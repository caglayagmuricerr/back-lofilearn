const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../utils/sendMail");
const logMail = require("../utils/logMail");

jest.mock("../utils/logMail");

describe("Auth Routes - POST /api/auth/<route>", () => {
  let name = "name";
  let studentEmail = "student@ogr.btu.edu.tr";
  let teacherEmail = "teacher@btu.edu.tr";
  let password = "Test12345";

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not defined");
    }
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Register", () => {
    test("FAIL | if a field is missing", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: name,
        email: studentEmail,
      }); // missing password intentionally
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("message", "All fields are required.");
    });

    test("FAIL | if email isn't a BTU email", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: name,
        email: "outside@gmail.com",
        password: password,
      });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.message).toMatch(/only students and teachers/i);
    });

    test("FAIL | because of duplicate name and email", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({ name: name, email: studentEmail, password });
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: name, email: studentEmail, password });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.message).toMatch(/already registered/i);
    });

    test.each([
      { email: studentEmail, expectedRole: "student" },
      { email: teacherEmail, expectedRole: "teacher" },
    ])(
      "SUCCESS | registering for BTU $expectedRole email",
      async ({ email, expectedRole }) => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({ name: name, email, password });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("message");
        expect(res.body.data).toHaveProperty("role", expectedRole);
      }
    );
  });

  describe("Login", () => {
    beforeEach(async () => {
      studentUser = await User.create({
        name: "Student",
        email: studentEmail,
        password: await bcrypt.hash(password, 10),
        role: "student",
        isVerified: false,
      });

      teacherUser = await User.create({
        name: "Teacher",
        email: teacherEmail,
        password: await bcrypt.hash(password, 10),
        role: "teacher",
        isVerified: false,
      });
    });

    test.each([
      { email: studentEmail, role: "student" },
      { email: teacherEmail, role: "teacher" },
    ])("FAIL | if a field is missing ($role)", async ({ email }) => {
      const res = await request(app).post("/api/auth/login").send({ email }); // missing password
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message", "All fields are required.");
    });

    test("FAIL | if email isn't a BTU email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@gmail.com", password });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(
        /a student or a teacher of Bursa Technical University/i
      );
    });

    test.each([
      { email: studentEmail, role: "student" },
      { email: teacherEmail, role: "teacher" },
    ])("FAIL | if credentials are wrong ($role)", async ({ email }) => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: email, password: "wrongpass" });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    test.each([
      { email: studentEmail, role: "student" },
      { email: teacherEmail, role: "teacher" },
    ])("FAIL | if not verified ($role)", async ({ email }) => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: email, password });
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/verify your email/i);
    });

    test.each([
      { email: studentEmail, role: "student", userVar: "studentUser" },
      { email: teacherEmail, role: "teacher", userVar: "teacherUser" },
    ])("SUCCESS | if verified ($role)", async ({ email, userVar }) => {
      const user = global[userVar]; // access the user created before each test
      user.isVerified = true; // simulate email verification
      await user.save();

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.message).toMatch(/login successful/i);
    });
  });

  describe("Logout", () => {
    beforeEach(async () => {
      await User.create({
        name: "Student",
        email: studentEmail,
        password: await bcrypt.hash(password, 10),
        role: "student",
        isVerified: false,
      });
      await User.create({
        name: "Teacher",
        email: teacherEmail,
        password: await bcrypt.hash(password, 10),
        role: "teacher",
        isVerified: false,
      });
    });
    test.each([
      { email: studentEmail, role: "student" },
      { email: teacherEmail, role: "teacher" },
    ])("SUCCESS | logout for $role", async ({ email }) => {
      // mark user as verified
      const user = await User.findOne({ email });
      user.isVerified = true;
      await user.save();

      // login to get cookie
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();

      // logout with cookie
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", cookies);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.message).toMatch(/logged out/i);
    });
  });

  describe("Send Verification OTP", () => {
    let unverifiedUser;
    let token;

    const generateToken = (user) =>
      jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    beforeEach(async () => {
      await User.deleteMany();

      unverifiedUser = await User.create({
        name: "Jane",
        email: "student@ogr.btu.edu.tr", // this is a mock email for testing im not sending real emails
        password: "Test12345",
        isVerified: false,
        role: "student",
      });

      token = generateToken(unverifiedUser);

      transporter.sendMail = jest.fn();
    });

    test("FAIL | User not found", async () => {
      await User.deleteMany(); // simulate user not found

      const res = await request(app)
        .post("/api/auth/send-verification-otp")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("FAIL | already verified", async () => {
      unverifiedUser.isVerified = true;
      await unverifiedUser.save();

      const res = await request(app)
        .post("/api/auth/send-verification-otp")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already verified/i);
    });

    test("SUCCESS | sends verification OTP email", async () => {
      transporter.sendMail.mockResolvedValue({}); // no error means success baby :D

      const res = await request(app)
        .post("/api/auth/send-verification-otp")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/verification code sent/i);
      expect(transporter.sendMail).toHaveBeenCalled();

      const updatedUser = await User.findById(unverifiedUser._id);
      expect(updatedUser.verificationOTP).toBeDefined(); // OTP should be set
      expect(updatedUser.verificationOTP).toHaveLength(6); // OTP should be 6 digits
      expect(updatedUser.verificationOTPExpires).toBeDefined(); // OTP expiration should be set
      expect(logMail).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: unverifiedUser._id,
          status: "SENT",
        })
      );
    });

    test("FAIL | transporter fails", async () => {
      transporter.sendMail.mockRejectedValue(new Error("SMTP error"));

      const res = await request(app)
        .post("/api/auth/send-verification-otp")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toMatch(/failed to send email/i);
      expect(logMail).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "FAILED",
        })
      );
    });
  });
  describe("Verify Email", () => {
    let unverifiedUser;
    let token;
    let validOTP = "123456";

    const generateToken = (user) =>
      jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    beforeEach(async () => {
      await User.deleteMany();

      unverifiedUser = await User.create({
        name: "Jane",
        email: "student@ogr.btu.edu.tr",
        password: "Test12345",
        isVerified: false,
        role: "student",
        verificationOTP: validOTP,
        verificationOTPExpires: Date.now() + 1000 * 60 * 60 * 4, // 4 hours from now
      });

      token = generateToken(unverifiedUser);
    });

    test("FAIL | Missing credentials", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({}); // no OTP provided

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/missing credentials/i);
    });

    test("FAIL | User not found", async () => {
      await User.deleteMany(); // simulate user not found

      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: validOTP });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/user not found/i);
    });

    test("FAIL | already verified", async () => {
      unverifiedUser.isVerified = true;
      await unverifiedUser.save();

      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: validOTP });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already verified/i);
    });

    test("FAIL | Invalid OTP", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: "000000" }); // wrong OTP

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid otp/i);
    });

    test("FAIL | OTP expired", async () => {
      // set OTP to be expired
      unverifiedUser.verificationOTPExpires = Date.now() - 1000;
      await unverifiedUser.save();

      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: validOTP });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/otp expired/i);
    });

    test("SUCCESS | Email verified", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: validOTP });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/email verified successfully/i);

      const updatedUser = await User.findById(unverifiedUser._id);
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.verificationOTP).toBeUndefined();
      expect(updatedUser.verificationOTPExpires).toBeUndefined();
    });

    test("FAIL | Server error", async () => {
      // mock a database error
      jest.spyOn(User, "findById").mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: validOTP });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
  describe("Change Password", () => {
    let verifiedUser;
    let token;
    const oldPassword = "OldPassword123";
    const newPassword = "NewPassword123";

    const generateToken = (user) =>
      jwt.sign(
        { _id: user._id, isVerified: user.isVerified },
        process.env.JWT_SECRET
      );

    beforeEach(async () => {
      await User.deleteMany();

      // create a verified user with known password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(oldPassword, salt);

      verifiedUser = await User.create({
        name: "John",
        email: "john@example.com",
        password: hashedPassword,
        isVerified: true,
        role: "student",
      });

      token = generateToken(verifiedUser);
    });

    test("FAIL | Missing credentials", async () => {
      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({}); // no old or new password provided

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/missing credentials/i);
    });

    test("FAIL | User not found", async () => {
      await User.deleteMany(); // simulate user not found

      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword, newPassword });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/user not found/i);
    });

    test("FAIL | User not verified", async () => {
      // create an unverified user
      const unverifiedUser = await User.create({
        name: "Unverified",
        email: "unverified@example.com",
        password: "TempPassword123",
        isVerified: false,
        role: "student",
      });
      const unverifiedToken = generateToken(unverifiedUser);

      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${unverifiedToken}`)
        .send({ oldPassword: "TempPassword123", newPassword });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not verified/i);
    });

    test("FAIL | Incorrect old password", async () => {
      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "WrongPassword123", newPassword });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/old password is incorrect/i);
    });

    test("SUCCESS | Password changed", async () => {
      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword, newPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/password changed successfully/i);

      // verifying the password was actually changed
      const updatedUser = await User.findById(verifiedUser._id).select(
        "+password"
      );
      const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isMatch).toBe(true);
    });

    test("FAIL | Server error", async () => {
      // mock db error
      jest.spyOn(User, "findById").mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword, newPassword });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test("FAIL | New password same as old password", async () => {
      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword, newPassword: oldPassword }); // same password

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/new password cannot be the same/i);
    });

    test("FAIL | New password doesn't meet requirements", async () => {
      const weakPassword = "weak";
      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword, newPassword: weakPassword });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /password must be at least 8 characters/i
      );
    });
  });

  describe("Send Reset Password OTP", () => {
    let user;

    beforeEach(async () => {
      await User.deleteMany();

      user = await User.create({
        name: "Jane",
        email: "student@ogr.btu.edu.tr",
        password: await bcrypt.hash("Test12345", 10),
        isVerified: true,
        role: "student",
      });

      transporter.sendMail = jest.fn(); // mock mail sending
    });

    test("FAIL | User not found", async () => {
      const res = await request(app)
        .post("/api/auth/send-reset-password-otp")
        .send({ email: "notfound@ogr.btu.edu.tr" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/user not found/i);
    });

    test("SUCCESS | OTP email sent", async () => {
      transporter.sendMail.mockResolvedValue({});

      const res = await request(app)
        .post("/api/auth/send-reset-password-otp")
        .send({ email: user.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/otp sent/i);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.resetPasswordOTP).toBeDefined();
      expect(updatedUser.resetPasswordOTP).toHaveLength(6);

      expect(transporter.sendMail).toHaveBeenCalled();
      expect(logMail).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user._id,
          email: user.email,
          status: "SENT",
        })
      );
    });

    test("FAIL | transporter fails to send OTP email", async () => {
      transporter.sendMail.mockRejectedValue(new Error("SMTP failure"));

      const res = await request(app)
        .post("/api/auth/send-reset-password-otp")
        .send({ email: user.email });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/failed to send email/i);

      expect(logMail).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user._id,
          email: user.email,
          status: "FAILED",
        })
      );
    });
  });
  describe("Reset Password", () => {
    let user;

    beforeEach(async () => {
      await User.deleteMany();

      user = await User.create({
        name: "Jane",
        email: "student@ogr.btu.edu.tr",
        password: await bcrypt.hash("OldPassword123", 10),
        isVerified: true,
        role: "student",
        resetPasswordOTP: "123456",
        resetPasswordOTPExpires: Date.now() + 10 * 60 * 1000,
      });
    });

    test("FAIL | User not found", async () => {
      const res = await request(app).post("/api/auth/reset-password").send({
        email: "notfound@ogr.btu.edu.tr",
        otp: "123456",
        newPassword: "NewPassword123",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid otp or email/i);
    });

    test("FAIL | Incorrect OTP", async () => {
      const res = await request(app).post("/api/auth/reset-password").send({
        email: user.email,
        otp: "000000", // wrong OTP
        newPassword: "NewPassword123",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid otp or email/i);
    });

    test("FAIL | Password does not meet criteria", async () => {
      const res = await request(app).post("/api/auth/reset-password").send({
        email: user.email,
        otp: "123456",
        newPassword: "short", // invalid password
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /password must be at least 8 characters/i
      );
    });

    test("FAIL | OTP expired", async () => {
      user.resetPasswordOTPExpires = Date.now() - 1000; // expired
      await user.save();

      const res = await request(app).post("/api/auth/reset-password").send({
        email: user.email,
        otp: "123456",
        newPassword: "NewPassword123",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/otp expired/i);
    });

    test("SUCCESS | Password reset", async () => {
      const res = await request(app).post("/api/auth/reset-password").send({
        email: user.email,
        otp: user.resetPasswordOTP,
        newPassword: "NewPassword123",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/password reset successfully/i);

      const updatedUser = await User.findById(user._id).select("+password");

      const isPasswordMatch = await bcrypt.compare(
        "NewPassword123",
        updatedUser.password
      );
      expect(isPasswordMatch).toBe(true);
      expect(updatedUser.resetPasswordOTP).toBeUndefined();
      expect(updatedUser.resetPasswordOTPExpires).toBeUndefined();
    });

    test("FAIL | Server error", async () => {
      // temporarily override findOne to simulate a DB error
      const originalFindOne = User.findOne;
      User.findOne = () => {
        throw new Error("DB error");
      };

      const res = await request(app).post("/api/auth/reset-password").send({
        email: user.email,
        otp: "123456",
        newPassword: "NewPassword123",
      });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Server error");
      expect(res.body.error).toMatch(/db error/i);

      // restore original function
      User.findOne = originalFindOne;
    });
  });
});
