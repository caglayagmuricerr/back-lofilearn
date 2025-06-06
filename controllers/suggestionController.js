const Suggestion = require("../models/Suggestion");

exports.createSuggestion = async (req, res) => {
  try {
    const { name, email, title, suggestion } = req.body;

    if (!title || !suggestion || suggestion.trim() === "") {
      return res.status(400).json({ 
        error: "Title and suggestion are required." 
      });
    }

    const newSuggestion = new Suggestion({
      name,
      email,
      title,
      suggestion,
    });

    await newSuggestion.save();

    res.status(201).json({ message: "Suggestion saved." });
  } catch (error) {
    console.error("Error saving suggestion:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};