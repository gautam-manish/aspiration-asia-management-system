import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, PageLoader, SearchBar, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSundryPaginated } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VendorsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const {
    data: { entries: vendors = [], total = 0, totalPages = 1 } = {},
    isLoading,
    isFetching,
    error,
  } = useSundryPaginated({ search: debouncedSearch, page, limit: 50, role: "vendor" });

  useEffect(() => { if (error) notifyError(error); }, [error]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">Sundry creditors available for purchase entries and vendor ledger review</p>
        </div>
        <button onClick={() => navigate("/sundry")} className="btn-secondary">
          <i className="fa fa-building" /> Manage Sundry
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Total Vendors</p>
          <p className="text-2xl font-bold text-slate-800">{total}</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Active Sundry Source</p>
          <p className="text-xl font-bold text-brand-700">Creditors</p>
        </div>
        <div className="card card-body !py-4">
          <p className="text-xs text-slate-500 mb-1">Opening Balance On Page</p>
          <p className="text-xl font-bold text-slate-800">{money(vendors.reduce((sum, v) => sum + (Number(v.openingBalance) || 0), 0))}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search vendor, company, code, phone..." />
          <span className="text-sm text-slate-500">
            {total === 0 ? "No vendors" : `${(page - 1) * 50 + 1}-${Math.min(page * 50, total)} of ${total} vendor${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {isLoading ? <div className="p-8"><PageLoader /></div> : vendors.length === 0 ? (
          <Empty icon="fa-truck" message="No vendors found" action={<button onClick={() => navigate("/sundry")} className="btn-primary">Create in Sundry</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Party Code</th>
                    <th>Vendor</th>
                    <th>Contact</th>
                    <th>PAN / VAT</th>
                    <th>Opening Balance</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor._id}>
                      <td className="font-mono text-xs text-slate-500">{vendor.partyCode || "-"}</td>
                      <td>
                        <p className="font-medium text-slate-800">{vendor.companyName || vendor.contactPerson}</p>
                        {vendor.companyName && <p className="text-xs text-slate-400">{vendor.contactPerson}</p>}
                      </td>
                      <td>
                        <p className="text-sm text-slate-600">{vendor.phone || "-"}</p>
                        {vendor.email && <p className="text-xs text-slate-400">{vendor.email}</p>}
                      </td>
                      <td className="font-mono text-xs text-slate-500">{vendor.panVatGst || "-"}</td>
                      <td className="font-semibold text-slate-700">{money(vendor.openingBalance)}</td>
                      <td><span className={vendor.status === "inactive" ? "badge badge-red" : "badge badge-green"}>{vendor.status || "active"}</span></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => navigate(`/vendor-ledger?vendorId=${vendor._id}`)} className="btn-ghost text-xs py-1 px-2">
                            <i className="fa fa-book-open" /> View Ledger
                          </button>
                          <button onClick={() => navigate(`/sundry/${vendor._id}`)} className="btn-ghost text-xs py-1 px-2">
                            <i className="fa fa-eye" /> View
                          </button>
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
    </div>
  );
}
