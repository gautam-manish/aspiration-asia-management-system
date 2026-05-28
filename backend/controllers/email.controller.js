import nodemailer from "nodemailer";

const safe = (v) => (v === undefined || v === null || v === "") ? "" : String(v);

// ── Shared Transporter ───────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "manishgtm123@gmail.com",
    pass: "dtrvlufskttkgxvl",
  },
});

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
      <tr><td style="border:1px solid #ddd;padding:8px;">Client Name</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.clientName)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Contact</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.contact)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Arrival Date</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.arrivalDate)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Departure Date</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.departureDate)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Arrival Destination</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.arrivalDestination)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Departure Destination</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.departureDestination)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">No. of Days</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.numberOfDays)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Adults</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.numberOfAdults)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Children</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.numberOfChildren)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Meal Plan</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.mealPlan)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Hotel Category</td><td style="border:1px solid #ddd;padding:8px;">${safe(clientDetails.hotelCategory)}</td></tr>
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
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.hotel)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.meal)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.cost)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.nights)}</td>
        <td style="border:1px solid #ddd;padding:8px;">${safe(a.total)}</td>
      </tr>`).join("")}
    </table>

    <h2 style="color:#111;margin-top:30px;">Cost Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="border:1px solid #ddd;padding:8px;">Vehicle</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.vehicle)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Flight</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.flight)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Lunch</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.lunch)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Entry Fee</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.entryFee)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Guide</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.guide)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Extra Services</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.extraServices)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Miscellaneous</td><td style="border:1px solid #ddd;padding:8px;">${safe(costs.miscellaneous)}</td></tr>
    </table>

    <div style="display:flex;align-items:center;">
      <h2 style="color:#111;margin-top:30px;">Profit:</h2>
      <p style="margin-top:30px;margin-left:10px;font-size:19px;font-weight:bold;color:#16a34a;">Rs. ${safe(costs.profit)}</p>
    </div>

    <div style="margin-top:30px;text-align:center;">
      <h2 style="background:#16a34a;color:white;padding:15px;border-radius:10px;">
        Grand Total: Rs. ${total}
      </h2>
    </div>

  </div>
</div>`;

    await transporter.sendMail({
      from: "manishgtm123@gmail.com",
      to: "manish.gtm222@gmail.com",
      subject: "Package Cost",
      html,
    });

    res.status(200).json({ success: true, message: "Mail sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error sending mail" });
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

    await transporter.sendMail({
      from: "manishgtm123@gmail.com",
      to: to.join(", "),
      subject: subject || "Hotel Reservation",
      html,
    });

    res.status(200).json({ success: true, message: "Reservation sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error sending reservation" });
  }
};