const english = require("./en.json");
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const supportedLanguage = (value) => (value === "en" ? "en" : "sq");
const fill = (text, values) =>
  text.replace(/\{(\d+)\}/g, (match, index) =>
    values[index] === undefined ? match : String(values[index]),
  );
function translate(source, values = [], language = "sq") {
  if (typeof source !== "string") return source;
  if (supportedLanguage(language) !== "en") return fill(source, values);
  const key = normalize(source);
  const translated = Object.hasOwn(english, key) ? english[key] : undefined;
  if (translated === undefined) return fill(source, values);
  return (
    source.match(/^\s*/)[0] + fill(translated, values) + source.match(/\s*$/)[0]
  );
}
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function pattern(text) {
  const indices = [];
  let last = 0,
    expression = "^";
  for (const match of text.matchAll(/\{(\d+)\}/g)) {
    expression += escape(text.slice(last, match.index)) + "([\\s\\S]*?)";
    indices.push(Number(match[1]));
    last = match.index + match[0].length;
  }
  return {
    regex: new RegExp(expression + escape(text.slice(last)) + "$"),
    indices,
  };
}
// Match complete application messages only; never translate names, notes or other user data.
const reverse = new Map(Object.entries(english).map(([sq, en]) => [en, sq]));
const templates = Object.entries(english)
  .filter(([sq]) => /\{\d+\}/.test(sq))
  .sort(
    ([a], [b]) =>
      b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
  )
  .map(([sq, en]) => ({
    sq,
    en,
    source: pattern(sq),
    translated: pattern(en),
  }));
function translateMessage(source, language = "sq") {
  if (typeof source !== "string") return source;
  const key = normalize(source),
    en = supportedLanguage(language) === "en";
  const direct = en
    ? Object.hasOwn(english, key)
      ? english[key]
      : undefined
    : reverse.get(key);
  if (direct !== undefined)
    return source.match(/^\s*/)[0] + direct + source.match(/\s*$/)[0];
  for (const entry of templates) {
    const { regex, indices } = en ? entry.source : entry.translated;
    const match = regex.exec(key);
    if (!match) continue;
    const values = [];
    indices.forEach((index, i) => {
      values[index] = match[i + 1];
    });
    return (
      source.match(/^\s*/)[0] +
      fill(en ? entry.en : entry.sq, values) +
      source.match(/\s*$/)[0]
    );
  }
  return source;
}
module.exports = { translate, translateMessage, supportedLanguage };
