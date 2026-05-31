// Format date to readable string
export const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Format currency
export const formatCurrency = (amount, currency = "Rs.") => {
  if (amount == null || amount === "") return "—";
  return `${currency} ${Number(amount).toLocaleString("en-IN")}`;
};

// Get error message from axios error.
// Returns null for cancelled / already-handled errors so callers can skip toasts.
export const getError = (err) => {
  if (!err) return "Something went wrong";
  // Skip cancelled (StrictMode unmount, page navigation) and already-handled (401) errors.
  if (err.__handled || err.code === "ERR_CANCELED" || err.name === "CanceledError") {
    return null;
  }
  return err?.response?.data?.message || err?.message || "Something went wrong";
};

// Show an error toast only when there's a real, user-facing message.
// Use everywhere instead of `toast.error(getError(err))` so cancelled/401 errors stay silent.
// Lazy-imported to avoid a cyclic import with helpers used during boot.
let _toast;
export const notifyError = async (err) => {
  const msg = getError(err);
  if (!msg) return;
  if (!_toast) _toast = (await import("react-hot-toast")).default;
  _toast.error(msg);
};

// Truncate long text
export const truncate = (str, n = 30) =>
  str && str.length > n ? str.slice(0, n) + "…" : str || "—";

// Number to words (for invoices, cash receipts)
const ones = ["", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function toWords(n) {
  if (n === 0) return "Zero";
  if (n < 20)  return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "");
  if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
  if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "");
  return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + toWords(n % 10000000) : "");
}

// Map currency symbol → display labels for the words representation.
// `major` = whole-unit name, `minor` = sub-unit name (1/100 of major).
const CURRENCY_WORDS = {
  "$":   { major: "Dollars", minor: "Cents" },
  "€":   { major: "Euros",   minor: "Cents" },
  "£":   { major: "Pounds",  minor: "Pence" },
  "₹":   { major: "Rupees",  minor: "Paise" },
  "Rs.": { major: "Rupees",  minor: "Paise" },
  "Rs":  { major: "Rupees",  minor: "Paise" },
};

export const numberToWords = (num, currency = "Rs.") => {
  const value = Number(num);
  if (isNaN(value) || value === 0) return "";

  // Round to 2 decimal places to handle floating-point noise, then split.
  const rounded = Math.round(value * 100) / 100;
  const whole   = Math.floor(rounded);
  const frac    = Math.round((rounded - whole) * 100); // 0..99

  const labels = CURRENCY_WORDS[currency] || { major: "Rupees", minor: "Paise" };

  let parts = [];
  if (whole > 0) parts.push(`${toWords(whole)} ${labels.major}`);
  if (frac  > 0) parts.push(`${toWords(frac)} ${labels.minor}`);
  if (parts.length === 0) return "";

  return parts.join(" and ") + " Only";
};

// Today's date for input[type=date]
export const todayString = () => new Date().toISOString().split("T")[0];
