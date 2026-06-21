import test from "node:test";
import assert from "node:assert/strict";
import {
  convertAmountToNpr,
  createLockedInvoiceConversion,
  getNprExchangeRate,
  getStoredInvoiceNprTotal,
  normalizeCurrencyCode,
} from "../services/exchange-rate.service.js";

test("normalizes invoice symbols to ISO currency codes", () => {
  assert.equal(normalizeCurrencyCode("Rs."), "NPR");
  assert.equal(normalizeCurrencyCode("₹"), "INR");
  assert.equal(normalizeCurrencyCode("$"), "USD");
  assert.equal(normalizeCurrencyCode("eur"), "EUR");
});

test("uses static NPR and INR conversion rates without an API call", async () => {
  const failFetch = () => { throw new Error("fetch should not be called"); };
  assert.equal((await getNprExchangeRate({ currency: "NPR", date: "2026-06-20", fetchImpl: failFetch })).rate, 1);
  assert.equal((await getNprExchangeRate({ currency: "INR", date: "2026-06-20", fetchImpl: failFetch })).rate, 1.6);
});

test("uses the latest NRB publication on or before the invoice date", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      data: {
        payload: [
          { date: "2026-06-18", rates: [{ currency: { iso3: "USD", unit: 1 }, buy: "149.50" }] },
          { date: "2026-06-19", rates: [{ currency: { iso3: "USD", unit: 1 }, buy: "150.25" }] },
        ],
      },
    }),
  });
  const quote = await getNprExchangeRate({ currency: "USD", date: "2026-06-20", fetchImpl });
  assert.equal(quote.rate, 150.25);
  assert.equal(quote.rateDate, "2026-06-19");
  assert.equal(quote.rateType, "buying");
});

test("locks and converts an invoice total to NPR", async () => {
  const conversion = await createLockedInvoiceConversion({ currency: "₹", invoiceDate: "2026-06-20", total: 1000 });
  assert.equal(conversion.currencyCode, "INR");
  assert.equal(conversion.exchangeRateToNpr, 1.6);
  assert.equal(conversion.nprTotal, 1600);
  assert.ok(conversion.exchangeRateLockedAt instanceof Date);
  assert.equal(convertAmountToNpr(100.555, 1.6), 160.89);
});

test("reads locked totals and safely handles legacy NPR and INR invoices", () => {
  assert.equal(getStoredInvoiceNprTotal({ total: 100, currency: "$", exchangeRateToNpr: 150.25 }), 15025);
  assert.equal(getStoredInvoiceNprTotal({ total: 100, currency: "Rs." }), 100);
  assert.equal(getStoredInvoiceNprTotal({ total: 100, currency: "₹" }), 160);
  assert.throws(
    () => getStoredInvoiceNprTotal({ invoiceNumber: "ASA1", total: 100, currency: "$" }),
    /missing its locked NPR exchange rate/,
  );
});
