const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const sendRes = require("../utils/sendRes");
const transporter = require("../utils/sendMail");
const logMail = require("../utils/logMail");
/* 
All the functions here are async because they perform asynchronous 
operations. Actions that don’t complete immediately 
and involve waiting (like reading/writing from a database, 
sending an email, or hashing a password).
*/

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  let role;

  if (!name || !email || !password) {
    return sendRes(res, 400, false, "All fields are required.");
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
      { _id: user._id, role: user.role, isVerified: user.isVerified },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("Authorization", "Bearer " + token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // against CSRF
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });

    sendRes(
      res,
      201,
      true,
      "Registration successful. Please verify your email."
    );
  } catch (error) {
    if (error.code === 11000) {
      // mongoose duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return sendRes(res, 400, false, `This ${field} is already in use.`);
    }
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
      return sendRes(res, 401, false, "Invalid credentials"); // Unauthorized
    }

    if (!user.isVerified) {
      return sendRes(
        res,
        403,
        false,
        "Please verify your email before logging in."
      ); // Forbidden
    }
    user.lastLogin = Date.now();
    await user.save();

    const token = jwt.sign(
      { _id: user._id, role: user.role, isVerified: user.isVerified },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("Authorization", "Bearer " + token, {
      httpOnly: true,
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
    res.clearCookie("Authorization", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return sendRes(res, 200, true, "Logged out");
  } catch (error) {
    return sendRes(res, 500, false, error.message);
  }
};

exports.sendVerificationOTP = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.isVerified) {
      return sendRes(res, 400, false, "Account already verified");
    }

    const OTP = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    user.verificationOTP = OTP;
    user.verificationOTPExpires = Date.now() + 1000 * 60 * 60 * 4; // 4 hours
    await user.save();

    const mailOptions = {
      from: `"Lofi Learn" <${process.env.SENDER_EMAIL}>`,
      to: user.email,
      subject: "Verify Your Email",
      text: `Your verification code is ${OTP}. It will expire in 4 hours.`,
    };

    try {
      await transporter.sendMail(mailOptions);

      await logMail({
        userId: user._id,
        email: user.email,
        type: "EMAIL_VERIFICATION_OTP",
        status: "SENT",
        subject: mailOptions.subject,
        text: mailOptions.text,
      });

      return sendRes(res, 200, true, "Verification code sent to email");
    } catch (emailError) {
      await logMail({
        userId: user._id,
        email: user.email,
        type: "EMAIL_VERIFICATION_OTP",
        status: "FAILED",
        subject: mailOptions.subject,
        text: emailError.message,
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

exports.changePassword = async (req, res) => {
  const { _id, isVerified } = req.user;
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(_id).select("+password");

    if (!user) {
      return sendRes(res, 404, false, "User not found");
    }

    if (!isVerified) {
      return sendRes(res, 403, false, "User is not verified");
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
