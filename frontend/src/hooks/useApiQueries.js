
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authAPI,
  hotelAPI,
  bookingAPI,
  reservationAPI,
  voucherAPI,
  invoiceAPI,
  cashReceiptAPI,
  customerPaymentAPI,
  vendorBillAPI,
  vendorPaymentAPI,
  officeExpenseAPI,
  auditLogAPI,
  journalEntryAPI,
  calculatorAPI,
  sundryAPI,
  salesRecordAPI,
  purchaseRecordAPI,
  bankAccountAPI,
  reportAPI,
} from "../api";

// ── Bookings ────────────────────────────────────────────────────────────────
export function useBookings({ status = "confirmed", search = "" } = {}) {
  return useQuery({
    queryKey: ["bookings", { status, search }],
    queryFn: () => bookingAPI.getAll({ status, search }).then((r) => r.data?.data ?? []),
  });
}

// Paginated variant for the Bookings list page.
export function useBookingsPaginated({ status = "confirmed", search = "", date = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["bookings", "paginated", { status, search, date, page, limit }],
    queryFn: () => bookingAPI.getAll({ status, search, date, page, limit }).then((r) => ({
      bookings:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useBooking(id) {
  return useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useBookingByQueryId(queryId, opts = {}) {
  return useQuery({
    queryKey: ["booking", "by-query-id", queryId],
    queryFn: () => bookingAPI.getByQueryId(queryId).then((r) => r.data?.data),
    enabled: !!queryId && !!opts.enabled,
    ...opts,
  });
}

export function useBookingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
  };

  return {
    create: useMutation({
      mutationFn: (data) => bookingAPI.create(data).then((r) => r.data?.data),
      onSuccess: (created) => {
        if (created?._id) qc.setQueryData(["booking", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => bookingAPI.update(id, data).then((r) => r.data?.data),
      onSuccess: (updated, { id }) => {
        if (updated) qc.setQueryData(["booking", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["booking", id] });
      },
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, status }) => bookingAPI.updateStatus(id, status).then((r) => r.data?.data),
      onSuccess: (updated, { id }) => {
        if (updated) qc.setQueryData(["booking", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["booking", id] });
      },
    }),
    saveItinerary: useMutation({
      mutationFn: ({ id, data }) => bookingAPI.saveItinerary(id, data).then((r) => r.data?.data),
      onSuccess: (updated, { id }) => {
        if (updated) qc.setQueryData(["booking", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["booking", id] });
      },
    }),
  };
}

// ── Hotels ──────────────────────────────────────────────────────────────────
// Returns the full hotel list (no pagination). Used by autocomplete dropdowns.
export function useHotels(search = "") {
  return useQuery({
    queryKey: ["hotels", { search }],
    queryFn: () => hotelAPI.getAll(search).then((r) => r.data?.data ?? []),
  });
}

// Paginated variant for the Hotels list page.
// Returns { hotels, total, page, limit, totalPages } so the page can render a footer.
export function useHotelsPaginated({ search = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["hotels", "paginated", { search, page, limit }],
    queryFn: () => hotelAPI.getAll({ search, page, limit }).then((r) => ({
      hotels:     r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev, // smooth page transitions, no spinner flash
  });
}

export function useHotel(id) {
  return useQuery({
    queryKey: ["hotel", id],
    queryFn: () => hotelAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useHotelMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hotels"] });
  return {
    create: useMutation({ mutationFn: (data) => hotelAPI.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }) => hotelAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["hotel", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["hotel", id] });
      },
    }),
    remove: useMutation({ mutationFn: (id) => hotelAPI.remove(id), onSuccess: invalidate }),
  };
}

// ── Reservations ────────────────────────────────────────────────────────────
export function useReservations(params = {}) {
  return useQuery({
    queryKey: ["reservations", params],
    queryFn: () => reservationAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

export function useReservationsPaginated({ search = "", date = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["reservations", "paginated", { search, date, page, limit }],
    queryFn: () => reservationAPI.getAll({ search, date, page, limit }).then((r) => ({
      reservations: r.data?.data       ?? [],
      total:        r.data?.total      ?? 0,
      page:         r.data?.page       ?? page,
      limit:        r.data?.limit      ?? limit,
      totalPages:   r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useReservation(id) {
  return useQuery({
    queryKey: ["reservation", id],
    queryFn: () => reservationAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useReservationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reservations"] });
  return {
    create: useMutation({ mutationFn: (data) => reservationAPI.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }) => reservationAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["reservation", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["reservation", id] });
      },
    }),
  };
}

// ── Vouchers ────────────────────────────────────────────────────────────────
export function useVouchers(params = {}) {
  return useQuery({
    queryKey: ["vouchers", params],
    queryFn: () => voucherAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

// Paginated variant for the Vouchers list page.
// Returns the full envelope so the page can render a footer.
export function useVouchersPaginated({ search = "", date = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["vouchers", "paginated", { search, date, page, limit }],
    queryFn: () => voucherAPI.getAll({ search, date, page, limit }).then((r) => ({
      vouchers:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useVoucher(id) {
  return useQuery({
    queryKey: ["voucher", id],
    queryFn: () => voucherAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useVoucherMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["vouchers"] });
  return {
    create: useMutation({ mutationFn: (data) => voucherAPI.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }) => voucherAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["voucher", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["voucher", id] });
      },
    }),
  };
}

// ── Invoices ────────────────────────────────────────────────────────────────
export function useInvoices(params = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => invoiceAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

export function useInvoicesPaginated({ search = "", date = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["invoices", "paginated", { search, date, page, limit }],
    queryFn: () => invoiceAPI.getAll({ search, date, page, limit }).then((r) => ({
      invoices:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useInvoice(id) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useInvoiceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
    qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => invoiceAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["invoice", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => invoiceAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["invoice", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["invoice", id] });
        qc.invalidateQueries({ queryKey: ["sales-records"] });
        qc.invalidateQueries({ queryKey: ["sales-record"] });
      },
    }),
    remove: useMutation({
      mutationFn: (id) => invoiceAPI.remove(id),
      onSuccess: (_, id) => {
        qc.removeQueries({ queryKey: ["invoice", id] });
        invalidate();
      },
    }),
  };
}

// ── Cash Receipts ───────────────────────────────────────────────────────────
export function useCashReceipts(params = {}) {
  return useQuery({
    queryKey: ["cash-receipts", params],
    queryFn: () => cashReceiptAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

export function useCashReceiptsPaginated({ search = "", date = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["cash-receipts", "paginated", { search, date, page, limit }],
    queryFn: () => cashReceiptAPI.getAll({ search, date, page, limit }).then((r) => ({
      receipts:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useCashReceipt(id) {
  return useQuery({
    queryKey: ["cash-receipt", id],
    queryFn: () => cashReceiptAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useCashReceiptMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cash-receipts"] });
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["customer-payment"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice"] });
    qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create: useMutation({ mutationFn: (data) => cashReceiptAPI.create(data), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id) => cashReceiptAPI.remove(id), onSuccess: invalidate }),
  };
}

// ── Sundry ──────────────────────────────────────────────────────────────────
export function useSundry(params = {}) {
  return useQuery({
    queryKey: ["sundry", params],
    queryFn: () => sundryAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

export function useSundryPaginated({ search = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["sundry", "paginated", { search, page, limit }],
    queryFn: () => sundryAPI.getAll({ search, page, limit }).then((r) => ({
      entries:    r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useSundryEntry(id) {
  return useQuery({
    queryKey: ["sundry", id],
    queryFn: () => sundryAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useSundryDropdown(params = {}) {
  return useQuery({
    queryKey: ["sundry", "dropdown", params],
    queryFn: () => sundryAPI.getDropdown(params).then((r) => r.data?.data ?? []),
    staleTime: 5 * 60_000, // dropdown rarely changes within a session
  });
}

export function useSundryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sundry"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => sundryAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["sundry", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => sundryAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["sundry", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["sundry", id] });
      },
    }),
  };
}

// ── Sales Records ───────────────────────────────────────────────────────────
export function useSalesRecords(params = {}) {
  return useQuery({
    queryKey: ["sales-records", params],
    queryFn: () => salesRecordAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

export function useSalesRecordsPaginated({ search = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["sales-records", "paginated", { search, page, limit }],
    queryFn: () => salesRecordAPI.getAll({ search, page, limit }).then((r) => ({
      records:    r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useSalesRecord(id) {
  return useQuery({
    queryKey: ["sales-record", id],
    queryFn: () => salesRecordAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useSalesRecordMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales-records"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice"] });
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["customer-payment"] });
    qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => salesRecordAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["sales-record", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => salesRecordAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["sales-record", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["sales-record", id] });
      },
    }),
    remove: useMutation({ mutationFn: (id) => salesRecordAPI.remove(id), onSuccess: invalidate }),
  };
}

// ── Purchase Records ────────────────────────────────────────────────────────
export function usePurchaseRecords(params = {}) {
  return useQuery({
    queryKey: ["purchase-records", params],
    queryFn: () => purchaseRecordAPI.getAll(params).then((r) => r.data?.data ?? []),
  });
}

export function usePurchaseRecordsPaginated({ search = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["purchase-records", "paginated", { search, page, limit }],
    queryFn: () => purchaseRecordAPI.getAll({ search, page, limit }).then((r) => ({
      records:    r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function usePurchaseRecord(id) {
  return useQuery({
    queryKey: ["purchase-record", id],
    queryFn: () => purchaseRecordAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function usePurchaseRecordMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchase-records"] });
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["customer-payment"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create:         useMutation({
      mutationFn: (data) => purchaseRecordAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["purchase-record", created._id], created);
        invalidate();
      },
    }),
    update:         useMutation({
      mutationFn: ({ id, data }) => purchaseRecordAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["purchase-record", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["purchase-record", id] });
      },
    }),
    remove:         useMutation({ mutationFn: (id) => purchaseRecordAPI.remove(id), onSuccess: invalidate }),
    addTransaction: useMutation({
      mutationFn: ({ id, data }) => purchaseRecordAPI.addTransaction(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["purchase-record", id], updated);
        qc.invalidateQueries({ queryKey: ["purchase-records"] });
        qc.invalidateQueries({ queryKey: ["purchase-record", id] });
        qc.invalidateQueries({ queryKey: ["customer-payments"] });
        qc.invalidateQueries({ queryKey: ["customer-payment"] });
        qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
        qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
        qc.invalidateQueries({ queryKey: ["journal-entries"] });
        qc.invalidateQueries({ queryKey: ["bank-accounts"] });
        qc.invalidateQueries({ queryKey: ["bank-account"] });
      },
    }),
  };
}

// ── Calculator ──────────────────────────────────────────────────────────────
export function useCalculatorRecords() {
  return useQuery({
    queryKey: ["calculator"],
    queryFn: () => calculatorAPI.getAll().then((r) => r.data?.data ?? []),
  });
}

export function useCalculatorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["calculator"] });
  return {
    create: useMutation({ mutationFn: (data) => calculatorAPI.create(data), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, data }) => calculatorAPI.update(id, data), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id) => calculatorAPI.remove(id), onSuccess: invalidate }),
  };
}

// ── Auth verify (used by AuthContext) ───────────────────────────────────────
export function useAuthVerify(token) {
  return useQuery({
    queryKey: ["auth", "verify", token],
    queryFn: () => authAPI.verify(token).then((r) => r.data?.user),
    enabled: !!token,
    staleTime: 30 * 60_000, // verified once per 30m is plenty
    retry: false,           // don't hammer auth on a 401
  });
}

// ── Bank Accounts ───────────────────────────────────────────────────────────
export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => bankAccountAPI.getAll().then((r) => r.data?.data ?? []),
    placeholderData: (prev) => prev,
  });
}

export function useBankAccount(id, params = {}) {
  return useQuery({
    queryKey: ["bank-account", id, params],
    queryFn: () => bankAccountAPI.getById(id, params).then((r) => r.data?.data),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
}

export function useBankDropdown() {
  return useQuery({
    queryKey: ["bank-accounts", "dropdown"],
    queryFn: () => bankAccountAPI.getDropdown().then((r) => r.data?.data ?? []),
    staleTime: 5 * 60_000,
  });
}

export function useBankAccountMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => bankAccountAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["bank-account", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => bankAccountAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["bank-account", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["bank-account", id] });
      },
    }),
    remove: useMutation({ mutationFn: (id) => bankAccountAPI.remove(id), onSuccess: invalidate }),
    addTransaction: useMutation({
      mutationFn: ({ id, data }) => bankAccountAPI.addTransaction(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["bank-account", id], updated);
        invalidate();
        qc.invalidateQueries({ queryKey: ["bank-account", id] });
        qc.invalidateQueries({ queryKey: ["purchase-records"] });
        qc.invalidateQueries({ queryKey: ["office-expenses"] });
      },
    }),
  };
}

// Customer Payments
export function useCustomerPaymentsPaginated({ search = "", customerId = "", invoiceId = "", invoiceNumber = "", status = "posted", from = "", to = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["customer-payments", "paginated", { search, customerId, invoiceId, invoiceNumber, status, from, to, page, limit }],
    queryFn: () => customerPaymentAPI.getAll({ search, customerId, invoiceId, invoiceNumber, status, from, to, page, limit }).then((r) => ({
      payments:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useCustomerPayment(id) {
  return useQuery({
    queryKey: ["customer-payment", id],
    queryFn: () => customerPaymentAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useCustomerPaymentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["customer-payment"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice"] });
    qc.invalidateQueries({ queryKey: ["reports", "ar-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => customerPaymentAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["customer-payment", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => customerPaymentAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["customer-payment", id], updated);
        invalidate();
      },
    }),
    void: useMutation({
      mutationFn: ({ id, data }) => customerPaymentAPI.void(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["customer-payment", id], updated);
        invalidate();
      },
    }),
  };
}

// Reports
export function useArAging({ asOf = "", minBalance = 0.01 } = {}) {
  return useQuery({
    queryKey: ["reports", "ar-aging", { asOf, minBalance }],
    queryFn: () => reportAPI.getArAging({ asOf, minBalance }).then((r) => r.data?.data ?? { rows: [], totals: {} }),
    placeholderData: (prev) => prev,
  });
}

// Vendor Bills
export function useVendorBillsPaginated({ search = "", vendorId = "", bookingId = "", status = "", from = "", to = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["vendor-bills", "paginated", { search, vendorId, bookingId, status, from, to, page, limit }],
    queryFn: () => vendorBillAPI.getAll({ search, vendorId, bookingId, status, from, to, page, limit }).then((r) => ({
      bills:      r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useVendorBill(id) {
  return useQuery({
    queryKey: ["vendor-bill", id],
    queryFn: () => vendorBillAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useVendorBillMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendor-bills"] });
    qc.invalidateQueries({ queryKey: ["vendor-bill"] });
    qc.invalidateQueries({ queryKey: ["reports", "ap-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
    qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => vendorBillAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["vendor-bill", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => vendorBillAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["vendor-bill", id], updated);
        invalidate();
      },
    }),
    void: useMutation({
      mutationFn: ({ id, data }) => vendorBillAPI.void(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["vendor-bill", id], updated);
        invalidate();
      },
    }),
  };
}

// Vendor Payments
export function useVendorPaymentsPaginated({ search = "", vendorId = "", vendorBillId = "", billNumber = "", bookingId = "", status = "posted", from = "", to = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["vendor-payments", "paginated", { search, vendorId, vendorBillId, billNumber, bookingId, status, from, to, page, limit }],
    queryFn: () => vendorPaymentAPI.getAll({ search, vendorId, vendorBillId, billNumber, bookingId, status, from, to, page, limit }).then((r) => ({
      payments:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useVendorPayment(id) {
  return useQuery({
    queryKey: ["vendor-payment", id],
    queryFn: () => vendorPaymentAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useVendorPaymentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendor-payments"] });
    qc.invalidateQueries({ queryKey: ["vendor-payment"] });
    qc.invalidateQueries({ queryKey: ["vendor-bills"] });
    qc.invalidateQueries({ queryKey: ["vendor-bill"] });
    qc.invalidateQueries({ queryKey: ["reports", "ap-aging"] });
    qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => vendorPaymentAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["vendor-payment", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => vendorPaymentAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["vendor-payment", id], updated);
        invalidate();
      },
    }),
    void: useMutation({
      mutationFn: ({ id, data }) => vendorPaymentAPI.void(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["vendor-payment", id], updated);
        invalidate();
      },
    }),
  };
}

// Office Expenses
export function useOfficeExpensesPaginated({ search = "", category = "", status = "posted", from = "", to = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["office-expenses", "paginated", { search, category, status, from, to, page, limit }],
    queryFn: () => officeExpenseAPI.getAll({ search, category, status, from, to, page, limit }).then((r) => ({
      expenses:   r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useOfficeExpense(id) {
  return useQuery({
    queryKey: ["office-expense", id],
    queryFn: () => officeExpenseAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useOfficeExpenseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["office-expenses"] });
    qc.invalidateQueries({ queryKey: ["office-expense"] });
    qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };
  return {
    create: useMutation({
      mutationFn: (data) => officeExpenseAPI.create(data),
      onSuccess: (res) => {
        const created = res?.data?.data;
        if (created?._id) qc.setQueryData(["office-expense", created._id], created);
        invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => officeExpenseAPI.update(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["office-expense", id], updated);
        invalidate();
      },
    }),
    void: useMutation({
      mutationFn: ({ id, data }) => officeExpenseAPI.void(id, data),
      onSuccess: (res, { id }) => {
        const updated = res?.data?.data;
        if (updated) qc.setQueryData(["office-expense", id], updated);
        invalidate();
      },
    }),
  };
}

export function useApAging({ asOf = "", minBalance = 0.01 } = {}) {
  return useQuery({
    queryKey: ["reports", "ap-aging", { asOf, minBalance }],
    queryFn: () => reportAPI.getApAging({ asOf, minBalance }).then((r) => r.data?.data ?? { rows: [], totals: {} }),
    placeholderData: (prev) => prev,
  });
}

export function useBookingProfitability({ from = "", to = "", search = "" } = {}) {
  return useQuery({
    queryKey: ["reports", "booking-profitability", { from, to, search }],
    queryFn: () => reportAPI.getBookingProfitability({ from, to, search }).then((r) => r.data?.data ?? { rows: [], totals: {} }),
    placeholderData: (prev) => prev,
  });
}

export function useCustomerLedger({ customerId = "", search = "", from = "", to = "" } = {}) {
  return useQuery({
    queryKey: ["reports", "customer-ledger", { customerId, search, from, to }],
    queryFn: () => reportAPI.getCustomerLedger({ customerId, search, from, to }).then((r) => r.data?.data ?? { entries: [], totals: {} }),
    placeholderData: (prev) => prev,
  });
}

export function useVendorLedger({ vendorId = "", search = "", from = "", to = "" } = {}) {
  return useQuery({
    queryKey: ["reports", "vendor-ledger", { vendorId, search, from, to }],
    queryFn: () => reportAPI.getVendorLedger({ vendorId, search, from, to }).then((r) => r.data?.data ?? { entries: [], totals: {} }),
    placeholderData: (prev) => prev,
  });
}

export function useProfitLoss({ from = "", to = "" } = {}) {
  return useQuery({
    queryKey: ["reports", "profit-loss", { from, to }],
    queryFn: () => reportAPI.getProfitLoss({ from, to }).then((r) => r.data?.data ?? { totals: {}, counts: {}, byExpenseCategory: [], byMonth: [] }),
    placeholderData: (prev) => prev,
  });
}

export function useAccountingReconciliation() {
  return useQuery({
    queryKey: ["reports", "accounting-reconciliation"],
    queryFn: () => reportAPI.getAccountingReconciliation().then((r) => r.data?.data ?? { status: "fail", totals: {}, checks: [] }),
    placeholderData: (prev) => prev,
  });
}

export function useAuditLogsPaginated({ search = "", entity = "", entityId = "", action = "", from = "", to = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["audit-logs", "paginated", { search, entity, entityId, action, from, to, page, limit }],
    queryFn: () => auditLogAPI.getAll({ search, entity, entityId, action, from, to, page, limit }).then((r) => ({
      logs:       r.data?.data       ?? [],
      total:      r.data?.total      ?? 0,
      page:       r.data?.page       ?? page,
      limit:      r.data?.limit      ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}

export function useJournalEntriesPaginated({ search = "", sourceEntity = "", sourceId = "", accountCode = "", status = "", from = "", to = "", page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ["journal-entries", "paginated", { search, sourceEntity, sourceId, accountCode, status, from, to, page, limit }],
    queryFn: () => journalEntryAPI.getAll({ search, sourceEntity, sourceId, accountCode, status, from, to, page, limit }).then((r) => ({
      entries: r.data?.data ?? [],
      total: r.data?.total ?? 0,
      page: r.data?.page ?? page,
      limit: r.data?.limit ?? limit,
      totalPages: r.data?.totalPages ?? 1,
    })),
    placeholderData: (prev) => prev,
  });
}
