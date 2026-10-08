# The Bridge - how to open it locally

`index.html` fetches `data.json` from the same folder (browsers block fetch
across folders). To run: copy `../data/data.json` next to `index.html`, then
open with any static server (`python3 -m http.server` or `npx serve`).
Phase 6 wires the deploy so this just works at a URL.
