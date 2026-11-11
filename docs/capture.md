# Phase 1 capture procedure

## Setup still needed

Apple distributes PacketLogger with Additional Tools for Xcode:
https://developer.apple.com/bluetooth/
https://developer.apple.com/download/all/

Bluetooth diagnostic profiles and instructions are available at:
https://developer.apple.com/bug-reporting/profiles-and-logs/

Obtain PacketLogger and review Apple's current macOS Bluetooth logging instructions. Apple downloads may require developer-account sign-in; profile installation may require interactive administrator approval. Coordinate any restart or Bluetooth reconnection after the current paper experiments finish.

Wireshark is already installed, but its currently listed interfaces do not include Bluetooth. Capturing Wi-Fi or a network interface will not capture this device's Bluetooth session. Determine the actual Bluetooth transport from evidence rather than assuming BLE or RFCOMM.

## First verified capture

1. Create a session directory under `captures/`, named with local date/time and a short experiment label.
2. Start a macOS Bluetooth trace in PacketLogger after completing its required setup. Record start time and timezone.
3. Confirm traffic is arriving and identify the Cameo connection. Keep unrelated Bluetooth traffic private.
4. Once coordinated with the user, capture connection setup and a small known test cut. Record any missing connection setup explicitly.
5. Record paper, blade/tool, depth, force, speed, passes, design dimensions, and actions with timestamps. Use `unknown` for missing details.
6. Stop and save the original trace. Record end time, application version, device firmware if available, and physical cut result.
7. Run `shasum -a 256` on the saved trace and preserve the result alongside it.
8. Inspect a copy to verify both traffic directions, timing, and payload availability. Document missing packets, redaction, and other limitations before calling the session complete.

## Session notes template

- Session ID:
- Start/end time and timezone:
- Capture tool/version:
- Original trace filename and SHA-256:
- Silhouette Studio version:
- Device model / firmware:
- Connection setup included:
- Paper and thickness:
- Tool / blade depth:
- Force / speed / passes:
- Design filename and dimensions:
- Timestamped user actions:
- Physical result:
- Packet verification / known gaps:

## Current status

Repository initialized during the user's paper experiments on 2026-11-11. No packet capture was started or verified. Do not assume those experiments can be recovered as replayable sessions.
