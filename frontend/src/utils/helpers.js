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

// Get error message from axios error
export const getError = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong";

// Truncate long text
export const truncate = (str, n = 30) =>
  str && str.length > n ? str.slice(0, n) + "…" : str || "—";

// Number to words (for cash receipt)
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

export const numberToWords = (num) => {
  const n = Math.floor(Number(num));
  if (isNaN(n) || n === 0) return "";
  return toWords(n) + " Only";
};

// Today's date for input[type=date]
export const todayString = () => new Date().toISOString().split("T")[0];
