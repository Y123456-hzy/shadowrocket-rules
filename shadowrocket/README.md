# Shadowrocket startup adblock

Current module name:

```text
GY Startup AdBlock v6.5 - Quality Gates
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
- Coolapk ad cleanup is kept in v6, but the script is narrowed to feed/list endpoints and skips the startup `main/init` API to reduce content-loading overhead.
- Ad SDK endpoints covered by `ad-sdk-no-fill.js` are left to the script instead of duplicated URL Rewrite rejects, so apps receive retry-friendly JSON no-fill responses.
- HTTPS hosts handled by no-fill scripts are explicitly listed in `%APPEND%` MITM, and exact-domain direct/reject conflicts are checked locally.
- Generic startup cleanup is intentionally limited to high-signal startup/ad URL terms and avoids broad business words such as `promotion` or `commercial`.
- China Broadnet service hall domains under `10099.com.cn` are explicitly kept direct and excluded from the generic startup-ad cleanup rule.
- Local checks compile script/rewrite regexes, verify script metadata, prevent duplicate rules, require `%APPEND%` MITM, and block exact or suffix direct/reject conflicts.
- Some ad SDK endpoints are still handled with lightweight fast 200 or reject-dict rules.
- The generic rule only works for HTTPS JSON endpoints that Shadowrocket can MITM. Apps with certificate pinning, protobuf, or non-HTTP startup ads may need app-specific rules.
- Keep this repository public so Shadowrocket can fetch the raw module and script URLs without authentication.

Local check:

```bash
node test-shadowrocket-rules.js
```
