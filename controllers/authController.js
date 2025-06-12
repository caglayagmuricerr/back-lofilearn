const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");

const sendRes = require("../utils/sendRes");
const transporter = require("../utils/sendMail");
const logMail = require("../utils/logMail");
const generateOTP = require("../utils/otp");
const { profile } = require("console");

/* 
  Authentication controller for handling user registration, login, logout, email verification, password reset, and password change.

  - register: Registers a new user and sends a verification email.
  - login: Authenticates a user and generates a JWT token.
  - logout: Logs out a user by clearing the JWT token from cookies.
  - sendVerificationOTP: Sends a verification OTP to the user's email.
  - verifyEmail: Verifies the user's email using the OTP.
  - changePassword: Changes the user's password after verifying the old password. Requires the user to be logged in.
  - sendResetPasswordOTP: Sends a password reset OTP to the user's email. No need to be logged in.
  - resetPassword: Resets the user's password using the OTP.
*/

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  let role;

  if (!name || !email || !password) {
    return sendRes(res, 400, false, "All fields are required.");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return sendRes(res, 400, false, "This email is already registered.");
  }

  if (email.endsWith("@ogr.btu.edu.tr")) {
    role = "student";
  } else if (email.endsWith("@btu.edu.tr")) {
    role = "teacher";
  } else {
    return sendRes(
      res,
      400,
      false,
      "Only students and teachers of Bursa Technical University can register."
    );
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      lastLogin: Date.now(),
    });

    await user.save();

    const token = jwt.sign(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        quizzes: user.quizzes,
        profilePicture: user.profilePicture,
        lastLogin: user.lastLogin,
        isVerified: user.isVerified,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("Authorization", "Bearer " + token, {
      //httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // against CSRF
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });

    sendRes(
      res,
      201,
      true,
      "Registration successful. Please verify your email.",
      { role: user.role }
    );

    console.log("Role sent in response:", user.role);
  } catch (error) {
    /* if (error.cause.code === 11000) { // DOESN'T WORK WITH BROWSER
      // mongoose duplicate key error
      // console.log("ERROR OBJECT:", error);
      // console.log("ERROR CODE:", error.code); // returns undefined... adding cause to all errors fixed this
      const field = Object.keys(error.cause.keyPattern)[0];
      return sendRes(res, 400, false, `This ${field} is already in use.`);
    } */
    return sendRes(res, 500, false, error.message);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendRes(res, 400, false, "All fields are required.");
  }

  if (!email.endsWith("@ogr.btu.edu.tr") && !email.endsWith("@btu.edu.tr")) {
    return sendRes(
      res,
      400,
      false,
      "You have to be a student or a teacher of Bursa Technical University to use Lofi Learn."
    );
  }

  try {
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return sendRes(res, 401, false, "Invalid credentials"); // unauthorized
    }

    if (!user.isVerified) {
      return sendRes(
        res,
        403,
        false,
        "Please verify your email before logging in."
      ); // forbidden
    }
    user.lastLogin = Date.now();
    await user.save();

    const userForToken = user.toObject();
    delete userForToken.password;

    const token = jwt.sign(userForToken, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("Authorization", "Bearer " + token, {
      //httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 1 * 24 * 60 * 60 * 1000,
    });
    sendRes(res, 200, true, "Login successful");
  } catch (error) {
    return sendRes(res, 500, false, error.message);
  }
};

exports.logout = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return sendRes(res, 404, false, "User not found");
    }

    res.clearCookie("Authorization", {
      //httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return sendRes(res, 200, true, "Logged out");
  } catch (error) {
    return sendRes(res, 500, false, error.message);
  }
};

exports.sendVerificationOTP = async (req, res) => {
  const templatePath = path.join(
    __dirname,
    "../templates/verification_template.html"
  );
  let htmlTemplate = fs.readFileSync(templatePath, "utf8");

  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return sendRes(res, 404, false, "User not found");
    }

    if (user.isVerified) {
      return sendRes(res, 400, false, "Account already verified");
    }

    /*  TODO: i should add a message to register that says if your not getting any emails 
          make sure your email is correct
    */

    const OTP = generateOTP();
    user.verificationOTP = OTP;
    user.verificationOTPExpires = Date.now() + 1000 * 60 * 60 * 1; // 1 hour
    await user.save();

    htmlTemplate = htmlTemplate.replace("{{NAME}}", user.name);
    htmlTemplate = htmlTemplate.replace("{{OTP}}", OTP);

    const mailOptions = {
      from: `"Lofi Learn" <${process.env.SENDER_EMAIL}>`,
      to: user.email,
      subject: "Verify Your Email",
      html: htmlTemplate,
    };

    try {
      await transporter.sendMail(mailOptions);

      await logMail({
        userId: user._id,
        email: user.email,
        type: "EMAIL_VERIFICATION_OTP",
        status: "SENT",
        subject: mailOptions.subject,
        html: mailOptions.html,
      });

      return sendRes(res, 200, true, "Verification code sent to email");
    } catch (emailError) {
      await logMail({
        userId: user._id,
        email: user.email,
        type: "EMAIL_VERIFICATION_OTP",
        status: "FAILED",
        subject: mailOptions.subject,
        error: emailError.message,
      });

      return sendRes(res, 500, false, "Failed to send email. Try again.");
    }
  } catch (error) {
    return sendRes(res, 500, false, error.message);
  }
};

