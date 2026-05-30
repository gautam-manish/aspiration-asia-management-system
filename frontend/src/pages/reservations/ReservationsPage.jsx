import { useState, useEffect, useCallback, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { reservationAPI } from "../../api";
import { getError, formatDate } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, Field, SectionTitle } from "../../components/common";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  to: "", subject: "Hotel Reservation",
  bookingName: "", nationality: "",
  pax: { adults: 0, childWithBed: 0, childWithoutBed: 0, childBelow5: 0 },
  room: { category: "", noOfRooms: "", type: "", extraBed: 0, mealPlan: "" },
  visits: { visit1in: "", visit1out: "", visit2in: "", visit2out: "" },
  note: "",
};

function ReservationModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const set   = (k, v)    => setForm((f) => ({ ...f, [k]: v }));
  const setPax = (k, v)   => setForm((f) => ({ ...f, pax: { ...f.pax, [k]: v } }));
  const setRoom = (k, v)  => setForm((f) => ({ ...f, room: { ...f.room, [k]: v } }));
  const setVisit = (k, v) => setForm((f) => ({ ...f, visits: { ...f.visits, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, to: form.to.split(",").map((s) => s.trim()).filter(Boolean) };
      await reservationAPI.create(payload);
      toast.success("Reservation created & email sent");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Hotel Reservation</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {/* Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Send To (comma-separated emails)" required>
                <input className="input" value={form.to} onChange={(e) => set("to", e.target.value)} required placeholder="hotel@example.com, ops@example.com" />
              </Field>
              <Field label="Subject">
                <input className="input" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
              </Field>
            </div>

            <SectionTitle>Booking Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Booking Name" required>
                <input className="input" value={form.bookingName} onChange={(e) => set("bookingName", e.target.value)} required />
              </Field>
              <Field label="Nationality">
                <input className="input" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </Field>
            </div>

            <SectionTitle>Number of Pax</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[["adults","Adults"],["childWithBed","Child with Bed"],["childWithoutBed","Child w/o Bed"],["childBelow5","Child < 5 yrs"]].map(([k, l]) => (
                <Field key={k} label={l}>
                  <input className="input" type="number" min="0" value={form.pax[k]} onChange={(e) => setPax(k, e.target.value)} />
                </Field>
              ))}
            </div>

            <SectionTitle>Room Details</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Room Category">
                <select className="input" value={form.room.category} onChange={(e) => setRoom("category", e.target.value)}>
                  <option value="">Select…</option>
                  {["Standard","Deluxe","Superior","Suite"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="No. of Rooms">
                <input className="input" value={form.room.noOfRooms} onChange={(e) => setRoom("noOfRooms", e.target.value)} />
              </Field>
              <Field label="Room Type">
                <select className="input" value={form.room.type} onChange={(e) => setRoom("type", e.target.value)}>
                  <option value="">Select…</option>
                  {["Single","Double","Twin","Triple"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Extra Bed">
                <input className="input" type="number" min="0" value={form.room.extraBed} onChange={(e) => setRoom("extraBed", e.target.value)} />
              </Field>
              <Field label="Meal Plan">
                <select className="input" value={form.room.mealPlan} onChange={(e) => setRoom("mealPlan", e.target.value)}>
                  <option value="">Select…</option>
                  {["EP","CP","MAP","AP","JP"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </div>

            <SectionTitle>Visit Dates</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[["visit1in","1st Check-In"],["visit1out","1st Check-Out"],["visit2in","2nd Check-In"],["visit2out","2nd Check-Out"]].map(([k, l]) => (
                <Field key={k} label={l}>
                  <input className="input" type="date" value={form.visits[k]} onChange={(e) => setVisit(k, e.target.value)} />
                </Field>
              ))}
            </div>

            <Field label="Notes">
              <textarea className="input" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Any special requests or instructions…" />
            </Field>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Sending…" : <><i className="fa fa-paper-plane" /> Send & Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrintView({ reservation }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 32 }}>
      <h1 style={{ textAlign: "center", color: "#2563eb" }}>Hotel Reservation</h1>
      <p style={{ textAlign: "center", color: "#666" }}>Aspiration AISA</p>
      <h3>Booking Details</h3>
      <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: 6 }}>Booking Name</td><td style={{ padding: 6 }}>{reservation.bookingName}</td></tr>
          <tr><td style={{ padding: 6 }}>Nationality</td><td style={{ padding: 6 }}>{reservation.nationality}</td></tr>
        </tbody>
      </table>
      <h3>Pax</h3>
      <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: 6 }}>Adults</td><td style={{ padding: 6 }}>{reservation.pax?.adults}</td></tr>
          <tr><td style={{ padding: 6 }}>Child w/ Bed</td><td style={{ padding: 6 }}>{reservation.pax?.childWithBed}</td></tr>
          <tr><td style={{ padding: 6 }}>Child w/o Bed</td><td style={{ padding: 6 }}>{reservation.pax?.childWithoutBed}</td></tr>
          <tr><td style={{ padding: 6 }}>Child Below 5</td><td style={{ padding: 6 }}>{reservation.pax?.childBelow5}</td></tr>
        </tbody>
      </table>
      <h3>Room</h3>
      <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: 6 }}>Category</td><td style={{ padding: 6 }}>{reservation.room?.category}</td></tr>
          <tr><td style={{ padding: 6 }}>No. of Rooms</td><td style={{ padding: 6 }}>{reservation.room?.noOfRooms}</td></tr>
          <tr><td style={{ padding: 6 }}>Type</td><td style={{ padding: 6 }}>{reservation.room?.type}</td></tr>
          <tr><td style={{ padding: 6 }}>Extra Bed</td><td style={{ padding: 6 }}>{reservation.room?.extraBed}</td></tr>
          <tr><td style={{ padding: 6 }}>Meal Plan</td><td style={{ padding: 6 }}>{reservation.room?.mealPlan}</td></tr>
        </tbody>
      </table>
      <h3>Visits</h3>
      <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: 6 }}>1st Check-In</td><td style={{ padding: 6 }}>{reservation.visits?.visit1in}</td></tr>
          <tr><td style={{ padding: 6 }}>1st Check-Out</td><td style={{ padding: 6 }}>{reservation.visits?.visit1out}</td></tr>
          <tr><td style={{ padding: 6 }}>2nd Check-In</td><td style={{ padding: 6 }}>{reservation.visits?.visit2in}</td></tr>
          <tr><td style={{ padding: 6 }}>2nd Check-Out</td><td style={{ padding: 6 }}>{reservation.visits?.visit2out}</td></tr>
        </tbody>
      </table>
      {reservation.note && <><h3>Note</h3><p>{reservation.note}</p></>}
    </div>
  );
}

export default function ReservationsPage() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [modal, setModal]     = useState(false);
  const [printData, setPrintData] = useState(null);
  const printRef = useRef();

  const handlePrint = useReactToPrint({ content: () => printRef.current });

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await reservationAPI.getAll({ search, date });
      setList(data.data || []);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLoading(false);
    }
  }, [search, date]);

  useEffect(() => { fetch(); }, [fetch]);

  const triggerPrint = (r) => {
    setPrintData(r);
    setTimeout(() => handlePrint(), 100);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hotel Reservations</h1>
          <p className="page-subtitle">Create & track hotel reservation requests</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><i className="fa fa-plus" /> New Reservation</button>
      </div>

      {/* Hidden print target */}
      <div className="hidden">
        <div ref={printRef}>{printData && <PrintView reservation={printData} />}</div>
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name…" />
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          {date && <button onClick={() => setDate("")} className="btn-ghost text-xs">Clear</button>}
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-calendar-check" message="No reservations found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking Name</th>
                  <th>Nationality</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Date Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r._id}>
                    <td className="font-medium text-slate-800">{r.bookingName}</td>
                    <td className="text-slate-500">{r.nationality || "—"}</td>
                    <td className="text-xs text-slate-600">
                      {r.room?.category} {r.room?.type} {r.room?.noOfRooms ? `(${r.room.noOfRooms}rm)` : ""}
                    </td>
                    <td className="text-xs">{r.visits?.visit1in || "—"}</td>
                    <td className="text-xs">{r.visits?.visit1out || "—"}</td>
                    <td className="text-xs text-slate-400">{formatDate(r.createdAt)}</td>
                    <td>
                      <div className="flex justify-end">
                        <button onClick={() => triggerPrint(r)} className="btn-ghost text-xs py-1 px-2" title="Print">
                          <i className="fa fa-print" />
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

      {modal && <ReservationModal onClose={() => setModal(false)} onSaved={() => { setModal(false); fetch(); }} />}
    </div>
  );
}
