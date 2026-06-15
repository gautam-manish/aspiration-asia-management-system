import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { bookingAPI, purchaseRecordAPI, resolveUploadUrl } from "../../api";
import { notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePurchaseRecordsPaginated, usePurchaseRecordMutations, useSundryDropdown, useBankAccounts } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const fmt = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_LINE = { serviceType: "hotel", description: "", qty: 1, rate: "", amount: "" };

const fmtSize = (bytes = 0) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

function AttachmentField({ label, attachment, onChange }) {
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("File is too large. Please upload under 1 MB");
      return;
    }
    setBusy(true);
    try {
      const { data } = await purchaseRecordAPI.uploadAttachment(file);
      onChange(data?.data || null);
      toast.success("Attachment uploaded");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  if (attachment?.url) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 min-w-0">
        <i className={`fa ${/^application\/pdf/.test(attachment.mimeType) ? "fa-file-pdf text-red-500" : "fa-file-image text-blue-600"}`} />
        <a href={resolveUploadUrl(attachment.url)} target="_blank" rel="noreferrer" className="font-medium text-brand-700 truncate hover:underline" title={attachment.fileName}>
          {attachment.fileName || label}
        </a>
        <span className="text-slate-400 ml-auto whitespace-nowrap text-xs">{fmtSize(attachment.size)}</span>
        <button type="button" onClick={() => onChange(null)} disabled={busy} className="btn-ghost text-red-400 hover:text-red-600 p-1" title="Remove attachment">
          <i className="fa fa-times" />
        </button>
      </div>
    );
  }

  return (
    <label className="rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-3 text-sm text-slate-500 cursor-pointer flex items-center justify-center gap-2">
      <i className={`fa ${busy ? "fa-spinner fa-spin" : "fa-paperclip"}`} />
      <span>{busy ? "Uploading..." : `Attach ${label} (PDF / JPG, max 1 MB)`}</span>
      <input type="file" className="hidden" accept={ATTACHMENT_ACCEPT} disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
    </label>
  );
}

