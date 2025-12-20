const API = "";

/* =======================
   CLIENT SIGNUP
======================= */
async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!name || !email || !password) {
    alert("All fields required");
    return;
  }

  const res = await fetch("/api/client/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();

  if (data.success) {
    alert("Account created. Verify email (check server logs)");
    window.location.href = "client-login.html";
  } else {
    alert(data.error || "Signup failed");
  }
}

/* =======================
   CLIENT LOGIN
======================= */
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/api/client/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("clientName", data.name);
    window.location.href = "client-dashboard.html";
  } else {
    alert(data.error || "Login failed");
  }
}

/* =======================
   AUTH GUARD
======================= */
function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "client-login.html";
  }
}

/* =======================
   LOGOUT
======================= */
function logout() {
  localStorage.clear();
  window.location.href = "client-login.html";
}
