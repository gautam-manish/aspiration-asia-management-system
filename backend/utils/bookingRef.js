import Booking from "../models/booking.model.js";

export async function resolveBookingId(rawBookingId) {
  const bookingId = String(rawBookingId || "").trim();
  if (!bookingId) {
    return { error: "Booking ID is required." };
  }

  const booking = await Booking.findOne({ queryId: bookingId }).select("queryId").lean();
  if (!booking) {
    return { error: `Booking "${bookingId}" was not found.` };
  }

  return { bookingId: booking.queryId };
}
