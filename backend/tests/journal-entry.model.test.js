import test from "node:test";
import assert from "node:assert/strict";
import JournalEntry from "../models/journal-entry.model.js";

const baseEntry = {
  entryNumber: "JE-TEST-001",
  entryDate: "2026-06-04",
  sourceEntity: "invoice",
  sourceId: "source-1",
  sourceNumber: "INV-1",
  lines: [
    { accountCode: "1100", accountName: "Accounts Receivable", debit: 100.005, credit: 0 },
    { accountCode: "4000", accountName: "Sales Revenue", debit: 0, credit: 100.005 },
  ],
};

test("journal entry validation normalizes balanced totals", async () => {
  const entry = new JournalEntry(baseEntry);

  await entry.validate();

  assert.equal(entry.totals.debit, 100.01);
  assert.equal(entry.totals.credit, 100.01);
  assert.equal(entry.lines.length, 2);
});

test("journal entry validation rejects unbalanced postings", async () => {
  const entry = new JournalEntry({
    ...baseEntry,
    entryNumber: "JE-TEST-002",
    lines: [
      { accountCode: "1100", accountName: "Accounts Receivable", debit: 100, credit: 0 },
      { accountCode: "4000", accountName: "Sales Revenue", debit: 0, credit: 99 },
    ],
  });

  await assert.rejects(() => entry.validate(), /debit and credit totals must balance/i);
});
