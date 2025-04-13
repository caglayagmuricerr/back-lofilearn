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
      req.body.userId = decodedToken._id; // setting userId in req.body
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

const requireRole = (roles) => (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return sendRes(res, 401, false, "Unauthorized");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (!roles.includes(req.user.role)) {
      return sendRes(res, 403, false, "Forbidden");
    }
    next();
  } catch (error) {
    return sendRes(res, 401, false, "Invalid token");
  }
};
module.exports = { requireAuth, requireRole };
