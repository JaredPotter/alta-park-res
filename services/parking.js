const moment = require('moment');
const { sleep } = require('../utils/helpers');
const { sendTextMessage } = require('./notification');

/**
 * Make parking reservation for a specific date
 * @param {Page} page - Puppeteer page instance
 * @param {string} username - Email address
 * @param {string} password - Password
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} parkingCode - Optional parking code
 */
async function makeParkingReservation(page, date, parkingCode = null) {
    // Check if date is already reserved
    const momentDate = moment(date, 'YYYY-MM-DD');
    const reservationDateElements = await page.$$('.text-muted');

    for (const reservationDateElement of reservationDateElements) {
        const reservationDate = await reservationDateElement.evaluate(el => el.textContent);
        const momentReservationDate = moment(reservationDate, 'MMM D, yyyy');

        if (momentReservationDate.isSame(momentDate, 'day')) {
            console.log('Date Already Reserved! - ' + reservationDate);
            return false;
        }
    }

    const formattedDate = momentDate.format('dddd, MMMM D, YYYY');
    const selectorString = `div[aria-label='${formattedDate}']`;
    console.log('selectorString', selectorString);
    const calendarDateElements = await page.$$(selectorString);

    calendarDateElements[0].click();

    if (parkingCode) { 
        // Wait for the element to be available
        const arrowElement = await page.waitForSelector('[alt="arrow"]', { 
            visible: true,
            timeout: 10000 
        });
        if (!arrowElement) {
            throw new Error('Could not find element with alt text "arrow"');
        }
        await arrowElement.click();

        await makeReservationWithParkingCode(page);
        return true;
    } else {
        const paidReservationButtonElement = await page.waitForSelector('div[class^="SelectRate_card"]', {
            visible: true,
            timeout: 10000
        });
    
        await paidReservationButtonElement.click();
    
        await page.waitForFunction(
            url => window.location.href.startsWith(url),
            { timeout: 10000 },
            'https://parking.honkmobile.com/checkout/'
        );
    
        const payButtonElement = await page.waitForSelector('.CtaButton--container__shadow', {
            visible: true,
            timeout: 10000
        });
        await sleep(1500);
        await payButtonElement.click();
        
        const confirmButtonElement = await page.waitForSelector('.ButtonComponent', {
            visible: true,
            timeout: 10000
        });
        await confirmButtonElement.click();

        return true;
    }
}

/**
 * Make reservation using a parking code
 * @param {Page} page - Puppeteer page instance
 * @param {string} parkingCode - Parking code to redeem
 */
async function makeReservationWithParkingCode(page) {
    // Wait for and click the terms and conditions checkbox
    const termsCheckbox = await page.waitForSelector('#terms', {
        visible: true,
        timeout: 10000
    });
    
    if (termsCheckbox) {
        const isChecked = await termsCheckbox.evaluate(el => el.checked);
        if (!isChecked) {
            await termsCheckbox.click();
        }
    }

    // Find all buttons and check their child divs for "Redeem A Pass" text
    const allButtons = await page.$$('button[type="button"]');
    console.log('allButtons: ', allButtons.length);
    const submitButton = allButtons[allButtons.length - 1];

    await submitButton.click();

    await page.waitForSelector('.modals', {
        visible: true,
        timeout: 10000
    });
    const modalButtons = await page.$$('.modals button');
    await modalButtons[1].click();

    await page.waitForFunction(
        url => window.location.href.includes(url),
        { timeout: 10000 },
        '?purchased'
    );

    return true;
}

/**
 * Check if a date element has the style indicating parking availability
 * @param {Page} page - Puppeteer page instance
 * @param {string} formattedDate - Formatted date string (e.g., "Sunday, December 28, 2025")
 * @param {string} dateSelector - CSS selector for the date element
 * @param {string} availableBackgroundColor - Background color that indicates availability
 * @returns {Promise<boolean>} - True if the date is available
 */
