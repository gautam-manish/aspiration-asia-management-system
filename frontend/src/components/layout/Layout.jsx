import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ConfirmModal } from "../common";
import toast from "react-hot-toast";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { to: "/",              icon: "fa-hotel",          label: "Hotels" },
      { to: "/bookings",      icon: "fa-bookmark",       label: "Bookings" },
      { to: "/reservations",  icon: "fa-calendar-check", label: "Reservations" },
      { to: "/vouchers",      icon: "fa-ticket-alt",     label: "Vouchers" },
      { to: "/package-cost",  icon: "fa-box-open",       label: "Package Cost" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/invoices",         icon: "fa-file-invoice",   label: "Invoices" },
      { to: "/cash-receipts",    icon: "fa-receipt",        label: "Cash Receipts" },
      { to: "/sales-records",    icon: "fa-chart-line",     label: "Sales Records" },
      { to: "/purchase-records", icon: "fa-book",           label: "Purchase Records" },
      { to: "/calculator",       icon: "fa-calculator",     label: "Calculator" },
    ],
  },
  {
    label: "Contacts",
    items: [
      { to: "/sundry", icon: "fa-building", label: "Sundry" },
    ],
  },
];

export default function Layout({ children }) {
  // Desktop: sidebar can be collapsed to a 64px rail.
  // Mobile/tablet (<lg): the sidebar is hidden by default and slides in over the page.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close the mobile drawer whenever the user navigates.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    setConfirmLogout(false);
    setMobileOpen(false);
    logout();
    toast.success("Logged out");
    navigate("/login");
  };
  const askLogout = () => setConfirmLogout(true);

  const sidebarWidthClass = collapsed ? "lg:w-16" : "lg:w-56";
  // On mobile the sidebar is fixed-positioned; on lg+ it sits inline.
  const sidebarPositionClass = mobileOpen
    ? "translate-x-0"
    : "-translate-x-full lg:translate-x-0";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Mobile Top Bar (only <lg) ─────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="btn-ghost p-2 rounded-lg"
        >
          <i className="fa fa-bars text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-600 rounded-md flex items-center justify-center">
            <i className="fa fa-mountain text-white text-xs" />
          </div>
          <p className="font-display font-semibold text-slate-800 text-sm">Aspiration AISA</p>
        </div>
        <button
          onClick={askLogout}
          aria-label="Logout"
          className="btn-ghost p-2 rounded-lg text-slate-500 hover:text-red-600"
        >
          <i className="fa fa-sign-out-alt" />
        </button>
      </header>

      {/* ── Mobile Drawer Backdrop ─────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 ${sidebarWidthClass}
          flex flex-col bg-white border-r border-slate-200 shadow-sm
          transition-transform lg:transition-[width] duration-300 flex-shrink-0
          ${sidebarPositionClass}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa fa-mountain text-white text-sm" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="font-display font-semibold text-slate-800 leading-tight text-sm">Aspiration</p>
                <p className="text-[10px] text-slate-400 tracking-widest uppercase">AISA</p>
              </div>
            )}
          </div>
          {/* Mobile-only close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden btn-ghost p-1 rounded-lg"
            aria-label="Close menu"
          >
            <i className="fa fa-times text-slate-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="my-1 mx-3 border-t border-slate-100" />}

              {group.items.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`
                  }
                  title={collapsed ? label : undefined}
                >
                  <i className={`fa ${icon} w-4 text-center flex-shrink-0 text-sm`} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom: user + logout + collapse */}
        <div className="border-t border-slate-100 p-3 space-y-1">
          {!collapsed && (
            <div className="px-2 py-1.5 rounded-lg bg-slate-50 flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <i className="fa fa-user text-white text-xs" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-slate-700 truncate">{user?.username || "Admin"}</p>
                <p className="text-[10px] text-slate-400">Administrator</p>
              </div>
            </div>
          )}
          <button
            onClick={askLogout}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            title={collapsed ? "Logout" : undefined}
          >
            <i className="fa fa-sign-out-alt w-4 text-center flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          {/* Collapse button — desktop only */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-50 transition-colors"
          >
            <i className={`fa ${collapsed ? "fa-chevron-right" : "fa-chevron-left"} w-4 text-center`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">{children}</div>
      </main>

      {/* ── Logout Confirmation ──────────────────────────── */}
      <ConfirmModal
        open={confirmLogout}
        title="Logout"
        message={`Are you sure you want to log out${user?.username ? `, ${user.username}` : ""}?`}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
