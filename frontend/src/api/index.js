import api from "./axios";

export const resolveUploadUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || /^data:/i.test(value) || /^blob:/i.test(value)) {
    return value;
  }

  const configuredOrigin = String(import.meta.env.VITE_UPLOAD_ORIGIN || import.meta.env.VITE_API_ORIGIN || "").trim();
  const isLocalFrontend = typeof window !== "undefined" && ["3000", "4173", "5173"].includes(window.location.port);
  const uploadOrigin = configuredOrigin || (isLocalFrontend ? `${window.location.protocol}//${window.location.hostname}:5000` : "");
  if (!uploadOrigin) return value;

  try {
    return new URL(value, uploadOrigin.endsWith("/") ? uploadOrigin : `${uploadOrigin}/`).toString();
  } catch {
    return value;
  }
};

// ── Auth ────────────────────────────────────────────────────────────
export const authAPI = {
  login:  (data)  => api.post("/auth/login", data),
  verify: (token) => api.get("/auth/verify", { headers: { Authorization: `Bearer ${token}` } }),
};

// ── Hotels ──────────────────────────────────────────────────────────
export const hotelAPI = {
  // Accepts either a search string (legacy) or { search, page, limit } object.
  getAll: (params = "") => {
    if (typeof params === "string") {
      return api.get(`/hotels?search=${encodeURIComponent(params)}`);
    }
    return api.get("/hotels", { params });
  },
  getById: (id)          => api.get(`/hotels/${id}`),
  create:  (data)        => api.post("/hotels", data),
  update:  (id, data)    => api.put(`/hotels/${id}`, data),
  remove:  (id)          => api.delete(`/hotels/${id}`),
};

// ── Bookings ────────────────────────────────────────────────────────
export const bookingAPI = {
  getNextId:    ()           => api.get("/bookings/next-id"),
  getByQueryId: (queryId)    => api.get(`/bookings/by-query-id/${queryId}`),
  getAll:       (params)     => api.get("/bookings", { params }),
  getById:      (id)         => api.get(`/bookings/${id}`),
  create:       (data)       => api.post("/bookings", data),
  update:       (id, data)   => api.put(`/bookings/${id}`, data),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  saveItinerary: (id, data)   => api.patch(`/bookings/${id}/itinerary`, data),
};

// ── Reservations ────────────────────────────────────────────────────
export const reservationAPI = {
  getAll:  (params)   => api.get("/reservations", { params }),
  getById: (id)       => api.get(`/reservations/${id}`),
  create:  (data)     => api.post("/reservations", data),
  update:  (id, data) => api.put(`/reservations/${id}`, data),
};

// ── Vouchers ────────────────────────────────────────────────────────
export const voucherAPI = {
  getAll:         (params)   => api.get("/vouchers", { params }),
  getById:        (id)       => api.get(`/vouchers/${id}`),
  getByBookingId: (bid)      => api.get(`/vouchers/by-booking/${bid}`),
  create:         (data)     => api.post("/vouchers", data),
  update:         (id, data) => api.put(`/vouchers/${id}`, data),
};

