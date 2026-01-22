const twilio = require("twilio");
const config = require('../config');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Send text message via Twilio
 * @param {string} message - Message to send
 * @param {string} toNumber - Override default to number
 */
async function sendTextMessage(message, toNumber = null) {
    try {
        await client.messages.create({
            from: config.twilio.fromNumber,
            to: toNumber || config.twilio.toNumber,
            contentVariables: JSON.stringify({
                1: message
            }),
            contentSid: config.twilio.contentSid,
        });
        console.log('Text message sent successfully:', message);
    } catch (error) {
        console.error('Failed to send text message:', error);
        throw error;
    }
}

module.exports = {
    sendTextMessage
}; 