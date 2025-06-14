const jwt = require("jsonwebtoken");
const Quiz = require("./models/Quiz");
const Question = require("./models/Question");

const lobbies = {};
const activeQuizzes = {};
/* 
lobbies holds players in different lobbies.
 
const lobbies = {
  "A63YHK": [player1, player2, player3],  
  "G6KDS2": [player6]                     
  "P3DCA9": [player4, player5],           
} 

player1 = {
  name: "Alice",
  role: "student"
}
player2 = {
  name: "Bob",
  role: "teacher"
}
*/

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

    console.log("User connected:", name, "(", role, ")");

    socket.data.username = name;
    socket.data.role = role;

    socket.on("join-lobby", ({ inviteCode }) => {
      //console.log(`${name} is trying to join lobby: ${inviteCode}`);

      socket.join(inviteCode);
      socket.data.inviteCode = inviteCode;

      if (!lobbies[inviteCode]) {
        lobbies[inviteCode] = [];
        //console.log(`Created new lobby: ${inviteCode}`);
      }
      lobbies[inviteCode] = lobbies[inviteCode].filter(
        (player) => player.name !== name
      );

      lobbies[inviteCode].push({ name, role });
      //console.log(`Lobby ${inviteCode} now has players:`, lobbies[inviteCode]);

      // emit updated player list to the lobby
      io.to(inviteCode).emit("lobby-update", {
        // Belirtilen inviteCode'a sahip lobiye "lobby-update" eventi gönderiliyor.
        // Bu event, lobiye katılan oyuncuların güncel listesini ve
        // katılım gerçekleşince gösterilecek mesajı iletiliyor.
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
      console.log("User disconnected:", socket.user.name);
    });

    // -----------------------------------------------//
    // ------------------ PLAYING --------------------//
    // -----------------------------------------------//

    socket.on("start-quiz", async ({ inviteCode }) => {
      try {
        if (!socket.data.role === "teacher") {
          return socket.emit("error", {
            message: "Only teachers can start quizzes",
          });
        }

        const quiz = await Quiz.findOne({ inviteCode }).populate("questions");
        if (!quiz) {
          return socket.emit("error", { message: "Quiz not found" });
        }

        const questions = quiz.questions;
        if (!questions || questions.length === 0) {
          return socket.emit("error", {
            message: "No questions found for this quiz",
          });
        }
        const students = lobbies[inviteCode].filter(
          (player) => player.role === "student"
        );

        activeQuizzes[inviteCode] = {
          currentQuestionIndex: 0,
          questions: questions,
          scores: {},
          timeRemaining: 0,
          questionTimer: null,
          answeredStudents: new Set(),
          totalStudents: students.length,
        };

        students.forEach((player) => {
          activeQuizzes[inviteCode].scores[player.name] = 0;
        });

        io.to(inviteCode).emit("quiz-started", {
          totalQuestions: questions.length,
          backgroundMusic: quiz.backgroundMusic,
        });

        startNextQuestion(inviteCode);
      } catch (error) {
        console.error("Error starting quiz:", error);
        socket.emit("error", { message: "Failed to start quiz" });
      }
    });

    socket.on("submit-answer", ({ questionId, answer, timeRemaining }) => {
      const inviteCode = socket.data.inviteCode;
      const username = socket.data.username;

      // only allowing students to submit answers
      if (socket.data.role !== "student") return;

      if (!activeQuizzes[inviteCode]) return;

      const quiz = activeQuizzes[inviteCode];
      const currentQuestion = quiz.questions[quiz.currentQuestionIndex];

      if (currentQuestion._id.toString() !== questionId) return;

      // checking if student already answered this question
      if (quiz.answeredStudents.has(username)) return;

      // marking student as answered
      quiz.answeredStudents.add(username);

      // calculating score based on time and being correct ( obviously )
      const correctAnswerIndex = currentQuestion.options.findIndex(
        (option) => option.isCorrect
      );
      if (answer === correctAnswerIndex) {
        const points = 10 + timeRemaining;
        quiz.scores[username] = (quiz.scores[username] || 0) + points;
      }

      // checking if all students have answered
      if (quiz.answeredStudents.size >= quiz.totalStudents) {
        clearInterval(quiz.questionTimer);
        endCurrentQuestion(inviteCode);
      }
    });
  });

  function startNextQuestion(inviteCode) {
    const quiz = activeQuizzes[inviteCode];
    if (!quiz) return;

    const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
    if (!currentQuestion) {
      endQuiz(inviteCode);
      return;
    }

    quiz.timeRemaining = currentQuestion.timeLimit;
    quiz.answeredStudents.clear();

    // sending question to all players
    io.to(inviteCode).emit("new-question", {
      question: {
        id: currentQuestion._id,
        question: currentQuestion.text,
        options: currentQuestion.options.map((opt) => opt.text),
        timeLimit: currentQuestion.timeLimit,
        image: currentQuestion.image,
      },
      questionIndex: quiz.currentQuestionIndex,
      timeLimit: currentQuestion.timeLimit,
    });

    quiz.questionTimer = setInterval(() => {
      quiz.timeRemaining--;

      io.to(inviteCode).emit("time-update", {
        timeLeft: quiz.timeRemaining,
      });

      if (quiz.timeRemaining <= 0) {
        clearInterval(quiz.questionTimer);
        endCurrentQuestion(inviteCode);
      }
    }, 1000);
  }

  function endCurrentQuestion(inviteCode) {
    const quiz = activeQuizzes[inviteCode];
    if (!quiz) return;

    const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
    const correctAnswerIndex = currentQuestion.options.findIndex(
      (option) => option.isCorrect
    );

    io.to(inviteCode).emit("question-ended", {
      correctAnswer: correctAnswerIndex,
      scores: quiz.scores,
    });

    // moving to next question after 2 sec delay
    setTimeout(() => {
      quiz.currentQuestionIndex++;
      startNextQuestion(inviteCode);
    }, 2000);
  }

  function endQuiz(inviteCode) {
    const quiz = activeQuizzes[inviteCode];
    if (!quiz) return;

    io.to(inviteCode).emit("quiz-ended", {
      finalScores: quiz.scores,
    });

    delete activeQuizzes[inviteCode];
  }
};
