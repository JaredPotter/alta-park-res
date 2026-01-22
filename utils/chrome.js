const { spawn } = require('child_process');
const crossSpawn = require('cross-spawn');
const crossSpawnSync = crossSpawn.sync;
const puppeteer = require('puppeteer');
const axios = require('axios');
const config = require('../config');
const { sleep, findAvailablePort } = require('./helpers');

let chromeLauncher = '';
let chromeLauncherFlags = [];
const activeChromeProcesses = [];

/**
 * Start Chrome process with debugging port
 * @param {string} chromeLauncher - Path to Chrome executable
 * @param {Array} chromeLauncherFlags - Chrome launch flags
 * @returns {Promise<string>} WebSocket debugger URL
 */
async function startChromeProcess(chromeLauncher, chromeLauncherFlags) {
    try {
        const chromeStartCommand = `${chromeLauncher} ${chromeLauncherFlags.join(' ')}`;
        console.log(`Running \n${chromeStartCommand}`);

        if (process.platform === 'win32') {
            crossSpawnSync(chromeStartCommand, { stdio: 'inherit' });
        } else if (process.platform === 'darwin') {
            spawn(chromeLauncher, chromeLauncherFlags, { 
                stdio: 'inherit', 
                windowsVerbatimArguments: true 
            });
        }
    } catch (error) {
        console.error('Error starting Chrome process:', error);
    }

    await sleep(2500);
    let isWaiting = true;

    while (isWaiting) {
        try {
            console.log('Fetching webSocket URL...');
            const response = await axios.get('http://localhost:9222/json/version');
            const data = response.data;
            const webSocketDebuggerUrl = data.webSocketDebuggerUrl;

            console.log('WebSocket URL - ' + webSocketDebuggerUrl);
            return webSocketDebuggerUrl;
        } catch (error) {
            console.log('Request failed. Retrying...');
        }

        console.log('waiting for Chrome to finish launching...');
        await sleep(1000);
    }
}

/**
 * Launch Chromium using Puppeteer
 * @param {boolean} openDevTools - Whether to open dev tools (default: false)
 * @returns {Promise<{page: Page, browser: Browser}>}
 */
async function openChromiumAndConnectPuppeteer(openDevTools = false) {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: openDevTools, // This opens dev tools automatically
        defaultViewport: {
            width: config.WINDOW_WIDTH,
            height: config.WINDOW_HEIGHT
        },
        args: [
            `--window-size=${config.WINDOW_WIDTH},${config.WINDOW_HEIGHT}`,
            '--incognito'
        ]
    });

    const pages = await browser.pages();
    const page = pages[0];

    await page.setViewport({
        width: config.WINDOW_WIDTH,
        height: config.WINDOW_HEIGHT
    });

    await sleep(1000);
    return { page, browser };
}

/**
 * Launch Chrome and connect Puppeteer
 * @returns {Promise<Page>}
 */
async function openChromeAndConnectPuppeteer() {
    let wsChromeEndpointUrl = '';
    let port = findAvailablePort(9222, activeChromeProcesses);
    activeChromeProcesses.push(port);
    
    console.log(`Using port: ${port}`);

    if (process.platform === 'win32') {
        console.log('Running on Windows');
        crossSpawnSync('powershell', ['kill', '-n', 'chrome']);
        await sleep(2500);

        chromeLauncher = 'start';
        chromeLauncherFlags = [
            'chrome.exe',
            `--remote-debugging-port=${port}`,
            '--no-first-run',
            '--no-default-browser-check',
            `--window-size=${config.WINDOW_WIDTH},${config.WINDOW_HEIGHT}`,
            '--incognito'
        ];
    } else if (process.platform === 'darwin') {
        console.log('Running on Mac');
        chromeLauncher = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`;
        chromeLauncherFlags = [
            `--remote-debugging-port=${port}`,
            '--no-first-run',
            '--no-default-browser-check',
            `--window-size=${config.WINDOW_WIDTH},${config.WINDOW_HEIGHT}`,
            '--incognito'
        ];
        await sleep(2000);
    }

    wsChromeEndpointUrl = await startChromeProcess(chromeLauncher, chromeLauncherFlags);
    console.log('wsChromeEndpointUrl', wsChromeEndpointUrl);

    if (!wsChromeEndpointUrl) {
        console.log('Failed to load websocket URL. Exiting now!');
        return;
    }

    const browser = await puppeteer.connect({
        browserWSEndpoint: wsChromeEndpointUrl,
    });

    const page = await browser.newPage();
    return page;
}

/**
 * Close Chrome browser
 * @param {Browser} browser - Puppeteer browser instance
 */
async function closeChrome(browser) {
    if (browser) {
        await browser.close();
    } else {
        if (process.platform === 'win32') {
            crossSpawnSync('powershell', ['kill', '-n', 'chrome']);
        } else if (process.platform === 'darwin') {
            crossSpawnSync('killall', [`Google Chrome`]);
        }
    }
}

module.exports = {
    openChromiumAndConnectPuppeteer,
    openChromeAndConnectPuppeteer,
    closeChrome
}; 