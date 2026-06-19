/*
 * Shadowrocket response script for Coolapk feed ad cleanup.
 * It filters ad-like cards from JSON lists without touching image/CDN requests.
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

  return $done({ body: JSON.stringify(cleanCoolapkJson(json)) });
})();

function cleanCoolapkJson(value) {
  if (Array.isArray(value)) {
    return value
      .filter(function (item) {
        return !looksLikeCoolapkAd(item);
      })
      .map(cleanCoolapkJson);
  }

  if (!value || typeof value !== "object") return value;

  Object.keys(value).forEach(function (key) {
    var lower = key.toLowerCase();

    if (/^(?:ads|adlist|splashad|sponsor|sponsorcard|commercial|promotion)$/i.test(lower)) {
      value[key] = Array.isArray(value[key]) ? [] : {};
      return;
    }

    value[key] = cleanCoolapkJson(value[key]);
  });

  return value;
}

function looksLikeCoolapkAd(item) {
  if (!item || typeof item !== "object") return false;

  var template = String(item.entityTemplate || item.entityType || item.cardType || item.type || "");
  if (/sponsor|advert|adcard|feedad|goods/i.test(template)) return true;

  if (item.isAd === 1 || item.isAd === true || item.is_ad === 1 || item.is_ad === true || item.ad === 1 || item.ad === true) return true;

  var entityId = Number(item.entityId || item.id || 0);
  if ([945, 6390, 8639, 24455, 29349, 32557, 33006, 36839].indexOf(entityId) >= 0) return true;

  var text = "";
  try {
    text = JSON.stringify(item).slice(0, 4096);
  } catch (error) {
    return false;
  }

  return /sponsor|sponsorCard|advert|adInfo|广告|推广|精选配件|酷安热搜|流量/i.test(text);
}
