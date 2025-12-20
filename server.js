console.log("BOOTING SERVER...");

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); // OLD public (admin + old files)
app.use("/v2", express.static("public/v2")); // NEW client system

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

/* =========================================================
   ROOT ENTRY POINT (SINGLE PUBLIC LINK)
   ========================================================= */
app.get("/", (req, res) => {
  // Client always lands on new SaaS landing page
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

/* ===== CLIENT SIGNUP ===== */
app.post("/api/client/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO client_users (name, email, password) VALUES (?, ?, ?)",
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email exists" });

      const verifyToken = jwt.sign(
        { id: this.lastID },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      console.log(
        "VERIFY LINK 👉 https://orm-panel.onrender.com/v2/verify.html?token=" +
          verifyToken
      );

      res.json({ success: true });
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
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

/* ===== CLIENT LOGIN (JWT) ===== */
app.post("/api/client/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM client_users WHERE email=?",
    [email],
    async (err, user) => {
      if (!user || !user.verified) {
        return res.status(401).json({ error: "Invalid or not verified" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: "Invalid" });

      const token = jwt.sign(
        { id: user.id, role: "client" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ token, name: user.name });
    }
  );
});

/* ===== FORGOT PASSWORD ===== */
app.post("/api/client/forgot", (req, res) => {
  const { email } = req.body;

  db.get(
    "SELECT id FROM client_users WHERE email=?",
    [email],
    (err, user) => {
      if (!user) return res.json({ success: true });

      const resetToken = jwt.sign(
        { id: user.id },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      console.log(
        "RESET LINK 👉 https://orm-panel.onrender.com/v2/reset.html?token=" +
          resetToken
      );

      res.json({ success: true });
    }
  );
});

/* ===== RESET PASSWORD ===== */
app.post("/api/client/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    const data = jwt.verify(token, JWT_SECRET);
    const hash = await bcrypt.hash(password, 10);

    db.run(
      "UPDATE client_users SET password=? WHERE id=?",
      [hash, data.id]
    );

    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

/* ===== CLIENT DATA (CLIENT-SPECIFIC) ===== */
app.get("/api/my/reviews", authClient, (req, res) => {
  db.all(
    "SELECT status, note, removal FROM reviews WHERE client_id=?",
    [req.user.id],
    (err, rows) => res.json(rows)
  );
});

/* ===== SERVER START ===== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT:", PORT);
});
