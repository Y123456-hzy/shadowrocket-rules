#!/usr/bin/env node
/*
 * Lightweight local checks for the Shadowrocket module and response scripts.
 * Run from this directory with: node test-shadowrocket-rules.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const modulePath = path.join(root, "ios-ipados-startup-adblock.sgmodule");
const fixturePath = path.join(root, "fixtures", "behavior-cases.json");
const quiet = process.argv.indexOf("--quiet") >= 0;
let assertions = 0;

function runScript(file, options) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  let result;
  const context = {
    $request: { url: options.url },
    $response: options.hasResponse === false ? undefined : { body: options.body || "" },
    $done: function (value) {
      result = value || {};
    }
  };

  vm.createContext(context);
  vm.runInContext(code, context, { filename: file, timeout: 1000 });
  return result;
}

function assert(name, condition) {
  assertions += 1;
  if (!condition) {
    throw new Error("Failed: " + name);
  }
  if (!quiet) console.log("ok - " + name);
}

function extractSection(name) {
  const text = fs.readFileSync(modulePath, "utf8");
  const match = text.match(new RegExp("\\[" + name + "\\]\\n([\\s\\S]*?)(?=\\n\\[|$)"));
  return match ? match[1].trim().split(/\n/).filter(Boolean) : [];
}

function headerInt(key) {
  const text = fs.readFileSync(modulePath, "utf8");
  const match = text.match(new RegExp("^#!" + key + "=(\\d+)$", "m"));
  return match ? Number(match[1]) : null;
}

function hostsFromAppendLine(line) {
  return String(line || "")
    .replace(/^.*=\s*%APPEND%\s*/, "")
    .split(",")
    .map(function (host) { return host.trim(); })
    .filter(Boolean);
}

