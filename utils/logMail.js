const EmailLog = require("../models/EmailLog");

const logMail = async ({ userId, email, type, status, subject, text }) => {
  try {
    await EmailLog.create({ userId, email, type, status, subject, text });
  } catch (err) {
    console.error("Failed to log email:", err.message);
  }
};

module.exports = logMail;
