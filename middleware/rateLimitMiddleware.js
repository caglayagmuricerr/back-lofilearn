const { rateLimit } = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  limit: 100, // limit each IP to 100 requests per `window` (window = 15 mins).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // disable the `X-RateLimit-*` headers.
});

module.exports = { limiter };
