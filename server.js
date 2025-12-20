console.log("BOOTING SERVER...");

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/v2", express.static("public/v2"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/* ===== ADMIN CREDS ===== */
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
    verified INTEGER DEFAULT 1,
    paid INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    status TEXT,
    note TEXT,
    removal TEXT
  )`);
});

/* ===== MIDDLEWARE ===== */
function authClient(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.sendStatus(401);
  }
}

/* ===== ROOT ===== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/v2/index.html"));
});

/* ===== ADMIN LOGIN ===== */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

/* ===== CLIENT SIGNUP (AUTO VERIFIED) ===== */
app.post("/api/client/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO client_users (name,email,password,verified) VALUES (?,?,?,1)",
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email exists" });
      res.json({ success: true });
    }
  );
});

/* ===== CLIENT LOGIN ===== */
app.post("/api/client/login", (req, res) => {
  const { email, password } = req.body;
  db.get(
    "SELECT * FROM client_users WHERE email=?",
    [email],
    async (e, u) => {
      if (!u) return res.sendStatus(401);

      const ok = await bcrypt.compare(password, u.password);
      if (!ok) return res.sendStatus(401);

      const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, name: u.name });
    }
  );
});

/* ===== CLIENT DATA ===== */
app.get("/api/my/reviews", authClient, (req, res) => {
  db.all(
    "SELECT status,note,removal FROM reviews WHERE client_id=?",
    [req.user.id],
    (e, rows) => res.json(rows)
  );
});

/* ===== ADMIN ===== */
app.get("/api/admin/clients", (req, res) => {
  db.all(
    "SELECT id,name,email FROM client_users",
    [],
    (e, r) => res.json(r)
  );
});

app.post("/api/admin/reviews", (req, res) => {
  const { client_id, status, note, removal } = req.body;
  db.run(
    "INSERT INTO reviews (client_id,status,note,removal) VALUES (?,?,?,?)",
    [client_id, status, note, removal],
    () => res.json({ success: true })
  );
});

/* ===== START ===== */
app.listen(PORT, "0.0.0.0", () =>
  console.log("SERVER RUNNING ON", PORT)
);
