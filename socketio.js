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
    const name = socket.user.name;
    const role = socket.user.role;

    console.log("User connected:", name, role);

    socket.data.username = name;
    socket.data.role = role;

    socket.on("join-lobby", ({ inviteCode }) => {
      console.log(`${name} is trying to join lobby: ${inviteCode}`);

      socket.join(inviteCode);
      socket.data.inviteCode = inviteCode;

      if (!lobbies[inviteCode]) {
        lobbies[inviteCode] = [];
        console.log(`Created new lobby: ${inviteCode}`);
      }
      lobbies[inviteCode] = lobbies[inviteCode].filter(
        (player) => player.name !== name
      );

      lobbies[inviteCode].push({ name, role });
      console.log(`Lobby ${inviteCode} now has players:`, lobbies[inviteCode]);

      // emit updated player list to the lobby
      io.to(inviteCode).emit("lobby-update", {
        players: lobbies[inviteCode],
        message: `${name} joined the lobby.`,
      });
      console.log(`Emitted lobby-update to ${inviteCode}`);
    });

    socket.on("disconnecting", () => {
      console.log(`User ${socket.data.username} is disconnecting`);
      for (const inviteCode of socket.rooms) {
        if (lobbies[inviteCode]) {
          console.log(
            `Removing ${socket.data.username} from lobby ${inviteCode}`
          );
          lobbies[inviteCode] = lobbies[inviteCode].filter(
            (player) => player.name !== socket.data.username
          );

          io.to(inviteCode).emit("lobby-update", {
            players: lobbies[inviteCode],
            message: `${socket.data.username} left the lobby.`,
          });
          // if the lobby is empty, remove it
          if (lobbies[inviteCode].length === 0) {
            delete lobbies[inviteCode];
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.user?.name);
    });

    // TODO: Handle quiz start, question submission, score updates, etc.
  });
};
