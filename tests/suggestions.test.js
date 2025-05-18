const mongoose = require('mongoose');
const request = require("supertest");
const app = require("../app");
const Suggestion = require("../models/Suggestion");

describe("Suggestions", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterEach(async () => {
    await Suggestion.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("POST /api/suggestions WITHOUT AUTH - should fail", async () => {
    const res = await request(app)
      .post("/api/suggestions")
      .send({       
        title: "Feedback",
        suggestion: "Thank you for this great app. Could you add ..."
      });
    
    expect([401, 403]).toContain(res.statusCode); 
  });

  test("POST /api/suggestions WITH AUTH - should succeed", async () => {
    const jwt = require("jsonwebtoken");
    const secret = process.env.JWT_SECRET;

    const mockUser = {
      _id: "userId123",
      name: "Test User",
      email: "test@example.com", 
      role: "student",
    };

    const token = jwt.sign(mockUser, secret, { expiresIn: "1h" });

    const res = await request(app)
      .post("/api/suggestions")
      .set("Cookie", [`Authorization=Bearer ${token}`])
      .send({
        name: "Test User",
        email: "test@example.com",
        title: "Feedback",
        suggestion: "Thank you for this great app. Could you add ..."
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "Suggestion saved.");
    
    const savedSuggestion = await Suggestion.findOne();
    expect(savedSuggestion).toBeTruthy();
  });
});