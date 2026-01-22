const { openChromiumAndConnectPuppeteer, closeChrome } = require('./utils/chrome');
const { login } = require('./services/auth');
const { checkParkingAvailability } = require('./services/parking');

// Debug flag: Set to true to actually make reservations, false to only check availability
const MAKE_RESERVATION = true;

/**
 * Set up rate limit detection for a page
 * @param {Page} page - Puppeteer page instance
 * @param {Browser} browser - Puppeteer browser instance
 * @param {Function} onRateLimited - Callback function to call when rate limited
 * @returns {Object} - Object with rateLimited flag and cleanup function
 */
function setupRateLimitDetection(page, browser, onRateLimited) {
  console.log('setupRateLimitDetection');
  let rateLimited = false;
  const handlers = [];

  const requestFailedHandler = async (request) => {
    try {
      const url = request.url();
      const failure = request.failure();

      if (url.includes('platform.honkmobile.com/graphql')) {
        console.log(`[Rate Limit Detector] GraphQL Request Failed - URL: ${url}, Failure: ${JSON.stringify(failure)}`);

        // Check if it's a rate limit failure
        if (failure && (failure.errorText === 'net::ERR_FAILED')) {
          rateLimited = true;
          console.log('❌ RATE LIMITED detected via request failure! Closing process.');

          // Call the callback to handle cleanup
          if (onRateLimited) {
            onRateLimited();
          }
        }
      }
    } catch (error) {
      console.error('Error in request failed handler:', error.message);
    }
  };

  page.on('requestfailed', requestFailedHandler);
  handlers.push({ target: page, handler: requestFailedHandler, type: 'page-requestfailed' });

  // Also listen on the browser level to catch responses from all pages
  if (browser) {
    browser.on('targetcreated', async (target) => {
      const newPage = await target.page();
      if (newPage) {
        console.log('[Rate Limit Detector] New page created, attaching listeners');
        newPage.on('requestfailed', requestFailedHandler);
        handlers.push(
          { target: newPage, handler: requestFailedHandler, type: 'newPage-requestfailed' }
        );
      }
    });
  }

  // Return object with flag and cleanup function
  return {
    get rateLimited() {
      return rateLimited;
    },
    cleanup: () => {
      console.log(`[Rate Limit Detector] Cleaning up ${handlers.length} handlers`);
      handlers.forEach(({ target, handler, type }) => {
        try {
          if (target && typeof target.off === 'function') {
            target.off('requestfailed', handler);
            console.log(`[Rate Limit Detector] Removed handler from ${type}`);
          }
        } catch (error) {
          console.error(`[Rate Limit Detector] Error removing handler from ${type}:`, error.message);
        }
      });
    }
  };
}

/**
 * Extract calendar date (YYYY-MM-DD) from a date input, preserving the calendar date regardless of timezone
 * @param {string|Date|Timestamp} dateInput - Date input (YYYY-MM-DD string, Date object, or Firestore Timestamp)
 * @returns {string} Date string in YYYY-MM-DD format
 */
function extractCalendarDate(dateInput) {
  if (typeof dateInput === 'string') {
    // Already a date string, return as-is
    return dateInput;
  }

  let date;
  if (dateInput && typeof dateInput.toDate === 'function') {
    // Firestore Timestamp - convert to Date
    date = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    throw new Error('Invalid date input');
  }

  // Extract calendar date using LOCAL date methods to preserve the calendar date
  // This ensures "November 7, 2025 at 5:00 PM UTC-7" stays as "2025-11-07"
  // Using UTC methods would convert it to "2025-11-08" (next day in UTC)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Process new reservations for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} parkingCode - Parking code
 */
async function processNewReservationsForDate(date, username = null, password = null, parkingCode = null) {
  try {
    console.log(`Processing new reservations for date: ${date}`);
    console.log(`Make reservation mode: ${MAKE_RESERVATION ? 'ENABLED - will make reservations' : 'DISABLED - checking availability only'}`);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

          // Option 1: Use an environment variable or config flag
          const OPEN_DEVTOOLS = false;

          const resortBaseUrl = "https://reserve.altaparking.com";

          // Create browser once - keep it open for retries
          const { page, browser } = await openChromiumAndConnectPuppeteer(OPEN_DEVTOOLS);

          // Set up rate limit detection BEFORE login
          rateLimitDetector = setupRateLimitDetection(page, browser, async () => {
            await handleLogin(page, resortBaseUrl, username, password);

            // Check parking availability
            await checkParkingAvailability(page, resortBaseUrl, date, parkingCode);
          });

          // Login (on the same browser/page)
          await handleLogin(page, resortBaseUrl, username, password);

          // Check parking availability
          await checkParkingAvailability(page, resortBaseUrl, date, parkingCode);

        } catch (error) {
   
          console.error(`Error processing reservation:`, error);
        }
}

// create a function that handles the login process
async function handleLogin(page, resortBaseUrl, username, password) {
  try {
    await login(page, resortBaseUrl, username, password);
  } catch (error) {
    console.error(`Error logging in:`, error);
  }
}

module.exports = {
  processNewReservationsForDate
};
