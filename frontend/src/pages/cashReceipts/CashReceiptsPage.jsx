import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cashReceiptAPI, invoiceAPI } from "../../api";
import { formatDate, numberToWords, notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useBankDropdown, useCashReceiptsPaginated, useCashReceiptMutations } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  name: "", amount: "", amountInWords: "",
  cashChequeNo: "", bank: "", paymentType: "",
  invoiceNumber: "", bookingId: "", email: "", phone: "", address: "",
  paymentMethod: "cash", bankAccountId: "",
};

function CashReceiptModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const { data: banks = [] } = useBankDropdown();
  const set = (k, v) => {
    setForm((f) => {
      const updated = { ...f, [k]: v };
      if (k === "amount") updated.amountInWords = numberToWords(v);
      return updated;
    });
  };

  const lookupInvoice = async () => {
    const invoiceNumber = form.invoiceNumber.trim();
    if (!invoiceNumber) {
      toast.error("Enter an invoice number first");
      return;
    }
    setLookingUp(true);
    try {
      const { data } = await invoiceAPI.getByNumber(invoiceNumber);
      const invoice = data.data;
      setForm((f) => ({
        ...f,
        invoiceNumber: invoice.invoiceNumber || invoiceNumber,
        bookingId: invoice.bookingId || f.bookingId,
        name: invoice.billTo?.name || f.name,
        email: invoice.billTo?.email || f.email,
        phone: invoice.billTo?.mobile || f.phone,
        address: invoice.billTo?.address || f.address,
        amount: f.amount || "",
      }));
      toast.success(`Invoice ${invoice.invoiceNumber} loaded`);
    } catch (err) {
      notifyError(err);
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoiceNumber.trim()) { toast.error("Invoice number is required"); return; }
    if (!form.bookingId.trim()) { toast.error("Fetch the invoice before saving so the booking is linked"); return; }
    setLoading(true);
    try {
      await cashReceiptAPI.create(form);
      toast.success("Cash receipt created");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Cash Receipt</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Accounting Link</p>
              <Field label="Invoice Number" required>
                <div className="flex gap-2">
                  <input className="input flex-1" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} placeholder="e.g. ASA47821396" required />
                  <button type="button" onClick={lookupInvoice} disabled={lookingUp || !form.invoiceNumber.trim()} className="btn-secondary text-xs whitespace-nowrap">
                    {lookingUp ? "Fetching..." : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
              </Field>
              {form.bookingId && <p className="text-xs text-slate-400 mt-1">Booking ID: <span className="font-mono">{form.bookingId}</span></p>}
            </div>
            <Field label="Date" required>
              <input className="input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
            </Field>
            <Field label="Received From (Name)" required>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Client / Company name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>
            <Field label="Address">
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (Rs.)" required>
                <input className="input" type="number" min="0" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
              </Field>
              <Field label="Cheque / Ref No.">
                <input className="input" value={form.cashChequeNo} onChange={(e) => set("cashChequeNo", e.target.value)} />
              </Field>
            </div>
            <Field label="Amount in Words">
              <input className="input bg-slate-50" value={form.amountInWords} onChange={(e) => set("amountInWords", e.target.value)} placeholder="Auto-filled from amount" />
            </Field>
            <Field label="Bank">
              <input className="input" value={form.bank} onChange={(e) => set("bank", e.target.value)} placeholder="Bank name (if applicable)" />
            </Field>
            <Field label="Payment Method">
              <select className="input" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                {["cash", "bank", "card", "wallet", "cheque", "other"].map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </Field>
            <Field label="Bank Account">
              <select className="input" value={form.bankAccountId} onChange={(e) => set("bankAccountId", e.target.value)}>
                <option value="">Not linked</option>
                {banks.map((bank) => <option key={bank._id} value={bank._id}>{bank.bankName}</option>)}
              </select>
            </Field>
            <Field label="Payment Against For">
              <input className="input" value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)} placeholder="Nepal Tour" />
            </Field>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating…" : "Create Receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CashReceiptsPage() {
  const qc = useQueryClient();
  const [search, setSearch]     = useState("");
  const [date, setDate]         = useState("");
  const [page, setPage]         = useState(1);
  const [modal, setModal]       = useState(false);
  const [confirm, setConfirm]   = useState(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch, date]);

  const {
    data: { receipts = [], total = 0, totalPages = 1 } = {},
    isLoading: loading,
    isFetching,
    error,
  } = useCashReceiptsPaginated({ search: debouncedSearch, date, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { remove } = useCashReceiptMutations();
  const refresh = () => {
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

  const handleDelete = () => {
    remove.mutate(confirm._id, {
      onSuccess: () => {
        toast.success("Receipt deleted");
        setConfirm(null);
      },
      onError: (err) => notifyError(err),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Receipts</h1>
          <p className="page-subtitle">Track all payments received</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <i className="fa fa-plus" /> New Receipt
        </button>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div className="flex gap-3 flex-wrap">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name…" />
            <div className="relative">
              <i className="fa fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input pl-9 w-44"
              />
            </div>
            {date && <button onClick={() => setDate("")} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          </div>
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0
              ? "No receipts"
              : `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} receipt${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : receipts.length === 0 ? (
          <Empty icon="fa-receipt" message="No cash receipts found" action={<button onClick={() => setModal(true)} className="btn-primary">Create first receipt</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reg. No.</th>
                    <th>Date</th>
                    <th>Received From</th>
                    <th>Amount</th>
                    <th>Ref / Cheque</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r._id}>
                      <td><span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{r.registrationNumber || "—"}</span></td>
                      <td className="text-slate-500 text-sm">{r.date || formatDate(r.createdAt)}</td>
                      <td className="font-medium text-slate-800">{r.name}</td>
                      <td className="font-semibold text-slate-800">Rs. {Number(r.amount).toLocaleString("en-IN")}</td>
                      <td className="text-slate-500 text-sm">{r.cashChequeNo || "—"}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link to={`/cash-receipts/${r._id}`} className="btn-ghost text-xs py-1 px-2"><i className="fa fa-eye" /></Link>
                          <button onClick={() => setConfirm(r)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2"><i className="fa fa-trash-alt" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      {modal && (
        <CashReceiptModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); refresh(); }}
        />
      )}

      <ConfirmModal
        open={!!confirm}
        title="Delete Receipt"
        message={`Delete receipt for "${confirm?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={remove.isPending}
      />
    </div>
  );
}
