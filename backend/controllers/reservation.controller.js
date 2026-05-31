import Reservation from "../models/reservation.model.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "manishgtm123@gmail.com",
    pass: "dtrvlufskttkgxvl",
  },
});

const safe = (v) => (v === undefined || v === null || v === "") ? "" : String(v);

// ─────────────────────────────────────────
// @desc    Create Reservation + Send Email
// @route   POST /api/reservations
// ─────────────────────────────────────────
export const createReservation = async (req, res) => {
  try {
    const { to, subject, bookingName, nationality, pax, room, visits, note } = req.body;

    if (!bookingName) {
      return res.status(400).json({ success: false, message: "Booking name is required", data: null });
    }

    // Save to DB
    const reservation = await Reservation.create({
      bookingName, nationality, pax, room, visits, note,
      emailTo: to, subject,
    });

    // Send Email
    const html = `
<div style="font-family:Arial;background:#f4f6f8;padding:20px;">
  <div style="max-width:800px;margin:auto;background:white;padding:25px;border-radius:12px;">

    <h1 style="text-align:center;color:#2563eb;margin-bottom:5px;">Hotel Reservation</h1>
    <p style="text-align:center;color:#666;margin-bottom:20px;">Reservation Details</p>

    <h2 style="color:#111;margin-top:20px;">Booking Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Booking Name</td><td style="border:1px solid #ddd;padding:8px;font-weight:bold;">${safe(bookingName)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Nationality</td><td style="border:1px solid #ddd;padding:8px;">${safe(nationality)}</td></tr>
    </table>

    <h2 style="color:#111;margin-top:20px;">Number of Pax</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Adults</td><td style="border:1px solid #ddd;padding:8px;">${safe(pax?.adults)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Child with Bed</td><td style="border:1px solid #ddd;padding:8px;">${safe(pax?.childWithBed)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Child without Bed (6–10 yrs)</td><td style="border:1px solid #ddd;padding:8px;">${safe(pax?.childWithoutBed)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Child below 5 yrs</td><td style="border:1px solid #ddd;padding:8px;">${safe(pax?.childBelow5)}</td></tr>
    </table>

    <h2 style="color:#111;margin-top:20px;">Room Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Room Category</td><td style="border:1px solid #ddd;padding:8px;">${safe(room?.category)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">No. of Rooms</td><td style="border:1px solid #ddd;padding:8px;">${safe(room?.noOfRooms)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Room Type</td><td style="border:1px solid #ddd;padding:8px;">${safe(room?.type)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">No. of Extra Bed</td><td style="border:1px solid #ddd;padding:8px;">${safe(room?.extraBed)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Meal Plan</td><td style="border:1px solid #ddd;padding:8px;">${safe(room?.mealPlan)}</td></tr>
    </table>

    <h2 style="color:#111;margin-top:20px;">Visit Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">1st Visit Check-In</td><td style="border:1px solid #ddd;padding:8px;">${safe(visits?.visit1in)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">1st Visit Check-Out</td><td style="border:1px solid #ddd;padding:8px;">${safe(visits?.visit1out)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">2nd Visit Check-In</td><td style="border:1px solid #ddd;padding:8px;">${safe(visits?.visit2in)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">2nd Visit Check-Out</td><td style="border:1px solid #ddd;padding:8px;">${safe(visits?.visit2out)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Check-In Time</td><td style="border:1px solid #ddd;padding:8px;">${safe(visits?.checkinTime)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Check-Out Time</td><td style="border:1px solid #ddd;padding:8px;">${safe(visits?.checkoutTime)}</td></tr>
    </table>

    ${note ? `
    <h2 style="color:#111;margin-top:20px;">Note</h2>
    <div style="border:1px solid #ddd;padding:12px;border-radius:8px;color:#444;">${safe(note)}</div>
    ` : ""}

  </div>
</div>`;

    await transporter.sendMail({
      from: "manishgtm123@gmail.com",
      to: to.join(", "),
      subject: subject || "Hotel Reservation",
      html,
    });

    res.status(201).json({
      success: true,
      message: "Reservation saved and email sent successfully",
      data: reservation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Reservations (search by name or date)
//          - GET /api/reservations?search=john&date=2024-01-01           → ALL (back-compat)
//          - GET /api/reservations?search=&page=1&limit=50               → paginated envelope
// @route   GET /api/reservations?search=john&date=2024-01-01
// ─────────────────────────────────────────
export const getAllReservations = async (req, res) => {
  try {
    const { search, date, page, limit } = req.query;
    const query = {};

    if (search) {
      query.bookingName = { $regex: search, $options: "i" };
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const reservations = await Reservation.find(query).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, message: "Reservations fetched successfully", data: reservations });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [reservations, total] = await Promise.all([
      Reservation.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Reservation.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Reservations fetched successfully",
      data: reservations,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Reservation by ID
// @route   GET /api/reservations/:id
// ─────────────────────────────────────────
export const getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found", data: null });
    }
    res.status(200).json({ success: true, message: "Reservation fetched successfully", data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Reservation by ID
// @route   PUT /api/reservations/:id
// ─────────────────────────────────────────
export const updateReservation = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "No data provided to update", data: null });
    }
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    );
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found", data: null });
    }
    res.status(200).json({ success: true, message: "Reservation updated successfully", data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, data: null });
  }
};