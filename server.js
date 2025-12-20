console.log("BOOTING SERVER...");

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = "super_secret_jwt_key_change_me";

/* ===== ADMIN ===== */
const ADMIN_EMAIL = "admin@ormpanel.com";
const ADMIN_PASSWORD = "adminishuxuday";

/* ===== DB ===== */
const db = new sqlite3.Database("./db.sqlite");
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS client_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    verified INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    status TEXT,
    note TEXT,
    removal TEXT
  )`);
});

/* ===== HELPERS ===== */
function authClient(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ===== ROOT ===== */
app.get("/", (req, res) => res.send("ORM Panel Live 🚀"));

/* ===== ADMIN LOGIN ===== */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD)
    return res.json({ success: true });
  res.status(401).json({ success: false });
});

/* ===== CLIENT SIGNUP ===== */
app.post("/api/client/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO client_users (name, email, password) VALUES (?, ?, ?)",
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email exists" });

      const verifyToken = jwt.sign({ id: this.lastID }, JWT_SECRET, { expiresIn: "1d" });
      console.log("VERIFY LINK 👉 http://localhost:3000/verify.html?token=" + verifyToken);
      res.json({ success: true, message: "Verify email (check server log)" });
    }
  );
});

/* ===== EMAIL VERIFY ===== */
app.post("/api/client/verify", (req, res) => {
  try {
    const { token } = req.body;
    const data = jwt.verify(token, JWT_SECRET);
    db.run("UPDATE client_users SET verified=1 WHERE id=?", [data.id]);
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Invalid/expired token" });
  }
});

/* ===== CLIENT LOGIN (JWT) ===== */
app.post("/api/client/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM client_users WHERE email=?", [email], async (e, u) => {
    if (!u || !u.verified) return res.status(401).json({ error: "Invalid / Not verified" });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: "Invalid" });

    const token = jwt.sign({ id: u.id, role: "client" }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, name: u.name });
  });
});

/* ===== FORGOT PASSWORD ===== */
app.post("/api/client/forgot", (req, res) => {
  const { email } = req.body;
  db.get("SELECT id FROM client_users WHERE email=?", [email], (e, u) => {
    if (!u) return res.json({ success: true });
    const t = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "15m" });
    console.log("RESET LINK 👉 http://localhost:3000/reset.html?token=" + t);
    res.json({ success: true });
  });
});

/* ===== RESET PASSWORD ===== */
app.post("/api/client/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    const d = jwt.verify(token, JWT_SECRET);
    const h = await bcrypt.hash(password, 10);
    db.run("UPDATE client_users SET password=? WHERE id=?", [h, d.id]);
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Invalid/expired" });
  }
});

/* ===== CLIENT DATA (MAPPED) ===== */
app.get("/api/my/reviews", authClient, (req, res) => {
  db.all(
    "SELECT status,note,removal FROM reviews WHERE client_id=?",
    [req.user.id],
    (e, rows) => res.json(rows)
  );
});

app.listen(PORT, "0.0.0.0", () =>
  console.log("SERVER STARTED ON PORT:", PORT)
);
