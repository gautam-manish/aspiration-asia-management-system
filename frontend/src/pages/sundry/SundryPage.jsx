import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { sundryAPI } from "../../api";
import { notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSundryPaginated } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const COUNTRIES = ["Nepal", "India", "Bhutan"];

const EMPTY_FORM = {
  type: "debtor", companyName: "", contactPerson: "",
  panVatGst: "", address: "", phone: "", email: "", country: "",
  partyCode: "", roles: ["customer"], status: "active",
  openingBalance: "", creditLimit: "", paymentTermsDays: "", notes: "",
};

function TypeToggle({ value, onChange }) {
  return (
    <div className="flex gap-3">
      {[
        { val: "debtor",   icon: "fa-arrow-down", label: "Debtor",   active: "border-brand-600 text-brand-600 bg-blue-50" },
        { val: "creditor", icon: "fa-arrow-up",   label: "Creditor", active: "border-green-600 text-green-600 bg-green-50" },
      ].map(({ val, icon, label, active }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
            value === val ? active : "border-slate-200 text-slate-500 bg-white hover:border-slate-300"
          }`}
        >
          <i className={`fa ${icon}`} /> {label}
        </button>
      ))}
    </div>
  );
}

function SundryModal({ entry, onClose, onSaved }) {
  const isEdit = !!entry;
  const [form, setForm]     = useState(isEdit ? {
    ...EMPTY_FORM,
    ...entry,
    roles: Array.isArray(entry.roles) && entry.roles.length
      ? entry.roles
      : (entry.type === "creditor" ? ["vendor"] : ["customer"]),
  } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const toggleRole = (role) => {
    setForm((f) => {
      const current = Array.isArray(f.roles) ? f.roles : [];
      const roles = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return { ...f, roles };
    });
    setErrors((e) => ({ ...e, roles: undefined }));
  };

  const validate = () => {
    const e = {};
    const cp = (form.contactPerson || "").trim();
    if (!cp) e.contactPerson = "Required";
    else if (cp.length < 2) e.contactPerson = "At least 2 characters";
    else if (cp.length > 100) e.contactPerson = "Too long (max 100)";

    if ((form.companyName || "").length > 150) e.companyName = "Too long (max 150)";
    if ((form.address || "").length > 250)     e.address     = "Too long (max 250)";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Invalid email";

    if (form.phone) {
      const stripped = String(form.phone).replace(/[\s\-()]/g, "").replace(/^\+/, "");
      if (!/^\d{7,15}$/.test(stripped))
        e.phone = "7–15 digits, optional + prefix";
    }

    if (form.panVatGst && !/^[A-Za-z0-9]{5,20}$/.test(form.panVatGst.trim()))
      e.panVatGst = "5–20 alphanumeric chars";

    if (!["debtor", "creditor"].includes(form.type))
      e.type = "Pick a type";
    if (!Array.isArray(form.roles) || form.roles.length === 0)
      e.roles = "Pick at least one role";
    if (form.partyCode && !/^[A-Za-z0-9-]{3,30}$/.test(form.partyCode.trim()))
      e.partyCode = "3-30 letters, numbers, or hyphens";
    if (Number(form.openingBalance || 0) < 0)
      e.openingBalance = "Cannot be negative";
    if (Number(form.creditLimit || 0) < 0)
      e.creditLimit = "Cannot be negative";
    if (Number(form.paymentTermsDays || 0) < 0)
      e.paymentTermsDays = "Cannot be negative";
    if ((form.notes || "").length > 500)
      e.notes = "Too long (max 500)";

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      toast.error(Object.values(v)[0]);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        openingBalance: Number(form.openingBalance) || 0,
        creditLimit: Number(form.creditLimit) || 0,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
      };
      if (isEdit) await sundryAPI.update(entry._id, payload);
      else        await sundryAPI.create(payload);
      toast.success(`Entry ${isEdit ? "updated" : "saved"} ✓`);
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  const errCls = (key) => errors[key] ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "";

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Entry" : "Add Entry"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <p className="label mb-2">Accounting Type *</p>
              <TypeToggle value={form.type} onChange={(v) => set("type", v)} />
            </div>
            <div>
              <p className="label mb-2">Party Roles *</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: "customer", icon: "fa-user", label: "Customer" },
                  { val: "vendor", icon: "fa-truck", label: "Vendor" },
                ].map(({ val, icon, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => toggleRole(val)}
                    className={`flex items-center justify-center gap-2 border-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                      (form.roles || []).includes(val)
                        ? "border-brand-600 text-brand-600 bg-blue-50"
                        : "border-slate-200 text-slate-500 bg-white hover:border-slate-300"
                    }`}
                  >
                    <i className={`fa ${icon}`} /> {label}
                  </button>
                ))}
              </div>
              {errors.roles && <p className="text-xs text-red-500 mt-1">{errors.roles}</p>}
            </div>
            <div>
              <p className="label mb-3">Party Information</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Party Code">
                  <input className={`input ${errCls("partyCode")}`} value={form.partyCode || ""} onChange={(e) => set("partyCode", e.target.value.toUpperCase())} placeholder="CUS-001" maxLength={30} />
                  {errors.partyCode && <p className="text-xs text-red-500 mt-1">{errors.partyCode}</p>}
                </Field>
                <Field label="Status">
                  <select className="input" value={form.status || "active"} onChange={(e) => set("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
                <Field label="Company Name" className="col-span-2">
                  <input className={`input ${errCls("companyName")}`} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} maxLength={150} />
                  {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
                </Field>
                <Field label="Contact Person *">
                  <input className={`input ${errCls("contactPerson")}`} value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} required maxLength={100} />
                  {errors.contactPerson && <p className="text-xs text-red-500 mt-1">{errors.contactPerson}</p>}
                </Field>
                <Field label="PAN / VAT / GST">
                  <input className={`input ${errCls("panVatGst")}`} value={form.panVatGst} onChange={(e) => set("panVatGst", e.target.value)} maxLength={20} />
                  {errors.panVatGst && <p className="text-xs text-red-500 mt-1">{errors.panVatGst}</p>}
                </Field>
                <Field label="Address" className="col-span-2">
                  <input className={`input ${errCls("address")}`} value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={250} />
                  {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                </Field>
                <Field label="Contact Number">
                  <input className={`input ${errCls("phone")}`} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+977 9812345678" />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </Field>
                <Field label="Email">
                  <input className={`input ${errCls("email")}`} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </Field>
                <Field label="Country">
                  <select className={`input ${errCls("country")}`} value={form.country} onChange={(e) => set("country", e.target.value)}>
                    <option value="">—</option>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Opening Balance">
                  <input className={`input ${errCls("openingBalance")}`} type="number" min="0" value={form.openingBalance || ""} onChange={(e) => set("openingBalance", e.target.value)} />
                  {errors.openingBalance && <p className="text-xs text-red-500 mt-1">{errors.openingBalance}</p>}
                </Field>
                <Field label="Credit Limit">
                  <input className={`input ${errCls("creditLimit")}`} type="number" min="0" value={form.creditLimit || ""} onChange={(e) => set("creditLimit", e.target.value)} />
                  {errors.creditLimit && <p className="text-xs text-red-500 mt-1">{errors.creditLimit}</p>}
                </Field>
                <Field label="Payment Terms (Days)">
                  <input className={`input ${errCls("paymentTermsDays")}`} type="number" min="0" value={form.paymentTermsDays || ""} onChange={(e) => set("paymentTermsDays", e.target.value)} />
                  {errors.paymentTermsDays && <p className="text-xs text-red-500 mt-1">{errors.paymentTermsDays}</p>}
                </Field>
                <Field label="Notes" className="col-span-2">
                  <textarea className={`input min-h-[80px] ${errCls("notes")}`} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
                  {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes}</p>}
                </Field>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <i className="fa fa-save" /> {loading ? "Saving…" : isEdit ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SundryPage() {
  const navigate                 = useNavigate();
  const qc                       = useQueryClient();
  const [search,   setSearch]    = useState("");
  const [page,     setPage]      = useState(1);
  const [modal,    setModal]     = useState(null); // null | "add" | entry obj

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const {
    data: { entries = [], total = 0, totalPages = 1 } = {},
    isLoading: loading,
    isFetching,
    error,
  } = useSundryPaginated({ search: debouncedSearch, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["sundry"] });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sundry Debtors &amp; Creditors</h1>
          <p className="page-subtitle">Party master · {total} {total !== 1 ? "entries" : "entry"} found</p>
        </div>
        <button onClick={() => setModal("add")} className="btn-primary">
          <i className="fa fa-plus" /> Add Entry
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by company name or contact person…" />
          <button onClick={() => setSearch("")} className="btn-secondary text-xs">Clear</button>
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0
              ? "No entries"
              : `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} entr${total !== 1 ? "ies" : "y"}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : entries.length === 0 ? (
          <Empty icon="fa-building" message="No entries found" action={<button onClick={() => setModal("add")} className="btn-primary">Add your first entry</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Party</th>
                    <th>Contact Person</th>
                    <th>Roles</th>
                    <th>Address</th>
                    <th>Country</th>
                    <th>Type</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((s) => (
                    <tr key={s._id}>
                      <td className="font-medium text-slate-800">{s.companyName || "—"}</td>
                      <td>{s.contactPerson}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {(s.roles?.length ? s.roles : [s.type === "creditor" ? "vendor" : "customer"]).map((role) => (
                            <span key={role} className="badge badge-gray capitalize">{role}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-slate-500">{s.address || "—"}</td>
                      <td className="text-slate-500">{s.country || "—"}</td>
                      <td>
                        <span className={s.type === "debtor" ? "badge badge-blue" : "badge badge-green"}>
                          <i className={`fa fa-arrow-${s.type === "debtor" ? "down" : "up"} mr-1`} />
                          {s.type === "debtor" ? "Debtor" : "Creditor"}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setModal(s)} className="btn-ghost text-xs py-1 px-2">
                            <i className="fa fa-edit" /> Edit
                          </button>
                          <button onClick={() => navigate(`/sundry/${s._id}`)} className="btn-ghost text-xs py-1 px-2">
                            View <i className="fa fa-arrow-right" />
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

      {modal && (
        <SundryModal
          entry={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}
