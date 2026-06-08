// ── Spinner ────────────────────────────────────────────────────────
export function Spinner({ size = "md" }) {
  const s = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" }[size];
  return (
    <div className={`animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${s}`} />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────
export function Empty({ icon = "fa-inbox", message = "No records found", action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <i className={`fa ${icon} text-2xl text-slate-400`} />
      </div>
      <p className="text-slate-500 text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Confirm Modal ──────────────────────────────────────────────────
export function ConfirmModal({ open, title, message, onConfirm, onCancel, loading, variant = "danger" }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-display font-semibold text-slate-800">{title}</h3>
          <button onClick={onCancel} className="btn-ghost p-1 rounded-lg">
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="modal-body">
          <p className="text-slate-600 text-sm">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={variant === "danger" ? "btn-danger" : "btn-primary"}
          >
            {loading ? <Spinner size="sm" /> : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Search Bar ─────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="relative w-full sm:w-64">
      <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 w-full"
      />
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    confirmed: "badge-green",
    cancelled:  "badge-red",
    active:     "badge-blue",
    pending:    "badge-yellow",
  };
  return (
    <span className={map[status] || "badge-gray"}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "—"}
    </span>
  );
}

// ── Form Field ─────────────────────────────────────────────────────
export function Field({ label, children, required, className = "" }) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Section Title ──────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

// ── Hotel Search Select ────────────────────────────────────────────
// Searchable dropdown for picking a hotel by name.
// `hotels` is the full list; `value` is the current hotel name string.
// `onSelect(hotel)` fires with the full hotel object on pick;
// `onChange(name)` fires while the user types (so unmatched names still persist).
import { useEffect, useMemo, useRef, useState } from "react";

export function HotelSearchSelect({ hotels = [], value = "", onSelect, onChange, placeholder = "Search hotel…" }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen]   = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hotels.slice(0, 50);
    return hotels.filter((h) =>
      [h.name, h.city, h.country].some((f) => (f || "").toLowerCase().includes(q))
    ).slice(0, 50);
  }, [hotels, query]);

  return (
    <div className="relative" ref={wrapRef}>
      <input
        className="input"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (onChange) onChange(e.target.value);
        }}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">No hotels found</div>
          ) : (
            filtered.map((h) => (
              <button
                type="button"
                key={h._id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(h.name);
                  setOpen(false);
                  if (onSelect) onSelect(h);
                }}
                className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm border-b border-slate-100 last:border-0"
              >
                <div className="font-medium text-slate-800">{h.name}</div>
                <div className="text-xs text-slate-500">
                  {[h.city, h.country].filter(Boolean).join(", ")}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Pagination Footer ──────────────────────────────────────────────
// Drop-in pagination control shared by every list page that uses
// backend pagination. Renders nothing when totalPages <= 1.
//
//   <Pagination page={page} totalPages={totalPages} total={total} limit={50}
//               onChange={setPage} isFetching={isFetching} />
export function Pagination({ page, totalPages, total, limit = 50, onChange, isFetching }) {
  if (!totalPages || totalPages <= 1) return null;

  const go = (n) => {
    const next = Math.min(Math.max(1, n), totalPages);
    if (next !== page) onChange(next);
  };

  // "Showing 1–50 of 234" (only when total + limit are provided)
  const showRange = typeof total === "number" && total > 0;
  const from = showRange ? (page - 1) * limit + 1 : null;
  const to   = showRange ? Math.min(page * limit, total) : null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 text-sm text-slate-600 flex-wrap">
      <span className="text-xs text-slate-400">
        {showRange
          ? <>Showing <span className="font-medium text-slate-600">{from.toLocaleString()}–{to.toLocaleString()}</span> of <span className="font-medium text-slate-600">{total.toLocaleString()}</span></>
          : <>Page {page} of {totalPages}</>}
        {isFetching ? " · refreshing…" : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(1)}
          disabled={page === 1}
          className="btn-ghost text-xs py-1 px-2 disabled:opacity-40"
          title="First page"
        >
          <i className="fa fa-angle-double-left" />
        </button>
        <button
          onClick={() => go(page - 1)}
          disabled={page === 1}
          className="btn-ghost text-xs py-1 px-2 disabled:opacity-40"
        >
          <i className="fa fa-angle-left" /> Prev
        </button>
        <span className="text-xs text-slate-500 px-2 whitespace-nowrap">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost text-xs py-1 px-2 disabled:opacity-40"
        >
          Next <i className="fa fa-angle-right" />
        </button>
        <button
          onClick={() => go(totalPages)}
          disabled={page >= totalPages}
          className="btn-ghost text-xs py-1 px-2 disabled:opacity-40"
          title="Last page"
        >
          <i className="fa fa-angle-double-right" />
        </button>
      </div>
    </div>
  );
}
