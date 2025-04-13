const cron = require("node-cron");
const User = require("../models/User");

const cronProd = process.env.CRON_TIME_PROD;
const cronDev = process.env.CRON_TIME_DEV;
const cronTime = process.env.NODE_ENV === "production" ? cronProd : cronDev;

cron.schedule(cronTime, async () => {
  try {
    const result = await User.find({
      isVerified: true,
    });
    console.log(`Lofi Learn has ${result.length} verified users`);
  } catch (error) {
    console.error("Error :", error);
  }
});
