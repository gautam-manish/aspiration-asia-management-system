const REQUIRED_ALWAYS = ["MONGO_URI", "JWT_SECRET"];
const REQUIRED_PRODUCTION = ["CORS_ORIGIN"];

export function validateEnv(env = process.env) {
  const missing = REQUIRED_ALWAYS.filter((key) => !String(env[key] || "").trim());

  if (env.NODE_ENV === "production") {
    missing.push(...REQUIRED_PRODUCTION.filter((key) => !String(env[key] || "").trim()));
    if (String(env.JWT_SECRET || "").trim().length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters in production.");
    }
  }

  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${Array.from(new Set(missing)).join(", ")}`);
  }

  return true;
}

export default validateEnv;
