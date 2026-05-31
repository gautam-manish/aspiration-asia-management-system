import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBookings } from "../../hooks/useApiQueries";
import { formatDate, notifyError } from "../../utils/helpers";
import { PageLoader, Empty, StatusBadge } from "../../components/common";

// ── Helpers ───────────────────────────────────────────────────────────────
// Returns YYYY-MM-DD for any Date (or date string), in the user's local TZ.
const toDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "";
  const yyyy = dt.getFullYear();
  const mm   = String(dt.getMonth() + 1).padStart(2, "0");
  const dd   = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

// Build the strip: yesterday, today, and the next 6 days (8 buttons total).
const buildDateStrip = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [-1, 0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = addDays(today, offset);
    return {
      date:    d,
      key:     toDateKey(d),
      offset,
      label:   d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
    };
  });
};

const RELATIVE_LABEL = {
  "-1": "Yesterday",
  "0":  "Today",
  "1":  "Tomorrow",
};

export default function UpcomingArrivalsPage() {
  const navigate = useNavigate();

  // Date strip is computed once per mount (the user is unlikely to keep this
  // page open across midnight; if they do, a navigate-back will refresh it).
  const dateStrip = useMemo(() => buildDateStrip(), []);

  // Default selection is today.
  const [selectedKey, setSelectedKey] = useState(
    dateStrip.find((d) => d.offset === 0).key
  );

  // Pull confirmed bookings once. We filter client-side by arrival date.
  const { data: bookings = [], isLoading: loading, error } = useBookings({
    status: "confirmed",
    search: "",
  });
  useEffect(() => { if (error) notifyError(error); }, [error]);

  // Group bookings by arrival YYYY-MM-DD for fast counts + filtering.
  const byDate = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      if (!b.arrivalDate) continue;
      const key = toDateKey(b.arrivalDate);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    return map;
  }, [bookings]);

  const selectedBookings = byDate.get(selectedKey) || [];
  const selectedDateObj  = dateStrip.find((d) => d.key === selectedKey)?.date
                            || new Date(selectedKey);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Upcoming Arrivals</h1>
          <p className="page-subtitle">Quick view of bookings arriving soon</p>
        </div>
        <button onClick={() => navigate("/bookings")} className="btn-secondary">
          <i className="fa fa-list" /> All Bookings
        </button>
      </div>

      {/* Date strip */}
      <div className="card mb-4">
        <div className="card-body !py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {dateStrip.map((d) => {
              const isActive = d.key === selectedKey;
              const count    = byDate.get(d.key)?.length || 0;
              const relLabel = RELATIVE_LABEL[String(d.offset)];

              return (
                <button
                  key={d.key}
                  onClick={() => setSelectedKey(d.key)}
                  className={`flex-shrink-0 w-24 sm:w-28 rounded-xl border-2 px-2 py-2.5 text-center transition-colors ${
                    isActive
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <p className={`text-[10px] uppercase tracking-widest font-semibold ${isActive ? "text-brand-500" : "text-slate-400"}`}>
                    {relLabel || d.weekday}
                  </p>
                  <p className={`text-lg font-bold mt-0.5 ${isActive ? "text-brand-700" : "text-slate-800"}`}>
                    {d.label}
                  </p>
                  {count > 0 ? (
                    <p className={`text-[11px] mt-1 font-medium ${isActive ? "text-brand-600" : "text-slate-500"}`}>
                      {count} arrival{count !== 1 ? "s" : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] mt-1 text-slate-300">—</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Booking list for the selected date */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="font-semibold text-slate-700">
              {(RELATIVE_LABEL[String(dateStrip.find((d) => d.key === selectedKey)?.offset)] || "")}
              {RELATIVE_LABEL[String(dateStrip.find((d) => d.key === selectedKey)?.offset)] ? " · " : ""}
              {selectedDateObj.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedBookings.length} booking{selectedBookings.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8"><PageLoader /></div>
        ) : selectedBookings.length === 0 ? (
          <Empty icon="fa-bookmark" message="No arrivals on this date" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Client / Agent</th>
                  <th>Destination</th>
                  <th>Departure</th>
                  <th>Pax</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedBookings.map((b) => (
                  <tr key={b._id}>
                    <td className="font-mono text-xs text-brand-600 font-medium">{b.queryId}</td>
                    <td>
                      <p className="font-medium text-slate-800">{b.clientName}</p>
                      {b.email && <p className="text-xs text-slate-400">{b.email}</p>}
                    </td>
                    <td><span className="badge badge-blue">{b.destination}</span></td>
                    <td className="text-slate-600 text-xs">{formatDate(b.departureDate)}</td>
                    <td className="text-xs text-slate-600">
                      {b.adults}A {b.childEB ? `${b.childEB}CEB ` : ""}
                      {b.childNoEB ? `${b.childNoEB}CNEB ` : ""}
                      {b.childU5 ? `${b.childU5}U5` : ""}
                    </td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="text-right">
                      <button
                        onClick={() => navigate(`/bookings/${b._id}`)}
                        className="btn-ghost text-xs py-1 px-2"
                      >
                        <i className="fa fa-eye" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
