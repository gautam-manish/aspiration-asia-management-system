import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { companySettingsAPI } from "../../api";
import { Field, PageLoader } from "../../components/common";
import { useCompanySettings } from "../../hooks/useApiQueries";
import { notifyError } from "../../utils/helpers";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  companyName: "",
  addressLine: "",
  phone: "",
  email: "",
  panNumber: "",
  registrationNumber: "",
  invoiceAccountName: "",
};

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useCompanySettings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (data) {
      setForm({
        ...EMPTY_FORM,
        ...data,
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) notifyError(error);
  }, [error]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Only admin can update company settings");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyName: form.companyName,
        addressLine: form.addressLine,
        phone: form.phone,
        email: form.email,
        panNumber: form.panNumber,
        registrationNumber: form.registrationNumber,
        invoiceAccountName: form.invoiceAccountName,
      };
      const { data: res } = await companySettingsAPI.update(payload);
      qc.setQueryData(["company-settings"], res?.data);
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Company settings updated");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Settings</h1>
          <p className="page-subtitle">Company details used on invoices and official documents</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-4xl">
        <div className="card-header">
          <h2 className="font-semibold text-slate-700">Business Identity</h2>
          {!isAdmin && <span className="badge badge-gray">View only</span>}
        </div>
        <div className="card-body space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Full Name" required>
              <input className="input" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required disabled={!isAdmin} />
            </Field>
            <Field label="Invoice Account Name" required>
              <input className="input" value={form.invoiceAccountName} onChange={(e) => set("invoiceAccountName", e.target.value)} required disabled={!isAdmin} />
            </Field>
            <Field label="Office Address" className="md:col-span-2" required>
              <input className="input" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} required disabled={!isAdmin} />
            </Field>
            <Field label="Contact Number" required>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} required disabled={!isAdmin} />
            </Field>
            <Field label="Email" required>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required disabled={!isAdmin} />
            </Field>
            <Field label="PAN Number" required>
              <input className="input" value={form.panNumber} onChange={(e) => set("panNumber", e.target.value)} required disabled={!isAdmin} />
            </Field>
            <Field label="Registration Number" required>
              <input className="input" value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} required disabled={!isAdmin} />
            </Field>
          </div>
        </div>

        <div className="modal-footer">
          <button type="submit" disabled={!isAdmin || saving} className="btn-primary">
            <i className="fa fa-save" /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