// ── Invoices ────────────────────────────────────────────────────────
export const invoiceAPI = {
  getAll:         (params)   => api.get("/invoices", { params }),
  getById:        (id)       => api.get(`/invoices/${id}`),
  getByBookingId: (bid)      => api.get(`/invoices/by-booking/${bid}`),
  getByNumber:    (num)      => api.get(`/invoices/by-number/${num}`),
  getNextNumber:  ()         => api.get("/invoices/next-number"),
  create:         (data)     => api.post("/invoices", data),
  update:         (id, data) => api.put(`/invoices/${id}`, data),
  remove:         (id)       => api.delete(`/invoices/${id}`),
  uploadAdvanceSlip: (file)  => {
    const fd = new FormData();
    fd.append("slip", file, file.name);
    return api.post("/invoices/upload-advance-slip", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  addAdvancePayment:    (id, data)        => api.post(`/invoices/${id}/advance`, data),
  removeAdvancePayment: (id, advanceId)   => api.delete(`/invoices/${id}/advance/${advanceId}`),
};

// ── Cash Receipts ───────────────────────────────────────────────────
export const cashReceiptAPI = {
  getAll:  (params) => api.get("/cash-receipts", { params }),
  getById: (id)     => api.get(`/cash-receipts/${id}`),
  create:  (data)   => api.post("/cash-receipts", data),
  remove:  (id)     => api.delete(`/cash-receipts/${id}`),
};

// Customer Payments
export const customerPaymentAPI = {
  getAll:  (params) => api.get("/customer-payments", { params }),
  getById: (id)     => api.get(`/customer-payments/${id}`),
  create:  (data)   => api.post("/customer-payments", data),
  update:  (id, data) => api.put(`/customer-payments/${id}`, data),
  void:    (id, data = {}) => api.patch(`/customer-payments/${id}/void`, data),
};

// Vendor Bills
export const vendorBillAPI = {
  getAll:  (params) => api.get("/vendor-bills", { params }),
  getById: (id)     => api.get(`/vendor-bills/${id}`),
  create:  (data)   => api.post("/vendor-bills", data),
  update:  (id, data) => api.put(`/vendor-bills/${id}`, data),
  void:    (id, data = {}) => api.patch(`/vendor-bills/${id}/void`, data),
  uploadTaxInvoiceSlip: (file) => {
    const fd = new FormData();
    fd.append("slip", file, file.name);
    return api.post("/vendor-bills/upload-tax-invoice-slip", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Vendor Payments
export const vendorPaymentAPI = {
  getAll:  (params) => api.get("/vendor-payments", { params }),
  getById: (id)     => api.get(`/vendor-payments/${id}`),
  create:  (data)   => api.post("/vendor-payments", data),
  update:  (id, data) => api.put(`/vendor-payments/${id}`, data),
  void:    (id, data = {}) => api.patch(`/vendor-payments/${id}/void`, data),
};

// Office Expenses
export const officeExpenseAPI = {
  getAll:  (params) => api.get("/office-expenses", { params }),
  getById: (id)     => api.get(`/office-expenses/${id}`),
  create:  (data)   => api.post("/office-expenses", data),
  update:  (id, data) => api.put(`/office-expenses/${id}`, data),
  void:    (id, data = {}) => api.patch(`/office-expenses/${id}/void`, data),
};

// Audit Logs
export const auditLogAPI = {
  getAll: (params) => api.get("/audit-logs", { params }),
};

// Journal Entries
export const journalEntryAPI = {
  getAll: (params) => api.get("/journal-entries", { params }),
  backfill: (data = {}) => api.post("/journal-entries/backfill", data),
};

// Reports
export const reportAPI = {
  getArAging: (params) => api.get("/reports/ar-aging", { params }),
  getApAging: (params) => api.get("/reports/ap-aging", { params }),
  getBookingProfitability: (params) => api.get("/reports/booking-profitability", { params }),
  getCustomerLedger: (params) => api.get("/reports/customer-ledger", { params }),
  getVendorLedger: (params) => api.get("/reports/vendor-ledger", { params }),
  getProfitLoss: (params) => api.get("/reports/profit-loss", { params }),
  getAccountingReconciliation: () => api.get("/reports/accounting-reconciliation"),
};

// ── Calculator ──────────────────────────────────────────────────────
export const calculatorAPI = {
  getAll:  ()           => api.get("/calculator"),
  getById: (id)         => api.get(`/calculator/${id}`),
  create:  (data)       => api.post("/calculator", data),
  update:  (id, data)   => api.put(`/calculator/${id}`, data),
  remove:  (id)         => api.delete(`/calculator/${id}`),
};

// ── Email ───────────────────────────────────────────────────────────
export const emailAPI = {
  sendPackageMail:    (data) => api.post("/mail/send-mail", data),
  sendReservationMail:(data) => api.post("/mail/send-reservation", data),
};

// ── Sundry ──────────────────────────────────────────────────────────
export const sundryAPI = {
  getAll:      (params) => api.get("/sundry", { params }),
  getById:     (id)     => api.get(`/sundry/${id}`),
  getNextCode: (params) => api.get("/sundry/next-code", { params }),
  getDropdown: (params) => api.get("/sundry/dropdown", { params }),
  create:      (data)   => api.post("/sundry", data),
  update:      (id, data) => api.put(`/sundry/${id}`, data),
};

// ── Sales Records ───────────────────────────────────────────────────
export const salesRecordAPI = {
  getAll:             (params)   => api.get("/salesrecords", { params }),
  getById:            (id)       => api.get(`/salesrecords/${id}`),
  getByInvoiceNumber: (num)      => api.get(`/salesrecords/by-invoice/${encodeURIComponent(num)}`),
  create:             (data)     => api.post("/salesrecords", data),
  update:             (id, data) => api.put(`/salesrecords/${id}`, data),
  remove:             (id)       => api.delete(`/salesrecords/${id}`),
  uploadSlip:         (file)     => {
    const fd = new FormData();
    fd.append("slip", file, file.name);
    return api.post("/salesrecords/upload-slip", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  removeSlip:         (url)      => api.delete(`/salesrecords/slip?url=${encodeURIComponent(url)}`),
};

// ── Purchase Records ────────────────────────────────────────────────
export const purchaseRecordAPI = {
  getAll:          (params)   => api.get("/purchaserecords", { params }),
  getById:         (id)       => api.get(`/purchaserecords/${id}`),
  getByDebtor:     (name)     => api.get(`/purchaserecords/by-debtor/${encodeURIComponent(name)}`),
  create:          (data)     => api.post("/purchaserecords", data),
  update:          (id, data) => api.put(`/purchaserecords/${id}`, data),
  remove:          (id)       => api.delete(`/purchaserecords/${id}`),
  addTransaction:  (id, data) => api.post(`/purchaserecords/${id}/transaction`, data),
  updateTransactionAttachment: (id, transactionId, data) => api.patch(`/purchaserecords/${id}/transactions/${transactionId}/attachment`, data),
  uploadAttachment: (file)    => {
    const fd = new FormData();
    fd.append("slip", file, file.name);
    return api.post("/purchaserecords/upload-attachment", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Bank Accounts ───────────────────────────────────────────────
export const bankAccountAPI = {
  getAll:          ()            => api.get("/bank-accounts"),
  getById:         (id, params)  => api.get(`/bank-accounts/${id}`, { params }),
  getDropdown:     ()            => api.get("/bank-accounts/dropdown"),
  create:          (data)        => api.post("/bank-accounts", data),
  update:          (id, data)    => api.put(`/bank-accounts/${id}`, data),
  remove:          (id)          => api.delete(`/bank-accounts/${id}`),
  addTransaction:  (id, data)    => api.post(`/bank-accounts/${id}/transaction`, data),
};
