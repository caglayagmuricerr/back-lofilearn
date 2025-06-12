const mongoose = require("mongoose");
const User = require("../models/User");
const Quiz = require("../models/Quiz");
const Question = require("../models/Question");

exports.getQuizzesByCreator = async (req, res) => {
  try {
    const { createdBy } = req.query;
    if (!createdBy) {
      return res
        .status(400)
        .json({ success: false, message: "createdBy is required." });
    }

    const quizzes = await Quiz.find({
      createdBy: new mongoose.Types.ObjectId(String(createdBy)),
    });

    res.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};

exports.getQuizzesByIds = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids array is required." });
    }

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
    const quizzes = await Quiz.find({ _id: { $in: objectIds } });
    console.log("Quizzes found:", quizzes);
    res.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};

exports.createQuiz = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "teacher") {
      return res
        .status(403)
        .json({ message: "Only teachers can create quizzes." });
    }

    const { title, description, questions } = req.body;

    if (!title || !questions || questions.length === 0) {
      return res
        .status(400)
        .json({ message: "Title and questions are required." });
    }

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const quiz = new Quiz({
      createdBy: userId,
      title,
      description,
      inviteCode,
      questions: [],
    });

    const savedQuiz = await quiz.save();

    const questionPromises = questions.map((questionData) => {
      const question = new Question({
        quizId: savedQuiz._id,
        type: questionData.type,
        text: questionData.text,
        options: questionData.options || [],
        correctAnswer: questionData.correctAnswer,
        explanation: questionData.explanation,
        image: questionData.image || null, // image URL
      });
      return question.save();
    });

    const savedQuestions = await Promise.all(questionPromises);

    savedQuiz.questions = savedQuestions.map((q) => q._id);
    await savedQuiz.save();

    res.status(201).json({
      message: "Quiz created successfully.",
      quiz: {
        _id: savedQuiz._id,
        title: savedQuiz.title,
        description: savedQuiz.description,
        inviteCode: savedQuiz.inviteCode,
        createdAt: savedQuiz.createdAt,
        questionCount: savedQuestions.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl: imageUrl,
    });
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

exports.inviteAllStudents = async (req, res) => {
  try {
    const { quizId } = req.body;
    if (!quizId) {
      return res
        .status(400)
        .json({ success: false, message: "quizId is required." });
    }

    const students = await User.find({ role: "student" });

    await Promise.all(
      students.map((student) =>
        User.updateOne(
          { _id: student._id, quizzesToTake: { $ne: quizId } },
          { $push: { quizzesToTake: quizId } }
        )
      )
    );

    res.status(200).json({ success: true, message: "All students invited." });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};
