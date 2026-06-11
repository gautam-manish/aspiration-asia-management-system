import CustomerPayment from "../models/customer-payment.model.js";
import Invoice from "../models/invoice.model.js";
import { postCustomerPaymentJournal, reverseJournalEntry } from "./journal.service.js";
import { resolveBookingId } from "../utils/bookingRef.js";

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function nextPaymentNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `CP${y}${m}`;
  const count = await CustomerPayment.countDocuments({ paymentNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function cleanSlip(slip = {}) {
  return slip && slip.url
    ? {
        url: String(slip.url || "").trim(),
        fileName: String(slip.fileName || "").trim(),
        mimeType: String(slip.mimeType || "").trim(),
        size: Number(slip.size) || 0,
      }
    : { url: "", fileName: "", mimeType: "", size: 0 };
}

async function findInvoice(invoiceNumber) {
  const number = String(invoiceNumber || "").trim().toUpperCase();
  return number ? Invoice.findOne({ invoiceNumber: number }).lean() : null;
}

async function activePaymentForReference({ invoice, invoiceNumber, referenceCode, source, sourceRef }) {
  const reference = String(referenceCode || "").trim();
  if (!reference) return null;
  const number = String(invoiceNumber || invoice?.invoiceNumber || "").trim().toUpperCase();
  const scope = [
    invoice?._id ? { invoiceId: invoice._id } : null,
    number ? { invoiceNumber: number } : null,
  ].filter(Boolean);
  if (!scope.length) return null;

  return CustomerPayment.findOne({
    status: "posted",
    referenceCode: { $regex: `^${reference.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, $options: "i" },
    $or: scope,
    $nor: [{ source, sourceRef }],
  }).lean();
}

export async function upsertLegacyCustomerPayment(payload, user) {
  const amount = round(payload.amount);
  if (amount <= 0 || !payload.source || !payload.sourceRef) return null;

  const invoice = payload.invoice || await findInvoice(payload.invoiceNumber);
  const invoiceNumber = String(invoice?.invoiceNumber || payload.invoiceNumber || "").trim().toUpperCase();
  const duplicate = await activePaymentForReference({
    invoice,
    invoiceNumber,
    referenceCode: payload.referenceCode,
    source: payload.source,
    sourceRef: payload.sourceRef,
  });

  if (duplicate) {
    return duplicate;
  }

  const customer = {
    name: String(payload.customer?.name || invoice?.billTo?.name || "").trim(),
    email: String(payload.customer?.email || invoice?.billTo?.email || "").trim().toLowerCase(),
    phone: String(payload.customer?.phone || invoice?.billTo?.mobile || "").trim(),
    address: String(payload.customer?.address || invoice?.billTo?.address || "").trim(),
  };

  const data = {
    customerId: payload.customerId || invoice?.customerId || null,
    invoiceId: payload.invoiceId || invoice?._id || null,
    invoiceNumber,
    bookingId: String(payload.bookingId || invoice?.bookingId || "").trim(),
    customer,
    paymentDate: String(payload.paymentDate || new Date().toISOString().slice(0, 10)).trim(),
    amount,
    method: String(payload.method || "bank").trim().toLowerCase(),
    referenceCode: String(payload.referenceCode || "").trim(),
    bankAccountId: payload.bankAccountId || null,
    slip: cleanSlip(payload.slip),
    source: payload.source,
    sourceRef: String(payload.sourceRef),
    status: "posted",
    notes: String(payload.notes || "").trim(),
  };
  if (!data.bookingId) {
    throw new Error("Booking ID is required for synced customer payments.");
  }
  const bookingRef = await resolveBookingId(data.bookingId);
  if (bookingRef.error) {
    throw new Error(bookingRef.error);
  }
  data.bookingId = bookingRef.bookingId;

  let payment = await CustomerPayment.findOne({ source: data.source, sourceRef: data.sourceRef });
  if (invoice) {
    const relatedPayments = await CustomerPayment.find({
      status: "posted",
      ...(payment?._id ? { _id: { $ne: payment._id } } : {}),
      $or: [
        { invoiceId: invoice._id },
        { invoiceNumber: String(invoice.invoiceNumber || "").toUpperCase() },
      ],
    }).select("amount").lean();
    const paidBefore = relatedPayments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const outstanding = round((Number(invoice.total) || 0) - paidBefore);
    if (amount > outstanding + 0.009) {
      throw new Error(`Payment exceeds invoice outstanding balance (${outstanding.toFixed(2)}).`);
    }
  }

  if (payment) {
    if (payment.status === "void") return payment;
    Object.assign(payment, data);
    await payment.save();
  } else {
    payment = await CustomerPayment.create({
      ...data,
      paymentNumber: await nextPaymentNumber(),
    });
  }

  await postCustomerPaymentJournal(payment, user);
  return payment;
}

export async function voidLegacyCustomerPayments({ source, sourceRefs = [], sourceRefPrefix = "", notes = "", user }) {
  const filter = { source, status: "posted" };
  if (sourceRefs.length) {
    filter.sourceRef = { $in: sourceRefs.map(String) };
  } else if (sourceRefPrefix) {
    filter.sourceRef = { $regex: `^${sourceRefPrefix.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}` };
  } else {
    return;
  }

  const payments = await CustomerPayment.find(filter);
  for (const payment of payments) {
    payment.status = "void";
    payment.notes = notes || payment.notes || "Voided by legacy finance sync";
    await payment.save();
    await reverseJournalEntry({
      sourceEntity: "customer-payment",
      sourceId: payment._id,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `Customer payment ${payment.paymentNumber || ""} voided`.trim(),
      user,
    });
  }
}

export async function syncSalesRecordCustomerPayments(record, user) {
  if (!record) return;
  const invoice = await findInvoice(record.invoiceNumber);
  const activeRefs = [];

  for (const entry of record.paymentEntries || []) {
    const amount = round(entry.amount);
    if (amount <= 0) continue;
    const sourceRef = `${record._id}:${entry._id || ""}`;
    if (!sourceRef) continue;
    activeRefs.push(sourceRef);
    await upsertLegacyCustomerPayment({
      source: "sales-record",
      sourceRef,
      invoice,
      invoiceNumber: record.invoiceNumber,
      bookingId: record.bookingId || invoice?.bookingId || "",
      customer: {
        name: record.clientName,
        email: record.email,
        phone: record.phone,
        address: record.address,
      },
      paymentDate: entry.date || record.updatedAt?.toISOString?.().slice(0, 10),
      amount,
      method: "bank",
      referenceCode: entry.referenceCode,
      slip: entry.slip,
      notes: `Synced from Sales Record ${record.invoiceNumber || ""} (${record._id})`.trim(),
    }, user);
  }

  await voidLegacyCustomerPayments({
    source: "sales-record",
    sourceRefs: await staleSalesRecordRefs(record._id, activeRefs),
    notes: `Voided after Sales Record ${record.invoiceNumber || ""} update`.trim(),
    user,
  });
}

async function staleSalesRecordRefs(recordId, activeRefs) {
  const active = new Set(activeRefs.map(String));
  const payments = await CustomerPayment.find({
    source: "sales-record",
    status: "posted",
    sourceRef: { $regex: `^${String(recordId).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}:` },
  }).select("sourceRef").lean();
  return payments
    .filter((payment) => !active.has(String(payment.sourceRef)))
    .map((payment) => payment.sourceRef);
}

export async function voidSalesRecordCustomerPayments(recordId, user) {
  await voidLegacyCustomerPayments({
    source: "sales-record",
    sourceRefPrefix: `${recordId}:`,
    notes: "Voided after Sales Record deletion",
    user,
  });
}

export async function syncCashReceiptCustomerPayment(receipt, user) {
  if (!receipt) return null;
  return upsertLegacyCustomerPayment({
    source: "cash-receipt",
    sourceRef: receipt._id,
    invoiceNumber: receipt.invoiceNumber || "",
    bookingId: receipt.bookingId || "",
    customer: {
      name: receipt.name,
      email: receipt.email || "",
      phone: receipt.phone || "",
      address: receipt.address || "",
    },
    paymentDate: receipt.date || receipt.createdAt?.toISOString?.().slice(0, 10),
    amount: receipt.amount,
    method: String(receipt.paymentMethod || "cash").toLowerCase(),
    referenceCode: receipt.cashChequeNo || receipt.registrationNumber,
    bankAccountId: receipt.bankAccountId || null,
    notes: `Synced from Cash Receipt ${receipt.registrationNumber || ""}`.trim(),
  }, user);
}

export async function syncPurchaseRecordCredit(record, transaction, user) {
  if (!record || !transaction || transaction.type !== "cr") return null;
  return upsertLegacyCustomerPayment({
    source: "purchase-record",
    sourceRef: `${record._id}:${transaction._id}`,
    customer: {
      name: record.debtorName,
      email: record.debtorEmail,
      phone: record.debtorPhone,
      address: record.debtorAddress,
    },
    bookingId: transaction.bookingId || "",
    paymentDate: transaction.date,
    amount: transaction.amount,
    method: transaction.bank && transaction.bank !== "Cash" ? "bank" : "cash",
    referenceCode: transaction.refNo,
    notes: `Synced from Purchase Record ${record.debtorName || ""} (${record._id})`.trim(),
  }, user);
}

export async function voidPurchaseRecordCustomerPayments(recordId, user) {
  await voidLegacyCustomerPayments({
    source: "purchase-record",
    sourceRefPrefix: `${recordId}:`,
    notes: "Voided after Purchase Record deletion",
    user,
  });
}
