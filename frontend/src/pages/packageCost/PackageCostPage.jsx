import { useState } from "react";
import { emailAPI } from "../../api";
import { notifyError } from "../../utils/helpers";
import { Field } from "../../components/common";
import { useHotels } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const MEAL_PLANS = ["EP", "CP", "MAP", "AP", "JP"];
const today = () => new Date().toISOString().split("T")[0];

const EMPTY_ROW = { hotelId: "", hotelName: "", city: "", nights: 1, rooms: 1, mealPlan: "CP", ratePerRoom: 0, total: 0 };

function calcRow(r) {
  return { ...r, total: (Number(r.nights) || 0) * (Number(r.rooms) || 0) * (Number(r.ratePerRoom) || 0) };
}

export default function PackageCostPage() {
  // Cached hotels list — same hook used by VouchersPage / VoucherDetailPage.
  const { data: hotels = [] } = useHotels();
  const [rows,    setRows]    = useState([{ ...EMPTY_ROW }]);
  const [sending, setSending] = useState(false);

  // Agency
  const [agency, setAgency] = useState({ companyName: "", contactPerson: "", contactNumber: "" });
  // Client
  const [client, setClient] = useState({
    name: "", nationality: "", mobile: "", email: "",
    arrivalDate: today(), departureDate: today(),
    adults: 1, childEB: 0, childNoEB: 0, childU5: 0,
  });
  // Costs
  const [costs, setCosts] = useState({
    transferPickup: 0, transferDrop: 0,
    guide: 0, porter: 0, permit: 0,
    flightDomestic: 0, otherServices: 0,
  });
  const [miscLabel, setMiscLabel] = useState("Other Services");

  // ── helpers ──────────────────────────────────────────────────────
  const setA = (k, v) => setAgency((a) => ({ ...a, [k]: v }));
  const setC = (k, v) => setClient((c) => ({ ...c, [k]: v }));
  const setCS = (k, v) => setCosts((c) => ({ ...c, [k]: v }));

  // days between dates
  const days = (() => {
    try {
      const d1 = new Date(client.arrivalDate);
      const d2 = new Date(client.departureDate);
      const diff = Math.ceil((d2 - d1) / 86400000);
      return diff > 0 ? diff : 0;
    } catch { return 0; }
  })();

  const totalPax =
    Number(client.adults || 0) +
    Number(client.childEB || 0) +
    Number(client.childNoEB || 0) +
    Number(client.childU5 || 0);

  // accommodation total
  const accomTotal = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);

  // cost total
  const costsTotal = Object.values(costs).reduce((s, v) => s + (Number(v) || 0), 0);

  const grandTotal = accomTotal + costsTotal;

  // ── row helpers ───────────────────────────────────────────────────
  const setRow = (i, k, v) => {
    setRows((rs) => {
      const next = [...rs];
      next[i] = calcRow({ ...next[i], [k]: v });
      // if hotel selected, auto-fill name + city
      if (k === "hotelId") {
        const h = hotels.find((x) => x._id === v);
        if (h) next[i] = calcRow({ ...next[i], hotelName: h.name, city: h.city || "" });
      }
      return next;
    });
  };
  const addRow    = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, ii) => ii !== i));

  // ── send email ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!client.email.trim()) { toast.error("Client email is required to send"); return; }
    setSending(true);
    try {
      await emailAPI.sendPackageMail({
        agency,
        clientDetails: client,
        costs,
        accommodation: rows,
        total: grandTotal,
      });
      toast.success("Email sent ✓");
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  };

  // ── input style ───────────────────────────────────────────────────
  const inp = "input text-sm";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Package Cost Calculator</h1>
          <p className="page-subtitle">Build a tour package and send a quote by email</p>
        </div>
        <button onClick={handleSend} disabled={sending} className="btn-primary">
          <i className="fa fa-envelope" /> {sending ? "Sending…" : "Send Email"}
        </button>
      </div>

      {/* ── Agency ─────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-header"><h3 className="font-semibold text-slate-700">Agency Details</h3></div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Company Name"><input className={inp} value={agency.companyName} onChange={(e) => setA("companyName", e.target.value)} /></Field>
          <Field label="Contact Person"><input className={inp} value={agency.contactPerson} onChange={(e) => setA("contactPerson", e.target.value)} /></Field>
          <Field label="Contact Number"><input className={inp} value={agency.contactNumber} onChange={(e) => setA("contactNumber", e.target.value)} /></Field>
        </div>
      </div>

      {/* ── Client ─────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-header"><h3 className="font-semibold text-slate-700">Client Details</h3></div>
        <div className="card-body space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Client Name" className="col-span-2 sm:col-span-2"><input className={inp} value={client.name} onChange={(e) => setC("name", e.target.value)} /></Field>
            <Field label="Nationality"><input className={inp} value={client.nationality} onChange={(e) => setC("nationality", e.target.value)} /></Field>
            <Field label="Mobile"><input className={inp} value={client.mobile} onChange={(e) => setC("mobile", e.target.value)} /></Field>
            <Field label="Email" className="col-span-2"><input className={inp} type="email" value={client.email} onChange={(e) => setC("email", e.target.value)} /></Field>
            <Field label="Arrival Date"><input className={inp} type="date" value={client.arrivalDate} onChange={(e) => setC("arrivalDate", e.target.value)} /></Field>
            <Field label="Departure Date"><input className={inp} type="date" value={client.departureDate} onChange={(e) => setC("departureDate", e.target.value)} /></Field>
          </div>
          {days > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-brand-700 font-medium">
              <i className="fa fa-calendar mr-2" />{days} night{days !== 1 ? "s" : ""} / {days + 1} day{days + 1 !== 1 ? "s" : ""}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Adults"><input className={inp} type="number" min="0" value={client.adults} onChange={(e) => setC("adults", e.target.value)} /></Field>
            <Field label="Child (EB)"><input className={inp} type="number" min="0" value={client.childEB} onChange={(e) => setC("childEB", e.target.value)} /></Field>
            <Field label="Child (No EB)"><input className={inp} type="number" min="0" value={client.childNoEB} onChange={(e) => setC("childNoEB", e.target.value)} /></Field>
            <Field label="Child U5"><input className={inp} type="number" min="0" value={client.childU5} onChange={(e) => setC("childU5", e.target.value)} /></Field>
          </div>
          {totalPax > 0 && (
            <p className="text-sm text-slate-500">Total Pax: <strong className="text-slate-800">{totalPax}</strong></p>
          )}
        </div>
      </div>

      {/* ── Accommodation ─────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700">Accommodation</h3>
          <button onClick={addRow} className="btn-ghost text-xs text-brand-600"><i className="fa fa-plus" /> Add Row</button>
        </div>
        <div className="card-body space-y-2">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_0.6fr_0.6fr_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            <span>Hotel</span><span>City</span><span>Nights</span><span>Rooms</span><span>Meal Plan</span><span>Rate/Room</span><span>Total</span><span></span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_0.6fr_0.6fr_1fr_1fr_1fr_auto] gap-2 items-end bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Field label="Hotel">
                <select className="input text-xs" value={r.hotelId} onChange={(e) => setRow(i, "hotelId", e.target.value)}>
                  <option value="">Select hotel…</option>
                  {hotels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
              </Field>
              <Field label="City">
                <input className="input text-xs bg-slate-100" value={r.city} readOnly />
              </Field>
              <Field label="Nights">
                <input className="input text-xs" type="number" min="1" value={r.nights} onChange={(e) => setRow(i, "nights", e.target.value)} />
              </Field>
              <Field label="Rooms">
                <input className="input text-xs" type="number" min="1" value={r.rooms} onChange={(e) => setRow(i, "rooms", e.target.value)} />
              </Field>
              <Field label="Meal Plan">
                <select className="input text-xs" value={r.mealPlan} onChange={(e) => setRow(i, "mealPlan", e.target.value)}>
                  {MEAL_PLANS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Rate/Room (Rs.)">
                <input className="input text-xs" type="number" min="0" value={r.ratePerRoom} onChange={(e) => setRow(i, "ratePerRoom", e.target.value)} />
              </Field>
              <Field label="Total">
                <div className="input bg-slate-100 text-xs font-semibold text-slate-700">
                  Rs. {Number(r.total || 0).toLocaleString("en-IN")}
                </div>
              </Field>
              <button onClick={() => removeRow(i)} className="btn-ghost text-red-400 hover:text-red-600 p-2 mt-4">
                <i className="fa fa-times text-xs" />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700">
              Accommodation Total: <span className="text-brand-600 text-base">Rs. {accomTotal.toLocaleString("en-IN")}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Cost Details ──────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-header"><h3 className="font-semibold text-slate-700">Cost Details</h3></div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["transferPickup", "Transfer Pickup (Rs.)"],
              ["transferDrop",   "Transfer Drop (Rs.)"],
              ["guide",          "Guide (Rs.)"],
              ["porter",         "Porter (Rs.)"],
              ["permit",         "Permit (Rs.)"],
              ["flightDomestic", "Domestic Flight (Rs.)"],
            ].map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <input className="input text-sm" type="number" min="0" value={costs[k]} onChange={(e) => setCS(k, e.target.value)} />
              </Field>
            ))}
            <Field label={<input className="input text-xs py-0.5 px-2 h-6 mb-1" value={miscLabel} onChange={(e) => setMiscLabel(e.target.value)} placeholder="Other Services" />}>
              <input className="input text-sm" type="number" min="0" value={costs.otherServices} onChange={(e) => setCS("otherServices", e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Grand Total ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex justify-between gap-16 text-sm text-slate-600">
                <span>Accommodation</span>
                <span>Rs. {accomTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between gap-16 text-sm text-slate-600">
                <span>Other Costs</span>
                <span>Rs. {costsTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Grand Total</p>
              <p className="text-3xl font-bold text-brand-600">Rs. {grandTotal.toLocaleString("en-IN")}</p>
              {totalPax > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Per pax: Rs. {Math.round(grandTotal / totalPax).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
