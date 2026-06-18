import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { PageLoader } from "./components/common";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const HotelsPage = lazy(() => import("./pages/hotels/HotelsPage"));
const BookingsPage = lazy(() => import("./pages/bookings/BookingsPage"));
const BookingDetailPage = lazy(() => import("./pages/bookings/BookingDetailPage"));
const UpcomingArrivalsPage = lazy(() => import("./pages/upcomingArrivals/UpcomingArrivalsPage"));
const ReservationsPage = lazy(() => import("./pages/reservations/ReservationsPage"));
const VouchersPage = lazy(() => import("./pages/vouchers/VouchersPage"));
const VoucherDetailPage = lazy(() => import("./pages/vouchers/VoucherDetailPage"));
const InvoicesPage = lazy(() => import("./pages/invoices/InvoicesPage"));
const InvoiceDetailPage = lazy(() => import("./pages/invoices/InvoiceDetailPage"));
const CashReceiptsPage = lazy(() => import("./pages/cashReceipts/CashReceiptsPage"));
const CashReceiptDetailPage = lazy(() => import("./pages/cashReceipts/CashReceiptDetailPage"));
const CustomerPaymentsPage = lazy(() => import("./pages/customerPayments/CustomerPaymentsPage"));
const CustomerPaymentDetailPage = lazy(() => import("./pages/customerPayments/CustomerPaymentDetailPage"));
const ArAgingPage = lazy(() => import("./pages/reports/ArAgingPage"));
const VendorBillsPage = lazy(() => import("./pages/vendorBills/VendorBillsPage"));
const VendorBillDetailPage = lazy(() => import("./pages/vendorBills/VendorBillDetailPage"));
const VendorPaymentsPage = lazy(() => import("./pages/vendorPayments/VendorPaymentsPage"));
const VendorPaymentDetailPage = lazy(() => import("./pages/vendorPayments/VendorPaymentDetailPage"));
const ApAgingPage = lazy(() => import("./pages/reports/ApAgingPage"));
const BookingProfitabilityPage = lazy(() => import("./pages/reports/BookingProfitabilityPage"));
const CustomerLedgerPage = lazy(() => import("./pages/reports/CustomerLedgerPage"));
const VendorLedgerPage = lazy(() => import("./pages/reports/VendorLedgerPage"));
const OfficeExpensesPage = lazy(() => import("./pages/officeExpenses/OfficeExpensesPage"));
const OfficeExpenseDetailPage = lazy(() => import("./pages/officeExpenses/OfficeExpenseDetailPage"));
const ProfitLossPage = lazy(() => import("./pages/reports/ProfitLossPage"));
const AccountingReconciliationPage = lazy(() => import("./pages/reports/AccountingReconciliationPage"));
const JournalEntriesPage = lazy(() => import("./pages/journalEntries/JournalEntriesPage"));
const AuditLogsPage = lazy(() => import("./pages/auditLogs/AuditLogsPage"));
const CalculatorPage = lazy(() => import("./pages/calculator/CalculatorPage"));
const SundryPage = lazy(() => import("./pages/sundry/SundryPage"));
const SundryDetailPage = lazy(() => import("./pages/sundry/SundryDetailPage"));
const VendorsPage = lazy(() => import("./pages/vendors/VendorsPage"));
const SalesRecordsPage = lazy(() => import("./pages/salesRecords/SalesRecordsPage"));
const SalesRecordDetailPage = lazy(() => import("./pages/salesRecords/SalesRecordDetailPage"));
const PurchaseRecordsPage = lazy(() => import("./pages/purchaseRecords/PurchaseRecordsPage"));
const PurchaseRecordDetailPage = lazy(() => import("./pages/purchaseRecords/PurchaseRecordDetailPage"));
const PackageCostPage = lazy(() => import("./pages/packageCost/PackageCostPage"));
const BankAccountsPage = lazy(() => import("./pages/bankAccounts/BankAccountsPage"));
const CompanySettingsPage = lazy(() => import("./pages/settings/CompanySettingsPage"));

function P({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

        <Route path="/hotels"                    element={<P><HotelsPage /></P>} />
        <Route path="/bookings"                  element={<P><BookingsPage /></P>} />
        <Route path="/bookings/:id"              element={<P><BookingDetailPage /></P>} />
        <Route path="/"                          element={<P><UpcomingArrivalsPage /></P>} />
        <Route path="/reservations"              element={<P><ReservationsPage /></P>} />
        <Route path="/vouchers"                  element={<P><VouchersPage /></P>} />
        <Route path="/vouchers/:id"              element={<P><VoucherDetailPage /></P>} />
        <Route path="/invoices"                  element={<P><InvoicesPage /></P>} />
        <Route path="/invoices/:id"              element={<P><InvoiceDetailPage /></P>} />
        <Route path="/cash-receipts"             element={<P><CashReceiptsPage /></P>} />
        <Route path="/cash-receipts/:id"         element={<P><CashReceiptDetailPage /></P>} />
        <Route path="/customer-payments"         element={<P><CustomerPaymentsPage /></P>} />
        <Route path="/customer-payments/:id"     element={<P><CustomerPaymentDetailPage /></P>} />
        <Route path="/ar-aging"                  element={<P><ArAgingPage /></P>} />
        <Route path="/vendor-bills"              element={<P><VendorBillsPage /></P>} />
        <Route path="/vendor-bills/:id"          element={<P><VendorBillDetailPage /></P>} />
        <Route path="/vendor-payments"           element={<P><VendorPaymentsPage /></P>} />
        <Route path="/vendor-payments/:id"       element={<P><VendorPaymentDetailPage /></P>} />
        <Route path="/ap-aging"                  element={<P><ApAgingPage /></P>} />
        <Route path="/booking-profitability"     element={<P><BookingProfitabilityPage /></P>} />
        <Route path="/customer-ledger"           element={<P><CustomerLedgerPage /></P>} />
        <Route path="/vendor-ledger"             element={<P><VendorLedgerPage /></P>} />
        <Route path="/office-expenses"           element={<P><OfficeExpensesPage /></P>} />
        <Route path="/office-expenses/:id"       element={<P><OfficeExpenseDetailPage /></P>} />
        <Route path="/profit-loss"               element={<P><ProfitLossPage /></P>} />
        <Route path="/accounting-reconciliation" element={<P><AccountingReconciliationPage /></P>} />
        <Route path="/journal-entries"           element={<P><JournalEntriesPage /></P>} />
        <Route path="/audit-logs"                element={<P><AuditLogsPage /></P>} />
        <Route path="/calculator"                element={<P><CalculatorPage /></P>} />
        <Route path="/sundry"                    element={<P><SundryPage /></P>} />
        <Route path="/sundry/:id"                element={<P><SundryDetailPage /></P>} />
        <Route path="/vendors"                   element={<P><VendorsPage /></P>} />
        <Route path="/sales-records"             element={<P><SalesRecordsPage /></P>} />
        <Route path="/sales-records/:id"         element={<P><SalesRecordDetailPage /></P>} />
        <Route path="/purchase-records"          element={<P><PurchaseRecordsPage /></P>} />
        <Route path="/purchase-records/:id"      element={<P><PurchaseRecordDetailPage /></P>} />
        <Route path="/bank-accounts"              element={<P><BankAccountsPage /></P>} />
        <Route path="/package-cost"              element={<P><PackageCostPage /></P>} />
        <Route path="/settings/company"          element={<P><CompanySettingsPage /></P>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
