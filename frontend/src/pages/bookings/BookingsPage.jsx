import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { bookingAPI, sundryAPI } from "../../api";
import { getError, formatDate } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, StatusBadge, Field, ConfirmModal } from "../../components/common";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  queryId:"", companyName:"", clientName:"", email:"", mobile:"", address:"",
  destination:"Nepal", pickupPoint:"", dropPoint:"",
  arrivalDate:"", departureDate:"", noOfDays:"",
  adults:0, childEB:0, childNoEB:0, childU5:0, rooms:0,
  hotelCategory:"", mealPlan:"",
};

/* ── helper: calculate nights/days string ──────────────────────── */
function calcDays(arrival, departure) {
  if (!arrival || !departure) return "";
  const a = new Date(arrival);
  const d = new Date(departure);
  const diff = Math.round((d - a) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "";
  return `${diff}N/${diff + 1}D`;
}

function BookingModal({ booking, nextId, onClose, onSaved }) {
  const isEdit = !!booking;
  const [form, setForm] = useState(isEdit ? { ...booking } : { ...EMPTY_FORM, queryId: nextId });
  const [loading, setLoading] = useState(false);
  const [creditors, setCreditors] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  /* load creditors for dropdown */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await sundryAPI.getDropdown({ type: "creditor" });
        setCreditors(data.data || []);
      } catch { /* silently ignore */ }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* auto-calculate no of days when arrival or departure changes */
  const handleDateChange = (field, value) => {
    setForm((f) => {
      const updated = { ...f, [field]: value };
      updated.noOfDays = calcDays(updated.arrivalDate, updated.departureDate);
      return updated;
    });
  };

  /* when a creditor is selected from dropdown */
  const handleCreditorSelect = (creditor) => {
    setForm((f) => ({
      ...f,
      clientName: creditor.contactPerson || "",
      companyName: creditor.companyName || "",
      email: creditor.email || "",
      mobile: creditor.phone || "",
      address: creditor.address || "",
    }));
    setClientSearch("");
    setDropdownOpen(false);
  };

  /* filtered creditors based on search input */
  const filteredCreditors = useMemo(() => {
    if (!clientSearch) return creditors;
    const q = clientSearch.toLowerCase();
    return creditors.filter(
      (c) =>
        c.contactPerson?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q)
    );
  }, [creditors, clientSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await bookingAPI.update(booking._id, form);
      else        await bookingAPI.create(form);
      toast.success(`Booking ${isEdit ? "updated" : "created"}`);
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Booking" : "New Booking"}</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {/* Query ID */}
            <div className="bg-brand-50 border border-brand-100 rounded-lg px-4 py-2 flex items-center gap-2">
              <i className="fa fa-hashtag text-brand-500 text-sm" />
              <span className="text-sm font-medium text-brand-700">Query ID: {form.queryId}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client / Agent Dropdown */}
              <Field label="Client / Agent Name" required>
                <div className="relative">
                  <div
                    className="input cursor-pointer flex items-center justify-between"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <span className={form.clientName ? "text-slate-800" : "text-slate-400"}>
                      {form.clientName || "Select client / agent…"}
                    </span>
                    <i className={`fa fa-chevron-${dropdownOpen ? "up" : "down"} text-xs text-slate-400`} />
                  </div>
                  {dropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                      <div className="sticky top-0 bg-white border-b border-slate-100 p-2">
                        <input
                          autoFocus
                          type="text"
                          className="input text-sm"
                          placeholder="Search creditors…"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredCreditors.length === 0 ? (
                        <div className="p-3 text-sm text-slate-400 text-center">No creditors found</div>
                      ) : (
                        filteredCreditors.map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-b-0"
                            onClick={() => handleCreditorSelect(c)}
                          >
                            <p className="text-sm font-medium text-slate-800">{c.contactPerson}</p>
                            {c.companyName && (
                              <p className="text-xs text-slate-400">{c.companyName}</p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Company Name">
                <input className="input" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Company name" />
              </Field>
              <Field label="Email" required>
                <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Field label="Mobile">
                <input className="input" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Destination" required>
                <select className="input" value={form.destination} onChange={(e) => set("destination", e.target.value)}>
                  {["Nepal","India","Bhutan"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Pickup Point">
                <input className="input" value={form.pickupPoint} onChange={(e) => set("pickupPoint", e.target.value)} />
              </Field>
              <Field label="Drop Point">
                <input className="input" value={form.dropPoint} onChange={(e) => set("dropPoint", e.target.value)} />
              </Field>
              <Field label="Arrival Date">
                <input className="input" type="date" value={form.arrivalDate?.split("T")[0] || ""} onChange={(e) => handleDateChange("arrivalDate", e.target.value)} />
              </Field>
              <Field label="Departure Date">
                <input className="input" type="date" value={form.departureDate?.split("T")[0] || ""} onChange={(e) => handleDateChange("departureDate", e.target.value)} />
              </Field>
              <Field label="No. of Days">
                <input className="input bg-slate-50" value={form.noOfDays} readOnly placeholder="Auto-calculated" />
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[["adults","Adults"],["childEB","Child EB"],["childNoEB","Child No EB"],["childU5","Child U5"],["rooms","Rooms"]].map(([k, lbl]) => (
                <Field key={k} label={lbl}>
                  <input className="input" type="number" min="0" value={form[k]} onChange={(e) => set(k, e.target.value)} />
                </Field>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Hotel Category">
                <select className="input" value={form.hotelCategory} onChange={(e) => set("hotelCategory", e.target.value)}>
                  <option value="">Select…</option>
                  {["2-star","3-star","4-star","5-star"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Meal Plan">
                <select className="input" value={form.mealPlan} onChange={(e) => set("mealPlan", e.target.value)}>
                  <option value="">Select…</option>
                  {["EP","MAP","CP","JP","AP"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving…" : isEdit ? "Update" : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("confirmed");
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState(null);
  const [nextId, setNextId]     = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling]     = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await bookingAPI.getAll({ status, search });
      setBookings(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const openNew = async () => {
    try {
      const { data } = await bookingAPI.getNextId();
      setNextId(data.queryId);
      setModal("new");
    } catch {
      setModal("new");
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await bookingAPI.updateStatus(cancelTarget._id, "cancelled");
      toast.success("Booking cancelled");
      setCancelTarget(null);
      fetchBookings();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-subtitle">Manage travel queries and bookings</p>
        </div>
        <button onClick={openNew} className="btn-primary"><i className="fa fa-plus" /> New Booking</button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-4">
        {["confirmed","cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name, ID, destination…" />
          <span className="text-sm text-slate-500">{bookings.length} records</span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : bookings.length === 0 ? (
          <Empty icon="fa-bookmark" message={`No ${status} bookings`} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Query ID</th>
                  <th>Client / Agent</th>
                  <th>Destination</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>Pax</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id}>
                    <td className="font-mono text-xs text-brand-600 font-medium">{b.queryId}</td>
                    <td>
                      <p className="font-medium text-slate-800">{b.clientName}</p>
                      <p className="text-xs text-slate-400">{b.email}</p>
                    </td>
                    <td><span className="badge badge-blue">{b.destination}</span></td>
                    <td className="text-slate-600 text-xs">{formatDate(b.arrivalDate)}</td>
                    <td className="text-slate-600 text-xs">{formatDate(b.departureDate)}</td>
                    <td className="text-xs text-slate-600">
                      {b.adults}A {b.childEB ? `${b.childEB}CEB ` : ""}{b.childNoEB ? `${b.childNoEB}CNEB ` : ""}{b.childU5 ? `${b.childU5}U5` : ""}
                    </td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/bookings/${b._id}`)} className="btn-ghost text-xs py-1 px-2" title="View">
                          <i className="fa fa-eye" />
                        </button>
                        {b.status === "confirmed" && (
                          <>
                            <button onClick={() => { setNextId(b.queryId); setModal(b); }} className="btn-ghost text-xs py-1 px-2" title="Edit">
                              <i className="fa fa-edit" />
                            </button>
                            <button onClick={() => setCancelTarget(b)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2" title="Cancel">
                              <i className="fa fa-ban" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <BookingModal
          booking={modal === "new" ? null : modal}
          nextId={nextId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchBookings(); }}
        />
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel Booking"
        message={`Cancel booking ${cancelTarget?.queryId} for ${cancelTarget?.clientName}? This cannot be reversed.`}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
        loading={cancelling}
      />
    </div>
  );
}
