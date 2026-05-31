
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authAPI,
  hotelAPI,
  bookingAPI,
  reservationAPI,
  voucherAPI,
  invoiceAPI,
  cashReceiptAPI,
  calculatorAPI,
  sundryAPI,
  salesRecordAPI,
  purchaseRecordAPI,
} from "../api";

// ── Bookings ────────────────────────────────────────────────────────────────
export function useBookings({ status = "confirmed", search = "" } = {}) {
  return useQuery({
    queryKey: ["bookings", { status, search }],
    queryFn: () => bookingAPI.getAll({ status, search }).then((r) => r.data?.data ?? []),
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  return {
    create: useMutation({
      mutationFn: (data) => bookingAPI.create(data).then((r) => r.data?.data),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, data }) => bookingAPI.update(id, data).then((r) => r.data?.data),
      onSuccess: (_, { id }) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ["booking", id] });
      },
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, status }) => bookingAPI.updateStatus(id, status).then((r) => r.data?.data),
      onSuccess: invalidate,
    }),
    saveItinerary: useMutation({
      mutationFn: ({ id, data }) => bookingAPI.saveItinerary(id, data).then((r) => r.data?.data),
      onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ["booking", id] }),
    }),
  };
}

// ── Hotels ──────────────────────────────────────────────────────────────────
export function useHotels(search = "") {
  return useQuery({
    queryKey: ["hotels", { search }],
    queryFn: () => hotelAPI.getAll(search).then((r) => r.data?.data ?? []),
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
    update: useMutation({ mutationFn: ({ id, data }) => hotelAPI.update(id, data), onSuccess: invalidate }),
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
    update: useMutation({ mutationFn: ({ id, data }) => reservationAPI.update(id, data), onSuccess: invalidate }),
  };
}

// ── Vouchers ────────────────────────────────────────────────────────────────
export function useVouchers(params = {}) {
  return useQuery({
    queryKey: ["vouchers", params],
    queryFn: () => voucherAPI.getAll(params).then((r) => r.data?.data ?? []),
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
      onSuccess: (_, { id }) => {
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

export function useInvoice(id) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function useInvoiceMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["invoices"] });
  return {
    create: useMutation({ mutationFn: (data) => invoiceAPI.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }) => invoiceAPI.update(id, data),
      onSuccess: (_, { id }) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ["invoice", id] });
      },
    }),
    remove: useMutation({ mutationFn: (id) => invoiceAPI.remove(id), onSuccess: invalidate }),
  };
}

// ── Cash Receipts ───────────────────────────────────────────────────────────
export function useCashReceipts(params = {}) {
  return useQuery({
    queryKey: ["cash-receipts", params],
    queryFn: () => cashReceiptAPI.getAll(params).then((r) => r.data?.data ?? []),
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cash-receipts"] });
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sundry"] });
  return {
    create: useMutation({ mutationFn: (data) => sundryAPI.create(data), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, data }) => sundryAPI.update(id, data), onSuccess: invalidate }),
  };
}

// ── Sales Records ───────────────────────────────────────────────────────────
export function useSalesRecords(params = {}) {
  return useQuery({
    queryKey: ["sales-records", params],
    queryFn: () => salesRecordAPI.getAll(params).then((r) => r.data?.data ?? []),
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sales-records"] });
  return {
    create: useMutation({ mutationFn: (data) => salesRecordAPI.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }) => salesRecordAPI.update(id, data),
      onSuccess: (_, { id }) => {
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

export function usePurchaseRecord(id) {
  return useQuery({
    queryKey: ["purchase-record", id],
    queryFn: () => purchaseRecordAPI.getById(id).then((r) => r.data?.data),
    enabled: !!id,
  });
}

export function usePurchaseRecordMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["purchase-records"] });
  return {
    create:         useMutation({ mutationFn: (data) => purchaseRecordAPI.create(data), onSuccess: invalidate }),
    update:         useMutation({ mutationFn: ({ id, data }) => purchaseRecordAPI.update(id, data), onSuccess: invalidate }),
    remove:         useMutation({ mutationFn: (id) => purchaseRecordAPI.remove(id), onSuccess: invalidate }),
    addTransaction: useMutation({
      mutationFn: ({ id, data }) => purchaseRecordAPI.addTransaction(id, data),
      onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ["purchase-record", id] }),
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
