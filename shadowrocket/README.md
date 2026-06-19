# Shadowrocket startup adblock

Current module name:

```text
GY Startup AdBlock v4 - Instant No-Fill
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

Notes:

- Built for Shadowrocket on iOS/iPadOS.
- Enable HTTPS decryption and install/trust the Shadowrocket CA certificate.
- Bilibili startup ads are handled by rewriting `app.bilibili.com/x/v2/splash/list`, `show`, and `event/list2` into a valid empty response.
- Xiaocan startup delay is reduced with request-stage 200 no-fill responses for Pangolin/CSJ, GDT, and Kuaishou ad fetch endpoints. v4 also fast-acks observed stats, win_notice, logBatch, and secondary HTTP ad-probe tails before the SDK waits on upstream servers.
- The generic rule only works for HTTPS JSON endpoints that Shadowrocket can MITM. Apps with certificate pinning, protobuf, or non-HTTP startup ads may need app-specific rules.
- Keep this repository public so Shadowrocket can fetch the raw module and script URLs without authentication.
