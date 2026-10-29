import { useEffect, useState } from "react";
import { calendarDay, paymentDeadline } from "../services/format";

export function useSchoolDay() {
  const [day, setDay] = useState(calendarDay);
  useEffect(() => {
    const update = () => setDay(calendarDay());
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return day;
}

export default function PaymentDeadline({ invoice, day }) {
  const deadline = paymentDeadline(invoice, day);
  return deadline ? (
    <span className={`payment-deadline ${deadline.tone}`}>
      {deadline.label}
    </span>
  ) : null;
}
