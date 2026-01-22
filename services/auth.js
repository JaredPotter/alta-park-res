const config = require('../config');

/**
 * Handle SMS verification if the page navigates to SMS verify page
 * @param {Page} page - Puppeteer page instance
 * @param {string} smsCode - Optional SMS verification code (if provided, will auto-submit)
 * @returns {Promise<boolean>} True if verification was successful or not needed, false if failed
 */
async function handleSmsVerification(page, smsCode = null) {
    const currentUrl = await page.url();
    
    if (currentUrl.includes('/sms-verify')) {
        console.log('SMS verification page detected');
        
        try {
            // Wait for the SMS verification input to be ready
            await page.waitForSelector('input[type="text"]', { visible: true, timeout: 10000000 });
            
            if (smsCode) {
                // If SMS code is provided, enter it automatically
                console.log('Entering SMS verification code');
                const smsInput = await page.$('input[type="text"]');
                await smsInput.type(smsCode, { delay: 2 });
                
                // Find and click the submit/verify button
                const submitButton = await page.$('button[type="submit"]') || await page.$('button:has-text("Verify")');
                if (submitButton) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
                        submitButton.click()
                    ]);
                    console.log('SMS verification code submitted');
                    return true;
                }
            } else {
                // If no SMS code provided, wait for manual entry or timeout
                console.log('SMS verification required but no code provided. Waiting for manual entry...');
                console.log('Please enter the SMS verification code manually in the browser.');
                
                // Wait for navigation away from SMS verify page (indicating successful verification)
                try {
                    await page.waitForFunction(
                        (verifyUrl) => !window.location.href.includes('/sms-verify'),
                        { timeout: 300000 }, // 5 minute timeout
                        config.urls.smsVerify
                    );
                    console.log('SMS verification completed');
                    return true;
                } catch (timeoutError) {
                    console.error('SMS verification timeout - code may not have been entered');
                    return false;
                }
            }
        } catch (error) {
            console.error('Error handling SMS verification:', error);
            return false;
        }
    }
    
    // Not on SMS verify page, so verification not needed
    return true;
}

/**
 * Login to the parking reservation system
 * @param {Page} page - Puppeteer page instance
 * @param {string} resortBaseUrl - Base URL for the resort
 * @param {string} username - Email address
 * @param {string} password - Password
 * @param {string} smsCode - Optional SMS verification code
 */
async function login(page, resortBaseUrl, username, password, smsCode = null) {
    const loginUrl = resortBaseUrl + '/login';
    await page.goto(loginUrl, {
        waitUntil: 'networkidle0',
    });

    const currentPageUrl = await page.url();

    if (currentPageUrl.includes('/login')) {
        // Wait for the email input to be ready
        await page.waitForSelector('#emailAddress', { visible: true });

        // Type email with small delays between characters to mimic human behavior
        await page.type('#emailAddress', username, { delay: 2 });

        // Wait for and type password
        await page.waitForSelector('#password', { visible: true });
        await page.type('#password', password, { delay: 2 });

        // Wait for the submit button and click it
        await page.waitForSelector('button[type="submit"]', { visible: true });

        // Click and wait for navigation
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        // Check if we were redirected to SMS verification page
        const afterLoginUrl = await page.url();
        if (afterLoginUrl.includes('/sms-verify')) {
            console.log('Redirected to SMS verification page after login');
            const verified = await handleSmsVerification(page, smsCode);
            if (!verified) {
                throw new Error('SMS verification failed or timed out');
            }
        }

        console.log('Successfully logged in');
    }
}

module.exports = {
    login,
    handleSmsVerification
};
