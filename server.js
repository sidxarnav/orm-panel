console.log("BOOTING SERVER...");

const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("ORM Panel is Live 🚀");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT:", PORT);
});
