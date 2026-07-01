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
  if (!condition) {
    throw new Error("Failed: " + name);
  }
  console.log("ok - " + name);
}

function extractSection(name) {
  const text = fs.readFileSync(modulePath, "utf8");
  const match = text.match(new RegExp("\\[" + name + "\\]\\n([\\s\\S]*?)(?=\\n\\[|$)"));
  return match ? match[1].trim().split(/\n/).filter(Boolean) : [];
}

function patternFromScriptLine(line) {
  return new RegExp(line.match(/pattern=([^,]+)/)[1].replace(/\\\//g, "/"));
}

function regexFromRewriteLine(line) {
  return new RegExp(line.split(/\s+/)[0].replace(/\\\//g, "/"));
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
    url: "https://example.com/promotion/list",
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
  const scripts = extractSection("Script");
  const rewrites = extractSection("URL Rewrite").map(function (line) {
    return { line: line, re: regexFromRewriteLine(line) };
  });

  const genericLine = scripts.find(function (line) {
    return line.indexOf("Generic Startup Ads") === 0;
  });
  const genericRe = patternFromScriptLine(genericLine);
  assert("10099 is excluded from generic startup cleanup", !genericRe.test("https://m.10099.com.cn/h5wap/promotion"));
  assert("Generic startup cleanup still catches ad paths", genericRe.test("https://example.com/promotion"));

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
}

testScripts();
testModuleRules();
console.log("all Shadowrocket local checks passed");
