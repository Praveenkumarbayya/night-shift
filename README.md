# Night Shift 🌙

A browser game where you are the only SOC analyst on the night shift at a hospital.

Security alerts arrive as cards. Swipe right to **contain** a real attack, swipe left to clear a **false alarm**. Miss too many attacks and ransomware spreads across the network; isolate too many healthy systems and you are taken off the desk.

## What's in it

- **60 alerts** written to look like real telemetry (Sysmon, Windows Security events, DNS, proxy, identity and mail logs): 40 real attacks and 20 false positives that deliberately resemble them.
- **40 MITRE ATT&CK® technique cards** to collect. Containing an attack unlocks its card, with what the technique is and how to detect it.
- **A debrief after every decision** explaining why the alert was malicious or benign, and which line gave it away.
- **An outbreak minigame**: isolate hosts on a network map before the ransomware reaches them.
- Five nights of rising difficulty, then endless overtime. Progress is saved in the browser.

## Controls

| Action | Touch / mouse | Keyboard |
| --- | --- | --- |
| Contain | Swipe right, or the button | `→` or `D` |
| False alarm | Swipe left, or the button | `←` or `A` |
| Mark the giveaway line | Tap it | `1`–`4` |
| Continue | Button | `Enter` |

## Run it locally

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 5173
```

## Files

- `data.js` — the alerts, technique cards and dialogue
- `game.js` — the game engine
- `style.css`, `index.html` — the interface

All external IP addresses use the reserved documentation ranges, and Halcyon Health is a fictional organisation.

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. This project is not affiliated with or endorsed by MITRE.