export function AddModal({ mode = "purchase", initialVendor = null, initialTransaction = null, bookingOptions = [], onClose, onSaved }) {
  const isPayment = mode === "payment";
  const initialVendorLabel = initialVendor
    ? initialVendor.contactPerson + (initialVendor.companyName ? ` (${initialVendor.companyName})` : "")
    : "";
  const defaultBooking = initialTransaction || (bookingOptions.length === 1 ? bookingOptions[0] : null);
  // Cached sundry list — fetched once and reused on every modal open.
  const qc = useQueryClient();
  const { data: vendors = [], refetch: refetchVendors } = useSundryDropdown({ role: "vendor" });
  const { data: bankList = [] } = useBankAccounts();
  const [query,    setQuery]    = useState(initialVendorLabel);
  const [selected, setSelected] = useState(initialVendor);
  const [showDrop, setShowDrop] = useState(false);
  const [txn,      setTxn]      = useState({
    date: today(),
    refNo: "",
    bookingId: defaultBooking?.bookingId || "",
    clientName: defaultBooking?.clientName || "",
    description: "",
    amount: "",
    bank: "",
    type: isPayment ? "dr" : "cr",
    attachment: null,
  });
  const [taxAmount, setTaxAmount] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [loading,  setLoading]  = useState(false);
  const submittingRef = useRef(false);
  const [bookingLookup, setBookingLookup] = useState(false);
  // Holds the existing PurchaseRecord doc when one is found for the selected vendor.
  // null = unknown, false = no existing account (new ledger), object = existing.
  const [existing, setExisting] = useState(initialVendor?.existingRecord || null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { refetchVendors(); }, [refetchVendors]);

  const filtered = vendors.filter((d) =>
    (d.contactPerson || "").toLowerCase().includes(query.toLowerCase()) ||
    (d.companyName || "").toLowerCase().includes(query.toLowerCase())
  );
  const selectedBank = bankList.find((b) => b.bankName === txn.bank);
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
    const tax = Number(taxAmount) || 0;
    return { subtotal, tax, total: subtotal + tax };
  }, [lines, taxAmount]);

  // Look up an existing ledger by vendor name. Debounced lightly via blur/select.
  const checkExistingByName = async (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) { setExisting(null); return; }
    setChecking(true);
    try {
      const { data } = await purchaseRecordAPI.getByDebtor(trimmed);
      setExisting(data?.data || null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setExisting(false); // confirmed no account → show opening balance fields
      } else {
        setExisting(null);
      }
    } finally {
      setChecking(false);
    }
  };

  const selectVendor = (d) => {
    setSelected(d);
    setQuery(d.contactPerson + (d.companyName ? ` (${d.companyName})` : ""));
    setShowDrop(false);
    // The query string includes the company suffix; check by the contact person name only.
    checkExistingByName(d.contactPerson);
  };

  const setT = (k, v) => setTxn((t) => ({ ...t, [k]: v }));

  const applyBookingOption = (bookingId) => {
    const match = bookingOptions.find((option) => option.bookingId === bookingId);
    setTxn((t) => ({
      ...t,
      bookingId,
      clientName: match?.clientName || "",
    }));
  };

  const updateLine = (idx, key, value) => {
    setLines((current) => current.map((line, i) => {
      if (i !== idx) return line;
      const next = { ...line, [key]: value };
      const qty = Number(next.qty) || 0;
      const rate = Number(next.rate) || 0;
      if (key === "qty" || key === "rate") next.amount = qty * rate || "";
      return next;
    }));
  };

  const fetchBooking = async () => {
    const bookingId = (txn.bookingId || "").trim();
    if (!bookingId) { toast.error("Booking ID required"); return; }
    setBookingLookup(true);
    try {
      const { data } = await bookingAPI.getByQueryId(bookingId);
      const booking = data?.data || {};
      setTxn((t) => ({
        ...t,
        bookingId: booking.queryId || bookingId,
        clientName: t.clientName || booking.clientName || "",
      }));
      toast.success(`Booking ${booking.queryId || bookingId} loaded`);
    } catch (err) {
      notifyError(err);
    } finally {
      setBookingLookup(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!selected) { toast.error("Select a creditor/vendor from the dropdown"); return; }
    const debtorNameClean = selected.contactPerson;
    if (!txn.bookingId.trim()) { toast.error("Booking ID required"); return; }
    if (!txn.date)   { toast.error("Transaction date required"); return; }
    if (!isPayment && !lines.some((line) => String(line.description || "").trim() && Number(line.amount) >= 0)) {
      toast.error("At least one purchase line is required");
      return;
    }
    const amount = isPayment ? Number(txn.amount) : Number(totals.total);
    if (!amount || amount <= 0) { toast.error("Amount must be > 0"); return; }
    if (isPayment && !txn.bank) { toast.error("Select a bank account for payment entry"); return; }
    if (isPayment && selectedBank && amount > Number(selectedBank.balance || 0)) {
      toast.error(`Amount exceeds selected bank balance (${fmt(selectedBank.balance)})`);
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const { data } = await purchaseRecordAPI.create({
        vendorId:       selected?._id || "",
        debtorName:    debtorNameClean,
        debtorCompany: selected?.companyName  || existing?.debtorCompany || "",
        debtorPan:     selected?.panVatGst    || existing?.debtorPan     || "",
        debtorAddress: selected?.address      || existing?.debtorAddress || "",
        debtorPhone:   selected?.phone        || existing?.debtorPhone   || "",
        debtorEmail:   selected?.email        || existing?.debtorEmail   || "",
        // For new ledgers, send opening. For existing ledgers, omit it
        // so the controller doesn't try to override (controller only honors it on create anyway).
        ...(existing ? {} : { openingBalance: Number(selected.openingBalance) || 0 }),
        transaction:   {
          ...txn,
          bank: isPayment ? txn.bank : "",
          type: isPayment ? "dr" : "cr",
          amount,
          description: isPayment
            ? txn.description
            : (txn.description || lines.map((line) => line.description).filter(Boolean).join(", ")),
          lineItems: isPayment ? undefined : lines,
          taxAmount: isPayment ? undefined : Number(taxAmount) || 0,
        },
      });
      if (data?.data?._id) qc.setQueryData(["purchase-record", data.data._id], data.data);
      toast.success(existing ? "Entry added to existing ledger ✓" : "New ledger created ✓");
      qc.invalidateQueries({ queryKey: ["purchase-records"] });
      qc.invalidateQueries({ queryKey: ["customer-payments"] });
      qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
      qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
      qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
      qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
      qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["bank-account"] });
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className={`modal ${isPayment ? "max-w-2xl" : "max-w-4xl"}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{isPayment ? "Add Payment Entry" : "Add Purchase Entry"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {/* Creditor / Vendor */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Creditor / Vendor *</p>
              <div className="relative">
                <input
                  className="input"
                  placeholder="Search creditor/vendor..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDrop(true);
                    setSelected(null);
                    setExisting(null); // reset until blur or selection
                  }}
                  onFocus={() => setShowDrop(true)}
                  onBlur={() => {
                    // Allow click on dropdown options to register before checking.
                    setTimeout(() => {
                      if (selected) checkExistingByName(selected.contactPerson);
                    }, 150);
                  }}
                />
                {showDrop && filtered.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map((d) => (
                      <button key={d._id} type="button" onClick={() => selectVendor(d)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <p className="font-medium text-slate-800">{d.contactPerson}</p>
                        {d.companyName && <p className="text-xs text-slate-400">{d.companyName}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing-account banner (shown when a ledger already exists) */}
              {existing && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-brand-700 flex items-start gap-2">
                  <i className="fa fa-info-circle mt-0.5" />
                  <div>
                    <p className="font-semibold">Existing ledger found</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      This entry will be appended to <span className="font-medium">{existing.debtorName}</span>'s vendor account.
                    </p>
                  </div>
                </div>
              )}

              {/* No-account banner (shown after lookup confirms no ledger exists) */}
              {existing === false && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <i className="fa fa-exclamation-circle mt-0.5" />
                  <div>
                    <p className="font-semibold">No purchase ledger exists for this vendor</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      A new ledger will be created using the opening balance already stored in Sundry.
                    </p>
                  </div>
                </div>
              )}

              {checking && (
                <p className="mt-2 text-xs text-slate-400">Checking existing account…</p>
              )}

            </div>

            {!isPayment && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Invoice #">
                    <input className="input" value={txn.refNo} onChange={(e) => setT("refNo", e.target.value)} />
                  </Field>
                  <Field label="Entry / Invoice Date *">
                    <input className="input" type="date" value={txn.date} onChange={(e) => setT("date", e.target.value)} required />
                  </Field>
                  <Field label="Booking ID *">
                    {bookingOptions.length > 0 ? (
                      <select className="input" value={txn.bookingId} onChange={(e) => applyBookingOption(e.target.value)} required>
                        <option value="">Select booking</option>
                        {bookingOptions.map((option) => (
                          <option key={option.bookingId} value={option.bookingId}>
                            {option.bookingId}{option.clientName ? ` - ${option.clientName}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input className="input flex-1" value={txn.bookingId} onChange={(e) => setT("bookingId", e.target.value)} placeholder="ASA..." required />
                        <button type="button" onClick={fetchBooking} disabled={bookingLookup || !txn.bookingId.trim()} className="btn-secondary text-xs whitespace-nowrap">
                          {bookingLookup ? "Fetching..." : <><i className="fa fa-search" /> Fetch</>}
                        </button>
                      </div>
                    )}
                  </Field>
                  <Field label="Tax Amount">
                    <input className="input" type="number" min="0" step="any" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
                  </Field>
                  <Field label="Notes" className="sm:col-span-3">
                    <textarea className="input min-h-[76px]" value={txn.description} onChange={(e) => setT("description", e.target.value)} />
                  </Field>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cost Lines</p>
                    <button type="button" className="btn-secondary text-xs" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
                      <i className="fa fa-plus" /> Line
                    </button>
                  </div>
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-[130px_minmax(220px,1fr)_90px_130px_140px_42px] gap-2 items-end rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <Field label="Service">
                          <select className="input" value={line.serviceType} onChange={(e) => updateLine(idx, "serviceType", e.target.value)}>
                            {["hotel", "transport", "guide", "activity", "flight", "visa", "meal", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </Field>
                        <Field label="Description">
                          <input className="input" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="Description" />
                        </Field>
                        <Field label="Qty">
                          <input className="input" type="number" min="0" step="any" value={line.qty} onChange={(e) => updateLine(idx, "qty", e.target.value)} />
                        </Field>
                        <Field label="Rate">
                          <input className="input" type="number" min="0" step="any" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} placeholder="0.00" />
                        </Field>
                        <Field label="Total">
                          <input className="input" type="number" min="0" step="any" value={line.amount} onChange={(e) => updateLine(idx, "amount", e.target.value)} placeholder="0.00" />
                        </Field>
                        <button type="button" className="btn-ghost text-red-400 h-10" onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1} title="Remove line">
                          <i className="fa fa-trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="card card-body !py-3"><p className="text-xs text-slate-500">Subtotal</p><p className="font-bold">{fmt(totals.subtotal)}</p></div>
                  <div className="card card-body !py-3"><p className="text-xs text-slate-500">Tax</p><p className="font-bold">{fmt(totals.tax)}</p></div>
                  <div className="card card-body !py-3"><p className="text-xs text-slate-500">Total</p><p className="font-bold text-red-600">{fmt(totals.total)}</p></div>
                </div>
              </div>
            )}

            {isPayment && (<>
            {/* Transaction */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Transaction Details</p>

              {/* Entry type */}
              {false && <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Entry Type *</p>
                <div className="flex gap-3">
                  {[["cr","Purchase Entry (CR)"], ["dr","Payment Entry (DR)"]].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => { setTxn((t) => ({ ...t, type: val, bank: val === "cr" ? "" : t.bank, attachment: null })); }}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        txn.type === val ? (val === "cr" ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700") : "border-slate-200 text-slate-500"
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date *">
                  <input className="input" type="date" value={txn.date} onChange={(e) => setT("date", e.target.value)} required />
                </Field>
                <Field label="Ref / Voucher No.">
                  <input className="input" value={txn.refNo} onChange={(e) => setT("refNo", e.target.value)} />
                </Field>
                <Field label="Booking ID *">
                  {bookingOptions.length > 0 ? (
                    <select className="input" value={txn.bookingId} onChange={(e) => applyBookingOption(e.target.value)} required>
                      <option value="">Select booking</option>
                      {bookingOptions.map((option) => (
                        <option key={option.bookingId} value={option.bookingId}>
                          {option.bookingId}{option.clientName ? ` - ${option.clientName}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input className="input flex-1" value={txn.bookingId} onChange={(e) => setT("bookingId", e.target.value)} placeholder="ASA..." required />
                      <button type="button" onClick={fetchBooking} disabled={bookingLookup || !txn.bookingId.trim()} className="btn-secondary text-xs whitespace-nowrap">
                        {bookingLookup ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                      </button>
                    </div>
                  )}
                </Field>
                <Field label="Client Name">
                  <input className="input" value={txn.clientName} onChange={(e) => setT("clientName", e.target.value)} />
                </Field>
                <Field label="Amount (Rs.) *">
                  <input className="input" type="number" min="0.01" step="0.01" value={txn.amount} onChange={(e) => setT("amount", e.target.value)} required />
                </Field>
                <Field label="Description" className="col-span-2">
                  <textarea className="input min-h-[90px]" value={txn.description} onChange={(e) => setT("description", e.target.value)} />
                </Field>
                <Field label={txn.type === "cr" ? "Purchase Invoice" : "Payment Slip"} className="sm:col-span-2">
                  <AttachmentField
                    label={txn.type === "cr" ? "Purchase Invoice" : "Payment Slip"}
                    attachment={txn.attachment}
                    onChange={(attachment) => setT("attachment", attachment)}
                  />
                </Field>
                {txn.type === "dr" && (
                  <Field label="Bank Account *" className="sm:col-span-2 min-w-0">
                  <select className="input min-w-0 max-w-full truncate" value={txn.bank} onChange={(e) => setT("bank", e.target.value)} required>
                    <option value="">— Select Bank —</option>
                    {bankList.map((b) => (
                      <option key={b._id} value={b.bankName}>{b.bankName} - Balance {fmt(b.balance)}</option>
                    ))}
                  </select>
                  {selectedBank && <p className="text-xs text-slate-400 mt-1">Available balance: {fmt(selectedBank.balance)}</p>}
                </Field>
                )}
              </div>
            </div>
            </>)}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <i className="fa fa-save" /> {loading ? "Saving…" : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseRecordsPage() {
  const navigate             = useNavigate();
  const qc                   = useQueryClient();
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState(null);
  const [confirm,  setConfirm]  = useState(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const {
    data: { records = [], total = 0, totalPages = 1 } = {},
    isLoading: loading,
    isFetching,
    error,
  } = usePurchaseRecordsPaginated({ search: debouncedSearch, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { remove } = usePurchaseRecordMutations();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchase-records"] });
    qc.invalidateQueries({ queryKey: ["purchase-record"] });
    qc.invalidateQueries({ queryKey: ["customer-payments"] });
    qc.invalidateQueries({ queryKey: ["customer-payment"] });
    qc.invalidateQueries({ queryKey: ["reports", "customer-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "vendor-ledger"] });
    qc.invalidateQueries({ queryKey: ["reports", "booking-profitability"] });
    qc.invalidateQueries({ queryKey: ["reports", "profit-loss"] });
    qc.invalidateQueries({ queryKey: ["reports", "accounting-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["journal-entries"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["bank-account"] });
  };

  const handleDelete = () => {
    remove.mutate(confirm._id, {
      onSuccess: () => {
        toast.success("Record deleted");
        setConfirm(null);
      },
      onError: (err) => notifyError(err),
    });
  };

  const totalDR = records.reduce((s, r) => s + (Number(r.totalDebit) || 0), 0);
  const totalCR = records.reduce((s, r) => s + (Number(r.totalCredit) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Records</h1>
          <p className="page-subtitle">Creditor / vendor ledger management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal("purchase")} className="btn-primary">
            <i className="fa fa-file-invoice-dollar" /> Add Purchase Entry
          </button>
          <button onClick={() => setModal("payment")} className="btn-secondary">
            <i className="fa fa-money-check-alt" /> Add Payment Entry
          </button>
        </div>
      </div>

      {/* Summary (current page) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Creditors / Vendors</p><p className="text-2xl font-bold text-slate-800">{total}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Debit (this page)</p><p className="text-xl font-bold text-red-600">{fmt(totalDR)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Total Credit (this page)</p><p className="text-xl font-bold text-green-600">{fmt(totalCR)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500 mb-1">Net Balance (this page)</p><p className={`text-xl font-bold ${totalDR - totalCR >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(Math.abs(totalDR - totalCR))} {totalDR - totalCR >= 0 ? "DR" : "CR"}</p></div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by creditor/vendor name..." />
          <span className="text-sm text-slate-500">
            {total === 0
              ? "No creditors/vendors"
              : `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} creditor/vendor${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : records.length === 0 ? (
          <Empty icon="fa-book" message="No purchase records found" action={<button onClick={() => setModal("purchase")} className="btn-primary">Add first purchase entry</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Creditor / Vendor</th>
                    <th>PAN / VAT</th>
                    <th>Total Debit</th>
                    <th>Total Credit</th>
                    <th>Closing Balance</th>
                    <th>Entries</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const closing = Number(r.closingBalance || 0);
                    const isDR = closing >= 0;
                    return (
                      <tr key={r._id}>
                        <td className="text-slate-400 text-xs">{(page - 1) * 50 + i + 1}</td>
                        <td>
                          <p className="font-medium text-slate-800">{r.debtorName}</p>
                          {r.debtorCompany && <p className="text-xs text-slate-400">{r.debtorCompany}</p>}
                        </td>
                        <td className="text-slate-500 text-sm font-mono">{r.debtorPan || "—"}</td>
                        <td className="text-red-600 font-medium text-sm">{fmt(r.totalDebit)}</td>
                        <td className="text-green-600 font-medium text-sm">{fmt(r.totalCredit)}</td>
                        <td>
                          <span className={`font-bold text-sm ${isDR ? "text-red-600" : "text-green-600"}`}>
                            {fmt(Math.abs(closing))} <span className="text-xs font-semibold">{isDR ? "DR" : "CR"}</span>
                          </span>
                        </td>
                        <td className="text-slate-500 text-sm">{(r.transactions || []).length}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button onClick={() => navigate(`/purchase-records/${r._id}`)} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-eye" /> View</button>
                            <button onClick={() => setConfirm(r)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2"><i className="fa fa-trash-alt" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      {modal && <AddModal mode={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}

      <ConfirmModal
        open={!!confirm}
        title="Delete Purchase Record"
        message={`Delete all ledger data for "${confirm?.debtorName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={remove.isPending}
      />
    </div>
  );
}
