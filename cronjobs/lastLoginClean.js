const cron = require("node-cron");
const User = require("../models/User");

const cronProd = process.env.CRON_TIME_PROD;
const cronDev = process.env.CRON_TIME_DEV;
const cronTime = process.env.NODE_ENV === "production" ? cronProd : cronDev;

cron.schedule(cronTime, async () => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  try {
    await User.find({
      lastLogin: { $lt: oneYearAgo },
    });
  } catch (error) {
    console.error("Error deleting inactive users:", error);
  }
});
