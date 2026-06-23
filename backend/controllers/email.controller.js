import nodemailer from "nodemailer";

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

const mailFailure = (error) => {
  if (error?.code === "EAUTH" || error?.responseCode === 535) {
    return { status: 502, message: "Gmail rejected the sender credentials. Generate a new App Password and restart the backend." };
  }
  if (!MAIL_USER || !MAIL_PASS) {
    return { status: 503, message: "Email service is not configured. Add MAIL_USER and MAIL_PASS on the server." };
  }
  return { status: 502, message: "The email provider could not deliver the message. Check the backend mail logs." };
};

// ── Shared Transporter ───────────────────────
// Credentials must be supplied via environment variables. NEVER commit them.
const MAIL_USER     = process.env.MAIL_USER;     // sending Gmail address
const MAIL_PASS     = process.env.MAIL_PASS;     // Gmail "app password"
const PACKAGE_TO    = process.env.MAIL_PACKAGE_TO || MAIL_USER; // where package-cost mails go

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

// ─────────────────────────────────────────
// @desc    Send Package Cost Email
// @route   POST /api/mail/send-mail
// ─────────────────────────────────────────
export const sendPackageMail = async (req, res) => {
  try {
    const agency = req.body.agency || {};
    const clientDetails = req.body.clientDetails || {};
    const costs = req.body.costs || {};
    const accommodation = req.body.accommodation || [];
    const total = req.body.total || 0;
    const clientEmail = String(clientDetails.email || "").trim();
    const arrival = new Date(clientDetails.arrivalDate);
    const departure = new Date(clientDetails.departureDate);
    const numberOfDays = Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())
      ? ""
      : Math.max(0, Math.ceil((departure - arrival) / 86400000));
    const children = [clientDetails.childEB, clientDetails.childNoEB, clientDetails.childU5]
      .reduce((sum, value) => sum + (Number(value) || 0), 0);

    if (!clientEmail) {
      return res.status(400).json({ success: false, message: "Client email is required", data: null });
    }

    const html = `
<div style="font-family:Arial;background:#f4f6f8;padding:20px;">
  <div style="max-width:1000px;margin:auto;background:white;padding:25px;border-radius:12px;">

    <h1 style="text-align:center;color:#2563eb;margin-bottom:5px;">Travel Package Invoice</h1>
    <p style="text-align:center;color:#666;margin-bottom:20px;">Generated Report</p>

    <h2 style="color:#111;margin-top:30px;">Agency Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Company Name</td><td style="border:1px solid #ddd;padding:8px;">${safe(agency.companyName)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Contact Person</td><td style="border:1px solid #ddd;padding:8px;">${safe(agency.contactPerson)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Contact Number</td><td style="border:1px solid #ddd;padding:8px;">${safe(agency.contactNumber)}</td></tr>
    </table>

    <h2 style="color:#111;margin-top:30px;">Client Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Client Name</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.name || clientDetails.clientName)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Nationality</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.nationality)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Contact</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.mobile || clientDetails.contact)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Email</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientEmail)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Arrival Date</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.arrivalDate)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Departure Date</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.departureDate)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">No. of Nights</td><td style="border:1px solid #ddd;padding:8px;">${safe(numberOfDays)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Adults</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.adults)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Children</td><td style="border:1px solid #ddd;padding:8px;">${safe(children)}</td></tr>
    </table>

    <h2 style="color:#111;margin-top:30px;">Accommodation Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f3f4f6;">
        <th style="border:1px solid #ddd;padding:8px;">Hotel</th>
        <th style="border:1px solid #ddd;padding:8px;">Meal</th>
        <th style="border:1px solid #ddd;padding:8px;">Cost</th>
        <th style="border:1px solid #ddd;padding:8px;">Nights</th>
        <th style="border:1px solid #ddd;padding:8px;">Total</th>
      </tr>
      ${accommodation.map(a => `
      <tr>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.hotelName || a.hotel)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.mealPlan || a.meal)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.ratePerRoom ?? a.cost)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.nights)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.total)}</td>
      </tr>`).join("")}
    </table>

    <h2 style="color:#111;margin-top:30px;">Cost Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Airport Pickup</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.transferPickup)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Airport Drop</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.transferDrop)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Domestic Flight</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.flightDomestic)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Permit</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.permit)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Guide</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.guide)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Porter</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.porter)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Other Services</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.otherServices)}</td></tr>
    </table>

    <div style="margin-top:30px;text-align:center;">
      <h2 style="background:#16a34a;color:white;padding:15px;border-radius:10px;">
        Grand Total: Rs. ${total}
      </h2>
    </div>

  </div>
</div>`;

    await getTransporter().sendMail({
      from: MAIL_USER,
      to: clientEmail,
      bcc: PACKAGE_TO && PACKAGE_TO.toLowerCase() !== clientEmail.toLowerCase() ? PACKAGE_TO : undefined,
      subject: "Package Cost",
      html,
    });

    res.status(200).json({ success: true, message: "Mail sent successfully" });
  } catch (error) {
    console.error("[mail] sendPackageMail error:", error);
    const failure = mailFailure(error);
    res.status(failure.status).json({ success: false, message: failure.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Send Hotel Reservation Email
// @route   POST /api/mail/send-reservation
// ─────────────────────────────────────────
export const sendReservationMail = async (req, res) => {
  try {
    const { to, subject,  bookingName, nationality, pax, room, visits, note } = req.body;

    const html = `
<div style="font-family:Arial;background:#f4f6f8;padding:20px;">
  <div style="max-width:800px;margin:auto;background:white;padding:25px;border-radius:12px;">

    <h1 style="text-align:center;color:#2563eb;margin-bottom:5px;">Hotel Reservation</h1>
    <p style="text-align:center;color:#666;margin-bottom:20px;">Reservation Details</p>

    

    <h2 style="color:#111;margin-top:20px;">Booking Details</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Booking Name</td><td style="border:1px solid #ddd;padding:8px;">${safe(bookingName)}</td></tr>
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
      
    </table>

    ${note ? `
    <h2 style="color:#111;margin-top:20px;">Note</h2>
    <div style="border:1px solid #ddd;padding:12px;border-radius:8px;color:#444;">${safe(note)}</div>
    ` : ""}

  </div>
</div>`;

    await getTransporter().sendMail({
      from: MAIL_USER,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: subject || "Hotel Reservation",
      html,
    });

    res.status(200).json({ success: true, message: "Reservation sent successfully" });
  } catch (error) {
    console.error("[mail] sendReservationMail error:", error);
    res.status(500).json({ success: false, message: "Error sending reservation email. Check server email configuration." });
  }
};
