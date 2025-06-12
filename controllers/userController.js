const sendRes = require("../utils/sendRes");

const getUserInfo = (req, res) => {
  const user = req.user;

  if (!user) {
    return sendRes(res, 401, false, "Not authenticated");
  }
  const userInfo = {
    name: user.name,
    email: user.email,
    role: user.role,
    profilePicture: user.profilePicture,
    quizzes: user.quizzes,
    lastLogin: user.lastLogin,
    isVerified: user.isVerified,
  };
  return sendRes(
    res,
    200,
    true,
    "User information retrieved successfully",
    userInfo
  );
};

module.exports = { getUserInfo };
