import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { voucherAPI, bookingAPI, hotelAPI } from "../../api";
import { formatDate, notifyError } from "../../utils/helpers";
import { PageLoader, Empty, SearchBar, Field, SectionTitle, HotelSearchSelect, Pagination } from "../../components/common";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useVouchersPaginated, useHotels } from "../../hooks/useApiQueries";
import toast from "react-hot-toast";

const EMPTY_ROOM = { roomCategory: "", noOfRooms: "", roomType: "" };

const generateConfirmationNumber = () => Math.floor(100000 + Math.random() * 900000).toString();
const cleanConfirmationNumber = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);
const formatHotelContactNumbers = (hotel = {}) => (
  Array.isArray(hotel.contactNumbers)
    ? hotel.contactNumbers.map((n) => String(n || "").trim()).filter(Boolean).slice(0, 2).join(" | ")
    : ""
);

const EMPTY_HOTEL = {
  confirmationNumber:"", hotelName:"", hotelCity:"", hotelCountry:"",
  rooms: [{ ...EMPTY_ROOM }],
  mealPlan:"",
  visit1in:"", visit1out:"", visit2in:"", visit2out:"",
  includes:"", hotelContactNumber:"", googleMapsLink:"",
};

function VoucherModal({ onClose, onSaved }) {
  const { data: hotels = [] } = useHotels();

  const [form, setForm] = useState({
    bookingId:"",
    guestName:"", nationality:"", contactNumber:"", mealInstruction:"",
    wheelChair:"", arrivalFlightDetails:"", preferredFloor:"",
    pax:{ adults:0, childWithBed:0, childWithoutBed:0, childBelow5:0 },
    hotels:[{ ...EMPTY_HOTEL, confirmationNumber: generateConfirmationNumber() }],
  });
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const set    = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPax = (k, v) => setForm((f) => ({ ...f, pax: { ...f.pax, [k]: v } }));
  const setHotel = (i, k, v) => setForm((f) => {
    const h = [...f.hotels]; h[i] = { ...h[i], [k]: v }; return { ...f, hotels: h };
  });
  const onHotelPick = (i, h) => setForm((f) => {
    const list = [...f.hotels];
    list[i] = {
      ...list[i],
      hotelName:          h.name || "",
      hotelCity:          h.city || "",
      hotelCountry:       h.country || "",
      hotelContactNumber: formatHotelContactNumbers(h),
      googleMapsLink:     h.googleMapUrl || "",
    };
    return { ...f, hotels: list };
  });
  const addHotel    = () => setForm((f) => ({ ...f, hotels: [...f.hotels, { ...EMPTY_HOTEL, confirmationNumber: generateConfirmationNumber(), rooms: [{ ...EMPTY_ROOM }] }] }));
  const removeHotel = (i) => setForm((f) => ({ ...f, hotels: f.hotels.filter((_, idx) => idx !== i) }));

  const setRoom = (hi, ri, k, v) => setForm((f) => {
    const h = [...f.hotels];
    const rooms = [...(h[hi].rooms || [])];
    rooms[ri] = { ...rooms[ri], [k]: v };
    h[hi] = { ...h[hi], rooms };
    return { ...f, hotels: h };
  });
  const addRoom = (hi) => setForm((f) => {
    const h = [...f.hotels];
    h[hi] = { ...h[hi], rooms: [...(h[hi].rooms || []), { ...EMPTY_ROOM }] };
    return { ...f, hotels: h };
  });
  const removeRoom = (hi, ri) => setForm((f) => {
    const h = [...f.hotels];
    h[hi] = { ...h[hi], rooms: (h[hi].rooms || []).filter((_, idx) => idx !== ri) };
    return { ...f, hotels: h };
  });

  const lookupBooking = async () => {
    const id = form.bookingId.trim();
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
      notifyError(err);
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await voucherAPI.create(form);
      toast.success("Voucher created");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">New Voucher</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><i className="fa fa-times" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <SectionTitle>Booking Reference</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Booking ID">
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
                    disabled={lookingUp || !form.bookingId.trim()}
                    className="btn-secondary text-xs whitespace-nowrap"
                  >
                    {lookingUp ? "Fetching…" : <><i className="fa fa-search" /> Fetch</>}
                  </button>
                </div>
              </Field>
            </div>

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
            <div className="mt-2">
              <SectionTitle>Hotel Blocks</SectionTitle>
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
                    <HotelSearchSelect
                      hotels={hotels}
                      value={h.hotelName}
                      onChange={(name) => setHotel(i, "hotelName", name)}
                      onSelect={(picked) => onHotelPick(i, picked)}
                      placeholder="Search hotel by name, city…"
                    />
                  </Field>
                  <Field label="City">
                    <input className="input bg-slate-50" value={h.hotelCity} onChange={(e) => setHotel(i, "hotelCity", e.target.value)} />
                  </Field>
                  <Field label="Country">
                    <input className="input bg-slate-50" value={h.hotelCountry} onChange={(e) => setHotel(i, "hotelCountry", e.target.value)} />
                  </Field>
                  <Field label="Confirmation No.">
                    <input className="input font-mono font-bold text-brand-700" value={h.confirmationNumber} onChange={(e) => setHotel(i, "confirmationNumber", cleanConfirmationNumber(e.target.value))} maxLength={6} inputMode="numeric" />
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
                  <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>
                  <Field label="Includes">
                    <input className="input" value={h.includes} onChange={(e) => setHotel(i, "includes", e.target.value)} placeholder="Breakfast, WiFi…" />
                  </Field>
                  <Field label="Google Maps Link">
                    <input className="input" value={h.googleMapsLink} onChange={(e) => setHotel(i, "googleMapsLink", e.target.value)} />
                  </Field>
                </div>

                {/* Rooms (repeatable) */}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rooms</p>
                  <button type="button" onClick={() => addRoom(i)} className="btn-ghost text-xs text-brand-600">
                    <i className="fa fa-plus" /> Add Room
                  </button>
                </div>
                <div className="space-y-2">
                  {(h.rooms || []).map((r, ri) => (
                    <div key={ri} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-brand-600">Room #{ri + 1}</p>
                        {(h.rooms || []).length > 1 && (
                          <button type="button" onClick={() => removeRoom(i, ri)} className="btn-ghost text-xs text-red-500">
                            <i className="fa fa-times" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label="Room Category">
                          <input className="input" value={r.roomCategory} onChange={(e) => setRoom(i, ri, "roomCategory", e.target.value)} />
                        </Field>
                        <Field label="Room Type">
                          <input className="input" value={r.roomType} onChange={(e) => setRoom(i, ri, "roomType", e.target.value)} />
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
            <div className="flex justify-end pt-1">
              <button type="button" onClick={addHotel} className="btn-secondary text-xs">
                <i className="fa fa-plus" /> Add Hotel
              </button>
            </div>
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
  const qc = useQueryClient();
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(false);

  const PAGE_SIZE = 50;
  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, date]);

  const {
    data: pageData = { vouchers: [], total: 0, totalPages: 1 },
    isLoading: loading,
    isFetching,
    error,
  } = useVouchersPaginated({ search: debouncedSearch, date, page, limit: PAGE_SIZE });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  const list       = pageData.vouchers;
  const total      = pageData.total      || 0;
  const totalPages = pageData.totalPages || 1;
  const fromRow    = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow      = Math.min(page * PAGE_SIZE, total);

  const refresh = () => qc.invalidateQueries({ queryKey: ["vouchers"] });

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
          <SearchBar value={search} onChange={setSearch} placeholder="Search by guest or booking ID..." />
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          {date && <button onClick={() => setDate("")} className="btn-ghost text-xs">Clear</button>}
          <span className="text-sm text-slate-500 ml-auto">
            {total === 0 ? "No vouchers" : `${fromRow}–${toRow} of ${total} voucher${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? <div className="p-8"><PageLoader /></div> : list.length === 0 ? (
          <Empty icon="fa-ticket-alt" message="No vouchers found" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
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
                      <td className="text-xs font-mono text-slate-600">{v.bookingId || "—"}</td>
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

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={PAGE_SIZE}
              onChange={setPage}
              isFetching={isFetching}
            />
          </>
        )}
      </div>

      {modal && <VoucherModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}
    </div>
  );
}
