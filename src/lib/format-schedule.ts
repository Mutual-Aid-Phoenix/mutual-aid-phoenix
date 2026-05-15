import type { CollectionEntry } from "astro:content";
import { t, type Locale } from "../i18n";

type Schedule = CollectionEntry<"listings">["data"]["schedule"];

export type FormattedSchedule =
  | { kind: "text"; text: string }
  | { kind: "rows"; rows: { label: string; time: string }[] };

export function formatSchedule(
  schedule: Schedule,
  locale: Locale,
): FormattedSchedule {
  switch (schedule.kind) {
    case "always-open":
      return { kind: "text", text: t(locale, "schedule.always-open") };

    case "by-appointment":
      return {
        kind: "text",
        text: schedule.note?.[locale] ?? t(locale, "schedule.by-appointment"),
      };

    case "one-off": {
      const date = formatDate(schedule.date, locale);
      const time =
        schedule.start_time && schedule.end_time
          ? `${formatTime(schedule.start_time, locale)}–${formatTime(schedule.end_time, locale)}`
          : "";
      return { kind: "text", text: time ? `${date} · ${time}` : date };
    }

    case "recurring": {
      if (schedule.weekly && schedule.weekly.length > 0) {
        return {
          kind: "rows",
          rows: schedule.weekly.map((slot) => ({
            label: t(locale, `day_short.${slot.day}`),
            time: `${formatTime(slot.start_time, locale)}–${formatTime(slot.end_time, locale)}`,
          })),
        };
      }
      if (schedule.monthly && schedule.monthly.length > 0) {
        return {
          kind: "rows",
          rows: schedule.monthly.map((slot) => ({
            label: `${t(locale, `ordinal_week.${slot.week}`)} ${t(locale, `day_short.${slot.day}`)}`,
            time: `${formatTime(slot.start_time, locale)}–${formatTime(slot.end_time, locale)}`,
          })),
        };
      }
      if (schedule.daily && schedule.daily.length > 0) {
        return {
          kind: "rows",
          rows: schedule.daily.map((slot) => ({
            label: t(locale, "schedule.every_day"),
            time: `${formatTime(slot.start_time, locale)}–${formatTime(slot.end_time, locale)}`,
          })),
        };
      }
      // Schema guarantees one of weekly/monthly/daily is populated — this
      // branch should be unreachable. Surface an obvious marker if it isn't.
      return { kind: "text", text: "—" };
    }
  }
}

function formatTime(hhmm: string, locale: Locale): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(date: Date, locale: Locale): string {
  // YAML date-only values parse as UTC midnight. Format in UTC so we don't
  // shift a day backward in negative-offset timezones (Phoenix = UTC-7).
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
