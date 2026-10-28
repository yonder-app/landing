# Yonder alternative landing: performance and GA4

The alternative page uses the existing GA4 stream `G-DDWVMYJ078`. No new account or stream was created. Google is loaded asynchronously on `yonder.site` and `www.yonder.site` only. Localhost and other preview hosts do not load Google or send events. Do Not Track and Global Privacy Control also disable the tag. Advertising personalization and Google Signals are disabled in this page's configuration.

## Events

| Event | Trigger | Parameters |
| --- | --- | --- |
| `install_copy_success` | Clipboard write resolves successfully | `method: clipboard` |
| `install_copy_error` | Clipboard write fails; manual copy fallback is shown | `reason: clipboard_unavailable` |
| `install_help_open` | Tooltip remains open for 400 ms while the tab is visible; once per page | — |
| `demo_engaged` | 10 accumulated seconds of advancing video playback with at least 50% of the demo visible; once per page | `visible_seconds: 10` |
| `demo_toggle` | User clicks the video or presses its button | `action: play` or `pause` |
| `demo_error` | Media element reports an error; once per page | `media_error_code` |
| `footer_link_click` | User clicks a footer link | `destination: coffee` or `feedback` |

All custom events include `page_variant: portfolio`. Automatic pauses/resumes, video loops and buffering do not generate manual engagement events. Raw clipboard contents, error messages and email addresses are not sent as custom parameters.

## GA4 account setup after deployment

1. In the existing property's event settings, mark `install_copy_success` as a key event. Use once-per-session counting for the landing conversion funnel.
2. Register event-scoped custom dimensions for `page_variant`, `action` and `destination` if these breakdowns are needed in reports. Event totals are available without custom dimensions.
3. Visit the production URL with `?analytics_debug=1` and verify events in DebugView. Localhost intentionally cannot test delivery to Google. DebugView and account settings were not verified in this task.
4. Compare session conversion by traffic source/medium/campaign and operating system/device category. UTM attribution and device dimensions are supplied by the Google tag.

Copy success measures installation intent, not completed installation or first launch. No install-completion tracking has been added to the shell script or app.

Official references: https://developers.google.com/analytics/devguides/collection/ga4/events and https://support.google.com/analytics/answer/7201382

## Performance changes

- Removed the unused Google Fonts request and unused portfolio stylesheet dependency.
- Combined the required portfolio styles and Yonder overrides into one stylesheet, preserving computed desktop/mobile layout.
- Video source is attached near the viewport; reduced-motion/Save-Data users load it on explicit playback.
- Video pauses outside the viewport and in hidden tabs. Returning resumes only if the user has not manually paused.
- Contrast sampling runs at most four times per second during visible playback; the former callback on every decoded frame is removed.
- CSS keeps reserved media dimensions and reduced-motion support; the video resolution, frame rate and encoding are unchanged.
- Compression, CDN cache headers and HTTP Range support must be checked on the production host after deployment; the Python development server is not the production serving configuration.

## Validation

Run `node tests/landing.test.cjs`. It checks analytics host/privacy gating and deduplication; visibility/user-pause behavior; watch-time versus buffering; clipboard success/failure; reduced-motion and Save-Data behavior. Browser QA also compared computed styles before/after on mobile and desktop, checked video pause outside the screen, and exercised copy/tooltip behavior without sending local test traffic to GA4.
