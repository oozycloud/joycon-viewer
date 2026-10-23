# SIGNAL / Controller Studio

A minimal controller input viewer for GitHub Pages and OBS. The main canvas shows a front-view neon Joy-Con pair; Settings opens a compact drawer containing device selection, customization, motion metrics, diagnostics and relay controls. Press Escape or the close button to dismiss it. All web files are included: `index.html`, `styles.css`, `app.js`. There are no external fonts, image services, analytics or frontend dependencies. Settings and custom CSS remain in your browser's local storage.

## Start and publish

1. Put the **contents of this folder** at the root of a GitHub repository. Include the hidden `.github` folder.
2. In repository Settings → Pages, set the source to **GitHub Actions**.
3. Push to the `main` branch. The included workflow publishes the site. If your default branch is different, update `pages.yml`.
4. Open the resulting HTTPS URL. Connect a controller by USB or Bluetooth, focus the page, and press a button or move a stick. The browser may hide connected controllers until this interaction.

For local use, serve this folder over localhost, for example `python -m http.server 8080`, then visit `http://localhost:8080`. HTTPS or localhost is required for WebHID. Gamepad access may also depend on browser permissions and secure context. Opening files directly is not recommended.

## Controllers and mappings

- **Auto detect** previews the Joy-Con pair while disconnected, and keeps that artwork for every connected controller unless you choose an explicit layout. It follows deliberate button changes or stick motion beyond 0.35 to avoid ordinary drift taking control.
- **Switch Pro**, **Joy-Con pair**, and **generic gamepad** use distinct visual layouts. Every mapped button turns white and depresses; both sticks move independently in two axes and support click presses. Triggers/shoulders, D-pad, home and capture are included.
- In paired mode, select your left device as primary and right device as secondary. Each Joy-Con must be exposed as a separate gamepad by the OS/browser; this site cannot force Bluetooth pairing or combine devices at OS level.
- Standard mappings are the initial defaults. Nonstandard Nintendo mappings vary across OS/drivers. Open **Raw input diagnostics**, press one control at a time, and assign its zero-based index under **Button & stick mapping**. `-1` disables a field. Pair mode uses `LX/LY` for the left stick and `PAIR RIGHT X/Y` for the right stick (initially axes 0/1 on each device); `RX/RY` apply to single-controller mode. SL/SR rail buttons are drawn in paired mode and have separate left/right mappings, disabled with `-1` initially because driver indices vary. Use primary for left buttons, secondary for right buttons.
- Generic standard button labels show Xbox-style A/B/X/Y positions; Nintendo layouts show Nintendo labels. Mapping names A/B/X/Y describe Nintendo positions; adjust indices to your device if needed.
- Extra device axes and buttons are visible in diagnostics even when they do not correspond to a drawn control.
- **Try demo** runs explicitly labeled simulated animation; stop it to return to actual controller input.

## PS4 input and motion

A PS4 / DualShock 4 works with the Joy-Con artwork. **Auto detect** always keeps the Joy-Con pair visual, including when a PS4 controller connects. A single gamepad supplies all buttons and both sticks from that same device (axes 0/1 and 2/3 initially). Two-device input is only enabled for two independently exposed Joy-Cons. Explicit Pro/generic layouts remain available in Settings. Standard PS4 mappings light the matching physical positions: Cross → lower B, Circle → right A, Square → left Y, Triangle → upper X. Pressed caps turn white with dark symbols and physically depress; they do not glow. ZL/ZR are shown above the controllers with a visible gap.

**For PS4 motion, USB is the most reliable setup:**

1. Open the HTTPS/localhost site in desktop Chrome or Edge and connect the DualShock 4 with a data-capable USB cable.
2. Open Settings → **Connect motion**, then choose your controller in the WebHID permission dialog.
3. Tilt the physical controller. Four small D-pad arrowheads sit in the central gap. Pointing movement turns the corresponding arrowheads white (including two adjacent arrows for diagonals); all remain dim when you stop. The Joy-Con artwork stays still. Gyro and acceleration values are in Settings. **Reset indicator** clears the indicator briefly. It does not calibrate or change sensor bias.

The standard Gamepad API supplies buttons/sticks, but does **not** expose PS4 or Nintendo motion. The separate WebHID connection recognizes Sony vendor `054c`, products `05c4`, `09cc`, and `0ba0`. USB report `01` and full Bluetooth report `11` are parsed using signed little-endian sensor samples. Short Bluetooth `01` reports are explicitly rejected because they contain no motion. When the device exposes Bluetooth output `11`, the app requests full-feature mode with a correctly CRC32-protected HID output report (A2 transaction prefix, HID/CRC flags, 4ms interval); it does not change rumble or LEDs.

PS4 units use nominal raw/16.4 °/s and raw/8192 g. They are **uncalibrated**: no factory calibration, bias correction, or orientation fusion is claimed. The D-pad indicator uses live gyro angular velocity: X pitch is vertical and Y yaw is horizontal. Positive X points down; positive Y points right. Invert either axis in Settings if your mounting or driver reverses it. After the Ryujinx whole-vector filter, each pointing axis activates only when its magnitude reaches the configured motion deadzone. Roll-only Z motion does not activate arrows. Held tilt does not keep arrows active, because the indicator displays movement rather than absolute orientation. It does not track absolute 3D position or yaw. Stale reports clear all active arrowheads and set the disconnected state instead of inventing motion. The nominal sensor readings remain uncalibrated.

