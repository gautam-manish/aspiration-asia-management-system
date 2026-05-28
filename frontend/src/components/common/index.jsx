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
    <div className="modal-overlay" onClick={onCancel}>
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
    <div className="relative">
      <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 w-64"
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
export function Field({ label, children, required }) {
  return (
    <div>
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
