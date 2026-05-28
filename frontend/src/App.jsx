import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import LoginPage               from "./pages/auth/LoginPage";
import HotelsPage              from "./pages/hotels/HotelsPage";
import BookingsPage            from "./pages/bookings/BookingsPage";
import BookingDetailPage       from "./pages/bookings/BookingDetailPage";
import ReservationsPage        from "./pages/reservations/ReservationsPage";
import VouchersPage            from "./pages/vouchers/VouchersPage";
import VoucherDetailPage       from "./pages/vouchers/VoucherDetailPage";
import InvoicesPage            from "./pages/invoices/InvoicesPage";
import InvoiceDetailPage       from "./pages/invoices/InvoiceDetailPage";
import CashReceiptsPage        from "./pages/cashReceipts/CashReceiptsPage";
import CashReceiptDetailPage   from "./pages/cashReceipts/CashReceiptDetailPage";
import CalculatorPage          from "./pages/calculator/CalculatorPage";
import LedgerPage              from "./pages/ledger/LedgerPage";
import SundryPage              from "./pages/sundry/SundryPage";
import SundryDetailPage        from "./pages/sundry/SundryDetailPage";
import SalesRecordsPage        from "./pages/salesRecords/SalesRecordsPage";
import SalesRecordDetailPage   from "./pages/salesRecords/SalesRecordDetailPage";
import PurchaseRecordsPage     from "./pages/purchaseRecords/PurchaseRecordsPage";
import PurchaseRecordDetailPage from "./pages/purchaseRecords/PurchaseRecordDetailPage";
import PackageCostPage         from "./pages/packageCost/PackageCostPage";

function P({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/"                          element={<P><HotelsPage /></P>} />
        <Route path="/bookings"                  element={<P><BookingsPage /></P>} />
        <Route path="/bookings/:id"              element={<P><BookingDetailPage /></P>} />
        <Route path="/reservations"              element={<P><ReservationsPage /></P>} />
        <Route path="/vouchers"                  element={<P><VouchersPage /></P>} />
        <Route path="/vouchers/:id"              element={<P><VoucherDetailPage /></P>} />
        <Route path="/invoices"                  element={<P><InvoicesPage /></P>} />
        <Route path="/invoices/:id"              element={<P><InvoiceDetailPage /></P>} />
        <Route path="/cash-receipts"             element={<P><CashReceiptsPage /></P>} />
        <Route path="/cash-receipts/:id"         element={<P><CashReceiptDetailPage /></P>} />
        <Route path="/calculator"                element={<P><CalculatorPage /></P>} />
        <Route path="/ledger"                    element={<P><LedgerPage /></P>} />
        <Route path="/sundry"                    element={<P><SundryPage /></P>} />
        <Route path="/sundry/:id"                element={<P><SundryDetailPage /></P>} />
        <Route path="/sales-records"             element={<P><SalesRecordsPage /></P>} />
        <Route path="/sales-records/:id"         element={<P><SalesRecordDetailPage /></P>} />
        <Route path="/purchase-records"          element={<P><PurchaseRecordsPage /></P>} />
        <Route path="/purchase-records/:id"      element={<P><PurchaseRecordDetailPage /></P>} />
        <Route path="/package-cost"              element={<P><PackageCostPage /></P>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
