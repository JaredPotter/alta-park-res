const dotenv = require('dotenv');
dotenv.config();

const config = {
    // Browser configuration
    WINDOW_HEIGHT: 1000,
    WINDOW_WIDTH: 1000,
    
    // Twilio configuration
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
        toNumber: process.env.TWILIO_TO_NUMBER,
        contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e'
    },
    
    // Authentication
    auth: {
        email: process.env.EMAIL,
        password: process.env.PASSWORD
    },
    
    // iVPN configuration
    ivpn: {
        accountId: process.env.IVPN_ACCOUNT_ID,
    },
    
    // Firebase configuration
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        // If using service account JSON, parse it here
        serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT 
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
            : null
    },
};

module.exports = config; 