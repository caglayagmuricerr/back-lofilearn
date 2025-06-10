const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");
const authMiddleware = require("../middleware/authMiddleware");

// /api/quizzes
router.post("/", authMiddleware, quizController.createQuiz);

// /api/quizzes/myquizzes
router.get("/myquizzes", authMiddleware, quizController.getMyQuizzes);

module.exports = router;
