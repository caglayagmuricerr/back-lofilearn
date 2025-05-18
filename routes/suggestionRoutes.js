const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const suggestionController = require("../controllers/suggestionController");

// /api/suggestions
router.post(
  "/", 
  authMiddleware.requireAuth, 
  suggestionController.createSuggestion
);

module.exports = router;