const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  email: String,
  type: String, // "INACTIVITY_WARNING" "EMAIL_VERIFICATION_OTP" "PASSWORD_RESET_OTP" etc.
  status: String, // "SENT", "FAILED"
  subject: String,
  html: String,
  error: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("EmailLog", emailLogSchema);
