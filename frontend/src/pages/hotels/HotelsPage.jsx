import { useState, useEffect, useCallback } from "react";
import { hotelAPI } from "../../api";
import { getError, formatCurrency } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, ConfirmModal, Field } from "../../components/common";
import toast from "react-hot-toast";

const MEAL_PLANS = ["EP", "CP", "MAP", "AP", "JP"];
const ROOM_TYPES = ["Single", "Double", "Triple", "Quad"];
const EMPTY_COST = { mealPlan: "", roomCategory: "", roomType: "", inrRate: "", usdRate: "" };

function HotelModal({ hotel, onClose, onSaved }) {
  const isEdit = !!hotel;
  const [form, setForm] = useState(
    isEdit
      ? { name: hotel.name, country: hotel.country, city: hotel.city, contactNumbers: hotel.contactNumbers?.length ? hotel.contactNumbers : [""], googleMapUrl: hotel.googleMapUrl || "", costPerRoom: hotel.costPerRoom }
      : { name: "", country: "", city: "", contactNumbers: [""], googleMapUrl: "", costPerRoom: [{ ...EMPTY_COST }] }
  );
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCost  = (i, k, v) => setForm((f) => {
    const c = [...f.costPerRoom];
    c[i] = { ...c[i], [k]: v };
    return { ...f, costPerRoom: c };
  });
  const addCost    = () => setForm((f) => ({ ...f, costPerRoom: [...f.costPerRoom, { ...EMPTY_COST }] }));
  const removeCost = (i) => setForm((f) => ({ ...f, costPerRoom: f.costPerRoom.filter((_, idx) => idx !== i) }));

  // ── Contact Numbers helpers ──
  const setContact    = (i, v) => setForm((f) => { const c = [...f.contactNumbers]; c[i] = v; return { ...f, contactNumbers: c }; });
  const addContact    = () => setForm((f) => ({ ...f, contactNumbers: [...f.contactNumbers, ""] }));
  const removeContact = (i) => setForm((f) => ({ ...f, contactNumbers: f.contactNumbers.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await hotelAPI.update(hotel._id, form);
      else        await hotelAPI.create(form);
      toast.success(`Hotel ${isEdit ? "updated" : "created"} successfully`);
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
          <h2 className="font-display font-semibold text-slate-800">{isEdit ? "Edit Hotel" : "Add Hotel"}</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Hotel Name" required>
                <input className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} required placeholder="e.g. Hotel Yak & Yeti" />
              </Field>
              <Field label="Country" required>
                <input className="input" value={form.country} onChange={(e) => setField("country", e.target.value)} required placeholder="Nepal" />
              </Field>
              <Field label="City" required>
                <input className="input" value={form.city} onChange={(e) => setField("city", e.target.value)} required placeholder="Kathmandu" />
              </Field>
            </div>

            {/* Contact Numbers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Contact Numbers</label>
                <button type="button" onClick={addContact} className="btn-secondary text-xs py-1">
                  <i className="fa fa-plus" /> Add Number
                </button>
              </div>
              <div className="space-y-2">
                {form.contactNumbers.map((num, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={num}
                      onChange={(e) => setContact(i, e.target.value)}
                      placeholder="e.g. +977-1-4248999"
                    />
                    {form.contactNumbers.length > 1 && (
                      <button type="button" onClick={() => removeContact(i)} className="btn-ghost text-red-400 hover:text-red-600 p-1">
                        <i className="fa fa-trash-alt" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Field label="Google Map URL">
              <input className="input" value={form.googleMapUrl} onChange={(e) => setField("googleMapUrl", e.target.value)} placeholder="https://maps.google.com/..." />
            </Field>

            {/* Cost Per Room */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Cost Per Room</label>
                <button type="button" onClick={addCost} className="btn-secondary text-xs py-1">
                  <i className="fa fa-plus" /> Add Row
                </button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-11 gap-2 mb-1 px-2">
                <span className="col-span-2 text-[11px] font-medium text-slate-400 uppercase">Meal Plan</span>
                <span className="col-span-2 text-[11px] font-medium text-slate-400 uppercase">Room Category</span>
                <span className="col-span-2 text-[11px] font-medium text-slate-400 uppercase">Room Type</span>
                <span className="col-span-2 text-[11px] font-medium text-slate-400 uppercase">INR Rate</span>
                <span className="col-span-2 text-[11px] font-medium text-slate-400 uppercase">USD Rate</span>
                <span className="col-span-1"></span>
              </div>

              <div className="space-y-2">
                {form.costPerRoom.map((c, i) => (
                  <div key={i} className="grid grid-cols-11 gap-2 items-center bg-slate-50 p-2 rounded-lg">
                    <div className="col-span-2">
                      <select className="input text-sm" value={c.mealPlan} onChange={(e) => setCost(i, "mealPlan", e.target.value)} required>
                        <option value="">Plan…</option>
                        {MEAL_PLANS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input className="input text-sm" value={c.roomCategory || ""} onChange={(e) => setCost(i, "roomCategory", e.target.value)} placeholder="e.g. Deluxe" />
                    </div>
                    <div className="col-span-2">
                      <select className="input text-sm" value={c.roomType || ""} onChange={(e) => setCost(i, "roomType", e.target.value)}>
                        <option value="">Type…</option>
                        {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input className="input text-sm" type="number" value={c.inrRate} onChange={(e) => setCost(i, "inrRate", e.target.value)} placeholder="INR" required min="0" />
                    </div>
                    <div className="col-span-2">
                      <input className="input text-sm" type="number" value={c.usdRate} onChange={(e) => setCost(i, "usdRate", e.target.value)} placeholder="USD" required min="0" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {form.costPerRoom.length > 1 && (
                        <button type="button" onClick={() => removeCost(i)} className="btn-ghost text-red-400 hover:text-red-600 p-1">
                          <i className="fa fa-trash-alt" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving…" : isEdit ? "Update Hotel" : "Add Hotel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HotelsPage() {
  const [hotels, setHotels]   = useState([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | "add" | hotel obj
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHotels = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await hotelAPI.getAll(search);
      const list = data.data || [];
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setHotels(list);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchHotels(); }, [fetchHotels]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await hotelAPI.remove(confirm._id);
      toast.success("Hotel deleted");
      setConfirm(null);
      fetchHotels();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hotels</h1>
          <p className="page-subtitle">Manage hotel inventory and room rates</p>
        </div>
        <button onClick={() => setModal("add")} className="btn-primary">
          <i className="fa fa-plus" /> Add Hotel
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Search hotels…" />
          <span className="text-sm text-slate-500">{hotels.length} hotels</span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : hotels.length === 0 ? (
          <Empty icon="fa-hotel" message="No hotels found" action={<button onClick={() => setModal("add")} className="btn-primary">Add your first hotel</button>} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Hotel Name</th>
                  <th>Location</th>
                  <th>Contact Number</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((h) => (
                  <tr key={h._id}>
                    <td>
                      <p className="font-medium text-slate-800">{h.name}</p>
                      {h.googleMapUrl && (
                        <a href={h.googleMapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline">
                          <i className="fa fa-map-marker-alt text-[10px]" /> Map
                        </a>
                      )}
                    </td>
                    <td className="text-slate-500">{h.city}, {h.country}</td>
                    <td className="text-slate-600">
                      {h.contactNumbers?.filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td>
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setModal(h)} className="btn-ghost text-xs py-1 px-2">
                          <i className="fa fa-edit" />
                        </button>
                        <button onClick={() => setConfirm(h)} className="btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">
                          <i className="fa fa-trash-alt" />
                        </button>
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
        <HotelModal
          hotel={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchHotels(); }}
        />
      )}

      <ConfirmModal
        open={!!confirm}
        title="Delete Hotel"
        message={`Delete "${confirm?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        loading={deleting}
      />
    </div>
  );
}
