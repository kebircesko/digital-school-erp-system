import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { t, getLocale } from "../services/i18n.js";
import { calendarDay } from "../services/format";
import {
  parseDateInput,
  displayInputDate,
  calendarCells,
  changeMonth,
} from "../services/date-input.mjs";

export default function DateInput({
  value = "",
  onChange,
  min,
  max,
  disabled,
  readOnly,
  type,
  onBlur,
  ...props
}) {
  const [text, setText] = useState(() => displayInputDate(value));
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    (parseDateInput(value) ?? calendarDay()).slice(0, 7),
  );
  const [focused, setFocused] = useState(value || calendarDay());
  const root = useRef(null),
    input = useRef(null),
    focusCalendar = useRef(false);
  const lower = min || "1900-01-01",
    upper = max || "9999-12-31";
  function invalid(typed) {
    if (!typed.trim()) return "";
    const iso = parseDateInput(typed);
    if (!iso) return t("Vendosni datën në formatin DD/MM/YYYY.");
    if (iso < lower || iso > upper)
      return t("Data është jashtë intervalit të lejuar.");
    return "";
  }
  useEffect(() => {
    setText(displayInputDate(value));
  }, [value]);
  useEffect(() => {
    input.current?.setCustomValidity(invalid(text));
  }, [text, min, max]);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [open]);
  useEffect(() => {
    if (open && focusCalendar.current)
      root.current?.querySelector(`[data-day="${focused}"]`)?.focus();
  }, [open, focused, month]);
  function show() {
    if (disabled || readOnly) return;
    const day = parseDateInput(value) ?? calendarDay();
    const selected = day < lower ? lower : day > upper ? upper : day;
    setMonth(selected.slice(0, 7));
    setFocused(selected);
    focusCalendar.current = true;
    setOpen(true);
  }
  function choose(iso) {
    setText(displayInputDate(iso));
    input.current?.setCustomValidity("");
    onChange?.({ target: { value: iso, name: props.name } });
    setOpen(false);
    input.current?.focus();
  }
  function viewMonth(next) {
    const bounded =
      next < lower.slice(0, 7)
        ? lower.slice(0, 7)
        : next > upper.slice(0, 7)
          ? upper.slice(0, 7)
          : next;
    focusCalendar.current = false;
    setMonth(bounded);
    setFocused(bounded + "-01" < lower ? lower : bounded + "-01");
  }
  function dayKey(event, day) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next;
    if (event.key in moves) {
      const date = new Date(day + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + moves[event.key]);
      next = date.toISOString().slice(0, 10);
    } else if (event.key === "Home" || event.key === "End") {
      const date = new Date(day + "T12:00:00Z"),
        offset = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(
        date.getUTCDate() + (event.key === "Home" ? -offset : 6 - offset),
      );
      next = date.toISOString().slice(0, 10);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      next =
        changeMonth(day.slice(0, 7), event.key === "PageUp" ? -1 : 1) + "-01";
    } else return;
    event.preventDefault();
    next = next < lower ? lower : next > upper ? upper : next;
    focusCalendar.current = true;
    setMonth(next.slice(0, 7));
    setFocused(next);
  }
  const year = Number(month.slice(0, 4)),
    monthNumber = Number(month.slice(5, 7));
  const firstYear = Number(lower.slice(0, 4)),
    lastYear = max ? Number(max.slice(0, 4)) : Math.max(2100, year + 10);
  const monthName = (index) =>
    new Intl.DateTimeFormat(getLocale(), {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, index, 1)));
  return (
    <div
      className="date-input"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          input.current?.focus();
        }
      }}
    >
      <input
        {...props}
        ref={input}
        type="text"
        placeholder="DD/MM/YYYY"
        inputMode="numeric"
        maxLength={10}
        disabled={disabled}
        readOnly={readOnly}
        value={text}
        onChange={(event) => {
          const typed = event.target.value,
            iso = parseDateInput(typed);
          setText(iso ? displayInputDate(iso) : typed);
          input.current?.setCustomValidity(invalid(typed));
          if (!typed.trim() || iso)
            onChange?.({ target: { value: iso ?? "", name: props.name } });
        }}
        onBlur={(event) => {
          if (parseDateInput(text)) setText(displayInputDate(text));
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !readOnly) {
            event.preventDefault();
            show();
          }
        }}
      />
      {!readOnly && (
        <button
          className="date-toggle"
          type="button"
          disabled={disabled}
          aria-label={t("Hap kalendarin")}
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : show())}
        >
          <CalendarDays size={17} />
        </button>
      )}
      {open && (
        <div className="date-calendar" role="group" aria-label={t("Kalendari")}>
          <div className="date-calendar-heading">
            <button
              type="button"
              aria-label={t("Muaji i kaluar")}
              disabled={month <= lower.slice(0, 7)}
              onClick={() => viewMonth(changeMonth(month, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <select
              aria-label={t("Muaji")}
              value={monthNumber}
              onChange={(event) =>
                viewMonth(`${year}-${event.target.value.padStart(2, "0")}`)
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option
                  key={i}
                  value={i + 1}
                  disabled={
                    `${year}-${String(i + 1).padStart(2, "0")}` <
                      lower.slice(0, 7) ||
                    `${year}-${String(i + 1).padStart(2, "0")}` >
                      upper.slice(0, 7)
                  }
                >
                  {monthName(i)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("Viti")}
              value={year}
              onChange={(event) =>
                viewMonth(
                  `${event.target.value}-${String(monthNumber).padStart(2, "0")}`,
                )
              }
            >
              {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => (
                <option key={firstYear + i} value={firstYear + i}>
                  {firstYear + i}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={t("Muaji i ardhshëm")}
              disabled={month >= upper.slice(0, 7)}
              onClick={() => viewMonth(changeMonth(month, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="date-weekdays" aria-hidden="true">
            {["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"].map((day) => (
              <span key={day}>{t(day)}</span>
            ))}
          </div>
          <div className="date-days">
            {calendarCells(month).map((day) => (
              <button
                key={day}
                type="button"
                data-day={day}
                aria-label={displayInputDate(day)}
                aria-pressed={day === value}
                aria-current={day === calendarDay() ? "date" : undefined}
                tabIndex={day === focused ? 0 : -1}
                disabled={day < lower || day > upper}
                className={day.slice(0, 7) !== month ? "outside-month" : ""}
                onKeyDown={(event) => dayKey(event, day)}
                onClick={() => choose(day)}
              >
                {Number(day.slice(8, 10))}
              </button>
            ))}
          </div>
          <div className="date-calendar-actions">
            <button
              type="button"
              disabled={calendarDay() < lower || calendarDay() > upper}
              onClick={() => choose(calendarDay())}
            >
              {t("Sot")}
            </button>
            {!props.required && (
              <button type="button" onClick={() => choose("")}>
                {t("Pastro")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                input.current?.focus();
              }}
            >
              {t("Mbyll")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FormInput({ type, ...props }) {
  return type === "date" ? (
    <DateInput {...props} />
  ) : (
    <input type={type} {...props} />
  );
}
