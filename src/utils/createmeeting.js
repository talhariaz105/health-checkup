const axios = require('axios');

const getZoomAccessToken = async () => {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(tokenUrl, null, {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Failed to get Zoom access token:', error.response?.data || error.message);
        throw new Error('Zoom authentication failed');
    }
};


const createZoomMeeting = async (startTime) => {
    const accessToken = await getZoomAccessToken();

    try {
        // Set a dummy start time if not provided
        const meetingStartTime = startTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

        console.log('Creating Zoom meeting at:', meetingStartTime);

        const response = await axios.post(
            'https://api.zoom.us/v2/users/me/meetings',
            {
            topic: 'Consulting meeting',
            type: 2, // scheduled meeting
            start_time: meetingStartTime,
            duration: 30,
            timezone: 'Asia/Karachi',
            agenda: 'Customer Booking',

            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false,
            },
            },
            {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            }
        );

        return response.data;
    } catch (error) {
        console.error('Failed to create Zoom meeting:', error.response?.data || error.message);
        throw new Error('Zoom meeting creation failed');
    }
};

module.exports = {
    createZoomMeeting,
};