
const twilio = require('twilio');

/**
 * WhatsApp Service for automated reporting
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in .env
 */

const sendWhatsAppReport = async (to, content) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio Sandbox number

    if (!accountSid || !authToken) {
        console.error('WhatsApp Service: Missing Twilio credentials in environment variables.');
        return { success: false, error: 'Missing credentials' };
    }

    const client = twilio(accountSid, authToken);

    try {
        const message = await client.messages.create({
            body: content,
            from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
            to: to.startsWith('whatsapp:') ? to : `whatsapp:+${to.replace('+', '')}`
        });
        console.log(`WhatsApp Report Sent to ${to}: ${message.sid}`);
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error(`WhatsApp Service Error:`, error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendWhatsAppReport };
