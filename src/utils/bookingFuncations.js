const Booking = require("../models/Booking");
const { createZoomMeeting } = require("./createmeeting");
const Email = require("./email");

const createBooking = async(bookingData,user) => {
    try {
        const  res = await createZoomMeeting(bookingData?.appointmentDateandTime);
        console.log("Zoom meeting created successfully:", res);

        const booking = await Booking.create({...bookingData, meetingLink: res.join_url});
        const sendEmailtoAdmin= new Email(user.email, user.name);
        const meetingLink = booking.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${res.join_url}">${res.join_url}</a></p>` : '';
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h1 style="color: #2a7ae2;">Your Booking is Confirmed!</h1>
            <table style="width:100%; border-collapse: collapse;">
            <tr>
            <td style="padding: 8px 0;"><strong>Booking ID:</strong></td>
            <td style="padding: 8px 0;">${booking._id}</td>
            </tr>
            <tr>
            <td style="padding: 8px 0;"><strong>Name:</strong></td>
            <td style="padding: 8px 0;">${user.name}</td>
            </tr>
            <tr>
            <td style="padding: 8px 0;"><strong>Appointment Date and Time:</strong></td>
            <td style="padding: 8px 0;">${new Date(booking.appointmentDateandTime).toLocaleString()}</td>
            </tr>
            <tr>
            <td style="padding: 8px 0;"><strong>Payment Status:</strong></td>
            <td style="padding: 8px 0;">${booking.paymentStatus}</td>
            </tr>
            <tr>
            <td style="padding: 8px 0;" colspan="2">${meetingLink}</td>
            </tr>
            </table>
            <p style="margin-top: 24px; color: #888;">Thank you for booking your appointment. Please check your dashboard for more details.</p>
            </div>
        `;

         await sendEmailtoAdmin.sendHtmlEmail("New Booking Created", htmlBody);

        return booking;
    } catch (error) {
        return Promise.reject(new Error('Failed to create booking'));
    }
  
};

///////////////////////////////////////////// check if the booking is already exists on the same date and time ///////////////////////

const isBookingExists = async (appointmentDateandTime) => {
  const appointmentTime = new Date(appointmentDateandTime);

  const query = {
    appointmentDateandTime: {
      $gte: new Date(appointmentTime.getTime() - 30 * 60 * 1000), 
      $lte: new Date(appointmentTime.getTime()), 
    },
  };

  const booking = await Booking.findOne(query);
  console.log("Booking data", booking);
  return booking !== null;
};

module.exports = {
  createBooking,
  isBookingExists
};