const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./db");

const authRoutes = require("./routes/authRoutes");
const suggestionRoutes = require("./routes/suggestionRoutes");
const userRoutes = require("./routes/userRoutes");
const quizRoutes = require("./routes/quizRoutes");

const { limiter } = require("./middleware/rateLimitMiddleware");

require("./cronjobs/warnAndDeleteUser");

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV !== "test") {
  connectDB();
}

app.use("/api/auth", limiter, authRoutes);
app.use("/api/suggestions", limiter, suggestionRoutes);
app.use("/api/user", userRoutes);
app.use("/api/quizzes", quizRoutes);

module.exports = app;
