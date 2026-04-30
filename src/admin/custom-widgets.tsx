// Custom Decap widgets for the Mutual Aid in Phoenix listings form.
//
// Bundled by vite.admin.config.ts → public/admin/custom-widgets.js. Loaded by
// public/admin/index.html AFTER react and decap-cms-app globals are on
// `window`, and BEFORE CMS.init().
//
// Schema parity: this file imports the SAME Zod schemas the Astro build uses
// (src/lib/schema.ts). Field-level isValid hooks check against those schemas,
// and the preSave hook runs the full listing schema before commit — no more
// widget-vs-build drift.
//
// Widgets:
//   1. "bilingual" — labeled pair of EN/ES inputs, no nested card.
//                    Replaces `widget: object` with `{en,es}` children.
//   2. "heading"   — section divider. Saves nothing to frontmatter.
//   3. "schedule"  — conditional sub-fields driven by a `kind` selector.
//                    Output shape matches the discriminated union in
//                    src/lib/schema.ts.
//   4. "location"  — one-stop address + geocode + map-preview widget.

import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  PHOENIX_METRO_BBOX,
  TIME_OF_DAY_REGEX,
  listingSchema,
} from "../lib/schema";

// React/CMS are externalized as window globals via vite.admin.config.ts.
declare global {
  interface Window {
    CMS: any;
    React: typeof React;
  }
}

const CMS = window.CMS;

// Decap values arrive as Immutable Map/List or plain — always normalize.
function toPlain<T = any>(v: any): T | undefined {
  if (v == null) return undefined;
  if (typeof v.toJS === "function") return v.toJS();
  return v;
}

// ---------------------------------------------------------------------------
// BilingualControl — EN/ES paired inputs, flat (no nested card).
// ---------------------------------------------------------------------------

type BilingualValue = { en?: string; es?: string };

interface WidgetProps<V> {
  value: V;
  onChange: (v: V) => void;
  field: { get: (key: string) => any };
  forID?: string;
}

const BilingualControl = forwardRef<unknown, WidgetProps<BilingualValue>>(
  function BilingualControl(props, ref) {
    const value: BilingualValue = toPlain(props.value) || {};
    const field = props.field;
    const variant = field.get("variant") || "string"; // "string" | "text"
    const required = field.get("required") !== false;
    const placeholderEn = field.get("placeholder_en") || "";
    const placeholderEs = field.get("placeholder_es") || "";

    useImperativeHandle(ref, () => ({
      isValid() {
        const en = (value.en || "").trim();
        const es = (value.es || "").trim();
        if (!required) {
          // Optional bilingual fields must be all-or-nothing — the schema
          // requires both keys when the field is present (i18nString.optional()
          // means "absent OR fully bilingual"). One language alone fails.
          if ((en && !es) || (!en && es)) {
            return {
              error: {
                message:
                  "Fill in both English and Spanish, or leave both blank.",
              },
            };
          }
          return true;
        }
        if (!en && !es) {
          return {
            error: {
              message: "English and Spanish translations are required.",
            },
          };
        }
        if (!en) {
          return { error: { message: "English translation is required." } };
        }
        if (!es) {
          return { error: { message: "Spanish translation is required." } };
        }
        return true;
      },
    }));

    function setLang(lang: "en" | "es", text: string) {
      const next: BilingualValue = { ...value };
      if (text) next[lang] = text;
      else delete next[lang];
      props.onChange(next);
    }

    function renderInput(lang: "en" | "es", placeholder: string) {
      const missing = required && !(value[lang] && value[lang]!.trim());
      const cls = "maph-input" + (missing ? " is-missing" : "");
      if (variant === "text") {
        return (
          <textarea
            className={cls + " maph-bilingual-textarea"}
            rows={3}
            placeholder={placeholder}
            value={value[lang] || ""}
            onChange={(e) => setLang(lang, e.target.value)}
          />
        );
      }
      return (
        <input
          className={cls}
          type="text"
          placeholder={placeholder}
          value={value[lang] || ""}
          onChange={(e) => setLang(lang, e.target.value)}
        />
      );
    }

    return (
      <div className="maph-bilingual">
        <div className="maph-bilingual-field">
          <span className="maph-lang-badge">EN</span>
          {renderInput("en", placeholderEn)}
        </div>
        <div className="maph-bilingual-field">
          <span className="maph-lang-badge maph-lang-badge-es">ES</span>
          {renderInput("es", placeholderEs)}
        </div>
      </div>
    );
  },
);

