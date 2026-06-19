/*
 * Return retry-friendly 200 no-fill bodies for ad SDK endpoints.
 * This follows the SDK-style "no ad fill" approach instead of a network reject.
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = ($response && $response.body) || "";
  var output = null;

  if (isPangolinAdFetch(url) || isPangolinExchange(url)) {
    output = pangolinNoFill();
  } else if (isGdtAdFetch(url)) {
    output = gdtNoFill(body);
  } else if (isKuaishouAdFetch(url)) {
    output = kuaishouNoFill(body);
  }

  if (!output) return $done({ body: body });

  return $done({
    status: "HTTP/1.1 200 OK",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(output)
  });
})();

function isPangolinAdFetch(url) {
  return /^https?:\/\/api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com\/api\/ad\/union\/sdk\/get_ads(?:\/|\?)/i.test(url);
}

function isPangolinExchange(url) {
  return /^https?:\/\/gromore\.pangolin-sdk-toutiao\.com\/api\/ad\/union\/mediation\/exchange(?:\/|\?)/i.test(url);
}

function isGdtAdFetch(url) {
  return /^https?:\/\/(?:mi|win)\.gdt\.qq\.com\/gdt_mview\.fcg(?:\?|$)/i.test(url);
}

function isKuaishouAdFetch(url) {
  return /^https?:\/\/open\.e\.kuaishou\.com\/rest\/e\/v3\/open\/univ(?:\?|$)/i.test(url);
}

function pangolinNoFill() {
  return {
    request_id: "",
    status_code: 20001,
    reason: 112,
    desc: "no ad fill",
    message: "no ad fill",
    data: null,
    adms: [],
    ads: []
  };
}

function gdtNoFill(body) {
  var root = parseObject(body);
  root.ret = 102006;
  root.msg = root.msg || "no ad fill";
  root.message = root.message || "no ad fill";
  root.data = {};
  root.ads = [];
  root.ad_list = [];
  return root;
}

function kuaishouNoFill(body) {
  var root = parseObject(body);
  root.result = 40003;
  root.error_msg = root.error_msg || "no ad fill";
  root.message = root.message || "no ad fill";
  root.data = {};
  root.ads = [];
  return root;
}

function parseObject(body) {
  if (!body) return {};

  try {
    var value = JSON.parse(body);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch (error) {
    return {};
  }

  return {};
}
