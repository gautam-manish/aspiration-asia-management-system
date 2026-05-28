import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { bookingAPI } from "../../api";
import { getError, formatDate } from "../../utils/helpers";
import { PageLoader, StatusBadge } from "../../components/common";
import toast from "react-hot-toast";

function Row({ label, value }) {
  return (
    <div className="flex py-2 border-b border-slate-100 last:border-0">
      <span className="w-40 text-xs font-medium text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

const EMPTY_ITEM = { title: "", description: "" };

/* ── Printable Itinerary Document ───────────────────────────────── */
function PrintableItinerary({ booking, printRef }) {
  const paxParts = [
    booking.adults    ? `${booking.adults} Adult${booking.adults > 1 ? "s" : ""}` : "",
    booking.childEB   ? `${booking.childEB} Child EB`    : "",
    booking.childNoEB ? `${booking.childNoEB} Child No EB` : "",
    booking.childU5   ? `${booking.childU5} Child U5`    : "",
  ].filter(Boolean).join(" / ");

  return (
    <div ref={printRef}>
      <style>{`
        @media print {
          @page { margin: 20mm 18mm; size: A4; }
        }
        .pi-wrap {
          font-family: Arial, sans-serif;
          font-size: 16px;
          color: #000;
          background: #fff;
          padding: 0;
          line-height: 1.65;
        }
        .pi-summary {
          margin-bottom: 22px;
        }
        .pi-summary-row {
          font-size: 14.5px;
          margin-bottom: 3px;
          color: #000;
        }
        .pi-summary-row strong {
          font-weight: 700;
        }
        .pi-divider-row {
          margin: 22px 0 18px;
        }
        .pi-divider-label {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1a56db;
          white-space: nowrap;
        }
        .pi-item {
          margin-bottom: 20px;
        }
        .pi-item-title {
          font-size: 14.5px;
          font-weight: 700;
          color: #c0392b;
          margin-bottom: 6px;
        }
        .pi-item-desc {
          font-size: 14.5px;
          color: #000;
          line-height: 1.7;
          white-space: pre-wrap;
          margin: 0;
          padding-left: 2px;
        }
        .pi-bullets {
          margin: 0;
          padding-left: 20px;
          list-style: disc;
        }
        .pi-bullets li {
          font-size: 14.5px;
          color: #000;
          line-height: 1.75;
          margin-bottom: 2px;
        }
      `}</style>

      <div className="pi-wrap">

        {/* Summary block */}
        <div className="pi-summary">
          <div className="pi-summary-row">
            <strong>Duration:</strong> {booking.noOfDays || "—"}
          </div>
          <div className="pi-summary-row">
            <strong>Arrival Date:</strong> {formatDate(booking.arrivalDate)}
          </div>
          <div className="pi-summary-row">
            <strong>Departure Date:</strong> {formatDate(booking.departureDate)}
          </div>
          <div className="pi-summary-row">
            <strong>Total no. of Pax:</strong> {paxParts || "—"}
          </div>
          <div className="pi-summary-row">
            <strong>Hotel Category:</strong> {booking.hotelCategory || "—"}
          </div>
          {booking.rooms ? (
            <div className="pi-summary-row">
              <strong>No. of Rooms:</strong> {booking.rooms}
            </div>
          ) : null}
          <div className="pi-summary-row">
            <strong>Meal Plan:</strong> {booking.mealPlan || "—"}
          </div>
        </div>

        {/* DETAIL ITINERARY divider */}
        <div className="pi-divider-row">
          <span className="pi-divider-label">Detail Itinerary</span>
        </div>

        {/* Itinerary days */}
        {(booking.itinerary || []).map((item, i) => {
          // split description by newlines into bullet points
          const lines = (item.description || "")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

          return (
            <div key={i} className="pi-item">
              <div className="pi-item-title">
                Day {i + 1}{item.title ? `: ${item.title}` : ""}
              </div>
              {lines.length > 1 ? (
                <ul >
                  {lines.map((line, j) => (
                    <li key={j}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="pi-item-desc">{item.description || ""}</p>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}
/* ── Itinerary Modal (add / edit) ───────────────────────────────── */
function ItineraryModal({ booking, onClose, onSaved }) {
  const [items, setItems] = useState(
    booking.itinerary?.length
      ? booking.itinerary.map((i) => ({ ...i }))
      : [{ ...EMPTY_ITEM }]
  );
  const [saving, setSaving] = useState(false);

  const addItem    = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));
  const updateItem = (index, field, value) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  const handleSave = async () => {
    setSaving(true);
    try {
      await bookingAPI.saveItinerary(booking._id, { itinerary: items });
      toast.success("Itinerary saved");
      onSaved();
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const paxParts = [
    booking.adults    ? `${booking.adults} Adult${booking.adults > 1 ? "s" : ""}` : "",
    booking.childEB   ? `${booking.childEB} Child EB`    : "",
    booking.childNoEB ? `${booking.childNoEB} Child No EB` : "",
    booking.childU5   ? `${booking.childU5} Child U5`    : "",
  ].filter(Boolean).join(", ");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-display font-semibold text-slate-800">
            {booking.itinerary?.length ? "Edit Itinerary" : "Add Itinerary"}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
            <i className="fa fa-times" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
            <InfoPill label="Duration"       value={booking.noOfDays} />
            <InfoPill label="Arrival"        value={formatDate(booking.arrivalDate)} />
            <InfoPill label="Departure"      value={formatDate(booking.departureDate)} />
            <InfoPill label="No. of Pax"     value={paxParts} />
            <InfoPill label="Hotel Category" value={booking.hotelCategory} />
            <InfoPill label="Rooms"          value={booking.rooms} />
            <InfoPill label="Meal Plan"      value={booking.mealPlan} />
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-sm font-medium text-slate-700">Detailed Itinerary</span>
            <button
              type="button"
              onClick={addItem}
              className="btn-ghost text-brand-600 text-xs py-1 px-2 flex items-center gap-1"
            >
              <i className="fa fa-plus text-xs" />
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                {items.length > 1 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-medium">Day {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="btn-ghost text-red-400 hover:text-red-600 text-xs p-1"
                    >
                      <i className="fa fa-trash-o" />
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                  <input
                    className="input"
                    placeholder={`e.g. Day ${index + 1} – Arrival in Kathmandu`}
                    value={item.title}
                    onChange={(e) => updateItem(index, "title", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    placeholder="Describe the day's activities…"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="w-full border border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors flex items-center justify-center gap-1"
          >
            <i className="fa fa-plus text-xs" /> Add another day
          </button>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save Itinerary"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── View Itinerary Modal ───────────────────────────────────────── */
function ViewItineraryModal({ booking, onClose, onEdit }) {
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Itinerary_${booking.queryId}`,
  });

  const paxParts = [
    booking.adults    ? `${booking.adults} Adult${booking.adults > 1 ? "s" : ""}` : "",
    booking.childEB   ? `${booking.childEB} Child EB`    : "",
    booking.childNoEB ? `${booking.childNoEB} Child No EB` : "",
    booking.childU5   ? `${booking.childU5} Child U5`    : "",
  ].filter(Boolean).join(", ");

  return (
    <>
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <PrintableItinerary booking={booking} printRef={printRef} />
      </div>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="font-display font-semibold text-slate-800">Itinerary</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-slate-600"
                title="Print / Save as PDF"
              >
                <i className="fa fa-print text-slate-500" /> Print
              </button>
              <button
                onClick={onEdit}
                className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-brand-600"
              >
                <i className="fa fa-edit" /> Edit
              </button>
              <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
                <i className="fa fa-times" />
              </button>
            </div>
          </div>

          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
              <InfoPill label="Duration"       value={booking.noOfDays} />
              <InfoPill label="Arrival"        value={formatDate(booking.arrivalDate)} />
              <InfoPill label="Departure"      value={formatDate(booking.departureDate)} />
              <InfoPill label="No. of Pax"     value={paxParts} />
              <InfoPill label="Hotel Category" value={booking.hotelCategory} />
              <InfoPill label="Rooms"          value={booking.rooms} />
              <InfoPill label="Meal Plan"      value={booking.mealPlan} />
            </div>

            <div className="border-b border-slate-200 pb-2">
              <span className="text-sm font-medium text-slate-700">Detailed Itinerary</span>
            </div>

            <div className="space-y-3">
              {(booking.itinerary || []).map((item, i) => (
                <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      DAY {i + 1}
                    </span>
                    <p className="text-sm font-medium text-slate-800">{item.title || `Day ${i + 1}`}</p>
                  </div>
                  {item.description && (
                    <p className="text-sm text-slate-500 whitespace-pre-line pl-1">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // "add" | "view" | "edit" | null

  const fetchBooking = () => {
    setLoading(true);
    bookingAPI
      .getById(id)
      .then(({ data }) => setBooking(data.data))
      .catch((err) => toast.error(getError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBooking(); }, [id]);

  if (loading) return <PageLoader />;
  if (!booking) return <div className="text-center py-20 text-slate-400">Booking not found</div>;

  const hasItinerary = booking.itinerary?.length > 0;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/bookings")} className="btn-ghost p-2 rounded-lg">
            <i className="fa fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">Booking Details</h1>
            <p className="page-subtitle font-mono text-brand-600">{booking.queryId}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-brand-600">{booking.queryId}</span>
            <StatusBadge status={booking.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Created {formatDate(booking.createdAt)}</span>
            {hasItinerary ? (
              <button
                onClick={() => setModal("view")}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <i className="fa fa-map-o text-xs" /> View Itinerary
              </button>
            ) : (
              <button
                onClick={() => setModal("add")}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <i className="fa fa-plus text-xs" /> Add Itinerary
              </button>
            )}
          </div>
        </div>

        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Client Information</h3>
              <Row label="Client / Agent" value={booking.clientName} />
              <Row label="Email"          value={booking.email} />
              <Row label="Mobile"         value={booking.mobile} />
              <Row label="Address"        value={booking.address} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Trip Details</h3>
              <Row label="Destination"    value={booking.destination} />
              <Row label="Pickup Point"   value={booking.pickupPoint} />
              <Row label="Drop Point"     value={booking.dropPoint} />
              <Row label="Arrival Date"   value={formatDate(booking.arrivalDate)} />
              <Row label="Departure Date" value={formatDate(booking.departureDate)} />
              <Row label="No. of Days"    value={booking.noOfDays} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pax Details</h3>
              <Row label="Adults"               value={booking.adults} />
              <Row label="Child (Extra Bed)"    value={booking.childEB} />
              <Row label="Child (No Extra Bed)" value={booking.childNoEB} />
              <Row label="Child (Under 5)"      value={booking.childU5} />
              <Row label="Rooms"                value={booking.rooms} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hotel & Meal</h3>
              <Row label="Hotel Category" value={booking.hotelCategory} />
              <Row label="Meal Plan"      value={booking.mealPlan} />
            </div>
          </div>
        </div>
      </div>

      {(modal === "add" || modal === "edit") && (
        <ItineraryModal
          booking={booking}
          onClose={() => setModal(hasItinerary ? "view" : null)}
          onSaved={() => { fetchBooking(); setModal("view"); }}
        />
      )}

      {modal === "view" && (
        <ViewItineraryModal
          booking={booking}
          onClose={() => setModal(null)}
          onEdit={() => setModal("edit")}
        />
      )}
    </div>
  );
}