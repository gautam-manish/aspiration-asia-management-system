import test from "node:test";
import assert from "node:assert/strict";
import customerPaymentRoutes from "../routes/customer-payment.routes.js";
import invoiceRoutes from "../routes/invoice.routes.js";
import journalEntryRoutes from "../routes/journal-entry.routes.js";
import officeExpenseRoutes from "../routes/office-expense.routes.js";
import vendorBillRoutes from "../routes/vendor-bill.routes.js";
import vendorPaymentRoutes from "../routes/vendor-payment.routes.js";

function stackFor(router) {
  return router.stack.map((layer) => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {}),
    names: layer.route?.stack?.map((handler) => handler.name) || [],
  }));
}

function hasHandler(router, path, method, handlerName) {
  return stackFor(router).some((route) =>
    route.path === path &&
    route.methods.includes(method) &&
    route.names.includes(handlerName)
  );
}

test("finance correction routes require admin guard", () => {
  for (const router of [customerPaymentRoutes, vendorPaymentRoutes, vendorBillRoutes, officeExpenseRoutes]) {
    assert.equal(hasHandler(router, "/:id", "put", "requireAdminRole"), true);
    assert.equal(hasHandler(router, "/:id/void", "patch", "requireAdminRole"), true);
  }
});

test("invoice destructive and correction routes require admin guard", () => {
  assert.equal(hasHandler(invoiceRoutes, "/:id", "put", "requireAdminRole"), true);
  assert.equal(hasHandler(invoiceRoutes, "/:id", "delete", "requireAdminRole"), true);
  assert.equal(hasHandler(invoiceRoutes, "/:id/advance/:advanceId", "delete", "requireAdminRole"), true);
});

test("journal backfill route requires admin guard", () => {
  assert.equal(hasHandler(journalEntryRoutes, "/backfill", "post", "requireAdminRole"), true);
});
