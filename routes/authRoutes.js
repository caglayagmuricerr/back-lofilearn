const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const authController = require("../controllers/authController");

router.post("/register", authController.register); // api/auth/register

router.post("/login", authController.login); // api/auth/login

router.post("/logout", authMiddleware.requireAuth, authController.logout); // api/auth/logout

router.post(
  // api/auth/send-verification-otp
  "/send-verification-otp",
  authMiddleware.requireAuth,
  authController.sendVerificationOTP
);

router.post(
  // api/auth/verify-email
  "/verify-email",
  authMiddleware.requireAuth,
  authController.verifyEmail
);

router.patch(
  "/change-password",
  authMiddleware.requireAuth,
  authController.changePassword
); // api/auth/change-password

router.post(
  // api/auth/send-reset-password-otp
  "/send-reset-password-otp",
  authController.sendResetPasswordOTP
);

router.post(
  // api/auth/reset-password
  "/reset-password",
  authController.resetPassword
);

module.exports = router;
