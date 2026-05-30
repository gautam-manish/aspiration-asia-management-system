import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { voucherAPI, hotelAPI, bookingAPI } from "../../api";
import { getError } from "../../utils/helpers";
import { PageLoader, Field, HotelSearchSelect } from "../../components/common";
import toast from "react-hot-toast";

const ensureUrl = (url = "") => {
  url = url.trim();
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : "https://" + url;
};

const NATIONALITIES = [
  "Afghan","Albanian","American","Argentine","Australian","Austrian","Azerbaijani",
  "Bangladeshi","Belgian","Brazilian","British","Bulgarian","Burmese","Canadian",
  "Chilean","Chinese","Colombian","Croatian","Czech","Danish","Dutch","Egyptian",
  "Emirati","Ethiopian","Filipino","Finnish","French","German","Greek","Hungarian",
  "Indian","Indonesian","Iranian","Irish","Israeli","Italian","Japanese","Jordanian",
  "Kenyan","Korean","Kuwaiti","Lebanese","Malaysian","Maldivian","Mexican","Moroccan",
  "Nepalese","New Zealander","Nigerian","Norwegian","Pakistani","Polish","Portuguese",
  "Qatari","Romanian","Russian","Saudi","Singaporean","South African","Spanish",
  "Sri Lankan","Swedish","Swiss","Thai","Turkish","Ukrainian","Vietnamese",
];
const ROOM_TYPES = ["Single Room","Double Room","DORM","Suite","Triple Room","Quard Room"];
const MEAL_PLANS = ["EP","CP","MAP","AP","JP"];

