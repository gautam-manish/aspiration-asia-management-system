import BankAccount    from "../models/bank-account.model.js";
import PurchaseRecord from "../models/purchase-record.model.js";
import CustomerPayment from "../models/customer-payment.model.js";
import VendorPayment from "../models/vendor-payment.model.js";
import OfficeExpense from "../models/office-expense.model.js";

// ─────────────────────────────────────────
// GET ALL BANK ACCOUNTS (with computed balance)
// GET /api/bank-accounts
// ─────────────────────────────────────────
export const getAllBankAccounts = async (req, res) => {
  try {
    const banks = await BankAccount.find().sort({ bankName: 1 }).lean();

    // Aggregate only DR transactions from purchase records, grouped by bank name
    const debitAgg = await PurchaseRecord.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "dr", "transactions.bank": { $ne: "" } } },
      { $group: { _id: "$transactions.bank", total: { $sum: "$transactions.amount" } } },
    ]);

    const debitMap = new Map();
    for (const row of debitAgg) {
      debitMap.set(row._id, row.total || 0);
    }

    const [customerPaymentAgg, vendorPaymentAgg, officeExpenseAgg] = await Promise.all([
      CustomerPayment.aggregate([
        { $match: { status: "posted", bankAccountId: { $ne: null } } },
        { $group: { _id: "$bankAccountId", total: { $sum: "$amount" } } },
      ]),
      VendorPayment.aggregate([
        { $match: { status: "posted", bankAccountId: { $ne: null } } },
        { $group: { _id: "$bankAccountId", total: { $sum: "$amount" } } },
      ]),
      OfficeExpense.aggregate([
        { $match: { status: "posted", bankAccountId: { $ne: null } } },
        { $group: { _id: "$bankAccountId", total: { $sum: "$amount" } } },
      ]),
    ]);
    const customerPaymentMap = new Map(customerPaymentAgg.map((row) => [String(row._id), row.total || 0]));
    const vendorPaymentMap = new Map(vendorPaymentAgg.map((row) => [String(row._id), row.total || 0]));
    const officeExpenseMap = new Map(officeExpenseAgg.map((row) => [String(row._id), row.total || 0]));

    // Compute balance for each bank
    const data = banks.map((bank) => {
      const manualCredit = (bank.transactions || [])
        .filter((t) => t.type === "cr")
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const manualDebit = (bank.transactions || [])
        .filter((t) => t.type === "dr")
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const purchaseDebit = debitMap.get(bank.bankName) || 0;
      const customerPaymentCredit = customerPaymentMap.get(String(bank._id)) || 0;
      const vendorPaymentDebit = vendorPaymentMap.get(String(bank._id)) || 0;
      const officeExpenseDebit = officeExpenseMap.get(String(bank._id)) || 0;
      const totalCredit = manualCredit + customerPaymentCredit;
      const totalDebit = purchaseDebit + manualDebit + vendorPaymentDebit + officeExpenseDebit;
      const balance =
        (bank.openingBalance || 0) + totalCredit - totalDebit;
      return {
        ...bank,
        totalCredit,
        totalDebit,
        linkedTotals: {
          customerPaymentCredit,
          vendorPaymentDebit,
          officeExpenseDebit,
          purchaseDebit,
          manualCredit,
          manualDebit,
        },
        balance,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getAllBankAccounts error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch bank accounts." });
  }
};

// ─────────────────────────────────────────
// GET SINGLE BANK ACCOUNT WITH MERGED TRANSACTIONS
// GET /api/bank-accounts/:id?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────
export const getBankAccountById = async (req, res) => {
  try {
    const bank = await BankAccount.findById(req.params.id).lean();
    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found." });
    }

    const { from, to } = req.query;

    // 1. Manual transactions from this bank (both CR and DR/bank charges)
    const manualTxns = (bank.transactions || []).map((t) => ({
      _id:         t._id,
      date:        t.date,
      refNo:       t.refNo,
      description: t.description,
      amount:      t.amount || 0,
      type:        t.type || "cr",
      source:      t.type === "dr" ? "bank-charge" : "manual",
    }));

    // 2. Debit transactions from purchase records matching this bank's name (aggregation)
    const debitAgg = await PurchaseRecord.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "dr", "transactions.bank": bank.bankName } },
      { $project: {
          _id:         "$transactions._id",
          date:        "$transactions.date",
          refNo:       "$transactions.refNo",
          description: { $ifNull: ["$transactions.description", "$debtorName"] },
          debtorName:  "$debtorName",
          amount:      { $ifNull: ["$transactions.amount", 0] },
      }},
    ]);
    const debits = debitAgg.map((t) => ({
      ...t,
      type:   "dr",
      source: "purchase",
    }));

    const [customerPayments, vendorPayments, officeExpenses] = await Promise.all([
      CustomerPayment.find({ status: "posted", bankAccountId: bank._id })
        .select("paymentDate paymentNumber referenceCode customer amount")
        .lean(),
      VendorPayment.find({ status: "posted", bankAccountId: bank._id })
        .select("paymentDate paymentNumber referenceCode vendor amount")
        .lean(),
      OfficeExpense.find({ status: "posted", bankAccountId: bank._id })
        .select("expenseDate expenseNumber referenceCode paidTo description amount")
        .lean(),
    ]);
    const customerCredits = customerPayments.map((payment) => ({
      _id: payment._id,
      date: payment.paymentDate,
      refNo: payment.paymentNumber || payment.referenceCode || "",
      description: `Customer payment${payment.customer?.name ? ` - ${payment.customer.name}` : ""}`,
      amount: payment.amount || 0,
      type: "cr",
      source: "customer-payment",
    }));
    const vendorDebits = vendorPayments.map((payment) => ({
      _id: payment._id,
      date: payment.paymentDate,
      refNo: payment.paymentNumber || payment.referenceCode || "",
      description: `Vendor payment${payment.vendor?.name || payment.vendor?.company ? ` - ${payment.vendor?.name || payment.vendor?.company}` : ""}`,
      amount: payment.amount || 0,
      type: "dr",
      source: "vendor-payment",
    }));
    const officeDebits = officeExpenses.map((expense) => ({
      _id: expense._id,
      date: expense.expenseDate,
      refNo: expense.expenseNumber || expense.referenceCode || "",
      description: expense.description || `Office expense${expense.paidTo ? ` - ${expense.paidTo}` : ""}`,
      amount: expense.amount || 0,
      type: "dr",
      source: "office-expense",
    }));

    // 3. Merge & filter by date range
    let merged = [...manualTxns, ...debits, ...customerCredits, ...vendorDebits, ...officeDebits];
    if (from) merged = merged.filter((t) => t.date >= from);
    if (to)   merged = merged.filter((t) => t.date <= to);

    // 4. Sort by date ascending, then by _id (creation order) for same-date entries
    merged.sort((a, b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      if (d !== 0) return d;
      return String(a._id || "").localeCompare(String(b._id || ""));
    });

    // 5. Compute totals
    const totalCredit = merged
      .filter((t) => t.type === "cr")
      .reduce((s, t) => s + t.amount, 0);
    const totalDebit = merged
      .filter((t) => t.type === "dr")
      .reduce((s, t) => s + t.amount, 0);
    const balance = (bank.openingBalance || 0) + totalCredit - totalDebit;

    return res.status(200).json({
      success: true,
      data: {
        ...bank,
        mergedTransactions: merged,
        totalCredit,
        totalDebit,
        balance,
      },
    });
  } catch (error) {
    console.error("getBankAccountById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch bank account." });
  }
};

