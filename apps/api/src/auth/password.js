"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = require("node:crypto");
function hashPassword(password) {
  const salt = (0, node_crypto_1.randomBytes)(16).toString("hex");
  return `${salt}:${(0, node_crypto_1.scryptSync)(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const actual = (0, node_crypto_1.scryptSync)(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return (
    actual.length === expected.length &&
    (0, node_crypto_1.timingSafeEqual)(actual, expected)
  );
}
const hashToken = (token) =>
  (0, node_crypto_1.createHash)("sha256").update(token).digest("hex");
exports.hashToken = hashToken;