function BilingualPreview(props: { value: any }) {
  const v: BilingualValue = toPlain(props.value) || {};
  const en = v.en || "";
  const es = v.es || "";
  if (!en && !es)
    return <p className="maph-preview-empty">— not set —</p>;
  return (
    <div className="maph-preview-bilingual">
      {en ? (
        <div className="maph-preview-lang">
          <span className="maph-lang-badge">EN</span>
          <span>{en}</span>
        </div>
      ) : null}
      {es ? (
        <div className="maph-preview-lang">
          <span className="maph-lang-badge maph-lang-badge-es">ES</span>
          <span>{es}</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeadingControl — section divider. Never saves a value.
// The field's `label` becomes the visible heading (styled via CSS targeting
// `[data-maph-heading]`). The widget body renders the optional description.
// ---------------------------------------------------------------------------

function HeadingControl(props: WidgetProps<unknown>) {
  const onChange = props.onChange;
  const title = props.field.get("label") || "";
  const description = props.field.get("description") || "";

  // Reset any stray value that got saved by an earlier version.
  useEffect(() => {
    if (props.value != null) onChange(undefined as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Decap-rendered label is hidden at runtime by hideHeadingLabels()
  // below — it matches siblings by text content, so we pass the exact
  // title via data-maph-title.
  return (
    <div
      className="maph-heading"
      data-maph-heading
      data-maph-title={title}
    >
      <h3 className="maph-heading-title">{title}</h3>
      {description ? <p className="maph-heading-desc">{description}</p> : null}
    </div>
  );
}

function HeadingPreview() {
  return null; // Section headers don't appear in the preview pane.
}

// ---------------------------------------------------------------------------
// ScheduleControl
// ---------------------------------------------------------------------------

const SCHEDULE_KINDS = [
  { value: "always-open", label: "Always open" },
  { value: "by-appointment", label: "By appointment" },
  { value: "one-off", label: "One-time event" },
  { value: "recurring", label: "Recurring" },
] as const;

const DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
] as const;

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const WEEK_LABELS: Record<number, string> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
  4: "4th",
  5: "last",
};

type Slot = { day?: string; start_time?: string; end_time?: string };
type MonthlySlotV = Slot & { week?: number };

type ScheduleValue = {
  kind?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  start_date?: string;
  end_date?: string;
  weekly?: Slot[];
  monthly?: MonthlySlotV[];
  note?: BilingualValue;
};

const ScheduleControl = forwardRef<unknown, WidgetProps<ScheduleValue>>(
  function ScheduleControl(props, ref) {
    const value: ScheduleValue = toPlain(props.value) || {};
    const onChange = props.onChange;

    useImperativeHandle(ref, () => ({
      isValid() {
        if (!value.kind) {
          return { error: { message: "Pick a schedule type." } };
        }
        if (value.kind === "one-off" && !value.date) {
          return { error: { message: "One-time events need a date." } };
        }
        if (value.kind === "one-off") {
          // Optional times must match HH:MM if present (or be absent).
          if (value.start_time && !TIME_OF_DAY_REGEX.test(value.start_time)) {
            return {
              error: { message: "Start time must be HH:MM (24-hour)." },
            };
          }
          if (value.end_time && !TIME_OF_DAY_REGEX.test(value.end_time)) {
            return { error: { message: "End time must be HH:MM (24-hour)." } };
          }
        }
        if (value.kind === "recurring") {
          const weekly = value.weekly || [];
          const monthly = value.monthly || [];
          if (weekly.length === 0 && monthly.length === 0) {
            return {
              error: {
                message: "Add at least one weekly or monthly slot.",
              },
            };
          }
          const slots = weekly.length ? weekly : monthly;
          for (let i = 0; i < slots.length; i++) {
            if (!slots[i].start_time || !slots[i].end_time) {
              return {
                error: {
                  message: "Each slot needs a start and end time.",
                },
              };
            }
          }
          if (
            value.start_date &&
            value.end_date &&
            value.start_date > value.end_date
          ) {
            return {
              error: {
                message: "Start date must be on or before end date.",
              },
            };
          }
        }
        return true;
      },
    }));

    function setKind(kind: string) {
      // Wipe irrelevant fields when switching kinds so we never ship
      // stale data to YAML (e.g., a lingering `date` on an always-open
      // schedule). For one-off, do NOT seed empty-string time fields —
      // the schema's HH:MM regex rejects "" and the times are optional.
      if (!kind) return onChange({});
      if (kind === "always-open") return onChange({ kind });
      if (kind === "by-appointment") return onChange({ kind });
      if (kind === "one-off") return onChange({ kind, date: "" });
      if (kind === "recurring")
        return onChange({
          kind,
          weekly: [{ day: "mon", start_time: "", end_time: "" }],
        });
    }

    function patch(next: Partial<ScheduleValue>) {
      onChange({ ...value, ...next });
    }

    return (
      <div className="maph-schedule">
        <div className="maph-row">
          <label className="maph-label" htmlFor={(props.forID || "") + "-kind"}>
            Schedule type
          </label>
          <select
            id={(props.forID || "") + "-kind"}
            className="maph-select"
            value={value.kind || ""}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {SCHEDULE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {value.kind === "by-appointment" ? (
          <ByAppointmentFields value={value} patch={patch} />
        ) : null}
        {value.kind === "one-off" ? (
          <OneOffFields value={value} patch={patch} />
        ) : null}
        {value.kind === "recurring" ? (
          <RecurringFields value={value} patch={patch} onChange={onChange} />
        ) : null}
      </div>
    );
  },
);

function ByAppointmentFields(p: {
  value: ScheduleValue;
  patch: (n: Partial<ScheduleValue>) => void;
}) {
  const note: BilingualValue = p.value.note || {};
  function setNote(lang: "en" | "es", text: string) {
    const next: BilingualValue = { ...note };
    if (text) next[lang] = text;
    else delete next[lang];
    if (Object.keys(next).length === 0) {
      return p.patch({ note: undefined });
    }
    p.patch({ note: next });
  }
  return (
    <div className="maph-sub">
      <p className="maph-sub-label">
        Note for visitors (optional — fill both languages or neither)
      </p>
      <div className="maph-bilingual">
        <div className="maph-bilingual-field">
          <span className="maph-lang-badge">EN</span>
          <input
            className="maph-input"
            type="text"
            placeholder="e.g., Call ahead to schedule"
            value={note.en || ""}
            onChange={(e) => setNote("en", e.target.value)}
          />
        </div>
        <div className="maph-bilingual-field">
          <span className="maph-lang-badge maph-lang-badge-es">ES</span>
          <input
            className="maph-input"
            type="text"
            placeholder="ej., Llame para agendar"
            value={note.es || ""}
            onChange={(e) => setNote("es", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function OneOffFields(p: {
  value: ScheduleValue;
  patch: (n: Partial<ScheduleValue>) => void;
}) {
  return (
    <div className="maph-sub">
      <div className="maph-row">
        <label className="maph-label">Date</label>
        <input
          className="maph-input"
          type="date"
          value={p.value.date || ""}
          onChange={(e) => p.patch({ date: e.target.value })}
        />
      </div>
      <div className="maph-row-2">
        <TimeField
          label="Start (optional)"
          value={p.value.start_time}
          onChange={(t) => p.patch({ start_time: t })}
        />
        <TimeField
          label="End (optional)"
          value={p.value.end_time}
          onChange={(t) => p.patch({ end_time: t })}
        />
      </div>
    </div>
  );
}

function RecurringFields(p: {
  value: ScheduleValue;
  patch: (n: Partial<ScheduleValue>) => void;
  onChange: (v: ScheduleValue) => void;
}) {
  const hasWeekly = Array.isArray(p.value.weekly);
  const hasMonthly = Array.isArray(p.value.monthly);
  const cadence = hasWeekly ? "weekly" : hasMonthly ? "monthly" : "weekly";

  function switchCadence(next: "weekly" | "monthly") {
    // Carry start/end dates only if they're set — leaving undefined here
    // would let Decap serialize them as `null` in YAML, which the build
    // schema accepts but is noisy in the file.
    const base: ScheduleValue = { kind: "recurring" };
    if (p.value.start_date) base.start_date = p.value.start_date;
    if (p.value.end_date) base.end_date = p.value.end_date;
    if (next === "weekly") {
      base.weekly = p.value.weekly || [
        { day: "mon", start_time: "", end_time: "" },
      ];
    } else {
      base.monthly = p.value.monthly || [
        { week: 1, day: "mon", start_time: "", end_time: "" },
      ];
    }
    p.onChange(base);
  }

  return (
    <div className="maph-sub">
      <p className="maph-sub-label">How often?</p>
      <div className="maph-cadence">
        <label className="maph-radio">
          <input
            type="radio"
            name={"cadence-" + p.value.kind}
            checked={cadence === "weekly"}
            onChange={() => switchCadence("weekly")}
          />
          <span>
            <strong>Weekly</strong> — e.g., every Saturday, 10am–1pm
          </span>
        </label>
        <label className="maph-radio">
          <input
            type="radio"
            name={"cadence-" + p.value.kind}
            checked={cadence === "monthly"}
            onChange={() => switchCadence("monthly")}
          />
          <span>
            <strong>Monthly</strong> — e.g., first Saturday of each month
          </span>
        </label>
      </div>
      {cadence === "weekly" ? (
        <WeeklySlots
          slots={p.value.weekly || []}
          setSlots={(slots) => p.patch({ weekly: slots })}
        />
      ) : (
        <MonthlySlots
          slots={p.value.monthly || []}
          setSlots={(slots) => p.patch({ monthly: slots })}
        />
      )}
      <details className="maph-details">
        <summary>Only run during a date range? (optional)</summary>
        <div className="maph-row-2">
          <div className="maph-field">
            <label className="maph-label">Start date</label>
            <input
              className="maph-input"
              type="date"
              value={p.value.start_date || ""}
              onChange={(e) =>
                p.patch({ start_date: e.target.value || undefined })
              }
            />
          </div>
          <div className="maph-field">
            <label className="maph-label">End date</label>
            <input
              className="maph-input"
              type="date"
              value={p.value.end_date || ""}
              onChange={(e) =>
                p.patch({ end_date: e.target.value || undefined })
              }
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function WeeklySlots(p: { slots: Slot[]; setSlots: (s: Slot[]) => void }) {
  function updateSlot(i: number, patch: Partial<Slot>) {
    const next = p.slots.slice();
    next[i] = { ...next[i], ...patch };
    p.setSlots(next);
  }
  function addSlot() {
    p.setSlots(
      p.slots.concat([{ day: "mon", start_time: "", end_time: "" }]),
    );
  }
  function removeSlot(i: number) {
    const next = p.slots.slice();
    next.splice(i, 1);
    if (next.length === 0)
      next.push({ day: "mon", start_time: "", end_time: "" });
    p.setSlots(next);
  }
  return (
    <div className="maph-slots">
      {p.slots.map((slot, i) => (
        <div className="maph-slot" key={i}>
          <div className="maph-slot-day">
            <label className="maph-label">Day</label>
            <select
              className="maph-select"
              value={slot.day || "mon"}
              onChange={(e) => updateSlot(i, { day: e.target.value })}
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <TimeField
            label="Start"
            value={slot.start_time}
            onChange={(t) => updateSlot(i, { start_time: t })}
          />
          <TimeField
            label="End"
            value={slot.end_time}
            onChange={(t) => updateSlot(i, { end_time: t })}
          />
          <button
            type="button"
            className="maph-btn-icon"
            aria-label="Remove slot"
            onClick={() => removeSlot(i)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="maph-btn-secondary" onClick={addSlot}>
        + Add another slot
      </button>
    </div>
  );
}

function MonthlySlots(p: {
  slots: MonthlySlotV[];
  setSlots: (s: MonthlySlotV[]) => void;
}) {
  function updateSlot(i: number, patch: Partial<MonthlySlotV>) {
    const next = p.slots.slice();
    next[i] = { ...next[i], ...patch };
    p.setSlots(next);
  }
  function addSlot() {
    p.setSlots(
      p.slots.concat([
        { week: 1, day: "mon", start_time: "", end_time: "" },
      ]),
    );
  }
  function removeSlot(i: number) {
    const next = p.slots.slice();
    next.splice(i, 1);
    if (next.length === 0)
      next.push({ week: 1, day: "mon", start_time: "", end_time: "" });
    p.setSlots(next);
  }
  const WEEKS = [
    { value: 1, label: "1st" },
    { value: 2, label: "2nd" },
    { value: 3, label: "3rd" },
    { value: 4, label: "4th" },
    { value: 5, label: "Last" },
  ];
  return (
    <div className="maph-slots">
      {p.slots.map((slot, i) => (
        <div className="maph-slot maph-slot-monthly" key={i}>
          <div className="maph-slot-week">
            <label className="maph-label">Week</label>
            <select
              className="maph-select"
              value={String(slot.week || 1)}
              onChange={(e) =>
                updateSlot(i, { week: parseInt(e.target.value, 10) })
              }
            >
              {WEEKS.map((w) => (
                <option key={w.value} value={String(w.value)}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div className="maph-slot-day">
            <label className="maph-label">Day</label>
            <select
              className="maph-select"
              value={slot.day || "mon"}
              onChange={(e) => updateSlot(i, { day: e.target.value })}
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <TimeField
            label="Start"
            value={slot.start_time}
            onChange={(t) => updateSlot(i, { start_time: t })}
          />
          <TimeField
            label="End"
            value={slot.end_time}
            onChange={(t) => updateSlot(i, { end_time: t })}
          />
          <button
            type="button"
            className="maph-btn-icon"
            aria-label="Remove slot"
            onClick={() => removeSlot(i)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="maph-btn-secondary" onClick={addSlot}>
        + Add another slot
      </button>
    </div>
  );
}

// Native type="time" input. Browsers enforce HH:MM 24-hour on the value
// attribute (display is localized) so we get the same string back that the
// Zod regex expects.
function TimeField(p: {
  label: string;
  value?: string;
  onChange: (t: string | undefined) => void;
}) {
  return (
    <div className="maph-field">
      <label className="maph-label">{p.label}</label>
      <input
        className="maph-input maph-input-time"
        type="time"
        value={p.value || ""}
        onChange={(e) => p.onChange(e.target.value || undefined)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LocationControl
// ---------------------------------------------------------------------------

type LocationValue = {
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  lat?: number;
  lng?: number;
};

// Track the last Nominatim request time so we stay under 1 req/sec.
let lastNominatim = 0;
async function rateLimitedFetch(url: string) {
  const since = Date.now() - lastNominatim;
  if (since < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - since));
  }
  lastNominatim = Date.now();
  return fetch(url, { headers: { Accept: "application/json" } });
}

// Trim Nominatim's "display_name" down to "street, city, state". The raw
// field tacks on county, country, ZIP, postcode, etc. which is noise.
function compactDisplayName(c: any) {
  const a = c.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const locality = a.city || a.town || a.village || a.hamlet || a.county || "";
  const parts = [street, locality, a.state].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return (c.display_name || "")
    .split(",")
    .slice(0, 3)
    .map((s: string) => s.trim())
    .join(", ");
}

const LocationControl = forwardRef<unknown, WidgetProps<LocationValue>>(
  function LocationControl(props, ref) {
    const value: LocationValue = toPlain(props.value) || {};
    const onChange = props.onChange;

    useImperativeHandle(ref, () => ({
      isValid() {
        if (!value.address_1 || !value.address_1.trim()) {
          return { error: { message: "Street address is required." } };
        }
        if (!value.city || !value.city.trim()) {
          return { error: { message: "City is required." } };
        }
        if (!value.zip_code || !/^\d{5}(-\d{4})?$/.test(value.zip_code)) {
          return { error: { message: "ZIP must be 5 digits or ZIP+4." } };
        }
        if (typeof value.lat !== "number" || typeof value.lng !== "number") {
          return {
            error: {
              message:
                'Click "Find on map" to look up coordinates before saving.',
            },
          };
        }
        if (
          value.lat < PHOENIX_METRO_BBOX.lat_min ||
          value.lat > PHOENIX_METRO_BBOX.lat_max ||
          value.lng < PHOENIX_METRO_BBOX.lng_min ||
          value.lng > PHOENIX_METRO_BBOX.lng_max
        ) {
          return {
            error: {
              message: "Coordinates are outside the Greater Phoenix metro.",
            },
          };
        }
        return true;
      },
    }));

    const [state, setState] = useState({
      candidates: [] as any[],
      searching: false,
      error: null as string | null,
      mapOpen: false,
    });

    function patch(next: Partial<LocationValue>) {
      onChange({ ...value, ...next });
    }

    function composedQuery() {
      return [
        value.address_1,
        value.address_2,
        value.city,
        value.state,
        value.zip_code,
      ]
        .filter(Boolean)
        .join(", ");
    }

    async function geocode() {
      const q = composedQuery();
      if (!q.trim() || !value.address_1 || !value.city) {
        setState((s) => ({
          ...s,
          error: "Fill in at least the street and city before searching.",
        }));
        return;
      }
      setState((s) => ({ ...s, searching: true, error: null, candidates: [] }));
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&addressdetails=1&q=" +
          encodeURIComponent(q);
        const res = await rateLimitedFetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setState((s) => ({
            ...s,
            searching: false,
            candidates: [],
            error: "No results. Try a simpler address (e.g., street + city).",
          }));
          return;
        }
        setState((s) => ({
          ...s,
          searching: false,
          candidates: data,
          error: null,
          mapOpen: true,
        }));
        if (data.length === 1) {
          chooseCandidate(data[0]);
        }
      } catch (e: any) {
        setState((s) => ({
          ...s,
          searching: false,
          error: "Search failed: " + e.message,
        }));
      }
    }

    function chooseCandidate(c: any) {
      patch({ lat: parseFloat(c.lat), lng: parseFloat(c.lon) });
      setState((s) => ({ ...s, candidates: [], mapOpen: true }));
    }

    const hasCoords =
      typeof value.lat === "number" && typeof value.lng === "number";
    const insideBbox =
      hasCoords &&
      value.lat! >= PHOENIX_METRO_BBOX.lat_min &&
      value.lat! <= PHOENIX_METRO_BBOX.lat_max &&
      value.lng! >= PHOENIX_METRO_BBOX.lng_min &&
      value.lng! <= PHOENIX_METRO_BBOX.lng_max;

    return (
      <div className="maph-location">
        <div className="maph-row">
          <label className="maph-label" htmlFor={(props.forID || "") + "-a1"}>
            Street address
          </label>
          <input
            id={(props.forID || "") + "-a1"}
            className="maph-input"
            type="text"
            autoComplete="address-line1"
            value={value.address_1 || ""}
            onInput={(e) =>
              patch({ address_1: (e.target as HTMLInputElement).value })
            }
          />
        </div>
        <div className="maph-row">
          <label className="maph-label">Suite / apt / unit (optional)</label>
          <input
            className="maph-input"
            type="text"
            autoComplete="address-line2"
            value={value.address_2 || ""}
            onInput={(e) =>
              patch({
                address_2:
                  (e.target as HTMLInputElement).value || undefined,
              })
            }
          />
        </div>
        <div className="maph-row-3">
          <div className="maph-field maph-field-wide">
            <label className="maph-label">City</label>
            <input
              className="maph-input"
              type="text"
              autoComplete="address-level2"
              value={value.city || ""}
              onInput={(e) =>
                patch({ city: (e.target as HTMLInputElement).value })
              }
            />
          </div>
          <div className="maph-field maph-field-narrow">
            <label className="maph-label">State</label>
            <input
              className="maph-input"
              type="text"
              maxLength={2}
              value={value.state || "AZ"}
              onInput={(e) =>
                // Empty → undefined so the schema's `.default("AZ")` kicks in
                // instead of failing the length-2 check on an empty string.
                patch({
                  state:
                    (e.target as HTMLInputElement).value.toUpperCase() ||
                    undefined,
                })
              }
            />
          </div>
          <div className="maph-field">
            <label className="maph-label">ZIP</label>
            <input
              className="maph-input"
              type="text"
              inputMode="numeric"
              value={value.zip_code || ""}
              onInput={(e) =>
                patch({ zip_code: (e.target as HTMLInputElement).value })
              }
            />
          </div>
        </div>

        <div className="maph-geocode-row">
          <button
            type="button"
            className="maph-btn-primary"
            disabled={state.searching}
            onClick={geocode}
          >
            {state.searching ? "Searching…" : "🔎 Find on map"}
          </button>
          {hasCoords ? (
            <span className="maph-coords">
              <code>
                {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
              </code>
              {insideBbox ? (
                <span className="maph-badge maph-badge-ok">
                  ✓ inside metro
                </span>
              ) : (
                <span className="maph-badge maph-badge-err">
                  ✗ outside Phoenix metro bbox
                </span>
              )}
            </span>
          ) : null}
        </div>

        {state.error ? <p className="maph-error">{state.error}</p> : null}
        {state.candidates.length > 0 ? (
          <div className="maph-candidates-wrap">
            <p className="maph-candidates-label">Choose the best match:</p>
            <ul className="maph-candidates">
              {state.candidates.map((c) => (
                <li key={c.place_id}>
                  <button
                    type="button"
                    className="maph-candidate"
                    onClick={() => chooseCandidate(c)}
                  >
                    <span className="maph-candidate-name">
                      {compactDisplayName(c)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasCoords && state.mapOpen ? (
          <MapPreview lat={value.lat!} lng={value.lng!} />
        ) : null}
        {hasCoords ? (
          <details className="maph-details maph-details-coords">
            <summary>Adjust coordinates manually</summary>
            <div className="maph-row-2">
              <div className="maph-field">
                <label className="maph-label">Latitude</label>
                <input
                  className="maph-input"
                  type="number"
                  step="0.000001"
                  value={value.lat}
                  onChange={(e) =>
                    patch({ lat: parseFloat(e.target.value) })
                  }
                />
              </div>
              <div className="maph-field">
                <label className="maph-label">Longitude</label>
                <input
                  className="maph-input"
                  type="number"
                  step="0.000001"
                  value={value.lng}
                  onChange={(e) =>
                    patch({ lng: parseFloat(e.target.value) })
                  }
                />
              </div>
            </div>
          </details>
        ) : null}
      </div>
    );
  },
);

function MapPreview(p: { lat: number; lng: number }) {
  // OpenStreetMap embed — dependency-free map preview. A small bounding box
  // around the pin gives a zoom level roughly equivalent to ~z16.
  const delta = 0.005;
  const bbox =
    p.lng - delta + "," + (p.lat - delta) + "," + (p.lng + delta) + "," + (p.lat + delta);
  const src =
    "https://www.openstreetmap.org/export/embed.html?bbox=" +
    encodeURIComponent(bbox) +
    "&layer=mapnik&marker=" +
    p.lat +
    "," +
    p.lng;
  const gmaps =
    "https://www.google.com/maps?q=" + p.lat + "," + p.lng + "&z=17";
  return (
    <div className="maph-map-wrap">
      <iframe
        className="maph-map"
        src={src}
        title="Location preview"
        loading="lazy"
      />
      <a className="maph-map-link" href={gmaps} target="_blank" rel="noopener">
        Open in Google Maps ↗
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview components — formatted output for the entry preview pane.
// ---------------------------------------------------------------------------

function formatTimeRange(start?: string, end?: string) {
  if (!start && !end) return "";
  if (start && end) return start + "–" + end;
  return start || end || "";
}

function SchedulePreview(props: { value: any }) {
  const v: ScheduleValue = toPlain(props.value) || {};
  if (!v.kind)
    return <p className="maph-preview-empty">— not set —</p>;

  if (v.kind === "always-open") {
    return <p className="maph-preview-schedule">Always open</p>;
  }

  if (v.kind === "by-appointment") {
    const note: BilingualValue = v.note || {};
    return (
      <div className="maph-preview-schedule">
        <p>
          <strong>By appointment</strong>
        </p>
        {note.en ? (
          <p className="maph-preview-sub">
            <span className="maph-lang-badge">EN</span> {note.en}
          </p>
        ) : null}
        {note.es ? (
          <p className="maph-preview-sub">
            <span className="maph-lang-badge maph-lang-badge-es">ES</span>{" "}
            {note.es}
          </p>
        ) : null}
      </div>
    );
  }

  if (v.kind === "one-off") {
    const time = formatTimeRange(v.start_time, v.end_time);
    const whenParts = [v.date, time].filter(Boolean);
    return (
      <p className="maph-preview-schedule">
        <strong>One-time event</strong>
        {whenParts.length ? " — " + whenParts.join(", ") : ""}
      </p>
    );
  }

  if (v.kind === "recurring") {
    const entries: string[] = [];
    const weekly = v.weekly || [];
    const monthly = v.monthly || [];
    weekly.forEach((s) => {
      const day = DAY_LABELS[s.day || ""] || s.day;
      const time = formatTimeRange(s.start_time, s.end_time);
      entries.push("Every " + day + (time ? ", " + time : ""));
    });
    monthly.forEach((s) => {
      const day = DAY_LABELS[s.day || ""] || s.day;
      const wk = WEEK_LABELS[s.week || 0] || s.week + "th";
      const time = formatTimeRange(s.start_time, s.end_time);
      entries.push(wk + " " + day + " of the month" + (time ? ", " + time : ""));
    });
    const dateRange =
      v.start_date || v.end_date
        ? (v.start_date || "?") + " → " + (v.end_date || "?")
        : "";
    return (
      <div className="maph-preview-schedule">
        <p>
          <strong>Recurring</strong>
        </p>
        {entries.length ? (
          <ul className="maph-preview-list">
            {entries.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="maph-preview-sub">— no slots yet —</p>
        )}
        {dateRange ? (
          <p className="maph-preview-sub">Date range: {dateRange}</p>
        ) : null}
      </div>
    );
  }

  return <p className="maph-preview-empty">— not set —</p>;
}

function LocationPreview(props: { value: any }) {
  const v: LocationValue = toPlain(props.value) || {};
  const hasAddress = v.address_1 || v.city;
  const hasCoords = typeof v.lat === "number" && typeof v.lng === "number";
  if (!hasAddress && !hasCoords)
    return <p className="maph-preview-empty">— not set —</p>;

  const line1 = [v.address_1, v.address_2].filter(Boolean).join(", ");
  const line2 = [v.city, [v.state, v.zip_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="maph-preview-location">
      {line1 ? <p>{line1}</p> : null}
      {line2 ? <p>{line2}</p> : null}
      {hasCoords ? (
        <p className="maph-preview-coords">
          <code>
            {v.lat!.toFixed(5)}, {v.lng!.toFixed(5)}
          </code>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

CMS.registerWidget("bilingual", BilingualControl, BilingualPreview);
CMS.registerWidget("heading", HeadingControl, HeadingPreview);
CMS.registerWidget("schedule", ScheduleControl, SchedulePreview);
CMS.registerWidget("location", LocationControl, LocationPreview);

// ---------------------------------------------------------------------------
// preSave — populate the hidden `slug` field, then run the full Zod schema
// against the entry so the volunteer gets schema errors in the CMS instead
// of silent build failures on `main`.
// ---------------------------------------------------------------------------

function slugify(str: unknown) {
  if (str == null) return "";
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function getExistingListingSlugs(): string[] {
  try {
    const store = window.CMS && window.CMS.store;
    if (!store) return [];
    const state = store.getState();
    const entries = state.entries;
    if (!entries || typeof entries.get !== "function") return [];
    const entities = entries.get("entities");
    if (!entities || typeof entities.forEach !== "function") return [];
    const slugs: string[] = [];
    const prefix = "listings.";
    entities.forEach((_entry: unknown, key: string) => {
      if (typeof key === "string" && key.indexOf(prefix) === 0) {
        slugs.push(key.slice(prefix.length));
      }
    });
    return slugs;
  } catch (e) {
    console.warn("[maph] Could not read existing slugs:", e);
    return [];
  }
}

function findUniqueSlug(base: string, taken: string[], currentId: string) {
  const takenSet: Record<string, true> = Object.create(null);
  for (const t of taken) {
    if (t !== currentId) takenSet[t] = true;
  }
  if (!takenSet[base]) return base;
  let n = 2;
  while (takenSet[base + "-" + n]) n++;
  return base + "-" + n;
}

// Handler payload shape varies between Decap versions — sometimes Immutable,
// sometimes plain. Tiny helpers absorb the difference.
function pluck(obj: any, key: string) {
  if (obj == null) return undefined;
  if (typeof obj.get === "function") return obj.get(key);
  return obj[key];
}
function pluckIn(obj: any, path: string[]) {
  let cur = obj;
  for (const k of path) {
    cur = pluck(cur, k);
    if (cur == null) return undefined;
  }
  return cur;
}

// Coerce CMS-shaped data to the plain JS shape the Zod schema expects. We
// run this on a deep clone — the CMS holds Immutable values internally and
// dates as YYYY-MM-DD strings, so we hydrate strings → Date and convert
// every Immutable Map/List to plain objects/arrays.
function deepPlain(v: any): any {
  if (v == null) return v;
  if (typeof v.toJS === "function") v = v.toJS();
  if (Array.isArray(v)) return v.map(deepPlain);
  if (typeof v === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) out[k] = deepPlain(v[k]);
    return out;
  }
  return v;
}

const DATE_KEYS = new Set([
  "last_verified_date",
  "date",
  "start_date",
  "end_date",
]);

function hydrateDates(v: any, key?: string): any {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map((x) => hydrateDates(x));
  if (typeof v === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) out[k] = hydrateDates(v[k], k);
    return out;
  }
  if (typeof v === "string" && key && DATE_KEYS.has(key)) {
    // Decap datetime widget yields YYYY-MM-DD; YAML-frontmatter would parse
    // it to a Date. Mirror that here so the schema sees a Date.
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v);
  }
  return v;
}

function formatZodErrors(error: { issues: Array<{ path: (string | number)[]; message: string }> }): string {
  return error.issues
    .map((iss) => {
      const path = iss.path.length ? iss.path.join(".") : "(root)";
      return `• ${path}: ${iss.message}`;
    })
    .join("\n");
}

CMS.registerEventListener({
  name: "preSave",
  handler: function (payload: any) {
    const entry = payload && payload.entry ? payload.entry : payload;
    if (!entry) return;

    const collection = pluck(entry, "collection");
    if (collection !== "listings") return;

    const data = pluck(entry, "data");
    if (!data) return;

    // 1. Slug auto-population (preserves URL stability on edit).
    const existing = pluck(data, "slug");
    const needsSlug = !(existing && String(existing).trim());
    let modified: any = data;

    if (needsSlug) {
      const nameEn = pluckIn(data, ["name", "en"]);
      if (!nameEn) {
        // BilingualControl validation should block this path — but if the
        // form was bypassed somehow, fail loudly rather than emitting a
        // file with no slug.
        throw new Error(
          "Cannot save: listing has no English name. Slug cannot be derived.",
        );
      }
      const base = slugify(nameEn);
      if (!base) {
        throw new Error(
          "Cannot save: name.en slugifies to an empty string.",
        );
      }
      const currentId = pluck(entry, "slug") || "";
      const unique = findUniqueSlug(
        base,
        getExistingListingSlugs(),
        currentId,
      );
      console.log("[maph preSave] slug:", unique, "(base:", base + ")");
      modified =
        typeof data.set === "function"
          ? data.set("slug", unique)
          : { ...data, slug: unique };
    }

    // 2. Full schema validation. This catches every drift bug from the
    //    audit (and any future ones) before the commit lands on `main`.
    const plain = deepPlain(modified);
    const hydrated = hydrateDates(plain);
    const result = listingSchema.safeParse(hydrated);
    if (!result.success) {
      const summary = formatZodErrors(result.error as any);
      console.error("[maph preSave] schema validation failed:\n" + summary);
      throw new Error(
        "Listing failed validation. The build would have failed on this entry. Fix:\n" +
          summary,
      );
    }

    return modified;
  },
});

// ---------------------------------------------------------------------------
// Required-field marker — Decap appends "(Optional)" to optional field
// labels but adds nothing to required ones. Mark required ones with a
// subtle red asterisk so editors don't have to infer from the absence of
// a suffix.
// ---------------------------------------------------------------------------

function isInsideCustomWidget(el: Element) {
  return !!el.closest(
    ".maph-bilingual, .maph-schedule, .maph-location, .maph-heading, " +
      ".maph-sub, .maph-slots, .maph-field, .maph-row, .maph-row-2, " +
      ".maph-row-3, .maph-radio",
  );
}

function markLabels() {
  const labels = document.querySelectorAll("label");
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i] as HTMLLabelElement;
    if (label.dataset.maphMark) continue;
    if (isInsideCustomWidget(label)) continue;
    const txt = (label.textContent || "").trim();
    if (!txt) continue;
    if (/\(Optional\)/i.test(txt)) {
      label.dataset.maphMark = "optional";
      continue;
    }
    const hasFor = label.hasAttribute("for");
    const nextEl = label.nextElementSibling;
    const nearControl =
      nextEl &&
      (nextEl.tagName === "INPUT" ||
        nextEl.tagName === "SELECT" ||
        nextEl.tagName === "TEXTAREA" ||
        nextEl.querySelector(
          "input, select, textarea, [contenteditable], [data-maph-heading]",
        ));
    if (!hasFor && !nearControl) continue;
    label.dataset.maphMark = "required";
    if (!label.querySelector(".maph-req-mark")) {
      const mark = document.createElement("span");
      mark.className = "maph-req-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = " *";
      label.appendChild(mark);
    }
  }
}

function hideHeadingLabels() {
  const markers = document.querySelectorAll(
    "[data-maph-heading]:not([data-maph-hidden])",
  );
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i] as HTMLElement;
    const title = m.getAttribute("data-maph-title") || "";
    if (!title) continue;
    let node: Element | null = m.parentElement;
    let hid = false;
    while (node && node !== document.body && !hid) {
      for (let k = 0; k < node.children.length; k++) {
        const kid = node.children[k] as HTMLElement;
        if (kid.contains(m)) continue;
        const text = (kid.textContent || "").trim();
        if (!text) continue;
        if (
          text.toLowerCase().indexOf(title.toLowerCase()) === 0 &&
          text.length < title.length + 40
        ) {
          kid.style.display = "none";
          hid = true;
        }
      }
      node = node.parentElement;
    }
    if (hid) m.setAttribute("data-maph-hidden", "1");
  }
}

let pendingMark = false;
function scheduleMark() {
  if (pendingMark) return;
  pendingMark = true;
  requestAnimationFrame(() => {
    pendingMark = false;
    markLabels();
    hideHeadingLabels();
  });
}

const obs = new MutationObserver(scheduleMark);
obs.observe(document.body, { childList: true, subtree: true });
scheduleMark();
