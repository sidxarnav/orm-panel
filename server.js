console.log("BOOTING SERVER...");

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const Stripe = require("stripe");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/v2", express.static("public/v2"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ===== ADMIN CREDS ===== */
const ADMIN_EMAIL = "admin@ormpanel.com";
const ADMIN_PASSWORD = "adminishuxuday";
const ADMIN_KEY = "SUPER_ADMIN_KEY_123";

/* ===== DB ===== */
const db = new sqlite3.Database("./db.sqlite");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS client_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      verified INTEGER DEFAULT 1,
      paid INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      status TEXT,
      note TEXT,
      removal TEXT
    )
  `);
});

/* ===== MIDDLEWARE ===== */
function authClient(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

function requirePaid(req, res, next) {
  db.get(
    "SELECT paid FROM client_users WHERE id=?",
    [req.user.id],
    (e, u) => {
      if (!u || u.paid !== 1)
        return res.status(403).json({ error: "Payment required" });
      next();
    }
  );
}

function adminAuth(req, res, next) {
  if (req.headers.key !== ADMIN_KEY) return res.sendStatus(403);
  next();
}

/* ===== ROOT ===== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/v2/index.html"));
});

/* ===== ADMIN LOGIN ===== */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD)
    return res.json({ success: true });
  res.sendStatus(401);
});

/* ===== CLIENT SIGNUP ===== */
app.post("/api/client/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO client_users (name,email,password,verified) VALUES (?,?,?,1)",
    [name, email, hash],
    (err) => {
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
      res.json({ token, name: u.name, paid: u.paid });
    }
  );
});

/* ===== STRIPE CHECKOUT ===== */
app.post("/api/stripe/create-checkout", authClient, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: "ORM Panel Premium Access" },
            unit_amount: 19900,
          },
          quantity: 1,
        },
      ],
      success_url:
        "https://orm-panel.onrender.com/v2/payment-success.html",
      cancel_url:
        "https://orm-panel.onrender.com/v2/payment-cancel.html",
      metadata: { userId: req.user.id },
    });

    res.json({ url: session.url });
  } catch {
    res.status(500).json({ error: "Stripe error" });
  }
});

/* ===== PAYMENT CONFIRM ===== */
app.get("/api/payment/confirm", authClient, (req, res) => {
  db.run(
    "UPDATE client_users SET paid=1 WHERE id=?",
    [req.user.id],
    () => res.json({ success: true })
  );
});

/* ===== CLIENT DATA (PAID ONLY) ===== */
app.get("/api/my/reviews", authClient, requirePaid, (req, res) => {
  db.all(
    "SELECT status,note,removal FROM reviews WHERE client_id=?",
    [req.user.id],
    (e, rows) => res.json(rows)
  );
});

/* ===== ADMIN PANEL ===== */
app.get("/api/admin/users", adminAuth, (req, res) => {
  db.all(
    "SELECT id,name,email,paid FROM client_users",
    [],
    (e, rows) => res.json(rows)
  );
});

app.post("/api/admin/set-paid", adminAuth, (req, res) => {
  const { userId, paid } = req.body;
  db.run(
    "UPDATE client_users SET paid=? WHERE id=?",
    [paid, userId],
    () => res.json({ success: true })
  );
});

/* ===== START ===== */
app.listen(PORT, "0.0.0.0", () =>
  console.log("SERVER RUNNING ON", PORT)
);
