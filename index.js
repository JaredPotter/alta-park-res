const config = require('./config');
const { isValidDateFormat } = require('./utils/helpers');
const { processNewReservationsForDate } = require('./worker');

// Parse command line arguments
// Usage: node index.js YYYY-MM-DD  [email] [password]
const targetDate = process.argv[2];
const emailArg = process.argv[3] || null;
const passwordArg = process.argv[4] || null;
const parkingCodeArg = process.argv[5] || null;

// Initialize resort documents at startup
(async () => {
    try {
        // Continue with normal execution if targetDate is provided
        if (targetDate) {
            if (!isValidDateFormat(targetDate)) {
                console.log('Invalid date format. Please use YYYY-MM-DD format. Ex. 2025-02-17');
                process.exit(1);
                return;
            }

            if (!emailArg || !passwordArg) {
                console.log('No target resort ID provided. Exiting...');
                console.log('Usage: node index.js YYYY-MM-DD [email] [password]');
                console.log('Example: node index.js 2025-02-17 jaredpotter1+tyson@gmail.com Chaosman37*x');
                process.exit(1);
                return;
            }
            
            // Process new reservations from the reservations collection
            await processNewReservationsForDate(
                targetDate, 
                emailArg, 
                passwordArg,
                parkingCodeArg
            );
            console.log('Processing complete!');
        } else {
            console.log('No date or resort ID provided. Exiting...');
            console.log('Usage: node index.js YYYY-MM-DD [email] [password]');
            process.exit(0);
        }
    } catch (error) {
        console.error('Error initializing:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
})();
