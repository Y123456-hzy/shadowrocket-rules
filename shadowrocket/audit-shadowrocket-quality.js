#!/usr/bin/env node
/*
 * Structural quality audit for this Shadowrocket module.
 * The score is a local engineering proxy inspired by common public rule sets:
 * app-specific script entries, %APPEND% MITM, explicit host lists, low-conflict
 * rule order, and narrow generic matching.
 */

const fs = require("fs");
const path = require("path");

const root = __dirname;
const modulePath = path.join(root, "ios-ipados-startup-adblock.sgmodule");
const fixturePath = path.join(root, "fixtures", "behavior-cases.json");
const referencePath = path.join(root, "references", "public-patterns.json");
const releaseCheckPath = path.join(root, "release-check-shadowrocket.js");
const text = fs.readFileSync(modulePath, "utf8");
const releaseCheckText = fs.readFileSync(releaseCheckPath, "utf8");
const json = process.argv.indexOf("--json") >= 0;

function linesInSection(name) {
  const match = text.match(new RegExp("\\[" + name + "\\]\\n([\\s\\S]*?)(?=\\n\\[|$)"));
  return match ? match[1].trim().split(/\n/).map((line) => line.trim()).filter(Boolean) : [];
}

function sectionText(name) {
  return linesInSection(name).join("\n");
}

function headerInt(key) {
  const match = text.match(new RegExp("^#!" + key + "=(\\d+)$", "m"));
  return match ? Number(match[1]) : null;
}

