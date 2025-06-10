const Quiz = require("../models/Quiz");
const User = require("../models/User");

exports.createQuiz = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "teacher") {
      return res
        .status(403)
        .json({ message: "Only teachers can create quizzes." });
    }

    const { title, questions } = req.body;

    if (!title || questions.length === 0) {
      return res
        .status(400)
        .json({ message: "Title and questions are required." });
    }

    const quiz = new Quiz({
      createdBy: userId,
      title,
      questions,
    });

    await quiz.save();

    res.status(201).json({ message: "Quiz created successfully.", quiz });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

exports.getMyQuizzes = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "teacher") {
      return res
        .status(403)
        .json({ message: "Only teachers can view their quizzes." });
    }

    const quizzes = await Quiz.find({ createdBy: userId });

    res.status(200).json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};
