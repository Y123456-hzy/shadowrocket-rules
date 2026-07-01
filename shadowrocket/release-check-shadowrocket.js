#!/usr/bin/env node
/*
 * Release gate for the Shadowrocket module.
 * Runs local syntax, behavior, quality audit, version consistency, and optional
 * raw GitHub availability checks before publishing subscription updates.
 */

const childProcess = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");

const root = __dirname;
const moduleFile = path.join(root, "ios-ipados-startup-adblock.sgmodule");
const readmeFile = path.join(root, "README.md");
const runRemote = process.argv.indexOf("--remote") >= 0;
const rawModuleUrl = "https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/ios-ipados-startup-adblock.sgmodule";
const rawScriptBase = "https://raw.githubusercontent.com/Y123456-hzy/shadowrocket-rules/main/shadowrocket/";

function run(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options && options.capture ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    throw new Error([command].concat(args).join(" ") + " failed");
  }
  return result.stdout || "";
}

function ok(message) {
  console.log("ok - " + message);
}

function fail(message) {
  throw new Error(message);
}

function assert(message, condition) {
  if (!condition) fail(message);
  ok(message);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function moduleName(text) {
  const match = text.match(/^#!name=(.+)$/m);
  return match ? match[1].trim() : "";
}

function readmeName(text) {
  const match = text.match(/Current module name:\n\n```text\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : "";
}

function scriptPaths(moduleText) {
  const matches = moduleText.match(/script-path=https:\/\/raw\.githubusercontent\.com\/Y123456-hzy\/shadowrocket-rules\/main\/shadowrocket\/[^,\n]+/g) || [];
  return Array.from(new Set(matches.map((match) => match.replace(/^script-path=.*\/shadowrocket\//, ""))));
}

function requestText(url) {
  const curl = childProcess.spawnSync("curl", ["-fsSL", "--max-time", "20", url], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (curl.status === 0) return Promise.resolve(curl.stdout);

  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(url + " returned HTTP " + response.statusCode));
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve(body));
    });
    request.on("timeout", () => {
      request.destroy(new Error(url + " timed out"));
    });
    request.on("error", reject);
  }).catch((error) => {
    const curlError = (curl.stderr || curl.stdout || "").trim();
    const nodeError = error && (error.message || error.code || error.name) ? (error.message || error.code || error.name) : String(error);
    throw new Error(url + " unavailable; curl: " + (curlError || "exit " + curl.status) + "; node: " + nodeError);
  });
}

async function main() {
  const moduleText = read(moduleFile);
  const readmeText = read(readmeFile);
  const scripts = scriptPaths(moduleText);

  ["startup-ad-clean.js", "coolapk-clean.js", "ad-sdk-no-fill.js", "test-shadowrocket-rules.js", "audit-shadowrocket-quality.js"].forEach((file) => {
    run("node", ["--check", file]);
  });
  ok("JavaScript syntax checks pass");

  run("node", ["test-shadowrocket-rules.js", "--quiet"]);
  ok("behavior and structural tests pass");

  const auditOutput = run("node", ["audit-shadowrocket-quality.js", "--json"], { capture: true });
  const audit = JSON.parse(auditOutput);
  assert("quality audit score is at least 90", audit.score >= 90);
  assert("quality audit has no failed checks", audit.checks.every((check) => check.passed));

  assert("README module name matches sgmodule", readmeName(readmeText) === moduleName(moduleText));
  scripts.forEach((file) => {
    assert("published script path has local file: " + file, fs.existsSync(path.join(root, file)));
  });

  if (runRemote) {
    const remoteModule = await requestText(rawModuleUrl);
    assert("remote module is reachable", remoteModule.length > 0);
    assert("remote module name matches local module", moduleName(remoteModule) === moduleName(moduleText));
    for (const file of scripts) {
      const remoteScript = await requestText(rawScriptBase + file);
      assert("remote script is reachable: " + file, remoteScript.length > 0);
    }
  }

  console.log("release check passed");
}

main().catch((error) => {
  console.error("release check failed: " + error.message);
  process.exit(1);
});
