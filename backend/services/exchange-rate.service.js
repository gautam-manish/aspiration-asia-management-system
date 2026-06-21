const NRB_API_URL = "https://www.nrb.org.np/api/forex/v1/rates";
const INR_TO_NPR_RATE = 1.6;

const CURRENCY_ALIASES = new Map([
  ["RS.", "NPR"],
  ["RS", "NPR"],
  ["NPR", "NPR"],
  ["रू", "NPR"],
  ["₹", "INR"],
  ["INR", "INR"],
  ["$", "USD"],
  ["USD", "USD"],
  ["€", "EUR"],
  ["EUR", "EUR"],
  ["£", "GBP"],
  ["GBP", "GBP"],
]);

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const dateOnly = (value) => {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : raw;
};

const addUtcDays = (date, days) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export class ExchangeRateError extends Error {
  constructor(message, statusCode = 503) {
    super(message);
    this.name = "ExchangeRateError";
    this.statusCode = statusCode;
  }
}

export function normalizeCurrencyCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  return CURRENCY_ALIASES.get(raw) || CURRENCY_ALIASES.get(upper) || (/^[A-Z]{3}$/.test(upper) ? upper : "");
}

export function convertAmountToNpr(amount, rate) {
  return round((Number(amount) || 0) * (Number(rate) || 0), 2);
}

export async function getNprExchangeRate({ currency, date, fetchImpl = globalThis.fetch } = {}) {
  const currencyCode = normalizeCurrencyCode(currency);
  const requestedDate = dateOnly(date);

  if (!currencyCode) {
    throw new ExchangeRateError("Select a supported invoice currency.", 400);
  }
  if (!requestedDate) {
    throw new ExchangeRateError("A valid invoice date is required for currency conversion.", 400);
  }
  if (currencyCode === "NPR") {
    return { currencyCode, rate: 1, rateDate: requestedDate, source: "NPR base currency", rateType: "base" };
  }
  if (currencyCode === "INR") {
    return { currencyCode, rate: INR_TO_NPR_RATE, rateDate: requestedDate, source: "Company fixed INR/NPR rate", rateType: "fixed" };
  }
  if (typeof fetchImpl !== "function") {
    throw new ExchangeRateError("Exchange-rate service is unavailable.");
  }

  // A date can be a weekend or NRB holiday. Ask for the preceding two weeks
  // and lock the latest published buying rate on or before the invoice date.
  const params = new URLSearchParams({
    page: "1",
    per_page: "20",
    from: addUtcDays(requestedDate, -14),
    to: requestedDate,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetchImpl(`${NRB_API_URL}?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response?.ok) {
      throw new ExchangeRateError(`Nepal Rastra Bank rate lookup failed (${response?.status || "network error"}).`);
    }
    const body = await response.json();
    const publications = Array.isArray(body?.data?.payload) ? body.data.payload : [];
    const publication = publications
      .filter((item) => dateOnly(item?.date) && item.date <= requestedDate)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const quoted = publication?.rates?.find((item) => String(item?.currency?.iso3 || "").toUpperCase() === currencyCode);
    const unit = Number(quoted?.currency?.unit);
    const buyingRate = Number(quoted?.buy);

    if (!publication || !(unit > 0) || !(buyingRate > 0)) {
      throw new ExchangeRateError(`No NRB ${currencyCode}/NPR buying rate is available on or before ${requestedDate}.`);
    }

    return {
      currencyCode,
      rate: round(buyingRate / unit, 6),
      rateDate: publication.date,
      source: "Nepal Rastra Bank buying rate",
      rateType: "buying",
    };
  } catch (error) {
    if (error instanceof ExchangeRateError) throw error;
    if (error?.name === "AbortError") {
      throw new ExchangeRateError("Nepal Rastra Bank rate lookup timed out. Please try again.");
    }
    throw new ExchangeRateError("Could not fetch the historical NRB exchange rate. Please try again.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function createLockedInvoiceConversion({ currency, invoiceDate, total }, options = {}) {
  const quote = await getNprExchangeRate({ currency, date: invoiceDate, fetchImpl: options.fetchImpl });
  return {
    currencyCode: quote.currencyCode,
    exchangeRateToNpr: quote.rate,
    exchangeRateDate: quote.rateDate,
    exchangeRateSource: quote.source,
    exchangeRateType: quote.rateType,
    nprTotal: convertAmountToNpr(total, quote.rate),
    exchangeRateLockedAt: new Date(),
  };
}

export function getStoredInvoiceNprRate(invoice = {}) {
  if (Number(invoice.exchangeRateToNpr) > 0) return Number(invoice.exchangeRateToNpr);
  const currencyCode = normalizeCurrencyCode(invoice.currency || invoice.currencyCode);
  if (currencyCode === "NPR") return 1;
  if (currencyCode === "INR") return INR_TO_NPR_RATE;
  throw new ExchangeRateError(
    `Invoice ${invoice.invoiceNumber || invoice._id || ""} is missing its locked NPR exchange rate. Run the invoice currency backfill.`,
    409,
  );
}

export function getStoredInvoiceNprTotal(invoice = {}) {
  return convertAmountToNpr(invoice.total, getStoredInvoiceNprRate(invoice));
}

export { INR_TO_NPR_RATE, NRB_API_URL };
