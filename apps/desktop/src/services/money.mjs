export function moneyCents(value) {
  if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,2})?$/.test(value))
    return null;
  const [whole, decimals = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"));
}
export function centsMoney(value) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
