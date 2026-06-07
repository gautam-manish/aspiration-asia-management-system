import test from "node:test";
import assert from "node:assert/strict";
import { allowAdmin, allowFinance, allowSalesFinance, allowSalesOps } from "../middleware/rbac.middleware.js";

function runGuard(guard, role) {
  let nextCalled = false;
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  guard({ user: { role } }, res, () => {
    nextCalled = true;
  });

  return { nextCalled, res };
}

test("admin passes every role guard", () => {
  for (const guard of [allowAdmin, allowFinance, allowSalesFinance, allowSalesOps]) {
    assert.equal(runGuard(guard, "admin").nextCalled, true);
  }
});

test("finance guard allows accountant and blocks sales", () => {
  assert.equal(runGuard(allowFinance, "accountant").nextCalled, true);

  const blocked = runGuard(allowFinance, "sales");
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.res.statusCode, 403);
  assert.match(blocked.res.body.message, /permission/i);
});

test("sales finance guard allows sales and accountant", () => {
  assert.equal(runGuard(allowSalesFinance, "sales").nextCalled, true);
  assert.equal(runGuard(allowSalesFinance, "accountant").nextCalled, true);
  assert.equal(runGuard(allowSalesFinance, "operations").res.statusCode, 403);
});

test("sales operations guard blocks accountant", () => {
  assert.equal(runGuard(allowSalesOps, "sales").nextCalled, true);
  assert.equal(runGuard(allowSalesOps, "operations").nextCalled, true);
  assert.equal(runGuard(allowSalesOps, "accountant").res.statusCode, 403);
});
