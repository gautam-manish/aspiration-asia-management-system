import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    bookingName: {
      type: String,
      required: [true, "Booking name is required"],
      trim: true,
    },
    nationality: {
      type: String,
      trim: true,
    },
    pax: {
      adults:          { type: Number, default: 0 },
      childWithBed:    { type: Number, default: 0 },
      childWithoutBed: { type: Number, default: 0 },
      childBelow5:     { type: Number, default: 0 },
    },
    room: {
      category:  { type: String, trim: true },
      noOfRooms: { type: String, trim: true },
      type:      { type: String, trim: true },
      extraBed:  { type: Number, default: 0 },
      mealPlan:  { type: String, trim: true },
    },
    visits: {
      visit1in:     { type: String, default: "N/A" },
      visit1out:    { type: String, default: "N/A" },
      visit2in:     { type: String, default: "N/A" },
      visit2out:    { type: String, default: "N/A" },
      
    },
    note:      { type: String, trim: true },
    emailTo:   [{ type: String }],
    subject:   { type: String, trim: true },
  },
  { timestamps: true }
);

const Reservation = mongoose.model("Reservation", reservationSchema);
export default Reservation;