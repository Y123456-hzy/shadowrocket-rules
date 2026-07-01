/*
 * Shadowrocket response script for iOS/iPadOS startup/splash ad cleanup.
 * Bilibili splash APIs get a valid empty payload instead of a network reject,
 * which avoids app fallback caches and keeps newer message values such as "OK".
 */

(function () {
  var request = typeof $request !== "undefined" && $request ? $request : {};
  var response = typeof $response !== "undefined" && $response ? $response : null;
  var url = request.url || "";
  var body = (response && response.body) || "";

  if (!body) return $done({});

  var json;
  try {
    json = JSON.parse(body);
  } catch (error) {
    return $done({ body: body });
  }

  if (isBilibiliSplash(url)) {
    json = cleanBilibiliSplash(json);
  } else if (isBilibiliFeed(url)) {
    json = cleanBilibiliFeed(json);
  } else if (isStartupAdUrl(url)) {
    json = cleanGenericAdJson(json, 0);
  }

  return $done({ body: JSON.stringify(json) });
})();

function isBilibiliSplash(url) {
  return /^https?:\/\/app\.bilibili\.com\/x\/v2\/splash\/(?:list|show|event\/list2)(?:\?|$)/i.test(url);
}

function isBilibiliFeed(url) {
  return /^https?:\/\/app\.bilibili\.com\/x\/v2\/feed\/index(?:\?|$)/i.test(url);
}

function isStartupAdUrl(url) {
  return /(?:splash|launch|startup|start[-_]?up|open[-_]?screen|advert|advertise|promotion|commercial)/i.test(url);
}

function cleanBilibiliSplash(root) {
  if (!root || typeof root !== "object" || Array.isArray(root)) root = {};

  root.code = typeof root.code === "number" ? root.code : 0;
  root.message = root.message || "OK";
  root.ttl = 1;
  root.data = {
    list: [],
    show: [],
    ads: [],
    card: [],
    cards: [],
    banner: [],
    banners: [],
    material: [],
    splash: [],
    splash_ad: [],
    max_time: 0,
    min_interval: 31536000,
    pull_interval: 31536000,
    interval: 31536000,
    duration: 0,
    show_time: 0,
    countdown: 0,
    enable: 0,
    is_show: 0,
    show_ad: 0
  };

  return root;
}

function cleanBilibiliFeed(root) {
  if (root && root.data && Array.isArray(root.data.items)) {
    root.data.items = root.data.items
      .filter(function (item) {
        return !looksLikeAd(item);
      })
      .map(function (item) {
        return cleanGenericAdJson(item, 0);
      });
  }

  return root;
}

function cleanGenericAdJson(value, depth) {
  depth = depth || 0;
  if (depth > 12) return value;

  if (Array.isArray(value)) {
    return value
      .filter(function (item) {
        return !looksLikeAd(item);
      })
      .map(function (item) {
        return cleanGenericAdJson(item, depth + 1);
      });
  }

  if (!value || typeof value !== "object") return value;

  Object.keys(value).forEach(function (key) {
    var lower = key.toLowerCase();

    if (isAdContainerKey(lower)) {
      value[key] = neutralValue(value[key], lower);
      return;
    }

    if (isAdTimeKey(lower)) {
      value[key] = lower.indexOf("interval") >= 0 ? 31536000 : 0;
      return;
    }

    value[key] = cleanGenericAdJson(value[key], depth + 1);
  });

  return value;
}

function isAdContainerKey(key) {
  return /(?:^|_)(?:ad|ads|advert|advertise|advertisement|splash|launch|startup|open_screen|openscreen|promotion|commercial|campaign|material)(?:_|$)/i.test(key) ||
    /banner_ad|ad_info|adver|cm_mark/i.test(key);
}

function isAdTimeKey(key) {
  return /duration|countdown|show_time|display_time|stay_time|wait_time|interval/i.test(key);
}

function neutralValue(value, key) {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return {};
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return key.indexOf("interval") >= 0 ? 31536000 : 0;
  return "";
}

function looksLikeAd(item) {
  if (!item || typeof item !== "object") return false;

  if (item.is_ad === 1 || item.is_ad === true || item.ad === 1 || item.ad === true || item.cm_mark === 1) return true;
  if (item.card_type === "cm_v2" || item.card_type === "cm_double_v9") return true;
  if (/^(?:ad|ads|advert|splash|launch|promotion|commercial|banner)$/i.test(String(item.type || item.goto || item.card_goto || ""))) return true;
  if (/^ad_/i.test(String(item.card_goto || ""))) return true;

  var text = "";
  try {
    text = JSON.stringify(item).toLowerCase().slice(0, 4096);
  } catch (error) {
    return false;
  }

  return /ad_info|advert|splash_ad|cm\.bilibili\.com|ad_web|ad_player|ad_inline|creative_id/i.test(text);
}
