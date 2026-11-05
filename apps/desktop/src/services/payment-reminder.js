export function whatsappPhone(value) {
  if (typeof value !== "string" || !/^\+?[0-9 ()-]+$/.test(value.trim()))
    return null;
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "383" + digits.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return null;
  return digits;
}
export function whatsappUrl(phone, message) {
  const normalized = whatsappPhone(phone);
  return normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    : null;
}
