const jwt = require("jsonwebtoken");

module.exports = function (io) {
  io.use((socket, next) => {
    const token = socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket ${socket.id} connected as user ${socket.user._id}`);

    // CHAT FUNCTIONALITY
    socket.on("join-chat", () => {
      socket.join("public-chat");
      socket.to("public-chat").emit("user-joined", {
        userId: socket.user._id,
        username: socket.user.username,
        role: socket.user.role,
      });
    });

    socket.on("leave-chat", () => {
      socket.leave("public-chat");
      socket.to("public-chat").emit("user-left", {
        userId: socket.user._id,
        username: socket.user.username,
      });
    });

    socket.on("send-message", (data) => {
      const messageData = {
        messageId: Date.now(),
        userId: socket.user._id,
        username: socket.user.username,
        role: socket.user.role,
        message: data.message,
        timestamp: new Date().toISOString(),
      };
      io.to("public-chat").emit("new-message", messageData);
    });

    // QUIZ FUNCTIONALITY
    socket.on("join-quiz", (data) => {
      const quizRoom = `quiz-${data.quizId}`;
      socket.join(quizRoom);
      socket.to(quizRoom).emit("player-joined", {
        userId: socket.user._id,
        username: socket.user.username,
      });
    });

    socket.on("leave-quiz", (data) => {
      const quizRoom = `quiz-${data.quizId}`;
      socket.leave(quizRoom);
      socket.to(quizRoom).emit("player-left", {
        userId: socket.user._id,
        username: socket.user.username,
      });
    });

    socket.on("submit-answer", (data) => {
      const quizRoom = `quiz-${data.quizId}`;
      // Handle quiz answer logic here
      io.to(quizRoom).emit("answer-submitted", {
        userId: socket.user._id,
        questionId: data.questionId,
        answer: data.answer,
      });
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
      // Auto-leave all rooms on disconnect
    });

    socket.on("error", (error) => {
      console.error(`Socket ${socket.id} error:`, error);
      socket.emit("error", { message: "An error occurred", error });
    });
  });
};
