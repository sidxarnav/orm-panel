// ================== AUTH GUARD ==================
function requireAuth() {
  if (!localStorage.getItem("token")) {
    window.location.href = "/v2/client-login.html";
  }
}

// ================== SIGNUP ==================
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

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("clientName", data.name);
    window.location.href = "/v2/client-dashboard.html";
  } else {
    alert(data.error || "Signup failed");
  }
}

// ================== LOGIN ==================
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Email & password required");
    return;
  }

  const res = await fetch("/api/client/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("clientName", data.name);
    window.location.href = "/v2/client-dashboard.html";
  } else {
    alert("Invalid email or password");
  }
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "/v2/client-login.html";
}
