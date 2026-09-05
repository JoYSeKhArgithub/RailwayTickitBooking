import { config } from '../config/root.js';

export function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const FAILURE_REASON_MESSAGES = {
    payment_failed: 'Your payment could not be processed.',
    confirm_seats_failed: 'We could not confirm your seats with the inventory system.',
    booking_timeout: 'Your booking expired before payment was completed.',
};

export const CANCELLATION_REASON_MESSAGES = {
    user_cancelled: 'You requested to cancel this booking.',
    schedule_cancelled: 'The train schedule for this booking was cancelled by IRCTC.',
};

export function getOtpTemplate(otp, ttlMinutes = 5) {
    return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif; 
      max-width: 440px; 
      margin: 20px auto; 
      padding: 24px; 
      border: 1px solid #e5e7eb; 
      border-radius: 12px; 
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4A3AFF; margin: 0; font-size: 24px; letter-spacing: -0.5px;">DesignKarle</h2>
      </div>

      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">
        Hi,
      </p>

      <p style="font-size: 15px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
        Welcome to <strong>DesignKarle</strong> 👋<br/>
        Use the verification code below to complete your sign up:
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <div style="
          display: inline-block; 
          padding: 14px 28px; 
          font-size: 32px; 
          letter-spacing: 8px; 
          font-weight: 700; 
          background: #F4F4FF; 
          border-radius: 8px; 
          color: #4A3AFF;
          border: 1px solid #e0e0ff;
        ">
          ${otp}
        </div>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin: 8px 0;">
        This code will expire in <strong>${ttlMinutes} minutes</strong>.
      </p>

      <p style="font-size: 14px; color: #9ca3af; margin: 8px 0;">
        If you did not request this code, please safely ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
        Happy Learning 🎉<br/>
        <strong>Team DesignKarle</strong>
      </p>
    </div>
  `;
}

export function getWelcomeTemplate(firstName) {
    const loginUrl = `${config.FRONTEND_URL || 'http://localhost:3000'}/login`;

    return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif; 
      max-width: 440px; 
      margin: 20px auto; 
      padding: 24px; 
      border: 1px solid #e5e7eb; 
      border-radius: 12px; 
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4A3AFF; margin: 0; font-size: 24px; letter-spacing: -0.5px;">DesignKarle</h2>
      </div>

      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">
        Hi <strong>${firstName || 'there'}</strong>,
      </p>

      <p style="font-size: 15px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
        Welcome to <strong>DesignKarle</strong> 👋<br/>
        Your account has been successfully created and verified.
      </p>

      <div style="text-align: center; margin: 25px 0;">   
        <a href="${loginUrl}" 
          style="
            display: inline-block;
            padding: 12px 24px;
            background: #4A3AFF;
            color: #ffffff;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(74, 58, 255, 0.25);
          ">
          Login to Your Account
        </a>
      </div>

      <p style="font-size: 14px; color: #9ca3af; line-height: 1.4;">
        If you did not create this account, please contact our support team immediately.
      </p>

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
        Happy Learning 🎉<br/>
        <strong>Team DesignKarle</strong>
      </p>
    </div>
  `;
}

