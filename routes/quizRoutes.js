const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");
const { requireAuth } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

router.get("/", quizController.getQuizzesByCreator);
// /api/quizzes
router.post("/", requireAuth, quizController.createQuiz);
router.post("/byIds", quizController.getQuizzesByIds);
router.get("/my-quizzes", requireAuth, quizController.getMyQuizzes); //teachers
router.post(
  "/upload-image",
  requireAuth,
  upload.single("image"),
  quizController.uploadImage
);
router.post("/invite-all", requireAuth, quizController.inviteAllStudents);

module.exports = router;
