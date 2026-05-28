import api from "./axios";

// ── Auth ────────────────────────────────────────────────────────────
export const authAPI = {
  login:  (data)  => api.post("/auth/login", data),
  verify: (token) => api.get("/auth/verify", { headers: { Authorization: `Bearer ${token}` } }),
};

// ── Hotels ──────────────────────────────────────────────────────────
export const hotelAPI = {
  getAll:  (search = "") => api.get(`/hotels?search=${search}`),
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
  getAll:  (params)   => api.get("/vouchers", { params }),
  getById: (id)       => api.get(`/vouchers/${id}`),
  create:  (data)     => api.post("/vouchers", data),
  update:  (id, data) => api.put(`/vouchers/${id}`, data),
};

// ── Invoices ────────────────────────────────────────────────────────
export const invoiceAPI = {
  getAll:  (params)   => api.get("/invoices", { params }),
  getById: (id)       => api.get(`/invoices/${id}`),
  create:  (data)     => api.post("/invoices", data),
  update:  (id, data) => api.put(`/invoices/${id}`, data),
  remove:  (id)       => api.delete(`/invoices/${id}`),
};

// ── Cash Receipts ───────────────────────────────────────────────────
export const cashReceiptAPI = {
  getAll:  (params) => api.get("/cash-receipts", { params }),
  getById: (id)     => api.get(`/cash-receipts/${id}`),
  create:  (data)   => api.post("/cash-receipts", data),
  remove:  (id)     => api.delete(`/cash-receipts/${id}`),
};

// ── Calculator ──────────────────────────────────────────────────────
export const calculatorAPI = {
  getAll:  ()           => api.get("/calculator"),
  getById: (id)         => api.get(`/calculator/${id}`),
  create:  (data)       => api.post("/calculator", data),
  update:  (id, data)   => api.put(`/calculator/${id}`, data),
  remove:  (id)         => api.delete(`/calculator/${id}`),
};

// ── Clients ─────────────────────────────────────────────────────────
export const clientAPI = {
  getAll: ()     => api.get("/clients"),
  create: (data) => api.post("/clients", data),
  remove: (id)   => api.delete(`/clients/${id}`),
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
  getDropdown: (params) => api.get("/sundry/dropdown", { params }),
  create:      (data)   => api.post("/sundry", data),
  update:      (id, data) => api.put(`/sundry/${id}`, data),
};

// ── Sales Records ───────────────────────────────────────────────────
export const salesRecordAPI = {
  getAll:  (params)   => api.get("/salesrecords", { params }),
  getById: (id)       => api.get(`/salesrecords/${id}`),
  create:  (data)     => api.post("/salesrecords", data),
  update:  (id, data) => api.put(`/salesrecords/${id}`, data),
  remove:  (id)       => api.delete(`/salesrecords/${id}`),
};

// ── Purchase Records ────────────────────────────────────────────────
export const purchaseRecordAPI = {
  getAll:          (params)   => api.get("/purchaserecords", { params }),
  getById:         (id)       => api.get(`/purchaserecords/${id}`),
  create:          (data)     => api.post("/purchaserecords", data),
  update:          (id, data) => api.put(`/purchaserecords/${id}`, data),
  remove:          (id)       => api.delete(`/purchaserecords/${id}`),
  addTransaction:  (id, data) => api.post(`/purchaserecords/${id}/transaction`, data),
};
