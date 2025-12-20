function requireAuth() {
  if (!localStorage.getItem("token")) {
    location.href = "/v2/client-login.html";
  }
}

async function signup() {
  const name = nameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;

  const r = await fetch("/api/client/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (r.ok) {
    alert("Verify email (check server logs)");
    location.href = "/v2/client-login.html";
  } else alert("Signup failed");
}

async function login() {
  const r = await fetch("/api/client/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailInput.value,
      password: passwordInput.value,
    }),
  });

  const d = await r.json();
  if (d.token) {
    localStorage.setItem("token", d.token);
    localStorage.setItem("clientName", d.name);
    location.href = "/v2/client-dashboard.html";
  } else alert("Invalid login");
}

function logout() {
  localStorage.clear();
  location.href = "/v2/client-login.html";
}