// ─── Exact original PDF template ─────────────────────────────────────────────
export function VoucherPDF({ v }) {
  const totalPax =
    (Number(v.pax?.adults) || 0) +
    (Number(v.pax?.childWithBed) || 0) +
    (Number(v.pax?.childWithoutBed) || 0) +
    (Number(v.pax?.childBelow5) || 0);

  const rowBg = "rgb(206,218,228)";
  const td  = { padding: 7, fontSize: 13 };
  const tdB = { padding: 7, fontSize: 13, background: rowBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

  const CompanyHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <img src="https://i.ibb.co/bRJr7nNM/images.png" style={{ height: 80 }} alt="logo" />
      <div style={{ textAlign: "right", fontSize: 13 }}>
        <p style={{ fontWeight: 600, margin: 0 }}>Aspiration Asia Trekking and Expedition Pvt Ltd.</p>
        <p style={{ margin: 0 }}>Bhaktapur Durbar Square - Kathmandu, Nepal</p>
        <p style={{ margin: 0 }}>Web: www.aspirationasia.com</p>
        <p style={{ margin: 0 }}>Email: sales@aspirationasia.com / reservations@aspirationasia.com</p>
        <p style={{ margin: 0 }}>Contact: +977-982761738 / +977-9851021924</p>
      </div>
    </div>
  );

  const ConfirmBanner = () => (
    <div style={{ border: "1px solid #ccc", textAlign: "center", padding: 8, fontWeight: "bold", color: "#2563eb", fontSize: 16, marginBottom: 14 }}>
      HOTEL CONFIRMATION VOUCHER
    </div>
  );

  const Footer = () => (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, color: "#1e293b" }}>
      <div style={{ height: 3, background: "#2563eb", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", marginBottom: 16 }} />
      <div style={{ background: "#eff6ff", padding: "12px 16px", borderRadius: 6, marginBottom: 16, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: "#1e3a8a", marginBottom: 8 }}>CANCELLATION POLICY</p>
        <ul style={{ listStyle: "disc", paddingLeft: 18, lineHeight: 1.8, color: "#1e293b", margin: 0 }}>
          <li>All hotel bookings are subject to availability and confirmation.</li>
          <li>Cancellations made <strong>15 days</strong> before arrival – No Refund</li>
          <li>Cancellations made <strong>15–35 days</strong> before arrival – 50% cancellation charge.</li>
          <li>No-show or early checkout – No refund applicable.</li>
          <li>During peak season, festivals, long weekends, or special events, separate cancellation policies may apply.</li>
          <li>Refund processing time depends on hotel and banking procedures. (Min 2 weeks +)</li>
        </ul>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", marginTop: 16, gap: 40 }}>
        <div style={{ textAlign: "center", minWidth: 110 }}>
          <img
            src="https://i.ibb.co/Q3YX09kN/aspiration-asia-stamp-removebg-preview.png"
            style={{ maxHeight: 90, width: "auto", display: "block", margin: "0 auto" }}
            onError={(e) => (e.target.style.display = "none")}
            alt="stamp"
          />
        </div>
        <div style={{ textAlign: "center", minWidth: 180 }}>
          <img
            src="https://i.ibb.co/7dd53TPk/signature.png"
            style={{ maxHeight: 90, width: "auto", display: "block", margin: "0 auto" }}
            onError={(e) => (e.target.style.display = "none")}
            alt="signature"
          />
          <div style={{ width: 180, borderTop: "1px solid #1e293b", paddingTop: 6, fontSize: 12, color: "#475569" }}>
            Authorized Signature
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Aspiration Asia Trekking &amp; Expedition Pvt. Ltd
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
        This is a computer generated voucher. For bookings contact: sales@aspirationasia.com
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", margin: 0, background: "white", padding: "6px 10px", boxSizing: "border-box", fontFamily: "Arial,sans-serif", color: "#000" }}>

      {/* PAGE 1 — Client info */}
      <div style={{ fontFamily: "Arial,sans-serif", color: "#000", marginBottom: 40 }}>
        <CompanyHeader />
        <ConfirmBanner />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {(() => {
              // Build the list of rows that actually have a value, then render with
              // alternating row backgrounds based on visible index.
              const rows = [];
              if (v.bookingId)            rows.push({ label: "BOOKING ID",                value: v.bookingId,            bold: true });
              if (v.guestName)            rows.push({ label: "GUEST NAME",                value: v.guestName,            bold: true });
              if (v.nationality)          rows.push({ label: "NATIONALITY",               value: v.nationality });
              if (v.contactNumber)        rows.push({ label: "CONTACT NUMBER",            value: v.contactNumber });
              if (v.mealInstruction)      rows.push({ label: "MEAL INSTRUCTION",          value: v.mealInstruction });
              if (v.wheelChair)           rows.push({ label: "WHEEL CHAIR",               value: v.wheelChair });
              if (v.arrivalFlightDetails) rows.push({ label: "ARRIVAL FLIGHT DETAILS",    value: v.arrivalFlightDetails });
              if (v.preferredFloor)       rows.push({ label: "PREFERRED FLOOR",           value: v.preferredFloor });
              if (totalPax > 0)           rows.push({ label: "TOTAL PAX",                 value: totalPax });
              if (Number(v.pax?.adults))          rows.push({ label: "ADULTS",                  value: v.pax.adults });
              if (Number(v.pax?.childWithBed))    rows.push({ label: "CHILD WITH BED",          value: v.pax.childWithBed });
              if (Number(v.pax?.childWithoutBed)) rows.push({ label: "CHILD WITHOUT BED (6-10 YRS)", value: v.pax.childWithoutBed });
              if (Number(v.pax?.childBelow5))     rows.push({ label: "CHILD BELOW 5 YRS",       value: v.pax.childBelow5 });

              return rows.map((r, idx) => {
                const cell = idx % 2 === 0 ? td : tdB;
                return (
                  <tr key={r.label}>
                    <td style={{ ...cell, fontWeight: 600, width: "40%" }}>{r.label}</td>
                    <td style={{ ...cell, fontWeight: r.bold ? 700 : 400 }}>{r.value}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {/* HOTEL PAGES — one per hotel, each on new page */}
      {(v.hotels || []).map((h, i) => {
        const isLast = i === v.hotels.length - 1;
        const mapsCell = h.googleMapsLink
          ? <a href={ensureUrl(h.googleMapsLink)} style={{ color: "#2563eb", textDecoration: "underline", wordBreak: "break-all" }}>{h.googleMapsLink}</a>
          : "—";

        const rooms = (h.rooms && h.rooms.length > 0)
          ? h.rooms
          : [{ roomCategory: h.roomCategory, noOfRooms: h.noOfRooms, roomType: h.roomType }];

        return (
          <div
            key={i}
            className="hotel-page"
            style={{
              margin: "20px 0px",
              overflow: "hidden",
              background: "white",
              position: "relative",
              display: "block",
            }}
          >
            <div style={{ fontFamily: "Arial,sans-serif", color: "#000", padding: 20 }}>
              <div style={{
                background: "#2563eb",
                color: "white",
                textAlign: "center",
                padding: 8,
                fontWeight: "bold",
                fontSize: 14,
                marginTop: 0,
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }}>
                HOTEL #{i + 1} - {h.hotelName || ""}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {(() => {
                    const totalRooms = rooms.reduce((sum, r) => sum + (Number(r.noOfRooms) || 0), 0);
                    const allocations = rooms
                      .filter((r) => r.noOfRooms || r.roomCategory || r.roomType)
                      .map((r) => {
                        const count = r.noOfRooms || "";
                        const cat   = r.roomCategory || "";
                        const type  = r.roomType || "";
                        const right = [cat, type].filter(Boolean).join(", ");
                        return [count, right].filter(Boolean).join(" ");
                      });

                    const visit1 = h.visit1in && h.visit1in !== "N/A" ? `${h.visit1in} → ${h.visit1out || "N/A"}` : "";
                    const visit2 = h.visit2in && h.visit2in !== "N/A" ? `${h.visit2in} → ${h.visit2out || "N/A"}` : "";

                    const rowDefs = [];
                    if (h.confirmationNumber) rowDefs.push({ label: "CONFIRMATION NUMBER", node: h.confirmationNumber, bold: true });
                    if (h.hotelName)          rowDefs.push({ label: "HOTEL NAME",          node: h.hotelName });
                    if (h.hotelCity || h.hotelCountry) {
                      rowDefs.push({
                        label: "CITY / COUNTRY",
                        node: [h.hotelCity, h.hotelCountry].filter(Boolean).join(", "),
                      });
                    }
                    if (totalRooms || h.noOfRooms) {
                      rowDefs.push({ label: "NO. OF ROOMS", node: totalRooms || h.noOfRooms });
                    }
                    if (allocations.length > 0 || h.roomCategory || h.roomType) {
                      rowDefs.push({
                        label: "ROOM ALLOCATIONS",
                        node: allocations.length > 0
                          ? allocations.map((line, idx) => (
                              <Fragment key={idx}>
                                {line}
                                {idx < allocations.length - 1 ? <br /> : null}
                              </Fragment>
                            ))
                          : [h.roomCategory, h.roomType].filter(Boolean).join(", "),
                      });
                    }
                    if (h.mealPlan)            rowDefs.push({ label: "MEAL PLAN",     node: h.mealPlan });
                    if (h.hotelContactNumber)  rowDefs.push({ label: "HOTEL CONTACT", node: h.hotelContactNumber });
                    if (h.googleMapsLink)      rowDefs.push({ label: "GOOGLE MAPS",   node: mapsCell });
                    if (visit1) {
                      rowDefs.push({
                        label: "1ST VISIT",
                        node: <><strong>Check-In:</strong> {h.visit1in}<br /><strong>Check-Out:</strong> {h.visit1out || "N/A"}</>,
                      });
                    }
                    if (visit2) {
                      rowDefs.push({
                        label: "2ND VISIT",
                        node: <><strong>Check-In:</strong> {h.visit2in}<br /><strong>Check-Out:</strong> {h.visit2out || "N/A"}</>,
                      });
                    }
                    if (h.includes) rowDefs.push({ label: "INCLUDES", node: h.includes });
                    rowDefs.push({ label: "EMERGENCY NUMBER", node: "+977 982-7621738", emergency: true });

                    return rowDefs.map((r, idx) => {
                      const cell = idx % 2 === 0 ? td : tdB;
                      return (
                        <tr key={r.label}>
                          <td style={{ ...cell, fontWeight: 600, width: "40%" }}>{r.label}</td>
                          <td style={{ ...cell, ...(r.bold ? { fontWeight: "bold" } : {}), ...(r.emergency ? { fontWeight: 600, color: "#dc2626" } : {}) }}>
                            {r.node}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              {isLast && <div style={{ marginTop: 20 }}><Footer /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ voucher, hotels, onClose, onSaved }) {
  const [form, setForm] = useState({
    bookingId:            voucher.bookingId || "",
    guestName:            voucher.guestName || "",
    nationality:          voucher.nationality || "",
    contactNumber:        voucher.contactNumber || "",
    mealInstruction:      voucher.mealInstruction || "",
    wheelChair:           voucher.wheelChair || "",
    arrivalFlightDetails: voucher.arrivalFlightDetails || "",
    preferredFloor:       voucher.preferredFloor || "",
    pax: {
      adults:          voucher.pax?.adults || "",
      childWithBed:    voucher.pax?.childWithBed || "",
      childWithoutBed: voucher.pax?.childWithoutBed || "",
      childBelow5:     voucher.pax?.childBelow5 || "",
    },
    hotelEntries: (voucher.hotels || []).map((h) => ({
      ...h,
      rooms: (h.rooms && h.rooms.length > 0)
        ? h.rooms.map((r) => ({ ...r }))
        : [{ roomCategory: h.roomCategory || "", noOfRooms: h.noOfRooms || "", roomType: h.roomType || "" }],
    })),
  });
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const set    = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPax = (k, v) => setForm((f) => ({ ...f, pax: { ...f.pax, [k]: v } }));

  const lookupBooking = async () => {
    const id = (form.bookingId || "").trim();
    if (!id) { toast.error("Enter a booking ID first"); return; }
    setLookingUp(true);
    try {
      const { data } = await bookingAPI.getByQueryId(id);
      const b = data.data;
      setForm((f) => ({
        ...f,
        bookingId:     b.queryId || id,
        guestName:     b.clientName || f.guestName,
        contactNumber: b.mobile     || f.contactNumber,
        pax: {
          adults:          Number(b.adults)    || 0,
          childWithBed:    Number(b.childEB)   || 0,
          childWithoutBed: Number(b.childNoEB) || 0,
          childBelow5:     Number(b.childU5)   || 0,
        },
      }));
      toast.success(`Booking ${b.queryId} loaded`);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLookingUp(false);
    }
  };

  const addHotel = () =>
    setForm((f) => ({
      ...f,
      hotelEntries: [
        ...f.hotelEntries,
        {
          confirmationNumber: Math.floor(10000000 + Math.random() * 90000000).toString(),
          hotelName: "", hotelCity: "", hotelCountry: "",
          rooms: [{ roomCategory: "", noOfRooms: "", roomType: "" }],
          mealPlan: "",
          visit1in: "", visit1out: "", visit2in: "", visit2out: "",
          hotelContactNumber: "", googleMapsLink: "", includes: "",
        },
      ],
    }));

  const removeHotel = (i) =>
    setForm((f) => ({ ...f, hotelEntries: f.hotelEntries.filter((_, ii) => ii !== i) }));

  const setHotel = (i, k, v) =>
    setForm((f) => {
      const entries = [...f.hotelEntries];
      entries[i] = { ...entries[i], [k]: v };
      return { ...f, hotelEntries: entries };
    });

  const setRoom = (hi, ri, k, v) =>
    setForm((f) => {
      const entries = [...f.hotelEntries];
      const rooms = [...(entries[hi].rooms || [])];
      rooms[ri] = { ...rooms[ri], [k]: v };
      entries[hi] = { ...entries[hi], rooms };
      return { ...f, hotelEntries: entries };
    });

  const addRoom = (hi) =>
    setForm((f) => {
      const entries = [...f.hotelEntries];
      entries[hi] = {
        ...entries[hi],
        rooms: [...(entries[hi].rooms || []), { roomCategory: "", noOfRooms: "", roomType: "" }],
      };
      return { ...f, hotelEntries: entries };
    });

  const removeRoom = (hi, ri) =>
    setForm((f) => {
      const entries = [...f.hotelEntries];
      entries[hi] = {
        ...entries[hi],
        rooms: (entries[hi].rooms || []).filter((_, idx) => idx !== ri),
      };
      return { ...f, hotelEntries: entries };
    });

  const onHotelSelect = (i, picked) => {
    if (!picked) return;
    setForm((f) => {
      const entries = [...f.hotelEntries];
      entries[i] = {
        ...entries[i],
        hotelName:          picked.name || "",
        hotelCity:          picked.city || "",
        hotelCountry:       picked.country || "",
        hotelContactNumber: (picked.contactNumbers && picked.contactNumbers[0]) || entries[i].hotelContactNumber || "",
        googleMapsLink:     picked.googleMapUrl || entries[i].googleMapsLink || "",
      };
      return { ...f, hotelEntries: entries };
    });
  };

  const handleSave = async () => {
    if (!form.guestName.trim()) { toast.error("Guest name is required"); return; }
    setSaving(true);
    try {
      await voucherAPI.update(voucher._id, { ...form, hotels: form.hotelEntries });
      toast.success("Voucher updated ✓");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">Edit Voucher</h2>
          <button onClick={onClose} className="btn-ghost p-1"><i className="fa fa-times" /></button>
        </div>

        <div className="modal-body space-y-5" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          {/* Booking Reference */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Booking Reference</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Booking ID" className="col-span-2">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={form.bookingId}
                    onChange={(e) => set("bookingId", e.target.value)}
                    placeholder="e.g. ASA2026100"
                  />
                  <button
                    type="button"
                    onClick={lookupBooking}
                    disabled={lookingUp || !(form.bookingId || "").trim()}
                    className="btn-secondary text-xs whitespace-nowrap"
                  >
                    {lookingUp ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          {/* Guest */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Guest Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guest Name *"><input className="input" value={form.guestName} onChange={(e) => set("guestName", e.target.value)} /></Field>
              <Field label="Nationality">
                <select className="input" value={form.nationality} onChange={(e) => set("nationality", e.target.value)}>
                  <option value="">—</option>
                  {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Contact Number"><input className="input" type="number" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} /></Field>
              <Field label="Preferred Floor"><input className="input" value={form.preferredFloor} onChange={(e) => set("preferredFloor", e.target.value)} /></Field>
              <Field label="Meal Instruction" className="col-span-2"><input className="input" value={form.mealInstruction} onChange={(e) => set("mealInstruction", e.target.value)} /></Field>
              <Field label="Wheel Chair"><input className="input" value={form.wheelChair} onChange={(e) => set("wheelChair", e.target.value)} /></Field>
              <Field label="Arrival Flight Details"><input className="input" value={form.arrivalFlightDetails} onChange={(e) => set("arrivalFlightDetails", e.target.value)} /></Field>
            </div>
          </div>

          {/* PAX */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Number of Pax</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adults"><input className="input" type="number" min="0" value={form.pax.adults} onChange={(e) => setPax("adults", e.target.value)} /></Field>
              <Field label="Child with Bed"><input className="input" type="number" min="0" value={form.pax.childWithBed} onChange={(e) => setPax("childWithBed", e.target.value)} /></Field>
              <Field label="Child without Bed (6-10)"><input className="input" type="number" min="0" value={form.pax.childWithoutBed} onChange={(e) => setPax("childWithoutBed", e.target.value)} /></Field>
              <Field label="Child below 5 yrs"><input className="input" type="number" min="0" value={form.pax.childBelow5} onChange={(e) => setPax("childBelow5", e.target.value)} /></Field>
            </div>
          </div>

          {/* Hotels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Hotel Entries</p>
              <button onClick={addHotel} className="btn-ghost text-xs text-brand-600"><i className="fa fa-plus" /> Add Hotel</button>
            </div>
            <div className="space-y-4">
              {form.hotelEntries.map((h, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-brand-600">Hotel #{i + 1}</p>
                    <button onClick={() => removeHotel(i)} className="btn-ghost text-xs text-red-500"><i className="fa fa-times" /> Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Confirmation Number" className="col-span-2">
                      <input className="input" value={h.confirmationNumber} onChange={(e) => setHotel(i, "confirmationNumber", e.target.value)} />
                    </Field>
                    <Field label="Hotel Name" className="col-span-2">
                      <HotelSearchSelect
                        hotels={hotels}
                        value={h.hotelName}
                        onChange={(name) => setHotel(i, "hotelName", name)}
                        onSelect={(picked) => onHotelSelect(i, picked)}
                        placeholder="Search hotel by name, city…"
                      />
                    </Field>
                    <Field label="City"><input className="input bg-slate-100" value={h.hotelCity} onChange={(e) => setHotel(i, "hotelCity", e.target.value)} /></Field>
                    <Field label="Country"><input className="input bg-slate-100" value={h.hotelCountry} onChange={(e) => setHotel(i, "hotelCountry", e.target.value)} /></Field>
                    <Field label="Meal Plan">
                      <select className="input" value={h.mealPlan} onChange={(e) => setHotel(i, "mealPlan", e.target.value)}>
                        <option value="">—</option>
                        {MEAL_PLANS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label="1st Check-In"><input className="input" type="date" value={h.visit1in && h.visit1in !== "N/A" ? h.visit1in : ""} onChange={(e) => setHotel(i, "visit1in", e.target.value)} /></Field>
                    <Field label="1st Check-Out"><input className="input" type="date" value={h.visit1out && h.visit1out !== "N/A" ? h.visit1out : ""} onChange={(e) => setHotel(i, "visit1out", e.target.value)} /></Field>
                    <Field label="2nd Check-In"><input className="input" type="date" value={h.visit2in && h.visit2in !== "N/A" ? h.visit2in : ""} onChange={(e) => setHotel(i, "visit2in", e.target.value)} /></Field>
                    <Field label="2nd Check-Out"><input className="input" type="date" value={h.visit2out && h.visit2out !== "N/A" ? h.visit2out : ""} onChange={(e) => setHotel(i, "visit2out", e.target.value)} /></Field>
                    <Field label="Hotel Contact"><input className="input" type="number" value={h.hotelContactNumber} onChange={(e) => setHotel(i, "hotelContactNumber", e.target.value)} /></Field>
                    <Field label="Google Maps Link"><input className="input" value={h.googleMapsLink} onChange={(e) => setHotel(i, "googleMapsLink", e.target.value)} /></Field>
                    <Field label="Includes" className="col-span-2"><input className="input" value={h.includes} onChange={(e) => setHotel(i, "includes", e.target.value)} /></Field>
                  </div>

                  {/* Rooms (repeatable) */}
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rooms</p>
                    <button onClick={() => addRoom(i)} className="btn-ghost text-xs text-brand-600">
                      <i className="fa fa-plus" /> Add Room
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(h.rooms || []).map((r, ri) => (
                      <div key={ri} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-brand-600">Room #{ri + 1}</p>
                          {(h.rooms || []).length > 1 && (
                            <button onClick={() => removeRoom(i, ri)} className="btn-ghost text-xs text-red-500">
                              <i className="fa fa-times" /> Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Field label="Room Category">
                            <input className="input" value={r.roomCategory} onChange={(e) => setRoom(i, ri, "roomCategory", e.target.value)} />
                          </Field>
                          <Field label="Room Type">
                            <select className="input" value={r.roomType} onChange={(e) => setRoom(i, ri, "roomType", e.target.value)}>
                              <option value="">—</option>
                              {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          </Field>
                          <Field label="No. of Rooms">
                            <input className="input" value={r.noOfRooms} onChange={(e) => setRoom(i, ri, "noOfRooms", e.target.value)} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : <><i className="fa fa-save" /> Update</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VoucherDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [voucher, setVoucher] = useState(null);
  const [hotels,  setHotels]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadVoucher = () =>
    voucherAPI.getById(id)
      .then(({ data }) => setVoucher(data.data))
      .catch((err) => toast.error(getError(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadVoucher();
    hotelAPI.getAll().then(({ data }) => setHotels(data.data || [])).catch(() => {});
  }, [id]);

  // Same print mechanics as original — open new window, inject HTML, window.print()
  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Voucher — ${voucher?.guestName}</title>
      <style>
        @page { size: auto; margin: 8mm; }
        html, body { margin:0; padding:0; }
        body { font-family: Arial, sans-serif; }
        table, tr, td, th { border: 1px solid rgb(109,152,187); }
        .hotel-page { background: white; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      </style>
    </head><body>${printContents}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading) return <PageLoader />;
  if (!voucher) return <div className="text-center py-20 text-slate-400">Voucher not found</div>;

  const date = new Date(voucher.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div>
      {/* Toolbar */}
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/vouchers")} className="btn-ghost p-2">
            <i className="fa fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">{voucher.guestName}</h1>
            <p className="page-subtitle">
              {voucher.bookingId ? <><span className="font-mono text-brand-600">{voucher.bookingId}</span> · </> : null}
              Created on {date}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary">
            <i className="fa fa-edit" /> Edit Voucher
          </button>
          <button onClick={handlePrint} className="btn-primary">
            <i className="fa fa-file-pdf" /> Save as PDF
          </button>
        </div>
      </div>

      {/* Screen preview */}
      <div className="space-y-4 no-print">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <i className="fa fa-user text-white text-xs" />
              </div>
              <h3 className="font-semibold text-slate-700">Guest Details</h3>
            </div>
            <span className="badge badge-blue">{voucher.hotels?.length || 0} Hotel{voucher.hotels?.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ["Booking ID",       voucher.bookingId],
              ["Guest Name",       voucher.guestName],
              ["Nationality",      voucher.nationality],
              ["Contact",          voucher.contactNumber],
              ["Preferred Floor",  voucher.preferredFloor],
              ["Meal Instruction", voucher.mealInstruction],
              ["Wheel Chair",      voucher.wheelChair],
              ["Arrival Flight",   voucher.arrivalFlightDetails],
              ["Total Pax",        `${voucher.pax?.adults || 0}A / ${(Number(voucher.pax?.childWithBed || 0) + Number(voucher.pax?.childWithoutBed || 0) + Number(voucher.pax?.childBelow5 || 0))}C`],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <p className="text-xs text-slate-400 mb-0.5">{lbl}</p>
                <p className="font-medium text-slate-800">{val || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {(voucher.hotels || []).map((h, i) => (
          <div key={i} className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                  <i className="fa fa-hotel text-white text-xs" />
                </div>
                <h3 className="font-semibold text-slate-700">Hotel #{i + 1} — {h.hotelName}</h3>
              </div>
              <span className="badge badge-gray">{h.mealPlan}</span>
            </div>
            <div className="card-body grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {[
                ["Confirmation #",  h.confirmationNumber],
                ["City / Country",  h.hotelCity ? `${h.hotelCity}, ${h.hotelCountry}` : "—"],
                ["Hotel Contact",   h.hotelContactNumber],
                ["1st Visit",       h.visit1in && h.visit1in !== "N/A" ? `${h.visit1in} → ${h.visit1out}` : "—"],
                ["2nd Visit",       h.visit2in && h.visit2in !== "N/A" ? `${h.visit2in} → ${h.visit2out}` : "—"],
                ["Includes",        h.includes],
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <p className="text-xs text-slate-400 mb-0.5">{lbl}</p>
                  <p className="font-medium text-slate-800">{val || "—"}</p>
                </div>
              ))}
              {(() => {
                const rooms = (h.rooms && h.rooms.length > 0)
                  ? h.rooms
                  : [{ roomCategory: h.roomCategory, noOfRooms: h.noOfRooms, roomType: h.roomType }];
                return (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-xs text-slate-400 mb-1">Rooms</p>
                    <div className="space-y-1">
                      {rooms.map((r, ri) => (
                        <div key={ri} className="text-xs text-slate-700 bg-slate-50 rounded px-3 py-1.5 border border-slate-100">
                          <span className="font-semibold text-slate-500">#{ri + 1}</span>{" "}
                          <span className="font-medium">{r.roomCategory || "—"}</span>
                          {r.roomType ? <span> · {r.roomType}</span> : null}
                          {r.noOfRooms ? <span> · {r.noOfRooms} room(s)</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Hidden PDF template — injected into new window on print */}
      <div style={{ position: "absolute", left: -9999, top: 0, visibility: "hidden" }}>
        <div ref={printRef}>
          <VoucherPDF v={voucher} />
        </div>
      </div>

      {editing && (
        <EditModal
          voucher={voucher}
          hotels={hotels}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setLoading(true); loadVoucher(); }}
        />
      )}
    </div>
  );
}
