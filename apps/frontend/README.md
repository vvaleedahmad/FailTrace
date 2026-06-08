# FailTrace Frontend

This frontend is a browser app generated from the Google Stitch screens.

## Structure

- `index.html` contains only document structure and screen markup.
- `styles/app.css` contains visual styling, layout, responsive rules, and animations.
- `scripts/data.js` contains boot configuration, API base URL defaults, and storage keys.
- `scripts/app.js` contains browser behavior: screen switching, boot playback, session timer, auth handling, live data rendering, and terminal stream interactions.
- `assets/images/` contains runtime image assets used by the UI.

Open `index.html` directly in a browser to run the UI. Point it at the API server with the config panel if your backend is not already on `http://127.0.0.1:4000`.
