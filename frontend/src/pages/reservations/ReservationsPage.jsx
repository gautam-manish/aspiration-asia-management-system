import { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useQueryClient } from "@tanstack/react-query";
import { reservationAPI } from "../../api";
import { formatDate, notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, Field, SectionTitle, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useReservationsPaginated } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  to: "", subject: "Hotel Reservation",
  bookingName: "", nationality: "",
  pax: { adults: 0, childWithBed: 0, childWithoutBed: 0, childBelow5: 0 },
  room: { category: "", noOfRooms: "", type: "", extraBed: 0, mealPlan: "" },
  visits: { visit1in: "", visit1out: "", visit2in: "", visit2out: "" },
  note: "",
};

const reservationForm = (reservation) => reservation ? {
  to: (Array.isArray(reservation.emailTo) ? reservation.emailTo : [reservation.emailTo]).filter(Boolean).join(", "),
  subject: reservation.subject || "Hotel Reservation",
  bookingName: reservation.bookingName || "",
  nationality: reservation.nationality || "",
  pax: { ...EMPTY_FORM.pax, ...(reservation.pax || {}) },
  room: { ...EMPTY_FORM.room, ...(reservation.room || {}) },
  visits: { ...EMPTY_FORM.visits, ...(reservation.visits || {}) },
  note: reservation.note || "",
} : {
  ...EMPTY_FORM,
  pax: { ...EMPTY_FORM.pax },
  room: { ...EMPTY_FORM.room },
  visits: { ...EMPTY_FORM.visits },
};

function ReservationModal({ reservation = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => reservationForm(reservation));
  const [loading, setLoading] = useState(false);
  const set   = (k, v)    => setForm((f) => ({ ...f, [k]: v }));
  const setPax = (k, v)   => setForm((f) => ({ ...f, pax: { ...f.pax, [k]: v } }));
  const setRoom = (k, v)  => setForm((f) => ({ ...f, room: { ...f.room, [k]: v } }));
  const setVisit = (k, v) => setForm((f) => ({ ...f, visits: { ...f.visits, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const recipients = form.to.split(",").map((s) => s.trim()).filter(Boolean);
      if (reservation) {
        const { data } = await reservationAPI.update(reservation._id, {
          ...form,
          emailTo: recipients,
        });
        toast.success("Reservation updated");
        onSaved(data?.data);
        return;
      }

      const { data } = await reservationAPI.create({ ...form, to: recipients });
      if (data?.emailSent === false) {
        toast(data.warning || "Reservation saved, but the email was not sent");
      } else {
        toast.success("Reservation created & email sent");
      }
      onSaved(data?.data);
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">
            {reservation ? "Edit Hotel Reservation" : "New Hotel Reservation"}
          </h2>
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
              {loading
                ? (reservation ? "Saving…" : "Sending…")
                : reservation
                  ? <><i className="fa fa-save" /> Save Changes</>
                  : <><i className="fa fa-paper-plane" /> Send & Save</>}
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

function ReservationViewModal({ reservation, sending, onClose, onEdit, onPrint, onSendMail }) {
  const Detail = ({ label, value }) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700 break-all">
        {value === undefined || value === null || value === "" ? "—" : value}
      </p>
    </div>
  );
  const statusLabel = {
    sent: "Sent",
    failed: "Failed",
    not_configured: "Not configured",
    pending: "Pending",
  }[reservation.emailStatus] || "Not recorded";

  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-slate-800 truncate">{reservation.bookingName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Created {formatDate(reservation.createdAt)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg" aria-label="Close reservation">
            <i className="fa fa-times" />
          </button>
        </div>

        <div className="modal-body space-y-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <button onClick={onEdit} className="btn-secondary">
              <i className="fa fa-edit" /> Edit
            </button>
            <button onClick={onPrint} className="btn-secondary">
              <i className="fa fa-print" /> Print
            </button>
            <button onClick={onSendMail} disabled={sending} className="btn-primary">
              <i className={`fa ${sending ? "fa-spinner fa-spin" : "fa-envelope"}`} />
              {sending ? "Sending…" : "Send Mail"}
            </button>
            <span className={`badge ml-auto ${reservation.emailStatus === "sent" ? "badge-green" : reservation.emailStatus === "failed" ? "badge-red" : "badge-yellow"}`}>
              Email: {statusLabel}
            </span>
          </div>

          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Booking Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Detail label="Booking Name" value={reservation.bookingName} />
              <Detail label="Nationality" value={reservation.nationality} />
              <Detail label="Recipients" value={(reservation.emailTo || []).join(", ")} />
              <Detail label="Subject" value={reservation.subject} />
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Guests and Room</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Detail label="Adults" value={reservation.pax?.adults} />
              <Detail label="Child with Bed" value={reservation.pax?.childWithBed} />
              <Detail label="Child without Bed" value={reservation.pax?.childWithoutBed} />
              <Detail label="Child below 5" value={reservation.pax?.childBelow5} />
              <Detail label="Room Category" value={reservation.room?.category} />
              <Detail label="No. of Rooms" value={reservation.room?.noOfRooms} />
              <Detail label="Room Type" value={reservation.room?.type} />
              <Detail label="Extra Bed" value={reservation.room?.extraBed} />
              <Detail label="Meal Plan" value={reservation.room?.mealPlan} />
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Visit Dates</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Detail label="1st Check-In" value={reservation.visits?.visit1in} />
              <Detail label="1st Check-Out" value={reservation.visits?.visit1out} />
              <Detail label="2nd Check-In" value={reservation.visits?.visit2in} />
              <Detail label="2nd Check-Out" value={reservation.visits?.visit2out} />
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <Detail label="Notes" value={reservation.note} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sendingMail, setSendingMail] = useState(false);
  const [printData, setPrintData] = useState(null);
  const printRef = useRef();

  const handlePrint = useReactToPrint({ content: () => printRef.current });

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch, date]);

  const {
    data: { reservations: list = [], total = 0, totalPages = 1 } = {},
    isLoading: loading,
    isFetching,
    error,
  } = useReservationsPaginated({ search: debouncedSearch, date, page, limit: 50 });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["reservations"] });

  const triggerPrint = (r) => {
    setPrintData(r);
    setTimeout(() => handlePrint(), 100);
  };

  const sendReservationMail = async () => {
    if (!viewing?._id) return;
    setSendingMail(true);
    try {
      const { data } = await reservationAPI.sendMail(viewing._id);
      if (data?.data) setViewing(data.data);
      toast.success("Reservation email sent");
      refresh();
    } catch (error) {
      if (error?.response?.data?.data) setViewing(error.response.data.data);
      notifyError(error);
      refresh();
    } finally {
      setSendingMail(false);
    }
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
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0
              ? "No reservations"
              : `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} reservation${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-calendar-check" message="No reservations found" />
        ) : (
          <>
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
                          <button onClick={() => setViewing(r)} className="btn-secondary text-xs py-1 px-2">
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

      {modal && (
        <ReservationModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); refresh(); }}
        />
      )}
      {viewing && (
        <ReservationViewModal
          reservation={viewing}
          sending={sendingMail}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onPrint={() => triggerPrint(viewing)}
          onSendMail={sendReservationMail}
        />
      )}
      {editing && (
        <ReservationModal
          reservation={editing}
          onClose={() => { setViewing(editing); setEditing(null); }}
          onSaved={(updated) => {
            setEditing(null);
            setViewing(updated);
            refresh();
          }}
        />
      )}
    </div>
  );
}