// ─────────────────────────────────────────
// CREATE BANK ACCOUNT
// POST /api/bank-accounts
// ─────────────────────────────────────────
export const createBankAccount = async (req, res) => {
  try {
    const {
      bankName,
      branch,
      accountName,
      accountNumber,
      codeType,
      codeValue,
      openingBalance,
    } = req.body;

    if (!bankName?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Bank name is required." });
    }

    const bank = new BankAccount({
      bankName:       bankName.trim(),
      branch:         branch || "",
      accountName:    accountName || "",
      accountNumber:  accountNumber || "",
      codeType:       codeType || "swift",
      codeValue:      codeValue || "",
      openingBalance: Number(openingBalance || 0),
      transactions:   [],
    });

    await bank.save();

    return res.status(201).json({
      success: true,
      message: "Bank account created successfully.",
      data: bank,
    });
  } catch (error) {
    console.error("createBankAccount error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create bank account." });
  }
};

// ─────────────────────────────────────────
// UPDATE BANK ACCOUNT INFO
// PUT /api/bank-accounts/:id
// ─────────────────────────────────────────
export const updateBankAccount = async (req, res) => {
  try {
    const allowedFields = [
      "bankName",
      "branch",
      "accountName",
      "accountNumber",
      "codeType",
      "codeValue",
      "openingBalance",
    ];

    const bank = await BankAccount.findById(req.params.id);
    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found." });
    }

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        bank[field] = req.body[field];
      }
    }

    await bank.save();

    return res.status(200).json({
      success: true,
      message: "Bank account updated.",
      data: bank,
    });
  } catch (error) {
    console.error("updateBankAccount error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update bank account." });
  }
};

// ─────────────────────────────────────────
// DELETE BANK ACCOUNT
// DELETE /api/bank-accounts/:id
// ─────────────────────────────────────────
export const deleteBankAccount = async (req, res) => {
  try {
    const bank = await BankAccount.findById(req.params.id);
    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found." });
    }

    await bank.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Bank account deleted.",
    });
  } catch (error) {
    console.error("deleteBankAccount error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete bank account." });
  }
};

// ─────────────────────────────────────────
// ADD MANUAL CREDIT TRANSACTION
// POST /api/bank-accounts/:id/transaction
// ─────────────────────────────────────────
export const addBankTransaction = async (req, res) => {
  try {
    const { transaction } = req.body;

    if (!transaction) {
      return res
        .status(400)
        .json({ success: false, message: "Transaction data is required." });
    }
    if (!transaction.date) {
      return res
        .status(400)
        .json({ success: false, message: "Transaction date is required." });
    }
    if (!transaction.amount || Number(transaction.amount) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Amount must be > 0." });
    }

    const bank = await BankAccount.findById(req.params.id);
    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found." });
    }

    const txnType = transaction.type === "dr" ? "dr" : "cr";

    bank.transactions.push({
      date:        transaction.date,
      refNo:       transaction.refNo || "",
      description: transaction.description || "",
      amount:      Number(transaction.amount),
      type:        txnType,
    });

    await bank.save();

    return res.status(200).json({
      success: true,
      message: txnType === "dr" ? "Bank charge added." : "Credit transaction added.",
      data: bank,
    });
  } catch (error) {
    console.error("addBankTransaction error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add transaction." });
  }
};

// ─────────────────────────────────────────
// GET BANK NAMES FOR DROPDOWN
// GET /api/bank-accounts/dropdown
// ─────────────────────────────────────────
export const getBankDropdown = async (req, res) => {
  try {
    const banks = await BankAccount.find()
      .select("bankName branch accountNumber")
      .sort({ bankName: 1 })
      .lean();
    return res.status(200).json({ success: true, data: banks });
  } catch (error) {
    console.error("getBankDropdown error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch bank list." });
  }
};
