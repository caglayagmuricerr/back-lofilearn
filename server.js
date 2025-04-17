const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const suggestionRoutes = require("./routes/suggestionRoutes");

const { limiter } = require("./middleware/rateLimitMiddleware");

require("./cronjobs/warnAndDeleteUser");

const PORT = process.env.PORT;

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.use("/api/auth", limiter, authRoutes);
app.use("/api/suggestions", limiter, suggestionRoutes);

app.listen(PORT, () =>
  console.log(
    `\n~~~~~~~~~~~~~~~~~~~~~~~~~~~\nServer running on port ${PORT}\n~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`
  )
);
