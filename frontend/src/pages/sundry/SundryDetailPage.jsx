import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { sundryAPI } from "../../api";
import { formatDate, notifyError } from "../../utils/helpers";
import { PageLoader, Field } from "../../components/common";
import { useSundryEntry } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const COUNTRIES = ["Nepal", "India", "Bhutan"];

function RoleRadio({ value, onChange }) {
  return (
    <div className="flex gap-3">
      {[
        { val: "customer", icon: "fa-user", label: "Customer (Debtor)", active: "border-brand-600 text-brand-600 bg-blue-50" },
        { val: "vendor", icon: "fa-truck", label: "Vendor (Creditor)", active: "border-green-600 text-green-600 bg-green-50" },
      ].map(({ val, icon, label, active }) => (
        <button key={val} type="button" onClick={() => onChange(val)}
          className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
            value === val ? active : "border-slate-200 text-slate-500 bg-white hover:border-slate-300"
          }`}>
          <i className={`fa ${icon}`} /> {label}
        </button>
      ))}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-start py-2.5 border-b border-slate-100 last:border-0">
    <span className="w-44 text-sm text-slate-500 flex-shrink-0">{label}</span>
    <span className="text-sm font-medium text-slate-800">{value || "—"}</span>
  </div>
);

const fmtMoney = (n) => Number(n || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SundryDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [entry,   setEntry]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);

  const qc = useQueryClient();
  const { data: entryData, isLoading: entryLoading, error: entryError } = useSundryEntry(id);

  useEffect(() => {
    if (entryData) {
      setEntry(entryData);
      setForm({ ...entryData });
    }
  }, [entryData]);
  useEffect(() => { setLoading(entryLoading); }, [entryLoading]);
  useEffect(() => { if (entryError) notifyError(entryError); }, [entryError]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setRole = (role) => setForm((f) => ({
    ...f,
    roles: [role],
    type: role === "vendor" ? "creditor" : "debtor",
  }));

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!form.contactPerson?.trim()) { toast.error("Contact person is required"); return; }
    setSaving(true);
    try {
      const role = form.roles?.[0] === "vendor" ? "vendor" : "customer";
      const { data } = await sundryAPI.update(id, {
        ...form,
        roles: [role],
        type: role === "vendor" ? "creditor" : "debtor",
      });
      setEntry(data.data);
      setEditing(false);
      toast.success("Entry updated ✓");
      // Refresh both the list cache and this entry's cache
      qc.invalidateQueries({ queryKey: ["sundry"] });
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!entry)  return <div className="text-center py-20 text-slate-400">Entry not found</div>;

  const role = entry.roles?.[0] === "vendor" ? "vendor" : "customer";

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sundry")} className="btn-ghost p-2">
            <i className="fa fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">{entry.contactPerson}</h1>
            {entry.companyName && <p className="page-subtitle">{entry.companyName}</p>}
            <p className="text-xs text-slate-400 mt-0.5">Added on {formatDate(entry.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={role === "vendor" ? "badge badge-green" : "badge badge-blue"}>
            <i className={`fa ${role === "vendor" ? "fa-truck" : "fa-user"} mr-1`} />
            {role === "vendor" ? "Vendor (Creditor)" : "Customer (Debtor)"}
          </span>
          <button onClick={() => setEditing(true)} className="btn-secondary">
            <i className="fa fa-edit" /> Edit Entry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-700">Company Information</h3></div>
          <div className="card-body">
            <Row label="Company Name"    value={entry.companyName} />
            <Row label="Contact Person"  value={<strong>{entry.contactPerson}</strong>} />
            <Row label="Party Code"      value={entry.partyCode} />
            <Row label="PAN / VAT / GST" value={entry.panVatGst} />
            <Row label="Address"         value={entry.address} />
            <Row label="Country"         value={entry.country} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-700">Contact Details</h3></div>
          <div className="card-body">
            <Row label="Contact Number" value={entry.phone} />
            <Row label="Email"          value={entry.email} />
            <Row label="Party Type"     value={role === "vendor" ? "Vendor (Creditor)" : "Customer (Debtor)"} />
            <Row label="Status"         value={entry.status || "active"} />
            <Row label="Opening Balance" value={fmtMoney(entry.openingBalance)} />
            <Row label="Notes"           value={entry.notes} />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-display font-semibold text-slate-800">Edit Entry</h2>
              <button onClick={() => setEditing(false)} className="btn-ghost p-1"><i className="fa fa-times" /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body space-y-4">
                <div>
                  <p className="label mb-2">Party Type *</p>
                  <RoleRadio value={form.roles?.[0] === "vendor" ? "vendor" : "customer"} onChange={setRole} />
                </div>
                <div>
                  <p className="label mb-3">Company Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Company Name" className="col-span-2">
                      <input className="input" value={form.companyName || ""} onChange={(e) => set("companyName", e.target.value)} />
                    </Field>
                    <Field label="Contact Person *">
                      <input className="input" value={form.contactPerson || ""} onChange={(e) => set("contactPerson", e.target.value)} required />
                    </Field>
                    <Field label="PAN / VAT / GST">
                      <input className="input" value={form.panVatGst || ""} onChange={(e) => set("panVatGst", e.target.value)} />
                    </Field>
                    <Field label="Address" className="col-span-2">
                      <input className="input" value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
                    </Field>
                    <Field label="Contact Number">
                      <input className="input" type="number" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input className="input" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
                    </Field>
                    <Field label="Country">
                      <select className="input" value={form.country || ""} onChange={(e) => set("country", e.target.value)}>
                        <option value="">—</option>
                        {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  <i className="fa fa-save" /> {saving ? "Updating…" : "Update Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