function patternFromScriptLine(line) {
  return new RegExp(line.match(/pattern=([^,]+)/)[1].replace(/\\\//g, "/"));
}

function regexFromRewriteLine(line) {
  return new RegExp(line.split(/\s+/)[0].replace(/\\\//g, "/"));
}

function compileScriptPattern(line) {
  const match = line.match(/pattern=([^,]+)/);
  if (!match) return null;
  return new RegExp(match[1].replace(/\\\//g, "/"));
}

function parseRuleLine(line) {
  const parts = line.split(",");
  return {
    type: parts[0],
    value: parts[1],
    policy: parts[2]
  };
}

function valueAtPath(value, lookupPath) {
  return lookupPath.split(".").reduce(function (current, part) {
    if (current === undefined || current === null) return undefined;
    return current[part];
  }, value);
}

function equalJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function parseJson(value) {
  if (!value) return undefined;
  return JSON.parse(value);
}

function testBehaviorFixtures() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assert("Behavior fixture schema is supported", fixture.schema_version === 1 && Array.isArray(fixture.cases));

  fixture.cases.forEach(function (item) {
    const output = runScript(item.script, {
      url: item.url,
      hasResponse: item.hasResponse,
      body: item.body === undefined ? item.bodyText || "" : JSON.stringify(item.body)
    });
    const context = {
      result: output,
      bodyJson: parseJson(output.body),
      responseBodyJson: output.response ? parseJson(output.response.body) : undefined
    };

    item.assertions.forEach(function (expectation) {
      const actual = valueAtPath(context, expectation.path);
      if (Object.prototype.hasOwnProperty.call(expectation, "equals")) {
        assert("Fixture " + item.name + " expects " + expectation.path, equalJson(actual, expectation.equals));
      } else if (Object.prototype.hasOwnProperty.call(expectation, "notEquals")) {
        assert("Fixture " + item.name + " rejects " + expectation.path, !equalJson(actual, expectation.notEquals));
      } else {
        throw new Error("Unsupported fixture assertion in " + item.name + ": " + expectation.path);
      }
    });
  });
}

function testScripts() {
  const splash = runScript("startup-ad-clean.js", {
    url: "https://app.bilibili.com/x/v2/splash/list",
    body: JSON.stringify({ code: 0, data: { list: [{ id: 1 }], show: [{ id: 2 }] } })
  });
  const splashBody = JSON.parse(splash.body);
  assert("Bilibili splash payload is emptied", splashBody.data.list.length === 0 && splashBody.data.max_time === 0);

  const feed = runScript("startup-ad-clean.js", {
    url: "https://app.bilibili.com/x/v2/feed/index",
    body: JSON.stringify({ data: { items: [{ id: 1 }, { id: 2, is_ad: true }, { id: 3, card_goto: "ad_web" }] } })
  });
  const feedBody = JSON.parse(feed.body);
  assert("Bilibili feed ads are filtered", feedBody.data.items.length === 1 && feedBody.data.items[0].id === 1);

  const generic = runScript("startup-ad-clean.js", {
    url: "https://example.com/splash/list",
    body: JSON.stringify({ data: { user: { name: "ok" }, ad_list: [{ id: 1 }], interval: 8 } })
  });
  const genericBody = JSON.parse(generic.body);
  assert("Generic ad containers are neutralized", genericBody.data.ad_list.length === 0 && genericBody.data.user.name === "ok");

  const coolapk = runScript("coolapk-clean.js", {
    url: "https://api.coolapk.com/v6/dataList",
    body: JSON.stringify({ data: [{ id: 1, title: "normal" }, { id: 2, title: "推广" }, { id: 945, title: "known ad" }] })
  });
  const coolapkBody = JSON.parse(coolapk.body);
  assert("Coolapk feed ads are filtered", coolapkBody.data.length === 1 && coolapkBody.data[0].id === 1);

  const pangolin = runScript("ad-sdk-no-fill.js", {
    url: "https://api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/get_ads/?x=1",
    hasResponse: false
  });
  assert("Pangolin request gets no-fill response", pangolin.response.status === 200 && JSON.parse(pangolin.response.body).status_code === 20001);

  const gdt = runScript("ad-sdk-no-fill.js", {
    url: "https://win.gdt.qq.com/gdt_mview.fcg?x=1",
    body: JSON.stringify({ old: true })
  });
  assert("GDT response gets no-fill body", JSON.parse(gdt.body).ret === 102006);
}

function testModuleRules() {
  const general = extractSection("General");
  const scripts = extractSection("Script");
  const rules = extractSection("Rule").map(parseRuleLine);
  const rawRules = extractSection("Rule");
  const forceLine = general.find(function (line) {
    return line.indexOf("force-http-engine-hosts =") === 0;
  }) || "";
  const forceHosts = hostsFromAppendLine(forceLine);
  const mitmLine = extractSection("MITM").find(function (line) {
    return line.indexOf("hostname =") === 0;
  }) || "";
  const mitmHosts = hostsFromAppendLine(mitmLine);
  const rewrites = extractSection("URL Rewrite").map(function (line) {
    return { line: line, re: regexFromRewriteLine(line) };
  });

  const countedMetadata = {
    "http-request-script": scripts.filter(function (line) { return /type=http-request/.test(line); }).length,
    "http-response-script": scripts.filter(function (line) { return /type=http-response/.test(line); }).length,
    "url-rewrite": rewrites.length,
    domain: rules.filter(function (rule) { return rule.type === "DOMAIN"; }).length,
    "domain-suffix": rules.filter(function (rule) { return rule.type === "DOMAIN-SUFFIX"; }).length,
    "url-regex": rules.filter(function (rule) { return rule.type === "URL-REGEX"; }).length,
    "force-http-engine-hosts": forceHosts.length,
    mitm: mitmHosts.length,
    total: scripts.length + rewrites.length + rawRules.length + forceHosts.length + mitmHosts.length
  };

  Object.keys(countedMetadata).forEach(function (key) {
    assert("Header count matches " + key, headerInt(key) === countedMetadata[key]);
  });

  assert("General has scoped force-http-engine-hosts", /^force-http-engine-hosts\s*=\s*%APPEND%/.test(forceLine));
  assert("HTTP engine hosts avoid wildcard hosts", !forceHosts.some(function (host) { return host.indexOf("*") >= 0; }));
  assert("HTTP engine hosts do not include 10099 service hall", !forceHosts.some(function (host) { return /(?:^|\.)10099\.com\.cn$/i.test(host); }));
  const duplicateForceHosts = forceHosts.filter(function (host, index) {
    return forceHosts.indexOf(host) !== index;
  });
  assert("HTTP engine hostname list has no duplicates", duplicateForceHosts.length === 0);

  scripts.forEach(function (line) {
    assert("Script pattern compiles: " + line.split(" = ")[0], compileScriptPattern(line) instanceof RegExp);
    assert("Script has a timeout: " + line.split(" = ")[0], /(?:^|,)timeout=\d+(?:,|$)/.test(line));
    assert("Script has a raw script path: " + line.split(" = ")[0], /script-path=https:\/\/raw\.githubusercontent\.com\//.test(line));
    assert("Script pins update interval: " + line.split(" = ")[0], /(?:^|,)script-update-interval=0(?:,|$)/.test(line));
    if (/type=http-response/.test(line)) {
      assert("Response script declares body requirement: " + line.split(" = ")[0], /(?:^|,)requires-body=1(?:,|$)/.test(line));
      assert("Response script declares max-size: " + line.split(" = ")[0], /(?:^|,)max-size=\d+(?:,|$)/.test(line));
    }
  });

  rewrites.forEach(function (item) {
    assert("URL Rewrite pattern compiles: " + item.line, item.re instanceof RegExp);
  });

  assert("MITM hostname uses %APPEND%", /^hostname\s*=\s*%APPEND%/.test(mitmLine));
  assert("MITM avoids wildcard hosts", !mitmHosts.some(function (host) { return host.indexOf("*") >= 0; }));
  assert("MITM does not include 10099 service hall", !mitmHosts.some(function (host) { return /(?:^|\.)10099\.com\.cn$/i.test(host); }));
  assert("HTTP engine hosts align with MITM hosts", forceHosts.length === mitmHosts.length && forceHosts.every(function (host, index) { return host === mitmHosts[index]; }));

  const duplicateRules = rawRules.filter(function (line, index) {
    return rawRules.indexOf(line) !== index;
  });
  assert("Rule section has no duplicate lines", duplicateRules.length === 0);

  const duplicateMitmHosts = mitmHosts.filter(function (host, index) {
    return mitmHosts.indexOf(host) !== index;
  });
  assert("MITM hostname list has no duplicates", duplicateMitmHosts.length === 0);

  const firstRejectIndex = rules.findIndex(function (rule) {
    return /^REJECT/.test(rule.policy || "");
  });
  const directAfterReject = firstRejectIndex >= 0 && rules.slice(firstRejectIndex + 1).some(function (rule) {
    return rule.policy === "DIRECT";
  });
  assert("Direct allow rules appear before reject rules", !directAfterReject);

  scripts.forEach(function (line) {
    const match = line.match(/script-path=https:\/\/raw\.githubusercontent\.com\/Y123456-hzy\/shadowrocket-rules\/main\/shadowrocket\/([^,]+)/);
    if (!match) return;
    assert("Script path maps to a local file: " + match[1], fs.existsSync(path.join(root, match[1])));
  });

  const genericLine = scripts.find(function (line) {
    return line.indexOf("Generic Startup Ads") === 0;
  });
  const genericRe = patternFromScriptLine(genericLine);
  assert("10099 is excluded from generic startup cleanup", !genericRe.test("https://m.10099.com.cn/h5wap/promotion"));
  assert("Generic startup cleanup still catches startup ad paths", genericRe.test("https://example.com/splash/list"));
  assert("Generic startup cleanup avoids broad promotion paths", !genericRe.test("https://example.com/promotion/list"));
  assert("Generic startup cleanup avoids broad commercial paths", !genericRe.test("https://example.com/commercial/list"));
  assert("Generic startup cleanup avoids broad campaign paths", !genericRe.test("https://example.com/campaign/list"));

  const sdkScriptPatterns = scripts
    .filter(function (line) {
      return line.indexOf("Xiaocan Ad SDK") === 0;
    })
    .map(patternFromScriptLine);

  const sdkSamples = [
    "https://api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/get_ads/?x=1",
    "https://is.snssdk.com/api/ad/union/sdk/get_ads/?x=1",
    "https://api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/stats/batch/?x=1",
    "https://api-access.pangolin-sdk-toutiao.com/api/ad/union/mediation/exchange/?x=1",
    "https://mi.gdt.qq.com/gdt_mview.fcg?x=1",
    "https://win.gdt.qq.com/win_notice.fcg?x=1",
    "https://oth.eve.mdt.qq.com/a",
    "https://open.e.kuaishou.com/rest/e/v3/open/univ?x=1",
    "https://open.e.kuaishou.com/rest/e/v3/open/logBatch?x=1",
    "http://api-htp.beizi.biz/mb/sdk0/json?x=1",
    "http://t2.fancyapi.com/b?x=1",
    "http://g.fancyapi.com/s2s?x=1",
    "http://sdk.zhangyuyidong.cn/sdk/config?x=1",
    "http://sdktmp.hubcloud.com.cn/v1/api/sdk/task/list/p?x=1"
  ];

  sdkSamples.forEach(function (url) {
    assert("SDK sample is covered by no-fill script: " + url, sdkScriptPatterns.some(function (re) { return re.test(url); }));
    assert("SDK sample is not preempted by URL Rewrite: " + url, !rewrites.some(function (item) { return item.re.test(url); }));
  });

  assert("Baidu iOS startup rewrite catches exact start info", rewrites.some(function (item) { return item.re.test("https://mime.baidu.com/v1/IosStart/getStartInfo"); }));
  assert("Baidu iOS startup rewrite avoids adjacent paths", !rewrites.some(function (item) { return item.re.test("https://mime.baidu.com/v1/IosStart/getUserInfo"); }));
  assert("Baidu iOS startup rewrite is scoped to the exact path", !rewrites.some(function (item) { return item.re.test("https://mime.baidu.com/v1/IosStart/getStartInfo/extra"); }));
  assert("Baidu activity rewrite catches exact activity ads", rewrites.some(function (item) { return item.re.test("https://mime.baidu.com/v5/activity/advertisement?x=1"); }));
  assert("Baidu activity rewrite catches nonrealtime activity ads", rewrites.some(function (item) { return item.re.test("https://mime.baidu.com/v5/activity/advertisementnonrealtime"); }));
  assert("Baidu activity rewrite avoids adjacent activity paths", !rewrites.some(function (item) { return item.re.test("https://mime.baidu.com/v5/activity/advertisementList"); }));
  assert("Baidu Map qt ads rewrite catches exact ads query", rewrites.some(function (item) { return item.re.test("https://newclient.map.baidu.com/client/phpui2/?qt=ads&cuid=1"); }));
  assert("Baidu Map qt ads rewrite avoids adjacent query values", !rewrites.some(function (item) { return item.re.test("https://newclient.map.baidu.com/client/phpui2/?qt=address"); }));
  assert("Baidu Map qt ads rewrite avoids adjacent paths", !rewrites.some(function (item) { return item.re.test("https://newclient.map.baidu.com/client/phpui2/extra?qt=ads"); }));
  assert("MITM includes Baidu exact startup host", mitmHosts.indexOf("mime.baidu.com") >= 0);
  assert("MITM includes Baidu Map exact ads host", mitmHosts.indexOf("newclient.map.baidu.com") >= 0);

  [
    "api-access.pangolin-sdk-toutiao.com",
    "api-access.pangolin-sdk-toutiao1.com",
    "api-access.pangolin-sdk-toutiao-b.com",
    "is.snssdk.com",
    "gromore.pangolin-sdk-toutiao.com",
    "mi.gdt.qq.com",
    "win.gdt.qq.com",
    "oth.eve.mdt.qq.com",
    "oth.str.mdt.qq.com",
    "open.e.kuaishou.com",
    "api-htp.beizi.biz",
    "t2.fancyapi.com",
    "g.fancyapi.com",
    "sdk.zhangyuyidong.cn",
    "sdktmp.hubcloud.com.cn"
  ].forEach(function (host) {
    assert("MITM includes no-fill HTTPS host: " + host, mitmHosts.indexOf(host) >= 0);
  });

  const exactDomainPolicies = {};
  rules.forEach(function (rule) {
    if (rule.type !== "DOMAIN") return;
    exactDomainPolicies[rule.value] = exactDomainPolicies[rule.value] || [];
    exactDomainPolicies[rule.value].push(rule.policy);
  });

  const exactConflicts = [];
  Object.keys(exactDomainPolicies).forEach(function (domain) {
    const policies = exactDomainPolicies[domain];
    if (policies.indexOf("DIRECT") >= 0 && policies.some(function (policy) { return /^REJECT/.test(policy); })) {
      exactConflicts.push(domain + " => " + policies.join("/"));
    }
  });
  assert("Exact domains have no direct/reject conflicts", exactConflicts.length === 0);

  const directDomains = rules
    .filter(function (rule) { return rule.type === "DOMAIN" && rule.policy === "DIRECT"; })
    .map(function (rule) { return rule.value; });
  const rejectSuffixes = rules
    .filter(function (rule) { return rule.type === "DOMAIN-SUFFIX" && /^REJECT/.test(rule.policy || ""); })
    .map(function (rule) { return rule.value; });

  const suffixConflicts = [];
  directDomains.forEach(function (domain) {
    rejectSuffixes.forEach(function (suffix) {
      if (domain === suffix || domain.endsWith("." + suffix)) suffixConflicts.push(domain + " < " + suffix);
    });
  });
  assert("Direct domains are not shadowed by reject suffixes", suffixConflicts.length === 0);
}

testScripts();
testBehaviorFixtures();
testModuleRules();
console.log("all Shadowrocket local checks passed (" + assertions + " checks)");
