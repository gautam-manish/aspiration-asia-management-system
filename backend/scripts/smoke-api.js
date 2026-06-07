import "dotenv/config";

const baseUrl = String(process.env.SMOKE_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const username = process.env.SMOKE_USERNAME || "admin";
const password = process.env.SMOKE_PASSWORD || process.env.ADMIN_PASSWORD;

const checks = [
  { name: "Health", method: "GET", path: "/health", auth: false },
  { name: "AR Aging", method: "GET", path: "/reports/ar-aging", auth: true },
  { name: "AP Aging", method: "GET", path: "/reports/ap-aging", auth: true },
  { name: "Profitability", method: "GET", path: "/reports/booking-profitability", auth: true },
  { name: "Profit & Loss", method: "GET", path: "/reports/profit-loss", auth: true },
  { name: "Accounting Reconciliation", method: "GET", path: "/reports/accounting-reconciliation", auth: true },
];

async function request(path, { method = "GET", token = "", body = null } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${json?.message || response.statusText}`);
  }

  return json;
}

async function login() {
  if (!password) {
    throw new Error("SMOKE_PASSWORD or ADMIN_PASSWORD is required for authenticated smoke checks.");
  }

  const json = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });

  if (!json?.token) {
    throw new Error("Login succeeded but no token was returned.");
  }

  return json.token;
}

async function main() {
  console.log(`API smoke target: ${baseUrl}`);
  const token = await login();
  const results = [];

  for (const check of checks) {
    try {
      const json = await request(check.path, {
        method: check.method,
        token: check.auth ? token : "",
      });
      results.push({ name: check.name, status: "pass", success: json?.success ?? json?.status ?? true });
    } catch (error) {
      results.push({ name: check.name, status: "fail", success: error.message });
    }
  }

  console.table(results);
  const failed = results.filter((result) => result.status === "fail");
  if (failed.length) {
    throw new Error(`${failed.length} smoke check(s) failed.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