**Motion deadzone** defaults to a deliberately large **30 °/s**, requiring fast pointing movement. Smaller values make it more sensitive; Settings accepts 0–500 °/s. The underlying whole-vector algorithm matches Ryujinx at default sensitivity (100%), with a custom larger threshold instead of Ryujinx's 1 °/s. If the vector magnitude is below the threshold, all three gyro axes become zero; at or above it, the vector is unchanged. This is not a per-axis deadzone and does not subtract the threshold. The saved setting applies to gyro readouts and relayed frames. On the first load of this large-deadzone release, an old saved/URL threshold is migrated to 30 once per browser profile (`signal-motion-30-v1`). Subsequent manual changes and JSON imports remain yours. Raw gyro samples remain available internally so changing the threshold can recover previously filtered input. The directional arrows use gyro X/Y with an additional per-axis activation check at the same threshold; this does not reproduce Ryujinx's orientation fusion. Accelerometer samples remain available in Settings. Sources: [Ryujinx MotionInput](https://github.com/nintendoswitchemulators/ryujinx/blob/master/src/Ryujinx.Input/Motion/MotionInput.cs), [default gyro deadzone and sensitivity](https://github.com/NextendoNetwork/Ryujinx-Nextendo/blob/main/src/Ryujinx.Input/InputConfigDefaults.cs).

Bluetooth support depends on browser, OS and driver access; some drivers/apps keep the HID device busy or expose only basic reports. If no real sensor reports arrive, use USB and close other controller tools. Browser input can work while HID motion remains unavailable. Physical PS4/Nintendo hardware was not available for verification; USB/Bluetooth parsing and routing are covered by synthetic fixtures.

Nintendo motion remains optional: vendor `057e`, products `2006`, `2007`, `2009`. The app initializes USB output `80`, enables IMU with subcommand `40`, requests input mode `30`, and reads real signed gyro/accelerometer samples (nominal 0.06103 °/s/count and 4096 counts/g). Sony devices never receive Nintendo commands. If multiple motion devices stream, the newest sample is displayed rather than fusing them.

References: [MDN Gamepad API guide](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API), [Linux Sony report structures and Bluetooth output CRC](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c), [Chromium DS4 full-feature mode](https://chromium.googlesource.com/chromium/src/+/d4afc97b7/device/gamepad/dualshock4_controller.cc), [Nintendo protocol](https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering), [MDN WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API).

Run protocol/routing fixtures with `node tests/input-core.test.cjs`.

## OBS browser source

Click **Open OBS overlay**. Copy the resulting URL into an OBS Browser Source (suggested size 1280 × 720). The `overlay=1` parameter hides the studio and makes the page transparent. Your current colors, mapping, scale and custom CSS travel in the URL. Custom CSS can target `body.overlay`, `.controller`, `.button`, `.stick`, `.shell` and `.pressed`.

Browser storage is separate between Chrome, OBS and other browser profiles. **Copy URL** includes settings and CSS; **Export settings** / **Import** transfer a JSON file. Very large CSS configurations are rejected for URL sharing; use JSON import within the target browser, or edit the hosted CSS. URL settings are encoded, not encrypted: do not put secrets in custom CSS or relay room names. Custom CSS is applied as stylesheet text, never HTML, and can affect the whole page. It is intended for your own trusted styles.

OBS's embedded browser often cannot access local gamepads or WebHID. A browser-source URL alone cannot bypass that restriction. Use the optional relay:

1. Install Node.js. In the included `relay` folder, run `npm install` then `npm start`.
2. Open the studio in Chrome/Edge, open **OBS & relay**, set server to `ws://127.0.0.1:8787`, choose a room, choose **Send browser input**, and click **Connect relay**.
3. In a second studio tab, choose the same server and room, select **Receive in OBS overlay**, then click **Open OBS overlay**. Use this URL in OBS.
4. Receiver overlays connect automatically. An overlay opened while the sender relay is connected automatically uses receive mode and the same room. If the relay server starts later, reload the OBS source to retry.
5. Keep the sending page active. Some browsers throttle background tabs; OBS cannot make the sender continue receiving hardware input while its browser suspends it.

The included WebSocket server binds only to `127.0.0.1`, routes frames by room, limits message size and buffering, and never echoes frames to the sender. Rooms isolate accidental cross-stream input; they are not authentication. The server is optional and is **not hosted by GitHub Pages**. Local loopback WebSocket permissions vary: allow browser local-network access if prompted. For a remotely hosted relay or where HTTPS mixed-content policy blocks `ws://`, use a properly secured `wss://` endpoint instead. Do not expose this unauthenticated local relay publicly. Relay receivers clear buttons/sticks after 2.5 seconds without updates.

## Files

- `index.html` — studio and overlay page
- `styles.css` — responsive studio / controller styles
- `input-core.js` — PS4 report parser, Bluetooth initialization CRC and device routing
- `tests/input-core.test.cjs` — protocol and routing fixtures
- `app.js` — input polling, SVG visuals, mappings, storage, import/export, relay, WebHID
- `.github/workflows/pages.yml` — GitHub Pages deployment
- `relay/` — optional Node server (the `ws` package is its only dependency)

The static frontend needs no install/build step. No controller input leaves the browser unless you explicitly connect a relay. Physical controller and OBS integration require testing on your own hardware.
