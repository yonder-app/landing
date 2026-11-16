# Open project questions

Carried forward from project chats reviewed on 2026-11-16. These are historical unresolved items, not fresh checks of external services.

## Installation

The intended experience is installation without manually bypassing macOS trust warnings. The release's signing/notarization and installation on a clean Mac were not confirmed. A local signature trust check failed during earlier work.

The current script downloads the v1.0.0 DMG and checks its fixed SHA-256. It uses /Applications or ~/Applications. An existing installation is opened rather than upgraded. The script checks Darwin, but does not validate the macOS version; the page advertises macOS 26.1+.

## Analytics

GA4 DebugView and account configuration remain unconfirmed. Mark `install_copy_success` as a key event and verify production delivery. See [analytics.md](analytics.md).

Copying the command measures installation intent, not completed installation or first launch.

## Domain and HTTPS

Hosting: GitHub Pages. Domain/DNS provider: REG.RU. In the last certificate discussion HTTPS worked, while GitHub still reported a domain check error. Its cause and future automatic renewal were not established.

## Production performance

Server compression, caching and HTTP Range support for video were left for production verification.
