const express = require("express");
const router = express.Router();
const { getUserInfo } = require("../controllers/userController");
const { requireAuth } = require("../middleware/authMiddleware");
/* const { getUser } = require("../middleware/userMiddleware");
 */
router.get("/", requireAuth, getUserInfo);

module.exports = router;
