import Invoice from "../models/invoice.model.js";
import CustomerPayment from "../models/customer-payment.model.js";
import VendorBill from "../models/vendor-bill.model.js";
import VendorPayment from "../models/vendor-payment.model.js";
import Booking from "../models/booking.model.js";
import OfficeExpense from "../models/office-expense.model.js";
import PurchaseRecord from "../models/purchase-record.model.js";
import { buildAccountingReconciliation } from "../services/accounting-reconciliation.service.js";

const toDateOnly = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const daysBetween = (from, to) => {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
};

const bucketFor = (ageDays) => {
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  return "90+";
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const getArAging = async (req, res) => {
  try {
    const asOf = toDateOnly(req.query.asOf) || new Date().toISOString().slice(0, 10);
    const minBalance = Math.max(0, Number(req.query.minBalance) || 0.01);

    const invoices = await Invoice.find({ createdAt: { $lte: new Date(`${asOf}T23:59:59.999Z`) } })
      .select("invoiceNumber invoiceDate paymentTermsDays dueDate bookingId customerId billTo total currency createdAt")
      .sort({ invoiceDate: 1, createdAt: 1 })
      .lean();

    const invoiceIds = invoices.map((i) => i._id);
    const invoiceNumbers = invoices.map((i) => String(i.invoiceNumber || "").toUpperCase()).filter(Boolean);

    const payments = await CustomerPayment.find({
      status: "posted",
      paymentDate: { $lte: asOf },
      $or: [
        { invoiceId: { $in: invoiceIds } },
        { invoiceNumber: { $in: invoiceNumbers } },
      ],
    }).select("invoiceId invoiceNumber amount").lean();

    const paidByKey = new Map();
    for (const p of payments) {
      const keys = [];
      if (p.invoiceId) keys.push(String(p.invoiceId));
      if (p.invoiceNumber) keys.push(String(p.invoiceNumber).toUpperCase());
      for (const key of keys) {
        paidByKey.set(key, (paidByKey.get(key) || 0) + (Number(p.amount) || 0));
      }
    }

    const totals = {
      outstanding: 0,
      current: 0,
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };

    const rows = invoices
      .map((inv) => {
        const invoiceTotal = Number(inv.total) || 0;
        const paid = Math.max(
          paidByKey.get(String(inv._id)) || 0,
          paidByKey.get(String(inv.invoiceNumber || "").toUpperCase()) || 0,
        );
        const balance = Math.round((invoiceTotal - paid) * 100) / 100;
        if (balance < minBalance) return null;

        const invoiceDate = toDateOnly(inv.invoiceDate) || toDateOnly(inv.createdAt) || asOf;
        const dueDate = toDateOnly(inv.dueDate) || invoiceDate;
        const isCurrent = dueDate > asOf;
        const ageDays = isCurrent ? 0 : daysBetween(dueDate, asOf);
        const bucket = isCurrent ? "current" : bucketFor(ageDays);
        totals.outstanding += balance;
        totals[bucket] += balance;

        return {
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber || "",
          invoiceDate,
          paymentTermsDays: Number(inv.paymentTermsDays) || 0,
          dueDate,
          bookingId: inv.bookingId || "",
          customerId: inv.customerId || null,
          customerName: inv.billTo?.name || "",
          customerEmail: inv.billTo?.email || "",
          currency: inv.currency || "Rs.",
          invoiceTotal,
          paid,
          balance,
          ageDays,
          bucket,
          isOverdue: !isCurrent && ageDays > 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || b.ageDays - a.ageDays || b.balance - a.balance);

    for (const key of Object.keys(totals)) {
      totals[key] = Math.round(totals[key] * 100) / 100;
    }

    return res.status(200).json({
      success: true,
      data: {
        asOf,
        rows,
        totals,
      },
    });
  } catch (error) {
    console.error("getArAging error:", error);
    return res.status(500).json({ success: false, message: "Failed to build AR aging report.", data: null });
  }
};

export const getApAging = async (req, res) => {
  try {
    const asOf = toDateOnly(req.query.asOf) || new Date().toISOString().slice(0, 10);
    const minBalance = Math.max(0, Number(req.query.minBalance) || 0.01);

    const bills = await VendorBill.find({
      status: { $ne: "void" },
      billDate: { $lte: asOf },
      balance: { $gte: minBalance },
    })
      .select("billNumber vendorInvoiceNumber billDate dueDate bookingId vendorId vendor total amountPaid balance currency status")
      .sort({ billDate: 1, createdAt: 1 })
      .lean();

    const totals = {
      outstanding: 0,
      current: 0,
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };

    const rows = bills
      .map((bill) => {
        const agingDate = toDateOnly(bill.dueDate) || toDateOnly(bill.billDate) || asOf;
        const isCurrent = agingDate > asOf;
        const ageDays = isCurrent ? 0 : daysBetween(agingDate, asOf);
        const bucket = isCurrent ? "current" : bucketFor(ageDays);
        const balance = Math.round((Number(bill.balance) || 0) * 100) / 100;
        totals.outstanding += balance;
        totals[bucket] += balance;

        return {
          vendorBillId: bill._id,
          billNumber: bill.billNumber || "",
          vendorInvoiceNumber: bill.vendorInvoiceNumber || "",
          billDate: toDateOnly(bill.billDate),
          dueDate: toDateOnly(bill.dueDate),
          bookingId: bill.bookingId || "",
          vendorId: bill.vendorId || null,
          vendorName: bill.vendor?.name || bill.vendor?.company || "",
          vendorEmail: bill.vendor?.email || "",
          currency: bill.currency || "Rs.",
          billTotal: Number(bill.total) || 0,
          paid: Number(bill.amountPaid) || 0,
          balance,
          ageDays,
          bucket,
          isOverdue: !isCurrent && ageDays > 0,
          status: bill.status || "open",
        };
      })
      .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || b.ageDays - a.ageDays || b.balance - a.balance);

    for (const key of Object.keys(totals)) {
      totals[key] = Math.round(totals[key] * 100) / 100;
    }

    return res.status(200).json({
      success: true,
      data: {
        asOf,
        rows,
        totals,
      },
    });
  } catch (error) {
    console.error("getApAging error:", error);
    return res.status(500).json({ success: false, message: "Failed to build AP aging report.", data: null });
  }
};

export const getBookingProfitability = async (req, res) => {
  try {
    const { from = "", to = "", search = "" } = req.query;

    const invoiceFilter = {};
    const billFilter = { status: { $ne: "void" } };
    const purchaseFilter = {
      transactions: {
        $elemMatch: {
          type: "cr",
          bookingId: { $exists: true, $ne: "" },
        },
      },
    };

    if (from || to) {
      invoiceFilter.invoiceDate = {};
      billFilter.billDate = {};
      purchaseFilter.transactions.$elemMatch.date = {};
      if (from) {
        invoiceFilter.invoiceDate.$gte = String(from);
        billFilter.billDate.$gte = String(from);
        purchaseFilter.transactions.$elemMatch.date.$gte = String(from);
      }
      if (to) {
        invoiceFilter.invoiceDate.$lte = String(to);
        billFilter.billDate.$lte = String(to);
        purchaseFilter.transactions.$elemMatch.date.$lte = String(to);
      }
    }

    const [invoices, vendorBills, purchaseRecords] = await Promise.all([
      Invoice.find(invoiceFilter)
        .select("invoiceNumber invoiceDate bookingId customerId billTo total currency")
        .lean(),
      VendorBill.find(billFilter)
        .select("billNumber billDate bookingId vendor total currency status")
        .lean(),
      PurchaseRecord.find(purchaseFilter)
        .select("debtorName transactions")
        .lean(),
    ]);
    const purchaseCostRows = purchaseRecords.flatMap((record) => (record.transactions || [])
      .filter((txn) => txn.type === "cr" && String(txn.bookingId || "").trim())
      .filter((txn) => (!from || txn.date >= from) && (!to || txn.date <= to))
      .map((txn) => ({ record, txn })));

    const bookingIds = Array.from(new Set([
      ...invoices.map((i) => String(i.bookingId || "").trim()).filter(Boolean),
      ...vendorBills.map((b) => String(b.bookingId || "").trim()).filter(Boolean),
      ...purchaseCostRows.map(({ txn }) => String(txn.bookingId || "").trim()).filter(Boolean),
    ]));

    const bookings = bookingIds.length
      ? await Booking.find({ queryId: { $in: bookingIds } })
          .select("queryId customerId companyName clientName email destination arrivalDate departureDate status")
          .lean()
      : [];

    const bookingMap = new Map(bookings.map((b) => [String(b.queryId || ""), b]));
    const rowMap = new Map();

    const ensureRow = (bookingId) => {
      const key = bookingId || "UNLINKED";
      if (!rowMap.has(key)) {
        const booking = bookingMap.get(bookingId) || null;
        rowMap.set(key, {
        bookingId,
        bookingDbId: booking?._id || null,
        customerId: booking?.customerId || null,
          customerName: booking?.clientName || "",
          companyName: booking?.companyName || "",
          destination: booking?.destination || "",
          arrivalDate: toDateOnly(booking?.arrivalDate),
          departureDate: toDateOnly(booking?.departureDate),
          revenue: 0,
          directCost: 0,
          grossProfit: 0,
          marginPercent: 0,
          invoiceCount: 0,
          vendorBillCount: 0,
          purchaseRecordCostCount: 0,
          invoiceNumbers: [],
          vendorBillNumbers: [],
          purchaseRecordRefs: [],
          currency: "Rs.",
          month: "",
        });
      }
      return rowMap.get(key);
    };

    for (const inv of invoices) {
      const bookingId = String(inv.bookingId || "").trim();
      const row = ensureRow(bookingId);
      row.revenue += Number(inv.total) || 0;
      row.invoiceCount += 1;
      row.currency = inv.currency || row.currency || "Rs.";
      if (inv.invoiceNumber) row.invoiceNumbers.push(inv.invoiceNumber);
      if (!row.invoiceIds) row.invoiceIds = [];
      row.invoiceIds.push(inv._id);
      if (!row.customerName) row.customerName = inv.billTo?.name || "";
      if (!row.customerId) row.customerId = inv.customerId || null;
      const invoiceDate = toDateOnly(inv.invoiceDate);
      if (!row.month && invoiceDate) row.month = invoiceDate.slice(0, 7);
    }

    for (const bill of vendorBills) {
      const bookingId = String(bill.bookingId || "").trim();
      const row = ensureRow(bookingId);
      row.directCost += Number(bill.total) || 0;
      row.vendorBillCount += 1;
      row.currency = bill.currency || row.currency || "Rs.";
      if (bill.billNumber) row.vendorBillNumbers.push(bill.billNumber);
      if (!row.vendorBillIds) row.vendorBillIds = [];
      row.vendorBillIds.push(bill._id);
      const billDate = toDateOnly(bill.billDate);
      if (!row.month && billDate) row.month = billDate.slice(0, 7);
    }

    for (const { record, txn } of purchaseCostRows) {
      const bookingId = String(txn.bookingId || "").trim();
      const row = ensureRow(bookingId);
      row.directCost += Number(txn.amount) || 0;
      row.purchaseRecordCostCount += 1;
      if (txn.refNo) row.purchaseRecordRefs.push(txn.refNo);
      else if (record.debtorName) row.purchaseRecordRefs.push(record.debtorName);
      const txnDate = toDateOnly(txn.date);
      if (!row.month && txnDate) row.month = txnDate.slice(0, 7);
    }

    let rows = Array.from(rowMap.values()).map((row) => {
      const revenue = roundMoney(row.revenue);
      const directCost = roundMoney(row.directCost);
      const grossProfit = roundMoney(revenue - directCost);
      const marginPercent = revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : 0;
      return {
        ...row,
        revenue,
        directCost,
        grossProfit,
        marginPercent,
      };
    });

    if (search) {
      const q = String(search).trim().toLowerCase();
      rows = rows.filter((row) =>
        [
          row.bookingId,
          row.customerName,
          row.companyName,
          row.destination,
          ...(row.invoiceNumbers || []),
          ...(row.vendorBillNumbers || []),
          ...(row.purchaseRecordRefs || []),
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      );
    }

    rows.sort((a, b) => b.grossProfit - a.grossProfit || String(a.bookingId).localeCompare(String(b.bookingId)));

    const totals = rows.reduce((acc, row) => {
      acc.revenue += row.revenue;
      acc.directCost += row.directCost;
      acc.grossProfit += row.grossProfit;
      return acc;
    }, { revenue: 0, directCost: 0, grossProfit: 0, marginPercent: 0 });
    totals.revenue = roundMoney(totals.revenue);
    totals.directCost = roundMoney(totals.directCost);
    totals.grossProfit = roundMoney(totals.grossProfit);
    totals.marginPercent = totals.revenue > 0 ? roundMoney((totals.grossProfit / totals.revenue) * 100) : 0;

    const groupBy = (keyFn) => {
      const map = new Map();
      for (const row of rows) {
        const key = keyFn(row) || "Unassigned";
        if (!map.has(key)) map.set(key, { key, revenue: 0, directCost: 0, grossProfit: 0, count: 0, marginPercent: 0 });
        const item = map.get(key);
        item.revenue += row.revenue;
        item.directCost += row.directCost;
        item.grossProfit += row.grossProfit;
        item.count += 1;
      }
      return Array.from(map.values())
        .map((item) => ({
          ...item,
          revenue: roundMoney(item.revenue),
          directCost: roundMoney(item.directCost),
          grossProfit: roundMoney(item.grossProfit),
          marginPercent: item.revenue > 0 ? roundMoney((item.grossProfit / item.revenue) * 100) : 0,
        }))
        .sort((a, b) => b.grossProfit - a.grossProfit);
    };

    return res.status(200).json({
      success: true,
      data: {
        rows,
        totals,
        byCustomer: groupBy((row) => row.customerName || row.companyName),
        byDestination: groupBy((row) => row.destination),
        byMonth: groupBy((row) => row.month),
      },
    });
  } catch (error) {
    console.error("getBookingProfitability error:", error);
    return res.status(500).json({ success: false, message: "Failed to build booking profitability report.", data: null });
  }
};

export const getCustomerLedger = async (req, res) => {
  try {
    const { customerId = "", search = "", from = "", to = "" } = req.query;
    const invoiceFilter = {};
    const paymentFilter = { status: "posted" };

    if (customerId) {
      invoiceFilter.customerId = customerId;
      paymentFilter.customerId = customerId;
    }
    if (from || to) {
      invoiceFilter.invoiceDate = {};
      paymentFilter.paymentDate = {};
      if (from) {
        invoiceFilter.invoiceDate.$gte = String(from);
        paymentFilter.paymentDate.$gte = String(from);
      }
      if (to) {
        invoiceFilter.invoiceDate.$lte = String(to);
        paymentFilter.paymentDate.$lte = String(to);
      }
    }

    const purchaseFilter = {};
    if (from || to) {
      purchaseFilter.transactions = {
        $elemMatch: {
          type: "dr",
          ...(from ? { date: { $gte: String(from) } } : {}),
          ...(to ? { date: { ...(from ? { $gte: String(from) } : {}), $lte: String(to) } } : {}),
        },
      };
    }

    const [invoices, payments, purchaseRecords] = await Promise.all([
      Invoice.find(invoiceFilter)
        .select("invoiceNumber invoiceDate bookingId customerId billTo total currency")
        .lean(),
      CustomerPayment.find(paymentFilter)
        .select("paymentNumber paymentDate invoiceNumber bookingId customerId customer amount method referenceCode")
        .lean(),
      customerId ? [] : PurchaseRecord.find(purchaseFilter)
        .select("debtorName debtorEmail transactions")
        .lean(),
    ]);

    let entries = [
      ...invoices.map((inv) => ({
        sourceId: inv._id,
        sourcePath: `/invoices/${inv._id}`,
        date: toDateOnly(inv.invoiceDate),
        partyId: inv.customerId ? String(inv.customerId) : "",
        partyName: inv.billTo?.name || "Unassigned",
        partyEmail: inv.billTo?.email || "",
        reference: inv.invoiceNumber || "",
        bookingId: inv.bookingId || "",
        type: "invoice",
        description: "Customer invoice",
        debit: roundMoney(inv.total),
        credit: 0,
        currency: inv.currency || "Rs.",
      })),
      ...payments.map((payment) => ({
        sourceId: payment._id,
        sourcePath: `/customer-payments/${payment._id}`,
        date: toDateOnly(payment.paymentDate),
        partyId: payment.customerId ? String(payment.customerId) : "",
        partyName: payment.customer?.name || "Unassigned",
        partyEmail: payment.customer?.email || "",
        reference: payment.paymentNumber || payment.referenceCode || "",
        secondaryReference: payment.invoiceNumber || "",
        bookingId: payment.bookingId || "",
        type: "payment",
        description: `Customer payment${payment.method ? ` (${payment.method})` : ""}`,
        debit: 0,
        credit: roundMoney(payment.amount),
        currency: "Rs.",
      })),
      ...purchaseRecords.flatMap((record) => (record.transactions || [])
        .filter((txn) => txn.type === "dr")
        .filter((txn) => (!from || txn.date >= from) && (!to || txn.date <= to))
        .map((txn) => ({
          sourceId: txn._id,
          sourcePath: `/purchase-records/${record._id}`,
          date: toDateOnly(txn.date),
          partyId: "",
          partyName: record.debtorName || "Unassigned",
          partyEmail: record.debtorEmail || "",
          reference: txn.refNo || "",
          secondaryReference: "",
          bookingId: txn.bookingId || "",
          type: "purchase-record-debit",
          description: txn.description || "Purchase record debit",
          debit: roundMoney(txn.amount),
          credit: 0,
          currency: "Rs.",
        }))),
    ];

    if (search) {
      const q = String(search).trim().toLowerCase();
      entries = entries.filter((entry) =>
        [
          entry.partyName,
          entry.partyEmail,
          entry.reference,
          entry.secondaryReference,
          entry.bookingId,
          entry.description,
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      );
    }

    entries.sort((a, b) => {
      const partyCompare = String(a.partyName || "").localeCompare(String(b.partyName || ""));
      if (partyCompare !== 0) return partyCompare;
      const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.reference || "").localeCompare(String(b.reference || ""));
    });

    const runningByParty = new Map();
    entries = entries.map((entry) => {
      const key = entry.partyId || entry.partyName || "Unassigned";
      const nextBalance = roundMoney((runningByParty.get(key) || 0) + entry.debit - entry.credit);
      runningByParty.set(key, nextBalance);
      return { ...entry, balance: nextBalance };
    });

    const totals = entries.reduce((acc, entry) => {
      acc.debit += entry.debit;
      acc.credit += entry.credit;
      return acc;
    }, { debit: 0, credit: 0, balance: 0 });
    totals.debit = roundMoney(totals.debit);
    totals.credit = roundMoney(totals.credit);
    totals.balance = roundMoney(totals.debit - totals.credit);

    return res.status(200).json({ success: true, data: { entries, totals } });
  } catch (error) {
    console.error("getCustomerLedger error:", error);
    return res.status(500).json({ success: false, message: "Failed to build customer ledger.", data: null });
  }
};

export const getVendorLedger = async (req, res) => {
  try {
    const { vendorId = "", search = "", from = "", to = "" } = req.query;
    const billFilter = { status: { $ne: "void" } };
    const paymentFilter = { status: "posted" };

    if (vendorId) {
      billFilter.vendorId = vendorId;
      paymentFilter.vendorId = vendorId;
    }
    if (from || to) {
      billFilter.billDate = {};
      paymentFilter.paymentDate = {};
      if (from) {
        billFilter.billDate.$gte = String(from);
        paymentFilter.paymentDate.$gte = String(from);
      }
      if (to) {
        billFilter.billDate.$lte = String(to);
        paymentFilter.paymentDate.$lte = String(to);
      }
    }

    const [bills, payments] = await Promise.all([
      VendorBill.find(billFilter)
        .select("billNumber vendorInvoiceNumber billDate bookingId vendorId vendor total currency")
        .lean(),
      VendorPayment.find(paymentFilter)
        .select("paymentNumber paymentDate billNumber bookingId vendorId vendor amount method referenceCode")
        .lean(),
    ]);

    let entries = [
      ...bills.map((bill) => ({
        sourceId: bill._id,
        sourcePath: `/vendor-bills/${bill._id}`,
        date: toDateOnly(bill.billDate),
        partyId: bill.vendorId ? String(bill.vendorId) : "",
        partyName: bill.vendor?.name || bill.vendor?.company || "Unassigned",
        partyEmail: bill.vendor?.email || "",
        reference: bill.billNumber || "",
        secondaryReference: bill.vendorInvoiceNumber || "",
        bookingId: bill.bookingId || "",
        type: "vendor-bill",
        description: "Vendor bill",
        debit: 0,
        credit: roundMoney(bill.total),
        currency: bill.currency || "Rs.",
      })),
      ...payments.map((payment) => ({
        sourceId: payment._id,
        sourcePath: `/vendor-payments/${payment._id}`,
        date: toDateOnly(payment.paymentDate),
        partyId: payment.vendorId ? String(payment.vendorId) : "",
        partyName: payment.vendor?.name || payment.vendor?.company || "Unassigned",
        partyEmail: payment.vendor?.email || "",
        reference: payment.paymentNumber || payment.referenceCode || "",
        secondaryReference: payment.billNumber || "",
        bookingId: payment.bookingId || "",
        type: "vendor-payment",
        description: `Vendor payment${payment.method ? ` (${payment.method})` : ""}`,
        debit: roundMoney(payment.amount),
        credit: 0,
        currency: "Rs.",
      })),
    ];

    if (search) {
      const q = String(search).trim().toLowerCase();
      entries = entries.filter((entry) =>
        [
          entry.partyName,
          entry.partyEmail,
          entry.reference,
          entry.secondaryReference,
          entry.bookingId,
          entry.description,
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      );
    }

    entries.sort((a, b) => {
      const partyCompare = String(a.partyName || "").localeCompare(String(b.partyName || ""));
      if (partyCompare !== 0) return partyCompare;
      const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.reference || "").localeCompare(String(b.reference || ""));
    });

    const runningByParty = new Map();
    entries = entries.map((entry) => {
      const key = entry.partyId || entry.partyName || "Unassigned";
      const nextBalance = roundMoney((runningByParty.get(key) || 0) + entry.credit - entry.debit);
      runningByParty.set(key, nextBalance);
      return { ...entry, balance: nextBalance };
    });

    const totals = entries.reduce((acc, entry) => {
      acc.debit += entry.debit;
      acc.credit += entry.credit;
      return acc;
    }, { debit: 0, credit: 0, balance: 0 });
    totals.debit = roundMoney(totals.debit);
    totals.credit = roundMoney(totals.credit);
    totals.balance = roundMoney(totals.credit - totals.debit);

    return res.status(200).json({ success: true, data: { entries, totals } });
  } catch (error) {
    console.error("getVendorLedger error:", error);
    return res.status(500).json({ success: false, message: "Failed to build vendor ledger.", data: null });
  }
};

export const getProfitLoss = async (req, res) => {
  try {
    const { from = "", to = "" } = req.query;
    const invoiceFilter = {};
    const billFilter = { status: { $ne: "void" } };
    const expenseFilter = { status: "posted" };
    const purchaseFilter = {
      transactions: {
        $elemMatch: {
          type: "cr",
          bookingId: { $exists: true, $ne: "" },
        },
      },
    };

    if (from || to) {
      invoiceFilter.invoiceDate = {};
      billFilter.billDate = {};
      expenseFilter.expenseDate = {};
      purchaseFilter.transactions.$elemMatch.date = {};
      if (from) {
        invoiceFilter.invoiceDate.$gte = String(from);
        billFilter.billDate.$gte = String(from);
        expenseFilter.expenseDate.$gte = String(from);
        purchaseFilter.transactions.$elemMatch.date.$gte = String(from);
      }
      if (to) {
        invoiceFilter.invoiceDate.$lte = String(to);
        billFilter.billDate.$lte = String(to);
        expenseFilter.expenseDate.$lte = String(to);
        purchaseFilter.transactions.$elemMatch.date.$lte = String(to);
      }
    }

    const [invoices, vendorBills, officeExpenses, purchaseRecords] = await Promise.all([
      Invoice.find(invoiceFilter).select("invoiceNumber invoiceDate bookingId billTo total currency").lean(),
      VendorBill.find(billFilter).select("billNumber billDate bookingId vendor total currency").lean(),
      OfficeExpense.find(expenseFilter).select("expenseNumber expenseDate category paidTo description amount paymentMethod").lean(),
      PurchaseRecord.find(purchaseFilter).select("transactions").lean(),
    ]);
    const purchaseCostRows = purchaseRecords.flatMap((record) => (record.transactions || [])
      .filter((txn) => txn.type === "cr" && String(txn.bookingId || "").trim())
      .filter((txn) => (!from || txn.date >= from) && (!to || txn.date <= to)));

    const revenue = roundMoney(invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0));
    const directCost = roundMoney(
      vendorBills.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0)
      + purchaseCostRows.reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0),
    );
    const grossProfit = roundMoney(revenue - directCost);
    const operatingExpenses = roundMoney(officeExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0));
    const netProfit = roundMoney(grossProfit - operatingExpenses);
    const grossMarginPercent = revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : 0;
    const netMarginPercent = revenue > 0 ? roundMoney((netProfit / revenue) * 100) : 0;

    const byExpenseCategory = new Map();
    for (const expense of officeExpenses) {
      const key = expense.category || "other";
      if (!byExpenseCategory.has(key)) byExpenseCategory.set(key, { key, amount: 0, count: 0 });
      const row = byExpenseCategory.get(key);
      row.amount += Number(expense.amount) || 0;
      row.count += 1;
    }

    const monthMap = new Map();
    const ensureMonth = (dateValue) => {
      const month = toDateOnly(dateValue).slice(0, 7) || "Unassigned";
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, revenue: 0, directCost: 0, operatingExpenses: 0, grossProfit: 0, netProfit: 0 });
      }
      return monthMap.get(month);
    };
    for (const inv of invoices) ensureMonth(inv.invoiceDate).revenue += Number(inv.total) || 0;
    for (const bill of vendorBills) ensureMonth(bill.billDate).directCost += Number(bill.total) || 0;
    for (const txn of purchaseCostRows) ensureMonth(txn.date).directCost += Number(txn.amount) || 0;
    for (const expense of officeExpenses) ensureMonth(expense.expenseDate).operatingExpenses += Number(expense.amount) || 0;

    const byMonth = Array.from(monthMap.values())
      .map((row) => ({
        ...row,
        revenue: roundMoney(row.revenue),
        directCost: roundMoney(row.directCost),
        operatingExpenses: roundMoney(row.operatingExpenses),
        grossProfit: roundMoney(row.revenue - row.directCost),
        netProfit: roundMoney(row.revenue - row.directCost - row.operatingExpenses),
      }))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));

    return res.status(200).json({
      success: true,
      data: {
        totals: {
          revenue,
          directCost,
          grossProfit,
          operatingExpenses,
          netProfit,
          grossMarginPercent,
          netMarginPercent,
        },
        counts: {
          invoices: invoices.length,
          vendorBills: vendorBills.length,
          purchaseRecordCosts: purchaseCostRows.length,
          officeExpenses: officeExpenses.length,
        },
        byExpenseCategory: Array.from(byExpenseCategory.values())
          .map((row) => ({ ...row, amount: roundMoney(row.amount) }))
          .sort((a, b) => b.amount - a.amount),
        byMonth,
      },
    });
  } catch (error) {
    console.error("getProfitLoss error:", error);
    return res.status(500).json({ success: false, message: "Failed to build Profit & Loss report.", data: null });
  }
};

export const getAccountingReconciliation = async (_req, res) => {
  try {
    const report = await buildAccountingReconciliation();
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error("getAccountingReconciliation error:", error);
    return res.status(500).json({ success: false, message: "Failed to build accounting reconciliation report.", data: null });
  }
};
