console.log("BOOTING SERVER...");

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const Stripe = require("stripe");

const app = express();

/* ===== STRIPE RAW BODY (WEBHOOK KE LIYE) ===== */
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/v2", express.static("public/v2"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ===== ADMIN CREDS ===== */
const ADMIN_EMAIL = "admin@ormpanel.com";
const ADMIN_PASSWORD = "adminishuxuday";

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
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  try {
    req.admin = jwt.verify(token, ADMIN_JWT_SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
}

/* ===== ROOT ===== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/v2/index.html"));
});

/* ===== ADMIN LOGIN (JWT) ===== */
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD)
    return res.sendStatus(401);

  const token = jwt.sign({ role: "admin" }, ADMIN_JWT_SECRET, {
    expiresIn: "1d",
  });
  res.json({ token });
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
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: { name: "ORM Panel Premium" },
          unit_amount: 19900,
        },
        quantity: 1,
      },
    ],
    success_url: "https://orm-panel.onrender.com/v2/payment-success.html",
    cancel_url: "https://orm-panel.onrender.com/v2/payment-cancel.html",
    metadata: { userId: req.user.id },
  });

  res.json({ url: session.url });
});

/* ===== STRIPE WEBHOOK FUNCTION ===== */
function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;

    db.run("UPDATE client_users SET paid=1 WHERE id=?", [userId]);
  }

  res.json({ received: true });
}

/* ===== CLIENT DATA (PAID ONLY) ===== */
app.get("/api/my/reviews", authClient, requirePaid, (req, res) => {
  res.json([]);
});

/* ===== ADMIN USERS ===== */
app.get("/api/admin/users", adminAuth, (req, res) => {
  db.all("SELECT id,name,email,paid FROM client_users", [], (e, rows) =>
    res.json(rows)
  );
});

/* ===== START ===== */
app.listen(PORT, "0.0.0.0", () =>
  console.log("SERVER RUNNING ON", PORT)
);
