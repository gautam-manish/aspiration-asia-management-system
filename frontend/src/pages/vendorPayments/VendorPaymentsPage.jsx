import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ConfirmModal, Empty, PageLoader, Pagination, SearchBar } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useVendorPaymentMutations, useVendorPaymentsPaginated } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { useAuth } from "../../context/AuthContext";

const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusBadge(status) {
  return status === "void" ? <span className="badge badge-red">Void</span> : <span className="badge badge-green">Posted</span>;
}

export default function VendorPaymentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("posted");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [voidTarget, setVoidTarget] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const isAdmin = user?.role === "admin";

  useEffect(() => { setPage(1); }, [debouncedSearch, status, from, to]);

  const { data: { payments = [], total = 0, totalPages = 1 } = {}, isLoading, isFetching, error } =
    useVendorPaymentsPaginated({ search: debouncedSearch, status, from, to, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const { void: voidPayment } = useVendorPaymentMutations();
  const totalAmount = payments.reduce((sum, p) => sum + (p.status === "posted" ? Number(p.amount || 0) : 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Payments</h1>
          <p className="page-subtitle">Accounts payable payment register</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Payments</p><p className="text-2xl font-bold">{total}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Posted Total (this page)</p><p className="text-xl font-bold text-green-600">{money(totalAmount)}</p></div>
        <div className="card card-body !py-4"><p className="text-xs text-slate-500">Status Filter</p><p className="text-xl font-bold capitalize">{status}</p></div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search payment, bill, vendor..." />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="posted">Posted</option>
            <option value="void">Void</option>
          </select>
          <input className="input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs"><i className="fa fa-times" /> Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">{total} payment{total !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : payments.length === 0 ? (
          <Empty icon="fa-money-check-alt" message="No vendor payments found" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Payment #</th><th>Date</th><th>Vendor</th><th>Bill</th><th>Booking</th><th>Method</th><th>Amount</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td><Link to={`/vendor-payments/${p._id}`} className="font-mono text-xs text-brand-600 font-medium hover:underline">{p.paymentNumber}</Link>{p.referenceCode && <p className="text-xs text-slate-400">{p.referenceCode}</p>}</td>
                      <td className="text-sm text-slate-500">{p.paymentDate}</td>
                      <td><p className="font-medium text-slate-800">{p.vendor?.name || p.vendor?.company || "-"}</p>{p.vendor?.company && <p className="text-xs text-slate-400">{p.vendor.company}</p>}</td>
                      <td>
                        {p.vendorBillId ? (
                          <Link to={`/vendor-bills/${p.vendorBillId}`} className="font-mono text-xs text-brand-600 hover:underline">{p.billNumber || "-"}</Link>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">{p.billNumber || "-"}</span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-slate-500">{p.bookingId || "-"}</td>
                      <td><span className="badge badge-gray capitalize">{p.method}</span></td>
                      <td className="font-semibold">{money(p.amount)}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td><div className="flex justify-end">{isAdmin && p.status === "posted" && <button onClick={() => setVoidTarget(p)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">Void</button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onChange={setPage} isFetching={isFetching} />
          </>
        )}
      </div>

      <ConfirmModal
        open={!!voidTarget}
        title="Void Vendor Payment"
        message={`Void payment ${voidTarget?.paymentNumber} for ${money(voidTarget?.amount)}?`}
        onConfirm={() => voidPayment.mutate({ id: voidTarget._id, data: { notes: "Voided from Vendor Payments page" } }, {
          onSuccess: () => { toast.success("Vendor payment voided"); setVoidTarget(null); },
          onError: (err) => notifyError(err),
        })}
        onCancel={() => setVoidTarget(null)}
        loading={voidPayment.isPending}
      />
    </div>
  );
}
