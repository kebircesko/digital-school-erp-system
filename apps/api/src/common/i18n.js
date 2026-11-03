"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");
const {
  translate,
  translateMessage,
} = require("@erp/shared/src/translate.cjs");
const locale = new AsyncLocalStorage();
const getLanguage = () => locale.getStore() ?? "sq";
const t = (source, values) => translate(source, values, getLanguage());
function requestLanguage(header) {
  // Only supported languages are considered, in the client's preference order.
  const choices = String(header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        tag: tag.toLowerCase().split("-")[0],
        q: q ? Number(q.trim().slice(2)) : 1,
        index,
      };
    })
    .filter((c) => ["sq", "en"].includes(c.tag) && c.q > 0 && c.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return choices[0]?.tag ?? "sq";
}
function localizeMessages(value, language) {
  if (Array.isArray(value))
    return value.map((item) => localizeMessages(item, language));
  if (
    !value ||
    typeof value !== "object" ||
    value instanceof Date ||
    Buffer.isBuffer(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === "message"
        ? Array.isArray(item)
          ? item.map((s) => translateMessage(s, language))
          : translateMessage(item, language)
        : localizeMessages(item, language),
    ]),
  );
}
function languageMiddleware(req, res, next) {
  const language = requestLanguage(req.headers["accept-language"]);
  res.setHeader("Content-Language", language);
  res.vary("Accept-Language");
  const json = res.json;
  res.json = function (body) {
    return json.call(this, localizeMessages(body, language));
  };
  locale.run(language, next);
}
module.exports = {
  t,
  getLanguage,
  requestLanguage,
  languageMiddleware,
  localizeMessages,
  locale,
};
