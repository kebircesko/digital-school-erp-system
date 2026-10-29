import { useEffect, useRef } from "react";

export function useDialog(close, busy = false, active = true) {
  const closeRef = useRef(close),
    busyRef = useRef(busy);
  closeRef.current = close;
  busyRef.current = busy;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement;
    const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    if (!dialog) return;
    const selector =
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";
    if (!dialog.contains(document.activeElement))
      dialog.querySelector(selector)?.focus();
    const handler = (event) => {
      if (
        event.defaultPrevented ||
        !dialog.isConnected ||
        [...document.querySelectorAll('[role="dialog"]')].at(-1) !== dialog
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll(selector)].filter(
        (element) => element.getClientRects().length,
      );
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);
}
