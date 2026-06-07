import mongoose from "mongoose";

// ─────────────────────────────────────────
//  Booking Schema
//  Collection: bookings
// ─────────────────────────────────────────

const querySchema = new mongoose.Schema(
  {
    // ── Auto-generated ID ──────────────────────
    // Format: ASA{year}{runningNumber}
    // e.g. ASA2026100, ASA2026101, ASA2027174
    queryId: {
      type: String,
      unique: true,
      trim: true,
    },

    // ── Company / Client / Agent Info ──────────
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sundry",
      default: null,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    clientName: {
      type: String,
      required: [true, "Client / Agent name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    mobile: { type: String, trim: true },
    address: { type: String, trim: true },

    // ── Trip Details ───────────────────────────
    destination: {
      type: String,
      required: [true, "Destination is required"],
      enum: ["Nepal", "India", "Bhutan"],
    },
    pickupPoint: { type: String, trim: true },
    dropPoint: { type: String, trim: true },
    arrivalDate: { type: Date },
    departureDate: { type: Date },
    noOfDays: { type: String, trim: true },

    // ── Pax ───────────────────────────────────
    adults: { type: Number, default: 0, min: 0 },
    childEB: { type: Number, default: 0, min: 0 }, // Child with Extra Bed
    childNoEB: { type: Number, default: 0, min: 0 }, // Child without Extra Bed
    childU5: { type: Number, default: 0, min: 0 }, // Child below 5 yrs
    rooms: { type: Number, default: 0, min: 0 },

    // ── Hotel & Meal ───────────────────────────
    hotelCategory: {
      type: String,
      enum: ["2-star", "3-star", "4-star", "5-star", ""],
      default: "",
    },
    mealPlan: {
      type: String,
      enum: ["EP", "MAP", "CP", "JP", "AP", ""],
      default: "",
    },
    // ── Itinerary ──────────────────────────────
    itinerary: [
      {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
      },
    ],

    // ── Itinerary Includes / Excludes (free text) ──
    itineraryIncludes: { type: String, trim: true, default: "" },
    itineraryExcludes: { type: String, trim: true, default: "" },

    // ── Status ────────────────────────────────
    // Once set to 'cancelled' it cannot be reverted to 'confirmed'
    // (enforced at controller level)
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
  },
  { timestamps: true },
);

const Booking = mongoose.model("Query", querySchema);

// ── Indexes ───────────────────────────────────────────────────────────────
// Speed up the common search filter: queryId / clientName / destination + sort.
querySchema.index({ status: 1, createdAt: -1 });
querySchema.index({ clientName: 1 });
querySchema.index({ destination: 1 });

export default Booking;
