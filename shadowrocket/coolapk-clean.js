/*
 * Shadowrocket response script for Coolapk feed ad cleanup.
 * Keep this light: only inspect common card fields and avoid full-card JSON scans.
 */

(function () {
  var body = typeof $response !== "undefined" && $response ? $response.body : "";
  if (!body) return $done({});

  var json;
  try {
    json = JSON.parse(body);
  } catch (error) {
    return $done({ body: body });
  }

  return $done({ body: JSON.stringify(cleanValue(json, 0)) });
})();

function cleanValue(value, depth) {
  if (depth > 8) return value;

  if (Array.isArray(value)) {
    var output = [];
    for (var i = 0; i < value.length; i += 1) {
      var item = value[i];
      if (!looksLikeCoolapkAd(item)) output.push(cleanValue(item, depth + 1));
    }
    return output;
  }

  if (!value || typeof value !== "object") return value;

  Object.keys(value).forEach(function (key) {
    var lower = key.toLowerCase();
    if (isAdContainerKey(lower)) {
      value[key] = Array.isArray(value[key]) ? [] : {};
      return;
    }
    value[key] = cleanValue(value[key], depth + 1);
  });

  return value;
}

function isAdContainerKey(key) {
  return /^(?:ads|adlist|splashad|sponsor|sponsorcard|commercial|promotion)$/i.test(key);
}

function looksLikeCoolapkAd(item) {
  if (!item || typeof item !== "object") return false;

  if (item.isAd === 1 || item.isAd === true || item.is_ad === 1 || item.is_ad === true || item.ad === 1 || item.ad === true) return true;

  var entityId = Number(item.entityId || item.id || 0);
  if ([945, 6390, 8639, 24455, 29349, 32557, 33006, 36839].indexOf(entityId) >= 0) return true;

  var template = lowerText(item.entityTemplate || item.entityType || item.cardType || item.type || item.card_type || "");
  if (/sponsor|advert|adcard|feedad|goods/.test(template)) return true;

  var title = lowerText(item.title || item.subTitle || item.description || "");
  return /广告|推广|精选配件|酷安热搜/.test(title);
}

function lowerText(value) {
  return String(value || "").toLowerCase();
}
