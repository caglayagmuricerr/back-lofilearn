const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  inviteCode: { type: String },
  participants: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: {
        type: String,
        enum: ["invited", "completed"],
        default: "invited",
      },
      startTime: { type: Date },
    },
  ],
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  createdAt: { type: Date, default: Date.now },
  backgroundMusic: {
    type: String,
    default: "/uploads/lofi-background-music.mp3",
  },
});

module.exports = mongoose.model("Quiz", quizSchema);
