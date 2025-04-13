const mongoose = require("mongoose");

const suggestionSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    title: { type: String, required: true },
    suggestion: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Suggestion", suggestionSchema);
