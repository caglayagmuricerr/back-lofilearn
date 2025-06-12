const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
  type: {
    type: String,
    enum: ["multiple_choice", "true_false", "type_answer"],
    required: true,
  },
  text: { type: String, required: true },
  image: { type: String },
  options: [
    {
      text: { type: String },
      isCorrect: { type: Boolean },
    },
  ],
  correctAnswer: { type: String },
  explanation: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Question", questionSchema);
