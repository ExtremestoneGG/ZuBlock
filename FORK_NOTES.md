# Fork Notes

This fork starts from the official uBlock Origin source repository:

- Upstream: https://github.com/gorhill/uBlock
- Base tag: 1.72.0
- Base commit: abb9457af6d83b510d3101e125fb5a14d89e858a
- License: GPLv3
- Target browser family for the first fork build: Chromium / Brave, Manifest V2
- Current Brave-compatible test build: Chromium / Brave, Manifest V3

The locally installed Brave copy found on this machine is also uBlock Origin
1.72.0, Manifest V2.

## Local Paths

- Source fork: `D:\Ubloc 2\ublock-origin-fork`
- Loadable Chromium MV2 build: `D:\Ubloc 2\ublock-origin-fork\dist\build\uBlock0.chromium`
- No-space MV2 test copy: `D:\ZuBlockBuild`
- Loadable Chromium MV3 test copy: `D:\ZuBlockMV3`
- Brave MV3 test profile: `D:\ZuBlockMV3Profile`
- Installed Brave reference copy:
  `C:\Users\Stone\AppData\Local\BraveSoftware\Brave-Browser\User Data\Default\Extensions\cjpalhdlnbpafiamejdnhcphjbkeiagm\1.72.0_0`

## Important Fork Rules

- Keep GPLv3 license and original attribution.
- Mark modified versions clearly before distribution.
- Do not publish under a name that implies it is the official uBlock Origin.
- Keep large generated files and builds on `D:\` whenever possible.

## Current Build Status

The local Chromium/Brave unpacked build was generated successfully from tag
`1.72.0`.

The generated manifest intentionally does not include the Chrome Web Store
`key` or `update_url`, so it can be loaded as an independent unpacked extension.

The fork is now named `ZuBlock` in the Chromium manifest and uses a purple
variant of the original uBlock shield icon.

Brave 1.92 / Chromium 150 disables independent Manifest V2 forks as "no longer
compatible", even when the official uBlock Origin MV2 package is still allowed
through Brave's special exception path. ZuBlock should not copy the official
uBlock Origin key or identity to bypass this allowlist; the compatible path is
the MV3/Lite package.

The MV3/Lite package is generated at `dist\build\uBOLite.chromium` and copied
to `D:\ZuBlockMV3`. It is named ZuBlock, uses purple icons, and includes the
experimental Twitch Shield proxy toggle. As of the 2026-07-03 test build, the
Twitch Shield is enabled by default and activates only while Twitch tabs are
open. A first aggressive PAC caused Twitch player error #2000 because it
proxied media segment hosts too broadly. The PAC now avoids generic
`*.ttvnw.net` / `*.hls.ttvnw.net` segment proxying. After live ads still
appeared in testing, the PAC was adjusted closer to TTV LOL PRO's Chromium
request categories by routing the playlist host families and
`video-weaver.*.hls.ttvnw.net`, while still avoiding a blanket `*.ttvnw.net`
proxy rule.

- `passport.twitch.tv`
- `usher.ttvnw.net`
- `gql.twitch.tv`
- `*.playlist.live-video.net`
- `*.playlist.ttvnw.net`
- `video-weaver.*.hls.ttvnw.net`

The MV3/Lite dashboard now exposes the former custom cosmetic filters as
`Saved edits`. Edits saved through the picker or manually added by site are
stored per hostname, applied at `document_start`, and can be copied, removed, or
paused per site without deleting the saved selectors.

The MV3/Lite popup is the main ZuBlock control surface. It keeps the original
site tools visible, adds saved-edits controls for the current hostname, and adds
a `Brave Clean` shortcut area for the Brave pages that can hide or disable
browser-level features. Extensions cannot directly modify Brave's native
toolbar, new-tab implementation, or `brave://` pages; proper Brave debloat must
be done through Brave settings, Brave Group Policy, or Brave Origin.

The popup now also exposes `Visual translation`, off by default, with Portuguese
and English as the first supported target languages. The page translator uses a
quality-first cascade: prefer the browser-native Translator API when available,
then fall back to the Google Translate web endpoint with explicit `en <-> pt`
language pairs. The translator watches visible page text, placeholders, titles,
and aria labels, preserves simple capitalization such as all-caps buttons, and
can persist translated strings in `zublock.pageTranslator.cache.<language>` so
repeat visits do not need to translate the same strings again.

## Twitch Shield Reference

The Twitch helper is based on the current public TTV LOL PRO approach:

- Repository: https://github.com/younesaassila/ttv-lol-pro
- Reference version inspected: 2.6.2
- License: GPL-3.0
- Reference commit inspected: 0e81e741390a9deb0c009563c941dbd7fb855f18

ZuBlock's first Twitch Shield integration uses a Chromium PAC proxy helper for
Twitch live-video request hosts while Twitch tabs are open. This is intentionally
kept behind a popup switch so it can be disabled quickly if it conflicts with
another proxy extension.

## Next Customization Candidates

- Add richer Twitch status reporting in the popup.
- Add custom default filter lists.
- Add quick toggles or presets for stricter blocking modes.
- Improve import/export or backup flow for personal settings.
- Add a guarded Brave policy helper with dry-run, backup, and restore before
  touching Windows policy/registry keys.