exports.verifyEmail = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user._id;

  if (!userId || !otp) {
    return sendRes(res, 400, false, "Missing credentials");
  }
  try {
    const user = await User.findById(userId);

    if (!user) {
      return sendRes(res, 404, false, "User not found");
    }

    if (user.isVerified) {
      return sendRes(res, 400, false, "Account already verified");
    }

    if (user.verificationOTP !== otp || user.verificationOTP === "") {
      return sendRes(res, 400, false, "Invalid OTP");
    }

    if (user.verificationOTPExpires < Date.now()) {
      return sendRes(res, 400, false, "OTP expired");
    }

    user.isVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;

    await user.save();

    return sendRes(res, 200, true, "Email verified successfully");
  } catch (error) {
    return sendRes(res, 500, false, error.message);
  }
};

// NOTE: IM NOT SURE IF THIS KIND OF PASSWORD CHANGE IS SECURE

exports.changePassword = async (req, res) => {
  const { _id, isVerified } = req.user;
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(_id).select("+password");
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

    if (!user) {
      return sendRes(res, 404, false, "User not found");
    }

    if (!oldPassword || !newPassword) {
      return sendRes(res, 400, false, "Missing credentials");
    }

    if (!isVerified) {
      return sendRes(res, 403, false, "User is not verified");
    }

    if (oldPassword === newPassword) {
      return sendRes(
        res,
        400,
        false,
        "New password cannot be the same as old password"
      );
    }

    if (!passwordRegex.test(newPassword)) {
      return sendRes(
        res,
        400,
        false,
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number"
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return sendRes(res, 400, false, "Old password is incorrect");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return sendRes(res, 200, true, "Password changed successfully");
  } catch (error) {
    return sendRes(res, 500, false, error.message);
  }
};

exports.sendResetPasswordOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });
    // NOTE: Why did I not use sendRes here? LMAO
    const OTP = generateOTP();
    user.resetPasswordOTP = OTP;
    user.resetPasswordOTPExpires = Date.now() + 1000 * 60 * 15; // 15 minutes
    await user.save();

    const mailOptions = {
      from: `"Lofi Learn" <${process.env.SENDER_EMAIL}>`,
      to: user.email,
      subject: "Reset your password",
      html: `<p>Your OTP to reset your password is: <strong>${OTP}</strong></p>
             <p>This OTP will expire in 15 minutes.</p>`,
    };

    try {
      await transporter.sendMail(mailOptions);

      await logMail({
        userId: user._id,
        email: user.email,
        type: "PASSWORD_RESET_OTP",
        status: "SENT",
        subject: mailOptions.subject,
        html: mailOptions.text,
      });

      return sendRes(res, 200, true, "Reset Password OTP sent to email");
    } catch (emailError) {
      await logMail({
        userId: user._id,
        email: user.email,
        type: "PASSWORD_RESET_OTP",
        status: "FAILED",
        subject: mailOptions.subject,
        error: emailError.message,
      });

      return sendRes(res, 500, false, "Failed to send email. Try again.");
    }
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
    // NOTE: Why did I not use sendRes here? LMAO
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

  try {
    const user = await User.findOne({ email });
    if (!user || user.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP or email." });
      // NOTE: Why did I not use sendRes here? LMAO
    }

    if (!passwordRegex.test(newPassword)) {
      return sendRes(
        res,
        400,
        false,
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number"
      );
    }

    if (user.resetPasswordOTPExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired." });
      // NOTE: Why did I not use sendRes here? LMAO
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully." });
    // NOTE: Why did I not use sendRes here? LMAO
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
    // NOTE: Why did I not use sendRes here? LMAO
  }
};