async function checkDateAvailability(page, formattedDate, dateSelector, availableBackgroundColor) {
    try {
        // Wait for the calendar element to be present AND have the background color applied
        await page.waitForFunction(
            (selector, expectedBgColor) => {
                const el = document.querySelector(selector);
                if (!el) return false;
                const computedStyle = window.getComputedStyle(el);
                return computedStyle.backgroundColor === expectedBgColor;
            },
            { 
                timeout: 5000,
                polling: 5000 // Check every 100ms
            },
            dateSelector,
            availableBackgroundColor
        );

        // Use page.evaluate() directly with the selector to avoid detached node issues
        // This queries the element fresh each time
        const styles = await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (!el) {
                return null;
            }
            const computedStyle = window.getComputedStyle(el);
            return {
                backgroundColor: computedStyle.backgroundColor,
                color: computedStyle.color
            };
        }, dateSelector);

        if (!styles) {
            console.log('Date element not found:', formattedDate);
            return false;
        }

        console.log(`Checking date ${formattedDate} - Background: ${styles.backgroundColor}, Color: ${styles.color}`);

        // Check if the styles match the available style
        if (styles.backgroundColor === availableBackgroundColor) {
            console.log('SUCCESS: Found matching date and parking is available!');
            return true;
        } else {
            console.log('Date found but parking is not available (sold out or different status).');
            return false;
        }
    } catch (error) {
        return false;
    }
}

/**
 * Check parking availability for a target date
 * @param {Page} page - Puppeteer page instance
 * @param {string} resortBaseUrl - Base URL for the resort
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @param {Function} updateReservationStatus - Function to update reservation status
 * @param {string} reservationId - Reservation ID
 * @param {string} parkingCode - Optional parking code
 */
async function checkParkingAvailability(page, resortBaseUrl, targetDate, parkingCode = null) {
    let isWaiting = true;

    // Format the target date to match the aria-label format (e.g., "Sunday, December 28, 2025")
    const momentDate = moment(targetDate, 'YYYY-MM-DD');
    const formattedDate = momentDate.format('dddd, MMMM D, YYYY');
    const dateSelector = `div[aria-label='${formattedDate}']`;
    
    // The style that indicates availability
    const availableBackgroundColor = 'rgba(49, 200, 25, 0.2)';

    try {
        while (isWaiting) {
            try {
                if (parkingCode) {
                    const parkingCodesUrl = resortBaseUrl + '/parking-codes';
                    await page.goto(parkingCodesUrl, {
                        waitUntil: 'networkidle0',
                    });

                    // Use page.evaluate() to find the button in one go to avoid detached nodes
                    const reserveParkingButton = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button[type="button"]'));
                        const button = buttons.find(btn => btn.textContent.trim() === 'Reserve Parking');
                        return button ? true : false;
                    });

                    if (!reserveParkingButton) {
                        throw new Error('Could not find button with text "Reserve Parking"');
                    }

                    // Click using evaluate to avoid detached node issues
                    await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button[type="button"]'));
                        const button = buttons.find(btn => btn.textContent.trim() === 'Reserve Parking');
                        if (button) {
                            button.click();
                        }
                    });
                    
                    // Wait a bit for the calendar to load after clicking
                    await sleep(2000);
        
                } else {    
                    const selectParkingUrl = resortBaseUrl + '/select-parking';
                    await page.goto(selectParkingUrl, {
                        waitUntil: 'networkidle0',
                    });
                }

                // Check if the date is available
                const isAvailable = await checkDateAvailability(page, formattedDate, dateSelector, availableBackgroundColor);
                
                if (isAvailable) {
                    await makeParkingReservation(page, targetDate, parkingCode);
                    isWaiting = false;
                    break; // Exit the loop
                }

            } catch (error) {
                // Continue on navigation errors
                if (error.message && !error.message.includes('detached')) {
                    console.log('Navigation/check error:', error.message);
                }
            }

            // Check isWaiting before sleeping
            if (!isWaiting) {
                break;
            }

            console.log('refreshing page...');
            await sleep(10000);
        }

    } catch (error) {
        // Handle any errors
        throw error;
    }
}

module.exports = {
    makeParkingReservation,
    makeReservationWithParkingCode,
    checkParkingAvailability,
    checkDateAvailability
};