const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(
    `\n━━━━━━━━━━━━━━⊱⋆⊰━━━━━━━━━━━━━━\n\n  Server running on port ${PORT}\n\n━━━━━━━━━━━━━━⊱⋆⊰━━━━━━━━━━━━━━\n`
  )
);

