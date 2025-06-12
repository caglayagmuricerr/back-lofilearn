const jwt = require("jsonwebtoken");

const lobbies = {};

module.exports = (io) => {
  // auth middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);

      socket.user = decoded; // attach user data to socket
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-lobby", ({ inviteCode }) => {
      const name = socket.user.name;
      console.log(`${name} is trying to join lobby: ${inviteCode}`);
      socket.join(inviteCode);
      socket.data.username = name;

      if (!lobbies[inviteCode]) lobbies[inviteCode] = [];
      lobbies[inviteCode].push(name);

      // emit updated player list to the lobby
      io.to(inviteCode).emit("lobby-update", {
        players: lobbies[inviteCode],
        message: `${name} joined the lobby.`,
      });
    });

    socket.on("disconnecting", () => {
      for (const inviteCode of socket.rooms) {
        if (lobbies[inviteCode]) {
          lobbies[inviteCode] = lobbies[inviteCode].filter(
            (n) => n !== socket.data.username
          );
          io.to(inviteCode).emit("lobby-update", {
            players: lobbies[inviteCode],
            message: `${socket.data.username} left the lobby.`,
          });
        }
      }
    });

    // TODO: Handle quiz start, question submission, score updates, etc.
  });
};
