console.log("BOOTING SERVER...");

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

/* ================= ADMIN LOGIN ================= */
const ADMIN_EMAIL = "admin@ormpanel.com";
const ADMIN_PASSWORD = "admin123";

/* ================= DATABASE ================= */
const db = new sqlite3.Database("./db.sqlite");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    platform TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client TEXT,
    status TEXT,
    note TEXT,
    removal TEXT
  )`);
});

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.send("ORM Panel Backend Live 🚀");
});

/* ===== LOGIN API ===== */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* ===== CLIENT APIs ===== */
app.get("/api/clients", (req, res) => {
  db.all("SELECT * FROM clients", [], (err, rows) => {
    res.json(rows);
  });
});

app.post("/api/clients", (req, res) => {
  const { name, platform } = req.body;
  db.run(
    "INSERT INTO clients (name, platform) VALUES (?, ?)",
    [name, platform],
    () => res.json({ success: true })
  );
});

/* ===== REVIEW APIs ===== */
app.get("/api/reviews", (req, res) => {
  db.all("SELECT * FROM reviews", [], (err, rows) => {
    res.json(rows);
  });
});

app.post("/api/reviews", (req, res) => {
  const { client, status, note, removal } = req.body;
  db.run(
    "INSERT INTO reviews (client, status, note, removal) VALUES (?, ?, ?, ?)",
    [client, status, note, removal],
    () => res.json({ success: true })
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT:", PORT);
});
