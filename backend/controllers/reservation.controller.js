import Reservation from "../models/reservation.model.js";
import nodemailer from "nodemailer";
import escapeRegex from "../utils/escapeRegex.js";

// Use the SAME env-driven credentials as email.controller.js
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

let transporter = null;
function getTransporter() {
  if (!MAIL_USER || !MAIL_PASS) {
    throw new Error("Mail is not configured (MAIL_USER / MAIL_PASS missing in environment)");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: MAIL_USER, pass: MAIL_PASS },
    });
  }
  return transporter;
}

const safe = (v) => {
  if (v === undefined || v === null || v === "") return "";
  return String(v).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
};

const reservationEmailHtml = (reservation) => {
  const pax = reservation.pax || {};
  const room = reservation.room || {};
  const visits = reservation.visits || {};
  const row = (label, value) => `
    <tr>
      <td style="border:1px solid #ddd;padding:8px;font-weight:600;width:42%;">${safe(label)}</td>
      <td style="border:1px solid #ddd;padding:8px;">${safe(value) || "-"}</td>
    </tr>`;

  return `
    <div style="font-family:Arial;background:#f4f6f8;padding:20px;">
      <div style="max-width:800px;margin:auto;background:white;padding:25px;border-radius:12px;">
        <h1 style="text-align:center;color:#2563eb;margin-bottom:5px;">Hotel Reservation</h1>
        <p style="text-align:center;color:#666;margin-bottom:20px;">Reservation Details</p>
        <table style="width:100%;border-collapse:collapse;">
          ${row("Booking Name", reservation.bookingName)}
          ${row("Nationality", reservation.nationality)}
          ${row("Adults", pax.adults)}
          ${row("Child with Bed", pax.childWithBed)}
          ${row("Child without Bed", pax.childWithoutBed)}
          ${row("Child below 5 yrs", pax.childBelow5)}
          ${row("Room Category", room.category)}
          ${row("No. of Rooms", room.noOfRooms)}
          ${row("Room Type", room.type)}
          ${row("Extra Bed", room.extraBed)}
          ${row("Meal Plan", room.mealPlan)}
          ${row("1st Visit Check-In", visits.visit1in)}
          ${row("1st Visit Check-Out", visits.visit1out)}
          ${row("2nd Visit Check-In", visits.visit2in)}
          ${row("2nd Visit Check-Out", visits.visit2out)}
          ${row("Note", reservation.note)}
        </table>
      </div>
    </div>`;
};

// ─────────────────────────────────────────
// @desc    Create Reservation + Send Email
// @route   POST /api/reservations
// ─────────────────────────────────────────
export const createReservation = async (req, res) => {
  try {
    const { to, subject, bookingName, nationality, pax, room, visits, note } = req.body;
    const recipients = (Array.isArray(to) ? to : [to])
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (!bookingName) {
      return res.status(400).json({ success: false, message: "Booking name is required", data: null });
    }
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: "At least one recipient email is required", data: null });
    }

    // Save to DB
    const reservation = await Reservation.create({
      bookingName, nationality, pax, room, visits, note,
      emailTo: recipients, subject,
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

    let emailSent = false;
    let warning = "";
    try {
      await getTransporter().sendMail({
        from: MAIL_USER,
        to: recipients.join(", "),
        subject: subject || "Hotel Reservation",
        html,
      });
      emailSent = true;
      reservation.emailStatus = "sent";
      reservation.emailError = "";
    } catch (mailError) {
      const notConfigured = !MAIL_USER || !MAIL_PASS;
      warning = notConfigured
        ? "Email service is not configured. Add MAIL_USER and MAIL_PASS on the server."
        : "Email delivery failed. Check the server mail credentials and provider access.";
      reservation.emailStatus = notConfigured ? "not_configured" : "failed";
      reservation.emailError = warning;
      console.error("createReservation email error:", mailError);
    }

    await reservation.save();

    res.status(201).json({
      success: true,
      message: emailSent
        ? "Reservation saved and email sent successfully"
        : "Reservation saved, but the email was not sent",
      data: reservation,
      emailSent,
      warning,
    });
  } catch (error) {
    console.error("createReservation error:", error);
    res.status(500).json({ success: false, message: "Failed to create reservation.", data: null });
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
      query.bookingName = { $regex: escapeRegex(search), $options: "i" };
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
    console.error("getAllReservations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reservations.", data: null });
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
    console.error("getReservationById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reservation.", data: null });
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
    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ["bookingName", "nationality", "pax", "room", "visits", "note", "emailTo", "subject"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found", data: null });
    }
    res.status(200).json({ success: true, message: "Reservation updated successfully", data: reservation });
  } catch (error) {
    console.error("updateReservation error:", error);
    res.status(400).json({ success: false, message: "Failed to update reservation.", data: null });
  }
};

// @desc    Send or resend the saved reservation email
// @route   POST /api/reservations/:id/send-email
export const sendReservationEmail = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found", data: null });
    }

    const recipients = (reservation.emailTo || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: "No recipient email is saved for this reservation", data: null });
    }

    try {
      await getTransporter().sendMail({
        from: MAIL_USER,
        to: recipients.join(", "),
        subject: reservation.subject || "Hotel Reservation",
        html: reservationEmailHtml(reservation),
      });
      reservation.emailStatus = "sent";
      reservation.emailError = "";
      await reservation.save();
      return res.status(200).json({
        success: true,
        message: "Reservation email sent successfully",
        data: reservation,
      });
    } catch (mailError) {
      const notConfigured = !MAIL_USER || !MAIL_PASS;
      const message = notConfigured
        ? "Email service is not configured. Add MAIL_USER and MAIL_PASS on the server."
        : "Email delivery failed. Check the server mail credentials and provider access.";
      reservation.emailStatus = notConfigured ? "not_configured" : "failed";
      reservation.emailError = message;
      await reservation.save();
      console.error("sendReservationEmail error:", mailError);
      return res.status(502).json({ success: false, message, data: reservation });
    }
  } catch (error) {
    console.error("sendReservationEmail lookup error:", error);
    return res.status(500).json({ success: false, message: "Failed to send reservation email.", data: null });
  }
};
