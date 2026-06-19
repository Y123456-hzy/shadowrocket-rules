/*
 * Return retry-friendly 200 no-fill bodies for ad SDK endpoints.
 * This follows the SDK-style "no ad fill" approach instead of a network reject.
 */

(function () {
  var request = typeof $request !== "undefined" ? $request : {};
  var response = typeof $response !== "undefined" ? $response : null;
  var url = (request && request.url) || "";
  var body = (response && response.body) || "";
  var output = null;

  if (isPangolinAdFetch(url) || isPangolinExchange(url)) {
    output = pangolinNoFill();
  } else if (isPangolinStats(url)) {
    output = successAck("pangolin");
  } else if (isGdtAdFetch(url)) {
    output = gdtNoFill(body);
  } else if (isGdtNotice(url) || isGdtEvent(url)) {
    output = successAck("gdt");
  } else if (isKuaishouAdFetch(url)) {
    output = kuaishouNoFill(body);
  } else if (isKuaishouLog(url)) {
    output = successAck("kuaishou");
  } else if (isSecondaryFastAck(url)) {
    output = successAck("generic");
  }

  if (!output) return response ? $done({ body: body }) : $done({});

  return doneJson(output, !!response);
})();

function isPangolinAdFetch(url) {
  return /^https?:\/\/(?:api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com|is\.snssdk\.com)\/api\/ad\/union\/sdk\/get_ads(?:\/|\?|$)/i.test(url);
}

function isPangolinExchange(url) {
  return /^https?:\/\/(?:api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com|gromore\.pangolin-sdk-toutiao\.com)\/api\/ad\/union\/mediation\/exchange(?:\/|\?|$)/i.test(url);
}

function isPangolinStats(url) {
  return /^https?:\/\/(?:api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com|is\.snssdk\.com)\/api\/ad\/union\/sdk\/stats\/batch(?:\/|\?|$)/i.test(url);
}

function isGdtAdFetch(url) {
  return /^https?:\/\/(?:mi|win)\.gdt\.qq\.com\/gdt_mview\.fcg(?:\?|$)/i.test(url);
}

function isGdtNotice(url) {
  return /^https?:\/\/win\.gdt\.qq\.com\/win_notice\.fcg(?:\?|$)/i.test(url);
}

function isGdtEvent(url) {
  return /^https?:\/\/oth\.(?:eve|str)\.mdt\.qq\.com\//i.test(url);
}

function isKuaishouAdFetch(url) {
  return /^https?:\/\/open\.e\.kuaishou\.com\/rest\/e\/v3\/open\/univ(?:\?|$)/i.test(url);
}

function isKuaishouLog(url) {
  return /^https?:\/\/open\.e\.kuaishou\.com\/rest\/e\/v3\/open\/logBatch(?:\?|$)/i.test(url);
}

function isSecondaryFastAck(url) {
  return /^https?:\/\/(?:api-htp\.beizi\.biz\/mb\/sdk0\/json(?:\?|$)|t2\.fancyapi\.com\/(?:b|e)(?:\?|$)|g\.fancyapi\.com\/s2s(?:\?|$)|sdk\.zhangyuyidong\.cn\/(?:sdk\/config|api\/zysdk)(?:\?|$)|sdktmp\.hubcloud\.com\.cn\/v1\/api\/sdk\/task\/list\/p(?:\?|$))/i.test(url);
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

function successAck(kind) {
  if (kind === "gdt") {
    return {
      ret: 0,
      msg: "ok",
      message: "ok",
      data: {}
    };
  }

  if (kind === "kuaishou") {
    return {
      result: 1,
      error_msg: "",
      message: "ok",
      data: {}
    };
  }

  return {
    status_code: 0,
    code: 0,
    message: "success",
    data: {}
  };
}

function doneJson(output, hasResponse) {
  var headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  var body = JSON.stringify(output);

  if (hasResponse) {
    return $done({
      status: "HTTP/1.1 200 OK",
      headers: headers,
      body: body
    });
  }

  return $done({
    response: {
      status: 200,
      headers: headers,
      body: body
    }
  });
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
