const cron = require("node-cron");
const User = require("../models/User");
const transporter = require("../utils/sendMail");
const logMail = require("../utils/logMail");

if (process.env.NODE_ENV !== 'test') {
  cron.schedule("0 0 * * *", async () => {
    const today = new Date();
    const almostOneYearAgo = new Date(today);
    almostOneYearAgo.setFullYear(today.getFullYear() - 1);
    almostOneYearAgo.setDate(almostOneYearAgo.getDate() + 7);

    try {
      const usersToWarn = await User.find({
        lastLogin: { $lt: almostOneYearAgo },
        warnedForDeletion: { $ne: true },
      });

      for (const user of usersToWarn) {
        const mailOptions = {
          from: `"Lofi Learn" <${process.env.SENDER_EMAIL}>`,
          to: user.email,
          subject: "⚠️ Your account will be deleted in 7 days due to inactivity",
          text: `Hi ${
            user.name || "there"
          },\n\nYour account will be deleted in 7 days unless you log in.\n\nThanks.`,
        };

        try {
          await transporter.sendMail(mailOptions);
          user.warnedForDeletion = true;
          await user.save();

          await logMail({
            userId: user._id,
            email: user.email,
            type: "INACTIVITY_WARNING",
            status: "SENT",
            subject: mailOptions.subject,
            text: mailOptions.text,
          });
        } catch (emailError) {
          await logMail({
            userId: user._id,
            email: user.email,
            type: "INACTIVITY_WARNING",
            status: "FAILED",
            subject: mailOptions.subject,
            text: emailError.message,
          });
        }
      }
    } catch (error) {
      console.error("Error in scheduled job:", error);
    }
  });
}
