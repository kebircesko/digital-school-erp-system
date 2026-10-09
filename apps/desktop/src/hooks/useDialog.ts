import { useEffect } from "react";
export function useDialog(close: () => void, busy: boolean) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const selector =
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)";
    dialog?.querySelector<HTMLElement>(selector)?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(selector)];
      const first = items[0],
        last = items[items.length - 1];
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
      previous?.focus();
    };
  }, [busy]);
}
