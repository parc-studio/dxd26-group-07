# Mixtape Shop — PUBLICparc workshop · ECAL Master DXD 2026

> *What if browsing a shop was the same as using the product?*

A mobile prototype for a Teenage Engineering store. You record a sound, then you try the machines with it before buying. Everything you play becomes a mixtape, and the mixtape becomes your cart.

## Flow
1. **record it.** Tap the button, record any sound around you, tap again to stop.
2. **all products.** The catalog. The OB-4 and the EP-133 can be played. The other products are for show.
3. **try it. feel it.** The 3D machine uses your sound. Tilting the phone switches between the front and top views, and your fingers play the buttons. Recording into the mixtape is automatic while you play, and mute turns the sound off.
4. **like it ?** "Finalizing your mixtape…", then **hear it.** The disc plays your mixtape. Tap a machine to jump to its part, or × to cut it out of the tape.
5. **get it.** The products you used, and check out.

## Run it
- **Folder version** (this one): it has to be served over http(s), so double-clicking `index.html` won't work.
  - `python3 -m http.server` in this folder, then open http://localhost:8000
  - or upload the folder (Netlify, workshop.parc.studio…).
  - On a phone, the mic and the tilt need **https**.
- **Single-file version:** `standalone/index.html` contains everything (images, 3D, audio) in one file.
- **On iPhone:** Share → "Add to Home Screen" opens it full screen, without the Safari bars.

## Structure
```
index.html              markup of every page (landing, catalog, product pages, cart, get it)
manifest.webmanifest    home-screen app settings
css/style.css           all styles
js/00-boot.js           loads three.js (CDN), then the scripts below, in order
js/01-config.js         asset paths, catalog data, helpers
js/02-dot-font.js       5×7 dot-matrix font
js/03-audio-core.js     audio engine (tape ring buffer, worklet + fallback, iOS unlock)
js/04-ob4-logic.js      OB-4 behaviour: line / bt / radio / disk, tape modes, radio stations
js/05-ui.js             pages, landing recorder, catalog, auto mixtape, mute, cart cards, get it
js/06-ob4-3d.js         OB-4 in 3D: views, tilt snapping, finger picking, pinch
js/07-cart-disc.js      the disc: playback, scrub, jump to / cut a machine
js/08-ep133.js          EP-133: 12 chopped pads, groove, loop, FX, fader, 7-segment screen
js/09-main-loop.js      animation loop + window.__dbg for testing
assets/img              product photos (webp)
assets/models           ob-4.fbx, ep-133.glb
assets/textures         OB-4 colour + roughness maps
assets/audio            the two OB-4 radio stations (ECAL Radio 94.6, DXD 99.9)
standalone/index.html   everything in one file
```
The scripts are plain JavaScript and share one global scope: each file builds on the ones loaded before it. Only `00-boot.js` is a module, because it imports three.js.

## Tech
three.js r160 · Web Audio (AudioWorklet) · MediaRecorder · DeviceOrientation · no framework, no build step.
The radio voices were generated with Kokoro, an open-source text-to-speech model. All the station texts are fictional.
