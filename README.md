# Yonder landing page

Static landing page for [yonder.site](https://yonder.site/), hosted with GitHub Pages from this repository.

## Run locally

From the project directory:

```sh
python3 -m http.server 4178
```

Open http://localhost:4178/. No build step or dependency installation is required.

## Files

- `index.html` — page content and markup.
- `styles.css` — responsive layout and visual styles.
- `main.js` — video, clipboard, tooltip and animation behavior.
- `analytics.js` — production-only GA4 events.
- `assets/` — demo video, poster, logo, social preview and heart icon.
- `install-yonder.sh` — downloadable installer; keep its release URL and SHA-256 in sync.
- `CNAME` — GitHub Pages custom domain.
- `docs/` — analytics setup and unresolved project questions.
- `tests/landing.test.cjs` — existing behavior checks.

## Validate

```sh
node tests/landing.test.cjs
node --check main.js
node --check analytics.js
bash -n install-yonder.sh
git diff --check
```

GitHub Pages publishes changes pushed to `main`. Local previews do not send GA4 traffic.

## Archive

Historical files and video masters are stored outside this repository:
`../Yonder Landing Page Archive/2026-11-16/`.

The previous landing with large typography and clouds inside “beautifully” is in
`previous-landing-672c6bc/` there and remains available in Git at `672c6bc`.
The current design replaced it in `a7ecd8b`; the repaired demo was added in `d748515`.

The archive is a local copy, not an off-device backup. Keep it separate from the published site.
