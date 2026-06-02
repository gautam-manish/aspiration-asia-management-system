import BankAccount    from "../models/bank-account.model.js";
import PurchaseRecord from "../models/purchase-record.model.js";

// ─────────────────────────────────────────
// GET ALL BANK ACCOUNTS (with computed balance)
// GET /api/bank-accounts
// ─────────────────────────────────────────
export const getAllBankAccounts = async (req, res) => {
  try {
    const banks = await BankAccount.find().sort({ bankName: 1 }).lean();

    // Collect all DR transactions from purchase records that reference each bank
    const purchaseRecords = await PurchaseRecord.find({}).lean();

    // Build a map: bankName → total debit amount from purchase records
    const debitMap = new Map();
    for (const pr of purchaseRecords) {
      for (const txn of pr.transactions || []) {
        if (txn.type === "dr" && txn.bank) {
          const prev = debitMap.get(txn.bank) || 0;
          debitMap.set(txn.bank, prev + (txn.amount || 0));
        }
      }
    }

    // Compute balance for each bank
    const data = banks.map((bank) => {
      const totalCredit = (bank.transactions || []).reduce(
        (sum, t) => sum + (t.amount || 0),
        0
      );
      const totalDebit = debitMap.get(bank.bankName) || 0;
      const balance =
        (bank.openingBalance || 0) + totalCredit - totalDebit;
      return {
        ...bank,
        totalCredit,
        totalDebit,
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

    // 1. Manual credit transactions from this bank
    const credits = (bank.transactions || []).map((t) => ({
      _id:         t._id,
      date:        t.date,
      refNo:       t.refNo,
      description: t.description,
      amount:      t.amount || 0,
      type:        "cr",
      source:      "manual",
    }));

    // 2. Debit transactions from purchase records matching this bank's name
    const purchaseRecords = await PurchaseRecord.find({}).lean();
    const debits = [];
    for (const pr of purchaseRecords) {
      for (const txn of pr.transactions || []) {
        if (txn.type === "dr" && txn.bank === bank.bankName) {
          debits.push({
            _id:         txn._id,
            date:        txn.date,
            refNo:       txn.refNo,
            description: txn.description || pr.debtorName,
            debtorName:  pr.debtorName,
            amount:      txn.amount || 0,
            type:        "dr",
            source:      "purchase",
          });
        }
      }
    }

    // 3. Merge & filter by date range
    let merged = [...credits, ...debits];
    if (from) merged = merged.filter((t) => t.date >= from);
    if (to)   merged = merged.filter((t) => t.date <= to);

    // 4. Sort by date ascending
    merged.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

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

    bank.transactions.push({
      date:        transaction.date,
      refNo:       transaction.refNo || "",
      description: transaction.description || "",
      amount:      Number(transaction.amount),
      type:        "cr",
    });

    await bank.save();

    return res.status(200).json({
      success: true,
      message: "Credit transaction added.",
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