function hostsFromAppendLine(line) {
  return String(line || "")
    .replace(/^.*=\s*%APPEND%\s*/, "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function scriptPattern(line) {
  const match = line.match(/pattern=([^,]+)/);
  return match ? match[1].replace(/\\\//g, "/") : "";
}

function compileRegex(pattern) {
  try {
    return { ok: true, re: new RegExp(pattern) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function parseRule(line) {
  const parts = line.split(",");
  return { type: parts[0], value: parts[1], policy: parts[2], raw: line };
}

function uniqueDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return Array.from(duplicates);
}

const headerLines = text.split(/\n/).filter((line) => line.startsWith("#!"));
const scripts = linesInSection("Script");
const rewrites = linesInSection("URL Rewrite");
const rawRules = linesInSection("Rule");
const rules = rawRules.map(parseRule);
const general = linesInSection("General");
const forceLine = general.find((line) => line.indexOf("force-http-engine-hosts =") === 0) || "";
const forceHosts = hostsFromAppendLine(forceLine);
let behaviorFixture = null;
try {
  behaviorFixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
} catch (error) {
  behaviorFixture = null;
}
let publicReference = null;
try {
  publicReference = JSON.parse(fs.readFileSync(referencePath, "utf8"));
} catch (error) {
  publicReference = null;
}
const fixtureCases = behaviorFixture && behaviorFixture.schema_version === 1 && Array.isArray(behaviorFixture.cases)
  ? behaviorFixture.cases
  : [];
const fixtureScripts = new Set(fixtureCases.map((item) => item.script));
const referenceSources = publicReference && publicReference.schema_version === 1 && Array.isArray(publicReference.sources)
  ? publicReference.sources
  : [];
const referencePatterns = publicReference && publicReference.schema_version === 1 && Array.isArray(publicReference.patterns)
  ? publicReference.patterns
  : [];
const referenceSourceIds = new Set(referenceSources.map((source) => source.id));
const mitmLine = linesInSection("MITM").find((line) => line.indexOf("hostname =") === 0) || "";
const mitmHosts = hostsFromAppendLine(mitmLine);
const countedMetadata = {
  "http-request-script": scripts.filter((line) => /type=http-request/.test(line)).length,
  "http-response-script": scripts.filter((line) => /type=http-response/.test(line)).length,
  "url-rewrite": rewrites.length,
  domain: rules.filter((rule) => rule.type === "DOMAIN").length,
  "domain-suffix": rules.filter((rule) => rule.type === "DOMAIN-SUFFIX").length,
  "url-regex": rules.filter((rule) => rule.type === "URL-REGEX").length,
  "force-http-engine-hosts": forceHosts.length,
  mitm: mitmHosts.length,
  total: scripts.length + rewrites.length + rawRules.length + forceHosts.length + mitmHosts.length
};

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

const noFillHosts = [
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
];

const scriptRegexes = scripts.map((line) => ({ line, compiled: compileRegex(scriptPattern(line)) }));
const rewriteRegexes = rewrites.map((line) => ({ line, compiled: compileRegex(line.split(/\s+/)[0].replace(/\\\//g, "/")) }));
const sdkRegexes = scripts
  .filter((line) => line.indexOf("Xiaocan Ad SDK") === 0)
  .map((line) => compileRegex(scriptPattern(line)).re)
  .filter(Boolean);
const rewriteRegexOnly = rewriteRegexes.map((item) => item.compiled.re).filter(Boolean);

const duplicateRules = uniqueDuplicates(rawRules);
const duplicateForceHosts = uniqueDuplicates(forceHosts);
const duplicateMitmHosts = uniqueDuplicates(mitmHosts);
const exactDomainPolicies = {};
rules.forEach((rule) => {
  if (rule.type !== "DOMAIN") return;
  exactDomainPolicies[rule.value] = exactDomainPolicies[rule.value] || [];
  exactDomainPolicies[rule.value].push(rule.policy);
});
const exactConflicts = Object.keys(exactDomainPolicies).filter((domain) => {
  const policies = exactDomainPolicies[domain];
  return policies.indexOf("DIRECT") >= 0 && policies.some((policy) => /^REJECT/.test(policy || ""));
});
const directDomains = rules.filter((rule) => rule.type === "DOMAIN" && rule.policy === "DIRECT").map((rule) => rule.value);
const rejectSuffixes = rules.filter((rule) => rule.type === "DOMAIN-SUFFIX" && /^REJECT/.test(rule.policy || "")).map((rule) => rule.value);
const suffixConflicts = [];
directDomains.forEach((domain) => {
  rejectSuffixes.forEach((suffix) => {
    if (domain === suffix || domain.endsWith("." + suffix)) suffixConflicts.push(domain + " < " + suffix);
  });
});

const genericLine = scripts.find((line) => line.indexOf("Generic Startup Ads") === 0) || "";
const genericCompiled = compileRegex(scriptPattern(genericLine));
const genericRe = genericCompiled.re;

function addCheck(checks, name, weight, passed, detail) {
  checks.push({ name, weight, passed: !!passed, detail: detail || "" });
}

function hasKnownScriptPrefix(prefix) {
  return scripts.some((line) => line.indexOf(prefix) === 0);
}

function referencePatternHasEvidence(pattern) {
  if (!pattern || !pattern.id || !Array.isArray(pattern.source_ids) || pattern.source_ids.length === 0 || !pattern.local_evidence) return false;
  if (!pattern.source_ids.every((sourceId) => referenceSourceIds.has(sourceId))) return false;

  if (pattern.id === "counted-release-metadata") {
    return ["version", "build", "http-request-script", "http-response-script", "url-rewrite", "domain", "domain-suffix", "url-regex", "force-http-engine-hosts", "mitm", "total"].every((key) => {
      return headerLines.some((line) => line.indexOf("#!" + key + "=") === 0);
    });
  }

  if (pattern.id === "scoped-http-engine-hosts") {
    return /^force-http-engine-hosts\s*=\s*%APPEND%/.test(forceLine) &&
      forceHosts.length === mitmHosts.length &&
      forceHosts.every((host, index) => host === mitmHosts[index]) &&
      !forceHosts.some((host) => host.indexOf("*") >= 0);
  }

  if (pattern.id === "script-body-metadata") {
    return scripts.every((line) => /(?:^|,)timeout=\d+(?:,|$)/.test(line) && /script-path=https:\/\/raw\.githubusercontent\.com\//.test(line)) &&
      scripts.filter((line) => /type=http-response/.test(line)).every((line) => /(?:^|,)requires-body=1(?:,|$)/.test(line) && /(?:^|,)max-size=\d+(?:,|$)/.test(line));
  }

  if (pattern.id === "narrow-app-specific-rules") {
    return hasKnownScriptPrefix("Bilibili Splash Ads") && hasKnownScriptPrefix("Bilibili Feed Ads") && hasKnownScriptPrefix("Coolapk Feed Ads") && hasKnownScriptPrefix("Generic Startup Ads");
  }

  if (pattern.id === "low-false-positive-bypass") {
    return rawRules.indexOf("DOMAIN-SUFFIX,10099.com.cn,DIRECT") >= 0 &&
      genericRe &&
      !genericRe.test("https://m.10099.com.cn/h5wap/promotion") &&
      !genericRe.test("https://example.com/promotion/list") &&
      !genericRe.test("https://example.com/commercial/list") &&
      !genericRe.test("https://example.com/campaign/list");
  }

  if (pattern.id === "behavior-regression-fixtures") {
    return fixtureCases.length >= 8 && ["startup-ad-clean.js", "coolapk-clean.js", "ad-sdk-no-fill.js"].every((file) => fixtureScripts.has(file));
  }

  if (pattern.id === "remote-release-drift-check") {
    return /sha256\(remoteModule\)\s*===\s*sha256\(moduleText\)/.test(releaseCheckText) &&
      /remote script content matches local file/.test(releaseCheckText);
  }

  return false;
}

const checks = [];

addCheck(checks, "module metadata", 8, ["#!name", "#!desc", "#!author", "#!homepage", "#!icon", "#!version", "#!build"].every((prefix) => headerLines.some((line) => line.startsWith(prefix))), "name/desc/author/homepage/icon/version/build");
addCheck(checks, "counted release metadata", 8, Object.keys(countedMetadata).every((key) => headerInt(key) === countedMetadata[key]), "script, rewrite, rule, MITM, and total counts");
addCheck(checks, "required sections", 7, ["General", "Script", "URL Rewrite", "Rule", "MITM"].every((name) => sectionText(name).length > 0), "[General], [Script], [URL Rewrite], [Rule], [MITM]");
addCheck(checks, "script metadata", 12, scripts.every((line) => /script-path=https:\/\/raw\.githubusercontent\.com\//.test(line) && /(?:^|,)timeout=\d+(?:,|$)/.test(line) && (!/type=http-response/.test(line) || (/(?:^|,)requires-body=1(?:,|$)/.test(line) && /(?:^|,)max-size=\d+(?:,|$)/.test(line)))), "raw script paths, timeouts, response body limits");
addCheck(checks, "script paths resolve locally", 8, scripts.every((line) => {
  const match = line.match(/script-path=https:\/\/raw\.githubusercontent\.com\/Y123456-hzy\/shadowrocket-rules\/main\/shadowrocket\/([^,]+)/);
  return !match || fs.existsSync(path.join(root, match[1]));
}), "published paths match local files");
addCheck(checks, "all regexes compile", 10, scriptRegexes.every((item) => item.compiled.ok) && rewriteRegexes.every((item) => item.compiled.ok), "script and URL Rewrite regexes");
addCheck(checks, "HTTP engine host hygiene", 8, /^force-http-engine-hosts\s*=\s*%APPEND%/.test(forceLine) && duplicateForceHosts.length === 0 && forceHosts.length === mitmHosts.length && forceHosts.every((host, index) => host === mitmHosts[index]) && !forceHosts.some((host) => host.indexOf("*") >= 0) && !forceHosts.some((host) => /(?:^|\.)10099\.com\.cn$/i.test(host)), "%APPEND%, exact hosts, aligned with MITM");
addCheck(checks, "MITM hygiene", 12, /^hostname\s*=\s*%APPEND%/.test(mitmLine) && duplicateMitmHosts.length === 0 && !mitmHosts.some((host) => host.indexOf("*") >= 0) && !mitmHosts.some((host) => /(?:^|\.)10099\.com\.cn$/i.test(host)), "%APPEND%, no wildcard, no duplicates, no 10099");
addCheck(checks, "rule conflict hygiene", 12, duplicateRules.length === 0 && exactConflicts.length === 0 && suffixConflicts.length === 0 && !rules.slice(rules.findIndex((rule) => /^REJECT/.test(rule.policy || "")) + 1).some((rule) => rule.policy === "DIRECT"), "no duplicate rules, no direct/reject conflicts, direct before reject");
addCheck(checks, "low false-positive generic rule", 12, genericRe && !genericRe.test("https://m.10099.com.cn/h5wap/promotion") && genericRe.test("https://example.com/splash/list") && !genericRe.test("https://example.com/promotion/list") && !genericRe.test("https://example.com/commercial/list") && !genericRe.test("https://example.com/campaign/list"), "catch startup terms, avoid broad business terms");
addCheck(checks, "no-fill script coverage", 14, sdkSamples.every((url) => sdkRegexes.some((re) => re.test(url))) && sdkSamples.every((url) => !rewriteRegexOnly.some((re) => re.test(url))) && noFillHosts.every((host) => mitmHosts.indexOf(host) >= 0), "covered by script, not preempted by rewrite, MITM hosts aligned");
addCheck(checks, "behavior fixture coverage", 10, fixtureCases.length >= 8 && ["startup-ad-clean.js", "coolapk-clean.js", "ad-sdk-no-fill.js"].every((file) => fixtureScripts.has(file)) && fixtureCases.every((item) => item.name && item.script && item.url && Array.isArray(item.assertions) && item.assertions.length > 0), "fixture schema, sample count, and all response scripts covered");
addCheck(checks, "public reference pattern coverage", 10, referenceSources.length >= 3 && referencePatterns.length >= 7 && uniqueDuplicates(referencePatterns.map((pattern) => pattern.id)).length === 0 && referenceSources.every((source) => source.id && /^https:\/\/github\.com\//.test(source.url || "")) && referencePatterns.every(referencePatternHasEvidence), "public source manifest and local evidence");
addCheck(checks, "10099 service hall bypass", 5, rawRules.indexOf("DOMAIN-SUFFIX,10099.com.cn,DIRECT") >= 0 && !mitmHosts.some((host) => /(?:^|\.)10099\.com\.cn$/i.test(host)), "direct and not MITM");

const total = checks.reduce((sum, check) => sum + check.weight, 0);
const earned = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
const score = Math.round((earned / total) * 100);
const failed = checks.filter((check) => !check.passed);

if (json) {
  console.log(JSON.stringify({ score, earned, total, checks }, null, 2));
} else {
  console.log("Shadowrocket quality audit");
  console.log("Score: " + score + "/100");
  checks.forEach((check) => {
    console.log((check.passed ? "ok" : "fail") + " - " + check.name + " (" + check.weight + "): " + check.detail);
  });
}

if (score < 90 || failed.length > 0) {
  process.exitCode = 1;
}
