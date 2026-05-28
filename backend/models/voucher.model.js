import mongoose from "mongoose";

const hotelBlockSchema = new mongoose.Schema(
  {
    confirmationNumber: { type: String, trim: true },
    hotelName:          { type: String, trim: true },
    hotelCity:          { type: String, trim: true },
    hotelCountry:       { type: String, trim: true },
    roomCategory:       { type: String, trim: true },
    noOfRooms:          { type: String, trim: true },
    roomType:           { type: String, trim: true },
    mealPlan:           { type: String, trim: true },
    visit1in:           { type: String, default: "N/A" },
    visit1out:          { type: String, default: "N/A" },
    visit2in:           { type: String, default: "N/A" },
    visit2out:          { type: String, default: "N/A" },
    includes:           { type: String, trim: true },
    // ── NEW hotel fields ──
    hotelContactNumber: { type: String, trim: true },
    googleMapsLink:     { type: String, trim: true },
  },
  { _id: false }
);

const voucherSchema = new mongoose.Schema(
  {
    guestName:       { type: String, required: [true, "Guest name is required"], trim: true },
    nationality:     { type: String, trim: true },
    // ── NEW client fields ──
    contactNumber:      { type: String, trim: true },
    mealInstruction:    { type: String, trim: true },
    wheelChair:         { type: String, trim: true },
    arrivalFlightDetails: { type: String, trim: true },
    preferredFloor:     { type: String, trim: true },
    pax: {
      adults:          { type: Number, default: 0 },
      childWithBed:    { type: Number, default: 0 },
      childWithoutBed: { type: Number, default: 0 },
      childBelow5:     { type: Number, default: 0 },
    },
    hotels: {
      type: [hotelBlockSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one hotel entry is required",
      },
    },
  },
  { timestamps: true }
);

const Voucher = mongoose.model("Voucher", voucherSchema);
export default Voucher;