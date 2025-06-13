const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name can't be empty."],
      unique: [true, "This name is already in use."],
    },
    email: {
      type: String,
      required: [true, "Email can't be empty."],
      trim: true,
      unique: [true, "This email is already in use."],
      minLength: [10, "Invalid email."],
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password can't be empty."],
      trim: true,
      select: false, // const user = await User.findOne({ email }).select("+password");
      minLength: [6, "Password must be at least 6 characters."],
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "student",
    },
    profilePicture: {
      type: String,
      default:
        "https://www.creativefabrica.com/wp-content/uploads/2023/05/20/User-icon-Graphics-70077892-1.jpg",
    },
    lastLogin: { type: Date },
    isVerified: { type: Boolean, default: false },
    verificationOTP: { type: String },
    verificationOTPExpires: Date,
    resetPasswordOTP: { type: String },
    resetPasswordOTPExpires: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("User", userSchema);
