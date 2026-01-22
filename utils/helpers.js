/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms);
    });
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 * @returns {boolean}
 */
function isValidDateFormat(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(dateString);
}

/**
 * Find available port starting from a base port
 * @param {number} startPort - Starting port number
 * @param {Array} activePorts - Array of currently active ports
 * @returns {number}
 */
function findAvailablePort(startPort, activePorts = []) {
    let port = startPort;
    
    while (activePorts.includes(port)) {
        port++;
        if (port > startPort + 100) { // Safety limit
            throw new Error('No available ports found');
        }
    }
    return port;
}

module.exports = {
    sleep,
    isValidDateFormat,
    findAvailablePort
}; 