A node.js program to that utilizes Puppeteer and a debug-mode instance of chrome to automatically wait for a parking reservation at Alta to become available. Once available it will automatically make the reservation.

1. Install nvm

2. Run `nvm install`

3. Run `npm install`

4. Run `npm run start "2026-01-25" "email" "password" "parking_code"`

If you prefer to pay for the parking do not pass the parking code parameter in.
`npm run start "2026-01-25" "email" "password"`

Note: It may be necessary to turn off the sleep mode on your computer while waiting for a reservation to open up