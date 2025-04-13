const sendRes = (
  res,
  statusCode = 200,
  success = true,
  message = "",
  data = null
) => {
  res.status(statusCode).json({
    success,
    message,
    data,
  });
};
module.exports = sendRes;
