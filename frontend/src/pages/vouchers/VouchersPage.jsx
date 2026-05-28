import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { voucherAPI } from "../../api";
import { getError, formatDate } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, Field, SectionTitle } from "../../components/common";
import toast from "react-hot-toast";

const EMPTY_HOTEL = {
  confirmationNumber:"", hotelName:"", hotelCity:"", hotelCountry:"",
  roomCategory:"", noOfRooms:"", roomType:"", mealPlan:"",
  visit1in:"", visit1out:"", visit2in:"", visit2out:"",
  includes:"", hotelContactNumber:"", googleMapsLink:"",
};

function VoucherModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    guestName:"", nationality:"", contactNumber:"", mealInstruction:"",
    wheelChair:"", arrivalFlightDetails:"", preferredFloor:"",
    pax:{ adults:0, childWithBed:0, childWithoutBed:0, childBelow5:0 },
    hotels:[{ ...EMPTY_HOTEL }],
  });
  const [loading, setLoading] = useState(false);
  const set    = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPax = (k, v) => setForm((f) => ({ ...f, pax: { ...f.pax, [k]: v } }));
  const setHotel = (i, k, v) => setForm((f) => {
    const h = [...f.hotels]; h[i] = { ...h[i], [k]: v }; return { ...f, hotels: h };
  });
  const addHotel    = () => setForm((f) => ({ ...f, hotels: [...f.hotels, { ...EMPTY_HOTEL }] }));
  const removeHotel = (i) => setForm((f) => ({ ...f, hotels: f.hotels.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await voucherAPI.create(form);
      toast.success("Voucher created");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Voucher</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <SectionTitle>Guest Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Guest Name" required>
                <input className="input" value={form.guestName} onChange={(e) => set("guestName", e.target.value)} required />
              </Field>
              <Field label="Nationality">
                <input className="input" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </Field>
              <Field label="Contact Number">
                <input className="input" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
              </Field>
              <Field label="Preferred Floor">
                <input className="input" value={form.preferredFloor} onChange={(e) => set("preferredFloor", e.target.value)} />
              </Field>
              <Field label="Arrival Flight Details">
                <input className="input" value={form.arrivalFlightDetails} onChange={(e) => set("arrivalFlightDetails", e.target.value)} />
              </Field>
              <Field label="Wheel Chair">
                <select className="input" value={form.wheelChair} onChange={(e) => set("wheelChair", e.target.value)}>
                  <option value="">N/A</option>
                  <option>Required</option>
                  <option>Not Required</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Meal Instruction">
                  <input className="input" value={form.mealInstruction} onChange={(e) => set("mealInstruction", e.target.value)} placeholder="e.g. Vegetarian, Jain" />
                </Field>
              </div>
            </div>

            <SectionTitle>Pax</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[["adults","Adults"],["childWithBed","Child w/ Bed"],["childWithoutBed","Child w/o Bed"],["childBelow5","Child < 5"]].map(([k, l]) => (
                <Field key={k} label={l}>
                  <input className="input" type="number" min="0" value={form.pax[k]} onChange={(e) => setPax(k, e.target.value)} />
                </Field>
              ))}
            </div>

            {/* Hotels */}
            <div className="flex items-center justify-between mt-2">
              <SectionTitle>Hotel Blocks</SectionTitle>
              <button type="button" onClick={addHotel} className="btn-secondary text-xs py-1">
                <i className="fa fa-plus" /> Add Hotel
              </button>
            </div>

            {form.hotels.map((h, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 relative">
                {form.hotels.length > 1 && (
                  <button type="button" onClick={() => removeHotel(i)} className="absolute top-3 right-3 btn-ghost text-red-400 hover:text-red-600 p-1">
                    <i className="fa fa-times" />
                  </button>
                )}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hotel {i + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Hotel Name">
                    <input className="input" value={h.hotelName} onChange={(e) => setHotel(i, "hotelName", e.target.value)} />
                  </Field>
                  <Field label="City">
                    <input className="input" value={h.hotelCity} onChange={(e) => setHotel(i, "hotelCity", e.target.value)} />
                  </Field>
                  <Field label="Country">
                    <input className="input" value={h.hotelCountry} onChange={(e) => setHotel(i, "hotelCountry", e.target.value)} />
                  </Field>
                  <Field label="Confirmation No.">
                    <input className="input" value={h.confirmationNumber} onChange={(e) => setHotel(i, "confirmationNumber", e.target.value)} />
                  </Field>
                  <Field label="Room Category">
                    <input className="input" value={h.roomCategory} onChange={(e) => setHotel(i, "roomCategory", e.target.value)} />
                  </Field>
                  <Field label="Room Type">
                    <input className="input" value={h.roomType} onChange={(e) => setHotel(i, "roomType", e.target.value)} />
                  </Field>
                  <Field label="No. of Rooms">
                    <input className="input" value={h.noOfRooms} onChange={(e) => setHotel(i, "noOfRooms", e.target.value)} />
                  </Field>
                  <Field label="Meal Plan">
                    <select className="input" value={h.mealPlan} onChange={(e) => setHotel(i, "mealPlan", e.target.value)}>
                      <option value="">Select…</option>
                      {["EP","CP","MAP","AP","JP"].map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Contact Number">
                    <input className="input" value={h.hotelContactNumber} onChange={(e) => setHotel(i, "hotelContactNumber", e.target.value)} />
                  </Field>
                  <Field label="1st Check-In">
                    <input className="input" type="date" value={h.visit1in} onChange={(e) => setHotel(i, "visit1in", e.target.value)} />
                  </Field>
                  <Field label="1st Check-Out">
                    <input className="input" type="date" value={h.visit1out} onChange={(e) => setHotel(i, "visit1out", e.target.value)} />
                  </Field>
                  <Field label="2nd Check-In">
                    <input className="input" type="date" value={h.visit2in} onChange={(e) => setHotel(i, "visit2in", e.target.value)} />
                  </Field>
                  <Field label="2nd Check-Out">
                    <input className="input" type="date" value={h.visit2out} onChange={(e) => setHotel(i, "visit2out", e.target.value)} />
                  </Field>
                  <Field label="Includes">
                    <input className="input" value={h.includes} onChange={(e) => setHotel(i, "includes", e.target.value)} placeholder="Breakfast, WiFi…" />
                  </Field>
                  <Field label="Google Maps Link">
                    <input className="input" value={h.googleMapsLink} onChange={(e) => setHotel(i, "googleMapsLink", e.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating…" : "Create Voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VouchersPage() {
  const navigate = useNavigate();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [modal, setModal]     = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await voucherAPI.getAll({ search, date });
      setList(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, [search, date]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vouchers</h1>
          <p className="page-subtitle">Hotel accommodation vouchers for guests</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><i className="fa fa-plus" /> New Voucher</button>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by guest…" />
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          {date && <button onClick={() => setDate("")} className="btn-ghost text-xs">Clear</button>}
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-ticket-alt" message="No vouchers found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Nationality</th>
                  <th>Hotels</th>
                  <th>Pax</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v._id}>
                    <td className="font-medium text-slate-800">{v.guestName}</td>
                    <td className="text-slate-500">{v.nationality || "—"}</td>
                    <td className="text-xs text-slate-600">{v.hotels?.map((h) => h.hotelName).join(", ") || "—"}</td>
                    <td className="text-xs">{v.pax?.adults}A {v.pax?.childWithBed ? `${v.pax.childWithBed}C` : ""}</td>
                    <td className="text-xs text-slate-400">{formatDate(v.createdAt)}</td>
                    <td>
                      <div className="flex justify-end">
                        <button onClick={() => navigate(`/vouchers/${v._id}`)} className="btn-ghost text-xs py-1 px-2">
                          <i className="fa fa-eye" />
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

      {modal && <VoucherModal onClose={() => setModal(false)} onSaved={() => { setModal(false); fetch(); }} />}
    </div>
  );
}
