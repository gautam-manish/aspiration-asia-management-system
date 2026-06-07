import test from "node:test";
import assert from "node:assert/strict";
import { validateEnv } from "../config/env.js";

test("env validation requires core secrets", () => {
  assert.throws(() => validateEnv({ NODE_ENV: "development" }), /MONGO_URI, JWT_SECRET/);
});

test("env validation accepts development minimums", () => {
  assert.equal(validateEnv({ NODE_ENV: "development", MONGO_URI: "mongodb://localhost/test", JWT_SECRET: "dev-secret" }), true);
});

test("env validation requires production CORS and strong JWT secret", () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: "production", MONGO_URI: "mongodb://localhost/test", JWT_SECRET: "short" }),
    /JWT_SECRET must be at least 32 characters|CORS_ORIGIN/,
  );
});

test("env validation accepts production requirements", () => {
  assert.equal(validateEnv({
    NODE_ENV: "production",
    MONGO_URI: "mongodb://localhost/test",
    JWT_SECRET: "a-production-secret-that-is-long-enough",
    CORS_ORIGIN: "https://example.com",
  }), true);
});
