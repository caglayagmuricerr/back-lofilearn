const mongoose = require("mongoose");

const changePasswordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    oldPassword: {
      type: String,
      required: true,
    },
    newPassword: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("ChangePassword", changePasswordSchema);
