const jwt = require("jsonwebtoken");
const sendRes = require("../utils/sendRes");

const requireAuth = async (req, res, next) => {
  const token = req.cookies.Authorization?.split(" ")[1];

  if (!token) {
    return sendRes(
      res,
      401,
      false,
      "Unauthorized. Please log in to access this resource."
    );
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (decodedToken._id) {
      req.user = decodedToken; // named req.user to be more descriptive
    } else {
      return sendRes(
        res,
        401,
        false,
        "Unauthorized. Please log in to access this resource."
      );
    }
    next();
  } catch (error) {
    return sendRes(res, 401, false, "Invalid or expired token");
  }
};

module.exports = { requireAuth };
