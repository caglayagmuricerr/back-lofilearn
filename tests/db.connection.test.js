const mongoose = require("mongoose");

describe("Database Connection", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("should connect to MongoDB", () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});