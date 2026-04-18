// Custom Decap widgets for the Mutual Aid in Phoenix listings form.
//
// Widgets:
//   1. "bilingual" — a labeled pair of EN/ES inputs, no nested card.
//                    Replaces `widget: object` with `{en,es}` children.
//   2. "heading"   — section divider. Saves nothing to frontmatter.
//                    The field's `label` becomes the visible section header
//                    (styled via CSS targeting `data-maph-heading`).
//   3. "schedule"  — conditional sub-fields driven by a `kind` selector.
//                    Output shape matches the discriminated union in
//                    src/content.config.ts.
//   4. "location"  — one-stop address + geocode + map-preview widget.
//
// Loaded from public/admin/index.html AFTER react, react-dom,
// decap-cms-app, and htm globals are available, and BEFORE CMS.init().
//
// Keep in sync with src/content.config.ts.
//
// -----------------------------------------------------------------------

(function () {
  var React = window.React;
  var h = React.createElement;
  var html = window.htm.bind(h);
  var CMS = window.CMS;

  var BBOX = { latMin: 33.0, latMax: 34.0, lngMin: -113.0, lngMax: -111.3 };

  // Decap values can arrive as Immutable Map, Immutable List, or plain —
  // always normalize before reading.
  function toPlain(v) {
    if (v == null) return undefined;
    if (typeof v.toJS === "function") return v.toJS();
    return v;
  }

  // ---------------------------------------------------------------------
  // BilingualControl — EN/ES paired inputs, flat (no nested card).
  // ---------------------------------------------------------------------

  // forwardRef so Decap can attach a ref and invoke our `isValid` on
  // save. Without this, the widget's value object is truthy even when
  // `es` is blank and Decap's default "required = truthy" check passes,
  // letting invalid entries reach the Zod build step.
  var BilingualControl = React.forwardRef(function BilingualControl(
    props,
    ref,
  ) {
    var value = toPlain(props.value) || {};
    var onChange = props.onChange;
    var field = props.field;
    var variant = field.get("variant") || "string"; // "string" | "text"
    var required = field.get("required") !== false;
    var placeholderEn = field.get("placeholder_en") || "";
    var placeholderEs = field.get("placeholder_es") || "";

    React.useImperativeHandle(ref, function () {
      return {
        isValid: function () {
          if (!required) return true;
          var en = value.en && value.en.trim();
          var es = value.es && value.es.trim();
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
      };
    });

    function setLang(lang, text) {
      var next = Object.assign({}, value);
      if (text) next[lang] = text;
      else delete next[lang];
      onChange(next);
    }

    function renderInput(lang, placeholder) {
      var missing = required && !(value[lang] && value[lang].trim());
      var cls = "maph-input" + (missing ? " is-missing" : "");
      if (variant === "text") {
        return html`
          <textarea
            class=${cls + " maph-bilingual-textarea"}
            rows="3"
            placeholder=${placeholder}
            value=${value[lang] || ""}
            onChange=${function (e) {
              setLang(lang, e.target.value);
            }}
          ></textarea>
        `;
      }
      return html`
        <input
          class=${cls}
          type="text"
          placeholder=${placeholder}
          value=${value[lang] || ""}
          onChange=${function (e) {
            setLang(lang, e.target.value);
          }}
        />
      `;
    }

    return html`
      <div class="maph-bilingual">
        <div class="maph-bilingual-field">
          <span class="maph-lang-badge">EN</span>
          ${renderInput("en", placeholderEn)}
        </div>
        <div class="maph-bilingual-field">
          <span class="maph-lang-badge maph-lang-badge-es">ES</span>
          ${renderInput("es", placeholderEs)}
        </div>
      </div>
    `;
  });

  // Preview: both languages, labelled. Rendered on the entry preview pane.
  function BilingualPreview(props) {
    var v = toPlain(props.value) || {};
    var en = v.en || "";
    var es = v.es || "";
    if (!en && !es)
      return h("p", { className: "maph-preview-empty" }, "— not set —");
    return h(
      "div",
      { className: "maph-preview-bilingual" },
      en
        ? h(
            "div",
            { className: "maph-preview-lang" },
            h("span", { className: "maph-lang-badge" }, "EN"),
            h("span", null, en),
          )
        : null,
      es
        ? h(
            "div",
            { className: "maph-preview-lang" },
            h(
              "span",
              { className: "maph-lang-badge maph-lang-badge-es" },
              "ES",
            ),
            h("span", null, es),
          )
        : null,
    );
  }

  // ---------------------------------------------------------------------
  // HeadingControl — section divider. Never saves a value.
  // The field's `label` becomes the visible heading (styled via CSS
  // targeting `[data-maph-heading]`). The widget body renders the optional
  // description.
  // ---------------------------------------------------------------------

  function HeadingControl(props) {
    var onChange = props.onChange;
    var title = props.field.get("label") || "";
    var description = props.field.get("description") || "";

    // Reset any stray value that got saved by an earlier version.
    React.useEffect(function () {
      if (props.value != null) onChange(undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The Decap-rendered label is hidden at runtime by hideHeadingLabels()
    // below — it matches siblings by text content, so we pass the exact
    // title via data-maph-title.
    return html`
      <div
        class="maph-heading"
        data-maph-heading
        data-maph-title=${title}
      >
        <h3 class="maph-heading-title">${title}</h3>
        ${description
          ? html`<p class="maph-heading-desc">${description}</p>`
          : null}
      </div>
    `;
  }

  function HeadingPreview() {
    return null; // Section headers don't appear in the preview pane.
  }

  // ---------------------------------------------------------------------
  // ScheduleControl
  // ---------------------------------------------------------------------

  var SCHEDULE_KINDS = [
    { value: "always-open", label: "Always open" },
    { value: "by-appointment", label: "By appointment" },
    { value: "one-off", label: "One-time event" },
    { value: "recurring", label: "Recurring" },
  ];

  var DAYS = [
    { value: "mon", label: "Mon" },
    { value: "tue", label: "Tue" },
    { value: "wed", label: "Wed" },
    { value: "thu", label: "Thu" },
    { value: "fri", label: "Fri" },
    { value: "sat", label: "Sat" },
    { value: "sun", label: "Sun" },
  ];

  var DAY_LABELS = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };

  var WEEK_LABELS = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
    5: "last",
  };

  var ScheduleControl = React.forwardRef(function ScheduleControl(props, ref) {
    var value = toPlain(props.value) || {};
    var onChange = props.onChange;

    React.useImperativeHandle(ref, function () {
      return {
        isValid: function () {
          if (!value.kind) {
            return { error: { message: "Pick a schedule type." } };
          }
          if (value.kind === "one-off" && !value.date) {
            return {
              error: { message: "One-time events need a date." },
            };
          }
          if (value.kind === "recurring") {
            var weekly = value.weekly || [];
            var monthly = value.monthly || [];
            if (weekly.length === 0 && monthly.length === 0) {
              return {
                error: {
                  message: "Add at least one weekly or monthly slot.",
                },
              };
            }
            var slots = weekly.length ? weekly : monthly;
            for (var i = 0; i < slots.length; i++) {
              if (!slots[i].start_time || !slots[i].end_time) {
                return {
                  error: {
                    message: "Each slot needs a start and end time.",
                  },
                };
              }
            }
          }
          return true;
        },
      };
    });

    function setKind(kind) {
      // Wipe irrelevant fields when switching kinds so we never ship
      // stale data to YAML (e.g., a lingering `date` on an always-open
      // schedule).
      if (!kind) return onChange({});
      if (kind === "always-open") return onChange({ kind: kind });
      if (kind === "by-appointment") return onChange({ kind: kind });
      if (kind === "one-off")
        return onChange({ kind: kind, date: "", start_time: "", end_time: "" });
      if (kind === "recurring")
        return onChange({
          kind: kind,
          weekly: [{ day: "mon", start_time: "", end_time: "" }],
        });
    }

    function patch(next) {
      onChange(Object.assign({}, value, next));
    }

    return html`
      <div class="maph-schedule">
        <div class="maph-row">
          <label class="maph-label" for=${props.forID + "-kind"}>
            Schedule type
          </label>
          <select
            id=${props.forID + "-kind"}
            class="maph-select"
            value=${value.kind || ""}
            onChange=${function (e) {
              setKind(e.target.value);
            }}
          >
            <option value="" disabled>Choose…</option>
            ${SCHEDULE_KINDS.map(function (k) {
              return html`<option value=${k.value}>${k.label}</option>`;
            })}
          </select>
        </div>
        ${value.kind === "by-appointment"
          ? html`<${ByAppointmentFields} value=${value} patch=${patch} />`
          : null}
        ${value.kind === "one-off"
          ? html`<${OneOffFields} value=${value} patch=${patch} />`
          : null}
        ${value.kind === "recurring"
          ? html`<${RecurringFields}
              value=${value}
              patch=${patch}
              onChange=${onChange}
            />`
          : null}
      </div>
    `;
  });

  function ByAppointmentFields(p) {
    var note = p.value.note || {};
    function setNote(lang, text) {
      var next = Object.assign({}, note);
      if (text) next[lang] = text;
      else delete next[lang];
      if (Object.keys(next).length === 0) {
        return p.patch({ note: undefined });
      }
      p.patch({ note: next });
    }
    return html`
      <div class="maph-sub">
        <p class="maph-sub-label">Note for visitors (optional)</p>
        <div class="maph-bilingual">
          <div class="maph-bilingual-field">
            <span class="maph-lang-badge">EN</span>
            <input
              class="maph-input"
              type="text"
              placeholder="e.g., Call ahead to schedule"
              value=${note.en || ""}
              onChange=${function (e) {
                setNote("en", e.target.value);
              }}
            />
          </div>
          <div class="maph-bilingual-field">
            <span class="maph-lang-badge maph-lang-badge-es">ES</span>
            <input
              class="maph-input"
              type="text"
              placeholder="ej., Llame para agendar"
              value=${note.es || ""}
              onChange=${function (e) {
                setNote("es", e.target.value);
              }}
            />
          </div>
        </div>
      </div>
    `;
  }

  function OneOffFields(p) {
    return html`
      <div class="maph-sub">
        <div class="maph-row">
          <label class="maph-label">Date</label>
          <input
            class="maph-input"
            type="date"
            value=${p.value.date || ""}
            onChange=${function (e) {
              p.patch({ date: e.target.value });
            }}
          />
        </div>
        <div class="maph-row-2">
          <${TimeField}
            label="Start (optional)"
            value=${p.value.start_time}
            onChange=${function (t) {
              p.patch({ start_time: t });
            }}
          />
          <${TimeField}
            label="End (optional)"
            value=${p.value.end_time}
            onChange=${function (t) {
              p.patch({ end_time: t });
            }}
          />
        </div>
      </div>
    `;
  }

  function RecurringFields(p) {
    var hasWeekly = Array.isArray(p.value.weekly);
    var hasMonthly = Array.isArray(p.value.monthly);
    var cadence = hasWeekly ? "weekly" : hasMonthly ? "monthly" : "weekly";

    function switchCadence(next) {
      if (next === "weekly") {
        p.onChange({
          kind: "recurring",
          start_date: p.value.start_date,
          end_date: p.value.end_date,
          weekly: p.value.weekly || [
            { day: "mon", start_time: "", end_time: "" },
          ],
        });
      } else {
        p.onChange({
          kind: "recurring",
          start_date: p.value.start_date,
          end_date: p.value.end_date,
          monthly: p.value.monthly || [
            { week: 1, day: "mon", start_time: "", end_time: "" },
          ],
        });
      }
    }

    return html`
      <div class="maph-sub">
        <p class="maph-sub-label">How often?</p>
        <div class="maph-cadence">
          <label class="maph-radio">
            <input
              type="radio"
              name=${"cadence-" + p.value.kind}
              checked=${cadence === "weekly"}
              onChange=${function () {
                switchCadence("weekly");
              }}
            />
            <span><strong>Weekly</strong> — e.g., every Saturday, 10am–1pm</span>
          </label>
          <label class="maph-radio">
            <input
              type="radio"
              name=${"cadence-" + p.value.kind}
              checked=${cadence === "monthly"}
              onChange=${function () {
                switchCadence("monthly");
              }}
            />
            <span
              ><strong>Monthly</strong> — e.g., first Saturday of each
              month</span
            >
          </label>
        </div>
        ${cadence === "weekly"
          ? html`<${WeeklySlots}
              slots=${p.value.weekly || []}
              setSlots=${function (slots) {
                p.patch({ weekly: slots });
              }}
            />`
          : html`<${MonthlySlots}
              slots=${p.value.monthly || []}
              setSlots=${function (slots) {
                p.patch({ monthly: slots });
              }}
            />`}
        <details class="maph-details">
          <summary>Only run during a date range? (optional)</summary>
          <div class="maph-row-2">
            <div class="maph-field">
              <label class="maph-label">Start date</label>
              <input
                class="maph-input"
                type="date"
                value=${p.value.start_date || ""}
                onChange=${function (e) {
                  p.patch({ start_date: e.target.value || undefined });
                }}
              />
            </div>
            <div class="maph-field">
              <label class="maph-label">End date</label>
              <input
                class="maph-input"
                type="date"
                value=${p.value.end_date || ""}
                onChange=${function (e) {
                  p.patch({ end_date: e.target.value || undefined });
                }}
              />
            </div>
          </div>
        </details>
      </div>
    `;
  }

  function WeeklySlots(p) {
    function updateSlot(i, patch) {
      var next = p.slots.slice();
      next[i] = Object.assign({}, next[i], patch);
      p.setSlots(next);
    }
    function addSlot() {
      p.setSlots(
        p.slots.concat([{ day: "mon", start_time: "", end_time: "" }]),
      );
    }
    function removeSlot(i) {
      var next = p.slots.slice();
      next.splice(i, 1);
      if (next.length === 0)
        next.push({ day: "mon", start_time: "", end_time: "" });
      p.setSlots(next);
    }
    return html`
      <div class="maph-slots">
        ${p.slots.map(function (slot, i) {
          return html`
            <div class="maph-slot" key=${i}>
              <div class="maph-slot-day">
                <label class="maph-label">Day</label>
                <select
                  class="maph-select"
                  value=${slot.day || "mon"}
                  onChange=${function (e) {
                    updateSlot(i, { day: e.target.value });
                  }}
                >
                  ${DAYS.map(function (d) {
                    return html`<option value=${d.value}>${d.label}</option>`;
                  })}
                </select>
              </div>
              <${TimeField}
                label="Start"
                value=${slot.start_time}
                onChange=${function (t) {
                  updateSlot(i, { start_time: t });
                }}
              />
              <${TimeField}
                label="End"
                value=${slot.end_time}
                onChange=${function (t) {
                  updateSlot(i, { end_time: t });
                }}
              />
              <button
                type="button"
                class="maph-btn-icon"
                aria-label="Remove slot"
                onClick=${function () {
                  removeSlot(i);
                }}
              >
                ×
              </button>
            </div>
          `;
        })}
        <button type="button" class="maph-btn-secondary" onClick=${addSlot}>
          + Add another slot
        </button>
      </div>
    `;
  }

  function MonthlySlots(p) {
    function updateSlot(i, patch) {
      var next = p.slots.slice();
      next[i] = Object.assign({}, next[i], patch);
      p.setSlots(next);
    }
    function addSlot() {
      p.setSlots(
        p.slots.concat([
          { week: 1, day: "mon", start_time: "", end_time: "" },
        ]),
      );
    }
    function removeSlot(i) {
      var next = p.slots.slice();
      next.splice(i, 1);
      if (next.length === 0)
        next.push({ week: 1, day: "mon", start_time: "", end_time: "" });
      p.setSlots(next);
    }
    var WEEKS = [
      { value: 1, label: "1st" },
      { value: 2, label: "2nd" },
      { value: 3, label: "3rd" },
      { value: 4, label: "4th" },
      { value: 5, label: "Last" },
    ];
    return html`
      <div class="maph-slots">
        ${p.slots.map(function (slot, i) {
          return html`
            <div class="maph-slot maph-slot-monthly" key=${i}>
              <div class="maph-slot-week">
                <label class="maph-label">Week</label>
                <select
                  class="maph-select"
                  value=${String(slot.week || 1)}
                  onChange=${function (e) {
                    updateSlot(i, { week: parseInt(e.target.value, 10) });
                  }}
                >
                  ${WEEKS.map(function (w) {
                    return html`<option value=${String(w.value)}>
                      ${w.label}
                    </option>`;
                  })}
                </select>
              </div>
              <div class="maph-slot-day">
                <label class="maph-label">Day</label>
                <select
                  class="maph-select"
                  value=${slot.day || "mon"}
                  onChange=${function (e) {
                    updateSlot(i, { day: e.target.value });
                  }}
                >
                  ${DAYS.map(function (d) {
                    return html`<option value=${d.value}>${d.label}</option>`;
                  })}
                </select>
              </div>
              <${TimeField}
                label="Start"
                value=${slot.start_time}
                onChange=${function (t) {
                  updateSlot(i, { start_time: t });
                }}
              />
              <${TimeField}
                label="End"
                value=${slot.end_time}
                onChange=${function (t) {
                  updateSlot(i, { end_time: t });
                }}
              />
              <button
                type="button"
                class="maph-btn-icon"
                aria-label="Remove slot"
                onClick=${function () {
                  removeSlot(i);
                }}
              >
                ×
              </button>
            </div>
          `;
        })}
        <button type="button" class="maph-btn-secondary" onClick=${addSlot}>
          + Add another slot
        </button>
      </div>
    `;
  }

  // Native type="time" input. Browsers enforce HH:MM 24-hour on the value
  // attribute (they localize display) so we get the same string back that
  // our Zod regex expects.
  function TimeField(p) {
    return html`
      <div class="maph-field">
        <label class="maph-label">${p.label}</label>
        <input
          class="maph-input maph-input-time"
          type="time"
          value=${p.value || ""}
          onChange=${function (e) {
            p.onChange(e.target.value || undefined);
          }}
        />
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // LocationControl
  // ---------------------------------------------------------------------

  // Track the last Nominatim request time so we stay under 1 req/sec.
  var lastNominatim = 0;
  async function rateLimitedFetch(url) {
    var since = Date.now() - lastNominatim;
    if (since < 1100) {
      await new Promise(function (r) {
        setTimeout(r, 1100 - since);
      });
    }
    lastNominatim = Date.now();
    return fetch(url, { headers: { Accept: "application/json" } });
  }

  // Trim Nominatim's "display_name" down to "street, city, state". The raw
  // field tacks on county, country, ZIP, postcode, etc. which is noise.
  function compactDisplayName(c) {
    var a = c.address || {};
    var street = [a.house_number, a.road].filter(Boolean).join(" ");
    var locality = a.city || a.town || a.village || a.hamlet || a.county || "";
    var parts = [street, locality, a.state].filter(Boolean);
    if (parts.length) return parts.join(", ");
    // Fall back to trimming display_name if addressdetails didn't give us enough.
    return (c.display_name || "")
      .split(",")
      .slice(0, 3)
      .map(function (s) {
        return s.trim();
      })
      .join(", ");
  }

  var LocationControl = React.forwardRef(function LocationControl(props, ref) {
    var value = toPlain(props.value) || {};
    var onChange = props.onChange;

    React.useImperativeHandle(ref, function () {
      return {
        isValid: function () {
          if (!value.address_1 || !value.address_1.trim()) {
            return { error: { message: "Street address is required." } };
          }
          if (!value.city || !value.city.trim()) {
            return { error: { message: "City is required." } };
          }
          if (!value.zip_code || !/^\d{5}(-\d{4})?$/.test(value.zip_code)) {
            return {
              error: { message: "ZIP must be 5 digits or ZIP+4." },
            };
          }
          if (
            typeof value.lat !== "number" ||
            typeof value.lng !== "number"
          ) {
            return {
              error: {
                message:
                  'Click "Find on map" to look up coordinates before saving.',
              },
            };
          }
          if (
            value.lat < BBOX.latMin ||
            value.lat > BBOX.latMax ||
            value.lng < BBOX.lngMin ||
            value.lng > BBOX.lngMax
          ) {
            return {
              error: {
                message:
                  "Coordinates are outside the Greater Phoenix metro.",
              },
            };
          }
          return true;
        },
      };
    });

    var stateHook = React.useState({
      candidates: [],
      searching: false,
      error: null,
      mapOpen: false,
    });
    var state = stateHook[0];
    var setState = stateHook[1];

    function patch(next) {
      onChange(Object.assign({}, value, next));
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
      var q = composedQuery();
      if (!q.trim() || !value.address_1 || !value.city) {
        setState(
          Object.assign({}, state, {
            error: "Fill in at least the street and city before searching.",
          }),
        );
        return;
      }
      setState(
        Object.assign({}, state, {
          searching: true,
          error: null,
          candidates: [],
        }),
      );
      try {
        var url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&addressdetails=1&q=" +
          encodeURIComponent(q);
        var res = await rateLimitedFetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        var data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setState(
            Object.assign({}, state, {
              searching: false,
              candidates: [],
              error:
                "No results. Try a simpler address (e.g., street + city).",
            }),
          );
          return;
        }
        setState(
          Object.assign({}, state, {
            searching: false,
            candidates: data,
            error: null,
            mapOpen: true,
          }),
        );
        // If there's exactly one result, auto-select it.
        if (data.length === 1) {
          chooseCandidate(data[0]);
        }
      } catch (e) {
        setState(
          Object.assign({}, state, {
            searching: false,
            error: "Search failed: " + e.message,
          }),
        );
      }
    }

    function chooseCandidate(c) {
      patch({
        lat: parseFloat(c.lat),
        lng: parseFloat(c.lon),
      });
      setState(Object.assign({}, state, { candidates: [], mapOpen: true }));
    }

    var hasCoords =
      typeof value.lat === "number" && typeof value.lng === "number";
    var insideBbox =
      hasCoords &&
      value.lat >= BBOX.latMin &&
      value.lat <= BBOX.latMax &&
      value.lng >= BBOX.lngMin &&
      value.lng <= BBOX.lngMax;

    return html`
      <div class="maph-location">
        <div class="maph-row">
          <label class="maph-label" for=${props.forID + "-a1"}>
            Street address
          </label>
          <input
            id=${props.forID + "-a1"}
            class="maph-input"
            type="text"
            autoComplete="address-line1"
            value=${value.address_1 || ""}
            onInput=${function (e) {
              patch({ address_1: e.target.value });
            }}
          />
        </div>
        <div class="maph-row">
          <label class="maph-label">Suite / apt / unit (optional)</label>
          <input
            class="maph-input"
            type="text"
            autoComplete="address-line2"
            value=${value.address_2 || ""}
            onInput=${function (e) {
              patch({ address_2: e.target.value || undefined });
            }}
          />
        </div>
        <div class="maph-row-3">
          <div class="maph-field maph-field-wide">
            <label class="maph-label">City</label>
            <input
              class="maph-input"
              type="text"
              autoComplete="address-level2"
              value=${value.city || ""}
              onInput=${function (e) {
                patch({ city: e.target.value });
              }}
            />
          </div>
          <div class="maph-field maph-field-narrow">
            <label class="maph-label">State</label>
            <input
              class="maph-input"
              type="text"
              maxLength=${2}
              value=${value.state || "AZ"}
              onInput=${function (e) {
                patch({ state: e.target.value.toUpperCase() });
              }}
            />
          </div>
          <div class="maph-field">
            <label class="maph-label">ZIP</label>
            <input
              class="maph-input"
              type="text"
              inputMode="numeric"
              value=${value.zip_code || ""}
              onInput=${function (e) {
                patch({ zip_code: e.target.value });
              }}
            />
          </div>
        </div>

        <div class="maph-geocode-row">
          <button
            type="button"
            class="maph-btn-primary"
            disabled=${state.searching}
            onClick=${geocode}
          >
            ${state.searching ? "Searching…" : "🔎 Find on map"}
          </button>
          ${hasCoords
            ? html`
                <span class="maph-coords">
                  <code
                    >${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}</code
                  >
                  ${insideBbox
                    ? html`<span class="maph-badge maph-badge-ok"
                        >✓ inside metro</span
                      >`
                    : html`<span class="maph-badge maph-badge-err"
                        >✗ outside Phoenix metro bbox</span
                      >`}
                </span>
              `
            : null}
        </div>

        ${state.error ? html`<p class="maph-error">${state.error}</p>` : null}
        ${state.candidates.length > 0
          ? html`
              <div class="maph-candidates-wrap">
                <p class="maph-candidates-label">
                  Choose the best match:
                </p>
                <ul class="maph-candidates">
                  ${state.candidates.map(function (c) {
                    return html`
                      <li key=${c.place_id}>
                        <button
                          type="button"
                          class="maph-candidate"
                          onClick=${function () {
                            chooseCandidate(c);
                          }}
                        >
                          <span class="maph-candidate-name"
                            >${compactDisplayName(c)}</span
                          >
                        </button>
                      </li>
                    `;
                  })}
                </ul>
              </div>
            `
          : null}
        ${hasCoords && state.mapOpen
          ? html`<${MapPreview} lat=${value.lat} lng=${value.lng} />`
          : null}
        ${hasCoords
          ? html`
              <details class="maph-details maph-details-coords">
                <summary>Adjust coordinates manually</summary>
                <div class="maph-row-2">
                  <div class="maph-field">
                    <label class="maph-label">Latitude</label>
                    <input
                      class="maph-input"
                      type="number"
                      step="0.000001"
                      value=${value.lat}
                      onChange=${function (e) {
                        patch({ lat: parseFloat(e.target.value) });
                      }}
                    />
                  </div>
                  <div class="maph-field">
                    <label class="maph-label">Longitude</label>
                    <input
                      class="maph-input"
                      type="number"
                      step="0.000001"
                      value=${value.lng}
                      onChange=${function (e) {
                        patch({ lng: parseFloat(e.target.value) });
                      }}
                    />
                  </div>
                </div>
              </details>
            `
          : null}
      </div>
    `;
  });

  function MapPreview(p) {
    // OpenStreetMap embed — dependency-free map preview. A small bounding
    // box around the pin gives a zoom level roughly equivalent to ~z16.
    var delta = 0.005;
    var bbox =
      p.lng -
      delta +
      "," +
      (p.lat - delta) +
      "," +
      (p.lng + delta) +
      "," +
      (p.lat + delta);
    var src =
      "https://www.openstreetmap.org/export/embed.html?bbox=" +
      encodeURIComponent(bbox) +
      "&layer=mapnik&marker=" +
      p.lat +
      "," +
      p.lng;
    var gmaps =
      "https://www.google.com/maps?q=" + p.lat + "," + p.lng + "&z=17";
    return html`
      <div class="maph-map-wrap">
        <iframe
          class="maph-map"
          src=${src}
          title="Location preview"
          loading="lazy"
        ></iframe>
        <a class="maph-map-link" href=${gmaps} target="_blank" rel="noopener">
          Open in Google Maps ↗
        </a>
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // Preview components — rendered in the entry preview pane. Formatted
  // output (not raw JSON) so volunteers can sanity-check the listing
  // before saving.
  // ---------------------------------------------------------------------

  function formatTimeRange(start, end) {
    if (!start && !end) return "";
    if (start && end) return start + "–" + end;
    return start || end;
  }

  function SchedulePreview(props) {
    var v = toPlain(props.value) || {};
    if (!v.kind)
      return h("p", { className: "maph-preview-empty" }, "— not set —");

    if (v.kind === "always-open") {
      return h("p", { className: "maph-preview-schedule" }, "Always open");
    }

    if (v.kind === "by-appointment") {
      var note = v.note || {};
      return h(
        "div",
        { className: "maph-preview-schedule" },
        h("p", null, h("strong", null, "By appointment")),
        note.en
          ? h(
              "p",
              { className: "maph-preview-sub" },
              h("span", { className: "maph-lang-badge" }, "EN"),
              " " + note.en,
            )
          : null,
        note.es
          ? h(
              "p",
              { className: "maph-preview-sub" },
              h(
                "span",
                { className: "maph-lang-badge maph-lang-badge-es" },
                "ES",
              ),
              " " + note.es,
            )
          : null,
      );
    }

    if (v.kind === "one-off") {
      var time = formatTimeRange(v.start_time, v.end_time);
      var whenParts = [v.date, time].filter(Boolean);
      return h(
        "p",
        { className: "maph-preview-schedule" },
        h("strong", null, "One-time event"),
        whenParts.length ? " — " + whenParts.join(", ") : "",
      );
    }

    if (v.kind === "recurring") {
      var entries = [];
      var weekly = v.weekly || [];
      var monthly = v.monthly || [];
      weekly.forEach(function (s) {
        var day = DAY_LABELS[s.day] || s.day;
        var time = formatTimeRange(s.start_time, s.end_time);
        entries.push("Every " + day + (time ? ", " + time : ""));
      });
      monthly.forEach(function (s) {
        var day = DAY_LABELS[s.day] || s.day;
        var wk = WEEK_LABELS[s.week] || s.week + "th";
        var time = formatTimeRange(s.start_time, s.end_time);
        entries.push(
          wk + " " + day + " of the month" + (time ? ", " + time : ""),
        );
      });
      var dateRange =
        v.start_date || v.end_date
          ? (v.start_date || "?") + " → " + (v.end_date || "?")
          : "";
      return h(
        "div",
        { className: "maph-preview-schedule" },
        h("p", null, h("strong", null, "Recurring")),
        entries.length
          ? h(
              "ul",
              { className: "maph-preview-list" },
              entries.map(function (e, i) {
                return h("li", { key: i }, e);
              }),
            )
          : h("p", { className: "maph-preview-sub" }, "— no slots yet —"),
        dateRange
          ? h(
              "p",
              { className: "maph-preview-sub" },
              "Date range: " + dateRange,
            )
          : null,
      );
    }

    return h("p", { className: "maph-preview-empty" }, "— not set —");
  }

  function LocationPreview(props) {
    var v = toPlain(props.value) || {};
    var hasAddress = v.address_1 || v.city;
    var hasCoords = typeof v.lat === "number" && typeof v.lng === "number";
    if (!hasAddress && !hasCoords)
      return h("p", { className: "maph-preview-empty" }, "— not set —");

    var line1 = [v.address_1, v.address_2].filter(Boolean).join(", ");
    var line2 = [
      v.city,
      [v.state, v.zip_code].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");

    return h(
      "div",
      { className: "maph-preview-location" },
      line1 ? h("p", null, line1) : null,
      line2 ? h("p", null, line2) : null,
      hasCoords
        ? h(
            "p",
            { className: "maph-preview-coords" },
            h(
              "code",
              null,
              v.lat.toFixed(5) + ", " + v.lng.toFixed(5),
            ),
          )
        : null,
    );
  }

  // ---------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------

  CMS.registerWidget("bilingual", BilingualControl, BilingualPreview);
  CMS.registerWidget("heading", HeadingControl, HeadingPreview);
  CMS.registerWidget("schedule", ScheduleControl, SchedulePreview);
  CMS.registerWidget("location", LocationControl, LocationPreview);

  // ---------------------------------------------------------------------
  // Required-field marker — Decap appends "(Optional)" to optional field
  // labels but adds nothing to required ones. Walk the DOM and mark the
  // required ones with a subtle red asterisk so editors don't have to
  // infer required-ness from the absence of a suffix.
  // ---------------------------------------------------------------------

  function isInsideCustomWidget(el) {
    return !!el.closest(
      ".maph-bilingual, .maph-schedule, .maph-location, .maph-heading, " +
        ".maph-sub, .maph-slots, .maph-field, .maph-row, .maph-row-2, " +
        ".maph-row-3, .maph-radio",
    );
  }

  function markLabels() {
    var labels = document.querySelectorAll("label");
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (label.dataset.maphMark) continue;
      if (isInsideCustomWidget(label)) continue;
      var txt = (label.textContent || "").trim();
      if (!txt) continue;
      if (/\(Optional\)/i.test(txt)) {
        label.dataset.maphMark = "optional";
        continue;
      }
      // Heuristic: skip labels that are clearly not form-field labels.
      // Decap's field labels have a `for` attribute or sit just above a
      // control. If neither, probably a legend/aside — leave alone.
      var hasFor = label.hasAttribute("for");
      var nextEl = label.nextElementSibling;
      var nearControl =
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
        var mark = document.createElement("span");
        mark.className = "maph-req-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = " *";
        label.appendChild(mark);
      }
    }
  }

  // Hide the Decap-rendered field label for any field whose widget emits
  // a [data-maph-heading] marker. Decap renders field titles with styled
  // components that aren't always <label> tags, so we text-match: walk up
  // from the marker, and at each level hide any sibling element whose
  // text starts with the exact section title (e.g., "Name & Description"
  // or "Name & Description (Optional)"). The branch containing our
  // marker is skipped so we never hide ourselves.
  function hideHeadingLabels() {
    var markers = document.querySelectorAll(
      "[data-maph-heading]:not([data-maph-hidden])",
    );
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      var title = m.getAttribute("data-maph-title") || "";
      if (!title) continue;
      var node = m.parentElement;
      var hid = false;
      while (node && node !== document.body && !hid) {
        for (var k = 0; k < node.children.length; k++) {
          var kid = node.children[k];
          if (kid.contains(m)) continue;
          var text = (kid.textContent || "").trim();
          if (!text) continue;
          // Accept "Title" and "Title (Optional)" but not unrelated text.
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

  var pendingMark = false;
  function scheduleMark() {
    if (pendingMark) return;
    pendingMark = true;
    requestAnimationFrame(function () {
      pendingMark = false;
      markLabels();
      hideHeadingLabels();
    });
  }

  var obs = new MutationObserver(scheduleMark);
  obs.observe(document.body, { childList: true, subtree: true });
  scheduleMark();
})();