export function getTicketConfirmationTemplate(ticketData = {}) {
    const {
        pnr = 'N/A',
        trainName = 'Express Train',
        trainNumber = '',
        from = '',
        to = '',
        date = '',
        passengers = [],
        amount = 0,
    } = ticketData;

    return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif; 
      max-width: 600px; 
      margin: 20px auto; 
      padding: 24px; 
      border: 1px solid #e5e7eb; 
      border-radius: 12px; 
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4A3AFF; margin: 0;">🎫 Ticket Confirmed</h2>
      </div>

      <div style="background: #F4F4FF; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0ff;">
        <p style="margin: 4px 0; font-size: 16px; color: #1f2937;"><strong>PNR:</strong> ${pnr}</p>
        <p style="margin: 4px 0; font-size: 16px; color: #1f2937;"><strong>Train:</strong> ${trainName} ${trainNumber ? `(${trainNumber})` : ''}</p>
      </div>

      <div style="margin: 20px 0; color: #374151;">
        <p style="margin: 8px 0;"><strong>From:</strong> ${from}</p>
        <p style="margin: 8px 0;"><strong>To:</strong> ${to}</p>
        <p style="margin: 8px 0;"><strong>Date:</strong> ${formatDate(date)}</p>
        <p style="margin: 8px 0;"><strong>Amount Paid:</strong> ₹${amount}</p>
      </div>

      ${passengers.length ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937; margin-bottom: 8px; font-size: 16px;">Passenger Details:</h3>
        ${passengers.map((p, i) => `
          <p style="margin: 4px 0; color: #4b5563;">${i + 1}. ${p.name} (${p.age || '—'} yrs, ${p.gender || '—'})</p>
        `).join('')}
      </div>` : ''}

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
        Safe Journey! 🚂<br/>
        <strong>Team IRCTC</strong>
      </p>
    </div>
  `;
}

export function getBookingConfirmedTemplate(data = {}) {
    const {
        bookingId,
        firstName,
        trainName = 'Express Train',
        trainNumber = '',
        fromStationName,
        toStationName,
        departureDate,
        passengers = [],
        seats = [],
        totalAmount = 0,
    } = data;

    return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      padding: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4A3AFF; margin: 0;">🎫 Booking Confirmed</h2>
      </div>

      <p style="font-size: 16px; color: #1f2937;">
        Hi ${firstName ? `<strong>${firstName}</strong>` : 'there'},
      </p>

      <p style="font-size: 15px; color: #4b5563; line-height: 1.5;">
        Your train booking has been confirmed. Here are your journey details:
      </p>

      <div style="background: #F4F4FF; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0ff;">
        <p style="margin: 4px 0; font-size: 16px; color: #1f2937;"><strong>Booking ID:</strong> ${bookingId}</p>
        <p style="margin: 4px 0; font-size: 16px; color: #1f2937;"><strong>Train:</strong> ${trainName} ${trainNumber ? `(${trainNumber})` : ''}</p>
      </div>

      <div style="margin: 20px 0; color: #374151;">
        ${fromStationName ? `<p style="margin: 8px 0;"><strong>From:</strong> ${fromStationName}</p>` : ''}
        ${toStationName ? `<p style="margin: 8px 0;"><strong>To:</strong> ${toStationName}</p>` : ''}
        <p style="margin: 8px 0;"><strong>Date:</strong> ${formatDate(departureDate)}</p>
        <p style="margin: 8px 0;"><strong>Amount Paid:</strong> ₹${totalAmount}</p>
      </div>

      ${seats.length ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937; margin-bottom: 8px; font-size: 16px;">Seats:</h3>
        ${seats.map(s => `
          <p style="margin: 4px 0; color: #4b5563;">Seat ${s.seatNumber} — ${s.seatType || 'General'} (₹${s.price || 0})</p>
        `).join('')}
      </div>` : ''}

      ${passengers.length ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937; margin-bottom: 8px; font-size: 16px;">Passenger Details:</h3>
        ${passengers.map((p, i) => `
          <p style="margin: 4px 0; color: #4b5563;">${i + 1}. ${p.name} (${p.age || '—'} yrs, ${p.gender || '—'})</p>
        `).join('')}
      </div>` : ''}

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
        Safe Journey! 🚂<br/>
        <strong>Team IRCTC</strong>
      </p>
    </div>
  `;
}

export function getBookingFailedTemplate(data = {}) {
    const { bookingId, firstName, reason } = data;
    const friendlyReason = FAILURE_REASON_MESSAGES[reason] || 'Your booking could not be completed.';

    return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      padding: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #EF4444; margin: 0;">Booking Unsuccessful</h2>
      </div>

      <p style="font-size: 16px; color: #1f2937;">
        Hi ${firstName ? `<strong>${firstName}</strong>` : 'there'},
      </p>

      <p style="font-size: 15px; color: #4b5563; line-height: 1.5;">
        We're sorry — we were unable to complete your booking.
      </p>

      <div style="background: #FEF2F2; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #FEE2E2;">
        <p style="margin: 4px 0; font-size: 16px; color: #991B1B;"><strong>Booking ID:</strong> ${bookingId}</p>
        <p style="margin: 4px 0; font-size: 16px; color: #991B1B;"><strong>Reason:</strong> ${friendlyReason}</p>
      </div>

      <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
        If any amount was debited, it will be refunded to your original payment method automatically. You can try booking again from your IRCTC account.
      </p>

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
        We apologize for the inconvenience.<br/>
        <strong>Team IRCTC</strong>
      </p>
    </div>
  `;
}

export function getBookingCancelledTemplate(data = {}) {
    const { bookingId, firstName, reason, refundAmount } = data;
    const friendlyReason = CANCELLATION_REASON_MESSAGES[reason] || 'Your booking has been cancelled.';
    const refundLine = refundAmount && refundAmount > 0
        ? `A refund of <strong>₹${refundAmount}</strong> has been initiated and will be credited to your original payment method within 5–7 business days.`
        : `No refund is applicable for this cancellation.`;

    return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      padding: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #F59E0B; margin: 0;">Booking Cancelled</h2>
      </div>

      <p style="font-size: 16px; color: #1f2937;">
        Hi ${firstName ? `<strong>${firstName}</strong>` : 'there'},
      </p>

      <p style="font-size: 15px; color: #4b5563; line-height: 1.5;">
        Your booking has been cancelled successfully.
      </p>

      <div style="background: #FFFBEB; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #FEF3C7;">
        <p style="margin: 4px 0; font-size: 16px; color: #92400E;"><strong>Booking ID:</strong> ${bookingId}</p>
        <p style="margin: 4px 0; font-size: 16px; color: #92400E;"><strong>Reason:</strong> ${friendlyReason}</p>
      </div>

      <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
        ${refundLine}
      </p>

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
        We hope to see you onboard again soon.<br/>
        <strong>Team IRCTC</strong>
      </p>
    </div>
  `;
}
