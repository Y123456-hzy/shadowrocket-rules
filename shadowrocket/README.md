# Shadowrocket startup adblock

Subscription module:

```text
https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/ios-ipados-startup-adblock.sgmodule
```

Script URL used by the module:

```text
https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/startup-ad-clean.js
```

Notes:

- Built for Shadowrocket on iOS/iPadOS.
- Enable HTTPS decryption and install/trust the Shadowrocket CA certificate.
- Bilibili startup ads are handled by rewriting `app.bilibili.com/x/v2/splash/list`, `show`, and `event/list2` into a valid empty response.
- Xiaocan startup delay is reduced by rejecting common ad SDK domains seen in proxy logs. Pangolin/CSJ only blocks ad fetch and exchange endpoints; stats, settings, config, and logging paths are left alone to avoid retry storms.
- The generic rule only works for HTTPS JSON endpoints that Shadowrocket can MITM. Apps with certificate pinning, protobuf, or non-HTTP startup ads may need app-specific rules.
- Keep this repository public so Shadowrocket can fetch the raw module and script URLs without authentication.
