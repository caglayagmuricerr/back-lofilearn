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

exports.getStudentQuizzes = async (req, res) => {
  try {
    const { userId } = req.params;

    const quizzes = await Quiz.find({
      "participants.user": userId,
    })
      .populate("createdBy", "name")
      .select("title description inviteCode participants createdAt createdBy");

    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    console.error("Error fetching student quizzes:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
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
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (
      quiz.createdBy.toString() !== req.user.id &&
      req.user.role !== "teacher"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to invite students to this quiz" });
    }

    const students = await User.find({ role: "student" }).select("_id");

    if (students.length === 0) {
      return res.status(404).json({ message: "No students found" });
    }

    // get existing participant user IDs to avoid duplicates
    const existingParticipantIds = quiz.participants.map((p) =>
      p.user.toString()
    );

    // filter out students who are already participants
    const newStudents = students.filter(
      (student) => !existingParticipantIds.includes(student._id.toString())
    );

    if (newStudents.length === 0) {
      return res
        .status(400)
        .json({ message: "All students are already invited to this quiz" });
    }

    // create participant objects for new students
    const newParticipants = newStudents.map((student) => ({
      user: student._id,
      status: "invited",
    }));

    // add new participants to the quiz
    await Quiz.findByIdAndUpdate(quizId, {
      $push: {
        participants: { $each: newParticipants },
      },
    });

    res.status(200).json({
      message: `Successfully invited ${newParticipants.length} students to the quiz`,
      invitedCount: newParticipants.length,
      totalParticipants: quiz.participants.length + newParticipants.length,
    });
  } catch (error) {
    console.error("Error inviting all students:", error);
    res.status(500).json({ message: "Internal server error" });
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
