# Shadowrocket startup adblock

Current module name:

```text
GY Startup AdBlock v6.16 - Baidu GetMobads Exact
```

Subscription module:

```text
https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/ios-ipados-startup-adblock.sgmodule
```

Script URL used by the module:

```text
https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/startup-ad-clean.js
```

Ad SDK no-fill script URL:

```text
https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/ad-sdk-no-fill.js
```

Coolapk cleanup script URL:

```text
https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/coolapk-clean.js
```

Notes:

- Built for Shadowrocket on iOS/iPadOS.
- Enable HTTPS decryption and install/trust the Shadowrocket CA certificate.
- Bilibili startup ads are handled by rewriting `app.bilibili.com/x/v2/splash/list`, `show`, and `event/list2` into a valid empty response.
- Bilibili feed cleanup removes nested ad banners and game promotion cards while preserving ordinary feed/banner card contents.
- Bilibili tab cleanup is narrowly scoped to `x/resource/show/tab/v2`, removing only game center, publish, and mall entries while repairing positions.
- Coolapk ad cleanup is kept in v6, but the script is narrowed to feed/list endpoints and skips the startup `main/init` API to reduce content-loading overhead.
- Baidu iOS startup and activity advertising are handled with exact `mime.baidu.com` rewrites instead of broad Baidu-domain blocks.
- Baidu Map `qt=ads` is handled with an exact `newclient.map.baidu.com/client/phpui2/` rewrite.
- Baidu newspage `getmobads?page=landingshare` is handled with an exact `mbd.baidu.com` rewrite.
- Ad SDK endpoints covered by `ad-sdk-no-fill.js` are left to the script instead of duplicated URL Rewrite rejects, so apps receive retry-friendly JSON no-fill responses.
- HTTPS hosts handled by scripts or rewrites are explicitly listed in `%APPEND%` `force-http-engine-hosts` and `%APPEND%` MITM, and exact-domain direct/reject conflicts are checked locally.
- Generic startup cleanup is intentionally limited to high-signal startup/ad URL terms and avoids broad business words such as `promotion` or `commercial`.
- Inside matched startup responses, ambiguous business keys such as `promotion`, `commercial`, and `campaign` are no longer erased wholesale; the script only removes contents that look ad-like.
- China Broadnet service hall domains under `10099.com.cn` are explicitly kept direct and excluded from the generic startup-ad cleanup rule.
- Local checks compile script/rewrite regexes, verify script metadata, prevent duplicate rules, require `%APPEND%` MITM, and block exact or suffix direct/reject conflicts.
- Script entries explicitly set `script-update-interval=0`, mirroring app-specific public modules that pin script update behavior in the module itself.
- The module header includes counted release metadata for script, rewrite, rule, HTTP-engine host, and MITM totals, and release checks recompute those counts before publishing.
- Remote release checks compare SHA-256 content hashes for the raw module and each published script, and verify public reference-source links before calling a release good.
- The quality audit scores release readiness across metadata, counted header accuracy, regex validity, script-path integrity, MITM hygiene, rule conflicts, low-false-positive generic matching, no-fill coverage, behavior fixtures, and the `10099.com.cn` bypass.
- Behavior fixtures live in `fixtures/behavior-cases.json`. Add real app logs there as small request/body/assertion samples before changing broad cleanup logic.
- Public-rule reference patterns live in `references/public-patterns.json`; the audit checks that each borrowed quality pattern has current local evidence, and `--remote` checks that source links still contain expected reference snippets.
- Some ad SDK endpoints are still handled with lightweight fast 200 or reject-dict rules.
- The generic rule only works for HTTPS JSON endpoints that Shadowrocket can MITM. Apps with certificate pinning, protobuf, or non-HTTP startup ads may need app-specific rules.
- Keep this repository public so Shadowrocket can fetch the raw module and script URLs without authentication.

Reference patterns:

- `blackmatrix7/ios_rule_script`: app-specific rewrite entries, exact startup-ad rewrites, explicit `requires-body`, `max-size`, `timeout`, and `%APPEND%` MITM.
- `Johnshall/Shadowrocket-ADBlock-Rules-Forever`: separate rule profiles and generated large-list hygiene for different user modes.
- `app2smile/rules`: narrow app-specific modules instead of broad global rewrites when app behavior is known.
- `bai1zi/shadowrocket-surge-loon-qx`: complex modules keep hostname scope explicit and avoid replacing the user's MITM list.

Local check:

```bash
node test-shadowrocket-rules.js
node audit-shadowrocket-quality.js
node release-check-shadowrocket.js
node release-check-shadowrocket.js --remote
```
