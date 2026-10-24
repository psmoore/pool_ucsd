// UC San Diego pools, read live from Pool Relay: which pool is open now and for what, each
// pool's day and week, and every hour, class time, practice and home event the pages print.
//
//   <div id="finder" data-view="TOKENS" data-origin="[lat,lng]">  the board on the pool page
//   <div id="today" data-view="TOKENS" data-pool="slug">           one pool's day, on its own page
//   <div id="week" data-view="TOKENS">                             this week's hours, pool by pool
//
// Pool facts (photo, area, address, which page) come from pools.js (window.POOLS).
(function () {
  const TZ = "America/Los_Angeles";
  const POOLS = window.POOLS || [];
  const API = "https://www.poolrelay.com/api/public/views/";

  // ── Time, in the pools' own zone ─────────────────────────────────────────────
  const parts = (d) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const P = parts(new Date());
  const TODAY = `${P.year}-${P.month}-${P.day}`;
  const NOW = +P.hour * 60 + +P.minute;
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const mins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const clock = (hhmm) => {
    let [h, m] = hhmm.split(":").map(Number); const ap = h >= 12 && h < 24 ? "pm" : "am"; h = h % 12 || 12;
    return m ? `${h}:${String(m).padStart(2, "0")}${ap}` : `${h}${ap}`;
  };
  const span = (a, b) => {
    const ap = (t) => (+t.split(":")[0] >= 12 ? "pm" : "am");
    return ap(a) === ap(b) ? `${clock(a).replace(/[ap]m$/, "")}–${clock(b)}` : `${clock(a)}–${clock(b)}`;
  };
  const LOC = (window.LANG || "en") === "es" ? "es-US" : "en-US";
  const weekday = (iso, style = "long") => new Date(iso + "T12:00:00Z").toLocaleDateString(LOC, { weekday: style, timeZone: "UTC" });
  const monthDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString(LOC, { month: "short", day: "numeric", timeZone: "UTC" });
  const LANG = window.LANG || "en";
  const T = (s) => (LANG === "es" && window.I18N && window.I18N[s]) || s;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ── What a session is, for filtering and color ───────────────────────────────
  const KINDS = {
    lap: { label: "Lap swim" },
    learn: { label: "Classes & teams" },
  };
  function kindsOf(o, groupName) {
    const names = (o.groupIds || []).map((g) => groupName[g] || "").join(" ") + " " + o.title;
    const ks = [];
    if (/^closes early/i.test(o.title)) return ["other"];
    if (/lesson|learn|level|parent|team|polo|splash ball|masters|adult swim|lifeguard|swim test|academy|training|conditioning|diving|workout|swimming & diving/i.test(names)) ks.push("learn");
    if (/water fitness|aerobic|aqua (fit|zumba|exercise|blast|kickboxing)|water exercise|deep water|twinges|sculpt|aqua jog/i.test(names)) ks.push("fit");
    if (/lap/i.test(names) && !ks.includes("learn")) ks.push("lap");
    if (/rec swim|recreation|open swim|public swim|family rec|wading|splash pad/i.test(names)) ks.push("rec");
    return ks.length ? ks : ["other"];
  }
  const swatch = (ks) => ks.length > 1
    ? `style="background:linear-gradient(90deg,var(--${ks[0]}) 50%,var(--${ks[1]}) 50%)"`
    : `class="k-${ks[0]}"`;

  // ── Reading the schedule ─────────────────────────────────────────────────────
  // A board can read several schedules (comma-separated tokens) and merge them by pool.
  async function load(views, from, to) {
    const all = await Promise.all(String(views).split(",").map((v) => loadOne(v.trim(), from, to)));
    return Object.assign({}, ...all);
  }
  async function loadOne(view, from, to) {
    // ?preview reads a local copy of the planned schedule instead of the live one.
    const r = await fetch(/[?&]preview\b/.test(location.search) ? new URL("preview-data.json", document.querySelector('script[src*="finder.js"]').src).href
      : `${API}${view}/project?from=${from}&to=${to}`);
    if (!r.ok) throw new Error(String(r.status));
    const { occurrences, facilities, groups } = await r.json();
    // Which facility and pool every area belongs to, and how many lanes each pool has.
    // Lanes are counted per layout: a 50 m pool has 20 short-course lanes OR 8 long-course ones.
    const facOf = {}, poolOf = {}, poolName = {}, isLane = {}, lanesIn = {}, layoutOf = {}, lanesUnder = {};
    const walk = (n, fac, pool, parent) => {
      facOf[n.id] = fac; if (pool) poolOf[n.id] = pool;
      if (n.type === "pool") poolName[n.id] = n.longName;
      if (n.type === "lane") { isLane[n.id] = true; layoutOf[n.id] = parent; lanesIn[parent] = (lanesIn[parent] || 0) + 1; }
      // A booking on a whole layout (Long Course) holds every lane in it; the pool's own lanes for a pool without layouts.
      if (n.type === "config" || n.type === "pool") lanesUnder[n.id] = (n.children || []).filter((c) => c.type === "lane").map((c) => c.id);
      (n.children || []).forEach((c) => walk(c, fac, n.type === "pool" ? n.id : pool, n.id));
    };
    (facilities || []).forEach((f) => walk(f, f.longName, null, null));
    // A facility with one pool doesn't name it ("Pool 2 of 6 lanes" says nothing the page doesn't).
    const poolsAt = {};
    for (const id in poolName) poolsAt[facOf[id]] = (poolsAt[facOf[id]] || 0) + 1;
    // Pool Relay geocodes each facility from its address; use that for the map pin.
    for (const f of facilities || []) {
      const p = POOLS.find((x) => x.facility === f.longName);
      if (p && f.latitude != null) { p.lat = f.latitude; p.lng = f.longitude; }
    }
    const groupName = {};
    const groupPath = {};
    const gwalk = (g, up) => { groupName[g.id] = g.longName; groupPath[g.id] = up ? `${up} / ${g.longName}` : g.longName; (g.children || []).forEach((c) => gwalk(c, groupPath[g.id])); };
    (groups || []).forEach((g) => gwalk(g, ""));
    const byFac = {};
    for (const o of occurrences) {
      const fac = facOf[o.areaIds?.[0]]; if (!fac) continue;
      const lanes = o.areaIds.flatMap((a) => (isLane[a] ? [a] : lanesUnder[a] || []));
      const pool = poolOf[o.areaIds[0]];
      const total = lanes.length ? lanesIn[layoutOf[lanes[0]]] || 0 : 0;
      const ev = {
        ...o, fac, kinds: o.allDay ? [] : kindsOf(o, groupName),
        groupPaths: (o.groupIds || []).map((g) => groupPath[g] || ""),
        // Which pool; a booking on the whole center (lanes not posted yet) has none.
        where: pool && poolsAt[fac] > 1 ? poolName[pool] : "", wanted: lanes.length,
        title: T(o.title), orig: o.title,
        laneText: !lanes.length || !total ? "" : lanes.length >= total ? T("all") + ` ${total} ` + T("lanes") : `${lanes.length} ` + T("of") + ` ${total} ` + T("lanes"),
      };
      (byFac[fac] ||= []).push(ev);
    }
    // One row per session: a booking on several lanes arrives once; drop exact repeats.
    for (const f in byFac) {
      const seen = new Set();
      byFac[f] = byFac[f].filter((o) => { const k = `${o.date}|${o.start}|${o.end}|${o.title}|${o.where}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      // A session whose lane count changes as lessons come and go is stored as back-to-back
      // blocks. A swimmer reads it as one session: "3–6pm, 4 to 8 lanes".
      const merged = [];
      for (const o of byFac[f]) {
        const prev = merged.findLast?.((p) => p.date === o.date && p.title === o.title && p.where === o.where && !p.allDay) ?? null;
        if (prev && !o.allDay && prev.end === o.start) {
          prev.end = o.end; prev.parts.push(o);
        } else merged.push({ ...o, parts: [o] });
      }
      for (const m of merged) {
        if (m.parts.length < 2) continue;
        const counts = m.parts.map((p) => +(p.laneText.match(/^(\d+)|^\S+ (\d+)/) || []).slice(1).find(Boolean) || 0);
        const total = (m.parts[0].laneText.match(/(\d+) \S+$/) || [])[1];
        const lo = Math.min(...counts), hi = Math.max(...counts);
        if (total && lo !== hi) m.laneText = `${lo}–${hi} ` + T("of") + ` ${total} ` + T("lanes");
      }
      byFac[f] = merged.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    }
    return byFac;
  }

  // Which sessions a pool has on a day, and what that means for a swimmer.
  function dayOf(pool, events, day, kind) {
    const evs = events || [];
    // "Anything" still means anything a member of the public can join: when a pool has lap or
    // open swim, a class doesn't count as the pool being open.
    const pub = (o) => o.kinds.includes("lap") || o.kinds.includes("rec");
    const publicPool = kind === "any" && evs.some((o) => !o.allDay && pub(o));
    const fits = (o) => (kind === "any" ? !publicPool || pub(o) : o.kinds.includes(kind));
    const closure = evs.find((o) => o.allDay && o.date <= day && (o.endDate || o.date) >= day && /clos/i.test(o.orig || o.title));
    const all = closure ? [] : evs.filter((o) => !o.allDay && o.date === day && (kind === "any" || o.kinds.includes(kind)));
    const sessions = all;          // the day's list shows everything, classes included
    const open = all.filter(fits); // the status line counts what the public can join
    const isToday = day === TODAY;
    // When several sessions are on at once, name the one most swimmers come for.
    const rank = (o) => (o.kinds.includes("lap") || o.kinds.includes("rec") ? 0 : o.kinds.includes("fit") ? 1 : 2);
    const byInterest = (a, b) => mins(a.start) - mins(b.start) || rank(a) - rank(b);
    const live = (isToday ? open.filter((o) => mins(o.start) <= NOW && NOW < mins(o.end)) : []).sort((a, b) => rank(a) - rank(b));
    const later = (isToday ? open.filter((o) => mins(o.start) > NOW) : open).slice().sort(byInterest);
    let state, line;
    if (closure) {
      state = "shut";
      // An open-ended closure is stored with a placeholder end; say so rather than print it.
      const openEnded = /until a reopening date is announced/i.test(closure.description || "");
      const until = openEnded ? ", no reopening date yet" : closure.endDate && closure.endDate !== closure.date ? ` ${T("through")} ${monthDay(closure.endDate)}` : "";
      line = `${closure.title}${until}`;
    } else if (live.length) {
      state = "open";
      const o = live[0];
      const part = (o.parts || [o]).find((p) => mins(p.start) <= NOW && NOW < mins(p.end)) || o;
      const pools = live.map((x) => { const p = (x.parts || [x]).find((q) => mins(q.start) <= NOW && NOW < mins(q.end)) || x; return [x.where, p.laneText].filter(Boolean).join(" "); }).filter(Boolean);
      const uniq = [...new Set(pools)];
      const classes = live.length > 1 && !live.some(pub);
      line = `${T("In the water now")}: ${classes ? `${live.length} ${T("classes")}` : o.title}${!classes && uniq.length ? ` (${uniq.join("; ")})` : ""}, ${T("until")} ${clock(live.reduce((m, x) => (x.end > m ? x.end : m), o.end))}`;
    } else if (later.length) {
      state = isToday ? "soon" : "open";
      const o = later[0];
      line = isToday ? `${T("Opens")} ${clock(o.start)}: ${o.title}` : `${o.title} ${T("from")} ${clock(o.start)}`;
    } else {
      state = "shut";
      const any = evs.some((o) => !o.allDay);
      const next = evs.find((o) => !o.allDay && o.date > day && fits(o));
      const what = kind === "any" ? "" : ` ${KINDS[kind].label.toLowerCase()}`; // eslint-disable-line
      line = !any ? T("No hours published")
        : isToday && sessions.length ? `${T("Done for today")}${next ? `. ${T("Next")}: ${weekday(next.date)} ${clock(next.start)}` : ""}`
        : `${T("Nothing scheduled")} ${isToday ? T("today") : weekday(day)}${next ? `. ${T("Next")}: ${weekday(next.date)} ${clock(next.start)}` : ""}`;
    }
    return { state, line, sessions, live, closure };
  }

  // A day as a bar from 5am to 10pm, so pools can be compared at a glance.
  const T0 = 5 * 60, T1 = 22 * 60;
  function timeline(sessions, day) {
    const pct = (m) => Math.max(0, Math.min(100, ((m - T0) / (T1 - T0)) * 100));
    const bars = sessions.map((o) => {
      const l = pct(mins(o.start)), w = pct(mins(o.end)) - l;
      const ks = o.kinds;
      const bg = ks.length > 1 ? `linear-gradient(180deg,var(--${ks[0]}) 50%,var(--${ks[1]}) 50%)` : `var(--${ks[0]})`;
      return `<i style="left:${l}%;width:${w}%;background:${bg}" title="${esc(o.title)} ${span(o.start, o.end)}"></i>`;
    }).join("");
    const now = day === TODAY && NOW > T0 && NOW < T1 ? `<span class="nowline" style="left:${pct(NOW)}%"></span>` : "";
    return `<div class="tl" aria-hidden="true">${bars}${now}</div>`;
  }

  // Lesson slots come every half hour; unless someone is looking for lessons, one line says it.
  const LESSON = /lesson|academy|private|parent|mighty fish|mini fish|super fish|big fish|starfish|seahorse|otter|stroke and conditioning|adult swim (basics|refinement)/i;
  function foldLessons(sessions) {
    const les = sessions.filter((o) => LESSON.test(o.orig || o.title) && !/team|aquatics –/i.test(o.orig || o.title));
    if (les.length < 3) return sessions;
    const a = les.reduce((m, o) => (o.start < m ? o.start : m), "99:99"), b = les.reduce((m, o) => (o.end > m ? o.end : m), "00:00");
    const row = { title: `${T("Swim lessons")} · ${les.length} ${T("classes")}`, start: a, end: b, kinds: ["learn"], laneText: "", parts: les, folded: true };
    return sessions.filter((o) => !les.includes(o)).concat(row).sort((x, y) => x.start.localeCompare(y.start));
  }
  function sessionList(sessions, day, kind = "any") {
    if (kind !== "learn") sessions = foldLessons(sessions);
    return `<ul class="sess">${sessions.map((o) => {
      const cls = o.folded ? "" : day === TODAY ? (mins(o.end) <= NOW ? "past" : mins(o.start) <= NOW ? "now" : "") : "";
      return `<li class="${cls}"><span class="t">${span(o.start, o.end)}</span><span class="k" ${swatch(o.kinds)}></span>` +
        `<span>${esc(o.title)}${o.where || o.laneText ? ` <span class="n">${esc([o.where, o.laneText].filter(Boolean).join(", "))}</span>` : ""}</span></li>`;
    }).join("")}</ul>`;
  }

  const miles = (a, b) => {
    const R = 3958.8, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // ── Schedule facts in the page's text, computed from the live schedule ──────
  // No hours, days or dates are typed into these pages. Each element with data-live fills in from
  // the same feed as the calendar, so a change in Pool Relay changes the text too.
  //   data-live="when" data-title="Lap Swim|…"  one program's week: "Mon–Fri 6:30–9:30am and 5–7:30pm; Sat 8:30–11:30am"
  //   data-live="hours"                          the pool's week, every session; data-format="dl" for a list by day
  //   data-live="swims"                          lap and rec swim by week, and what else runs there
  //   data-live="closures"                       coming closures; the element hides when there are none
  // Each also needs data-view (the feed) and data-pool (a slug in window.POOLS).
  const AHEAD = 28; // a "regular week" is read from the next four weeks
  const feeds = {};
  const feed = (view) => (feeds[view] ||= load(view, TODAY, addDays(TODAY, 120)));
  const dow = (iso) => (new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const LOCALE = (window.LANG || "en") === "es" ? "es-US" : "en-US";
  const dayName = (i, style) => { const s = weekday(addDays("2024-01-01", i), style).replace(/\.$/, ""); return s[0].toUpperCase() + s.slice(1); };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const isClosure = (o) => o.allDay && /clos/i.test(o.orig || o.title);
  const closedOn = (evs, d) => evs.some((o) => isClosure(o) && o.date <= d && (o.endDate || o.date) >= d);
  // A day's hours: each stretch with someone in the water, or (whole) first session to last.
  let MERGE_GAP = 15;
  function hoursOf(list, whole) {
    const iv = list.map((o) => [mins(o.start), mins(o.end)]).sort((a, b) => a[0] - b[0]);
    if (whole) return span(hhmm(iv[0][0]), hhmm(Math.max(...iv.map((x) => x[1]))));
    const out = [];
    // Back-to-back classes with a changeover of 15 minutes or less read as one stretch.
    for (const [a, b] of iv) { if (out.length && a <= out[out.length - 1][1] + MERGE_GAP) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b); else out.push([a, b]); }
    const parts = out.map(([a, b]) => span(hhmm(a), hhmm(b)));
    return parts.length > 2 ? `${parts.slice(0, -1).join(", ")} ${T("and")} ${parts[parts.length - 1]}` : parts.join(` ${T("and")} `);
  }
  // A program's regular week: each weekday it runs in at least half its weeks, with that weekday's most common hours.
  // `season` reads the whole scheduled season instead of four weeks: a pool's regular hours
  // shouldn't turn "Closed" because a few Saturdays in a row are closures.
  function weekly(evs, pick, whole, season) {
    const last = evs.filter((o) => !o.allDay && pick(o)).reduce((m, o) => (o.date > m ? o.date : m), TODAY);
    const end = season ? last : addDays(TODAY, AHEAD - 1);
    const byDate = {};
    for (const o of evs) if (!o.allDay && o.date >= TODAY && o.date <= end && pick(o) && !closedOn(evs, o.date)) (byDate[o.date] ||= []).push(o);
    const dates = Object.keys(byDate).sort();
    if (!dates.length) return null;
    const weeks = new Set(dates.map((d) => addDays(d, -dow(d)))).size;
    const seen = Array.from({ length: 7 }, () => ({}));
    for (const d of dates) { const h = hoursOf(byDate[d], whole); seen[dow(d)][h] = (seen[dow(d)][h] || 0) + 1; }
    const hours = seen.map((c) => {
      const n = Object.values(c).reduce((s, x) => s + x, 0);
      return n && n >= Math.ceil(weeks / 2) ? Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] : "";
    });
    return { hours, first: dates[0], last: dates[dates.length - 1], end };
  }
  // Weekdays with the same hours, as "Mon–Fri" or "Mon/Wed/Fri".
  function dayGroups(hours, style) {
    const groups = [];
    hours.forEach((h, i) => { if (h === "") return; const g = groups.find((x) => x.h === h); g ? g.days.push(i) : groups.push({ h, days: [i] }); });
    return groups.map(({ h, days }) => {
      const runs = [];
      for (const d of days) { const r = runs[runs.length - 1]; r && d === r[r.length - 1] + 1 ? r.push(d) : runs.push([d]); }
      return { h, label: runs.map((r) => (r.length >= 3 ? `${dayName(r[0], style)}–${dayName(r[r.length - 1], style)}` : r.map((d) => dayName(d, style)).join("/"))).join("/") };
    });
  }
  function whenText(evs, pick) {
    const w = weekly(evs, pick);
    const groups = w ? dayGroups(w.hours, "short") : [];
    if (!groups.length) {
      const next = evs.find((o) => !o.allDay && o.date >= TODAY && pick(o) && !closedOn(evs, o.date));
      return next ? `${T("Next")}: ${weekday(next.date)} ${monthDay(next.date)}, ${span(next.start, next.end)}` : T("Nothing scheduled in the next four weeks");
    }
    let s = groups.map((g) => `${g.label} ${g.h}`).join("; ");
    if (w.first > addDays(TODAY, 6)) s = `${T("Starts")} ${monthDay(w.first)}: ${s}`;
    if (w.last < addDays(w.end, -6)) s += `, ${T("through")} ${monthDay(w.last)}`;
    return s;
  }
  const dateRange = (a, b) => new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" })
    .formatRange(new Date(a + "T12:00:00Z"), new Date(b + "T12:00:00Z")).replace(/\s*–\s*/, "–");
  function closureList(evs) {
    const seen = new Set();
    return evs.filter((o) => isClosure(o) && (o.endDate || o.date) >= TODAY && o.date <= addDays(TODAY, 90))
      .filter((o) => { const k = `${o.orig || o.title}|${o.date}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((o) => {
        const last = o.endDate || o.date;
        if (o.date <= TODAY) {
          // Ongoing: "Closed for the season, no reopening date yet" / "Pool closed for replastering through Nov 29".
          const open = /until a reopening date is announced/i.test(o.description || "");
          return `${o.title}${open ? `, ${T("no reopening date yet")}` : ` ${T("through")} ${monthDay(last)}`}`;
        }
        const when = last !== o.date ? dateRange(o.date, last) : monthDay(o.date);
        const why = o.title.replace(/^(closed|cerrado)\s*[:–—-]\s*/i, "");
        return /^(closed|cerrado)$/i.test(why.trim()) ? when : `${when} (${why})`;
      });
  }
  document.querySelectorAll("[data-live]").forEach((el) => {
    const pool = POOLS.find((p) => p.slug === el.dataset.pool.split("|")[0]);
    // data-title narrows hours, adjusted days and the last day to one program (e.g. open swim).
    const only = el.dataset.title ? el.dataset.title.split("|") : null;
    // data-group picks a program by its group instead ("Sports Clubs / Men's Water Polo"): every booking under it, whatever its title.
    const grp = el.dataset.group ? el.dataset.group.split("|") : null;
    const inGroup = (o) => grp && grp.some((g) => (o.groupPaths || []).some((p) => p === g || p.endsWith(` / ${g}`) || p.includes(`${g} / `)));
    const inProgram = (o) => (grp ? inGroup(o) : !only || only.includes(o.orig || o.title));
    feed(el.dataset.view).then((byFac) => {
      const evs = byFac[pool.facility] || [];
      const mode = el.dataset.live;
      // data-pool="a|b" with both feeds in data-view: one program's week at each pool that has it ("Natatorium: Sat 9:30am; Canyonview: …").
      const several = el.dataset.pool.includes("|") ? el.dataset.pool.split("|").map((s) => POOLS.find((p) => p.slug === s)).filter(Boolean) : null;
      if (mode === "when" && several) {
        if (el.dataset.gap !== undefined) MERGE_GAP = +el.dataset.gap;
        const parts = several.map((p) => {
          const e = byFac[p.facility] || [];
          return e.some((o) => !o.allDay && o.date >= TODAY && inProgram(o)) ? `${p.short || p.name}: ${whenText(e, inProgram)}` : null;
        }).filter(Boolean);
        MERGE_GAP = 15;
        el.textContent = parts.join(" · ") || el.dataset.empty || T("Nothing scheduled in the next four weeks");
      } else if (mode === "when") {
        // data-gap="0": list each class on its own instead of reading back-to-back classes as one stretch; "-1" keeps even touching ones apart.
        if (el.dataset.gap !== undefined) MERGE_GAP = +el.dataset.gap;
        el.textContent = whenText(evs, inProgram);
        MERGE_GAP = 15;
      } else if (mode === "hours") {
        // data-whole="0": each stretch ("6am–1pm and 3–8pm") instead of first session to last.
        const w = weekly(evs, (o) => inProgram(o) && !/^closes early/i.test(o.orig || o.title), el.dataset.whole !== "0", true);
        const hours = (w ? w.hours : Array(7).fill("")).map((h) => h || T("Closed"));
        const groups = dayGroups(hours, el.dataset.format === "dl" ? "long" : "short");
        el.innerHTML = el.dataset.format === "dl"
          ? `<dl>${groups.map((g) => `<dt>${esc(g.label)}</dt><dd>${esc(g.h)}</dd>`).join("")}</dl>`
          : esc(groups.map((g) => `${g.label} ${g.h}`).join("; "));
      } else if (mode === "swims") {
        const lines = ["lap", "rec"].filter((k) => evs.some((o) => !o.allDay && o.date >= TODAY && o.kinds.includes(k)))
          .map((k) => `<b>${esc(T(KINDS[k].label))}:</b> ${esc(whenText(evs, (o) => o.kinds.includes(k)))}`);
        const also = ["fit", "learn"].filter((k) => evs.some((o) => !o.allDay && o.date >= TODAY && o.date < addDays(TODAY, AHEAD) && o.kinds.includes(k)))
          .map((k) => T(KINDS[k].label).toLowerCase());
        // A pool with no lap swim reads its classes' hours instead of "Also: classes".
        if (!lines.length && evs.some((o) => !o.allDay && o.date >= TODAY && o.kinds.includes("learn"))) lines.push(`<b>${esc(T("Classes"))}:</b> ${esc(whenText(evs, (o) => o.kinds.includes("learn")))}`);
        else if (also.length) lines.push(`${T("Also")}: ${esc(also.join(` ${T("and")} `))}.`);
        el.innerHTML = lines.join("<br>") || esc(T("Nothing scheduled in the next four weeks"));
      } else if (mode === "dates") {
        // Each coming date of a program: "Fri, Nov 13, 5–9pm; Sat, Nov 14, 8am–6pm".
        // data-show-title: each date says what it is ("Sat, Oct 24, 2pm: vs #8 LMU"), with data-strip cut from the front of the title.
        const list = evs.filter((o) => !o.allDay && o.date >= TODAY && inProgram(o));
        el.hidden = !list.length && el.dataset.hideEmpty !== undefined;
        const strip = el.dataset.strip ? new RegExp("^(" + el.dataset.strip + ")\\s*:?\\s*", "i") : null;
        const name = (o) => (strip ? o.title.replace(strip, "") : o.title);
        el.innerHTML = list.length
          ? el.dataset.showTitle !== undefined
            ? `<ul>${list.map((o) => `<li><b>${esc(`${weekday(o.date, "short")}, ${monthDay(o.date)}, ${clock(o.start)}`)}</b> ${esc(name(o))}</li>`).join("")}</ul>`
            : esc(list.map((o) => `${weekday(o.date, "short")}, ${monthDay(o.date)}, ${span(o.start, o.end)}`).join("; "))
          : esc(el.dataset.empty || T("Nothing scheduled in the next four weeks"));
      } else if (mode === "exceptions") {
        // Days whose hours differ from that weekday's regular hours, through the last scheduled day.
        const w = weekly(evs, inProgram, true, true);
        const open = evs.filter((o) => !o.allDay && inProgram(o));
        const lastDay = [...open.map((o) => o.date), ...evs.filter(isClosure).map((o) => o.endDate || o.date)]
          .filter((d) => d <= addDays(TODAY, 90)).reduce((m, d) => (d > m ? d : m), TODAY);
        const rows = [];
        for (let d = TODAY; d <= lastDay && rows.length < 12; d = addDays(d, 1)) {
          const closure = evs.find((o) => isClosure(o) && o.date <= d && (o.endDate || o.date) >= d);
          const on = open.filter((o) => o.date === d);
          const regular = w ? w.hours[dow(d)] : "";
          const h = closure ? T("Closed") : on.length ? hoursOf(on, true) : regular ? T("Closed") : "";
          if (h !== regular && (h || regular)) {
            const prev = rows[rows.length - 1];
            // Consecutive closed days read as one line: "Wed, Nov 25 – Fri, Nov 27: Closed".
            if (prev && prev.h === h && h === T("Closed") && prev.to === addDays(d, -1)) prev.to = d;
            else rows.push({ from: d, to: d, h, why: closure ? closure.title.replace(/^(closed|cerrado)\s*[:–—-]\s*/i, "") : "" });
          }
        }
        el.hidden = !rows.length;
        const day = (d) => `${weekday(d)}, ${monthDay(d)}`;
        el.innerHTML = `<ul>${rows.map((r) => `<li><b>${esc(r.from === r.to ? day(r.from) : `${day(r.from)} – ${day(r.to)}`)}:</b> ${esc(r.h)}${r.why && !/^closed$/i.test(r.why) ? ` (${esc(r.why)})` : ""}</li>`).join("")}</ul>`;
      } else if (mode === "last") {
        const open = evs.filter((o) => !o.allDay && o.date >= TODAY && inProgram(o));
        el.textContent = open.length ? `${weekday(open[open.length - 1].date)}, ${monthDay(open[open.length - 1].date)}` : "—";
      } else if (mode === "closures") {
        const list = closureList(evs);
        el.hidden = !list.length;
        // A list that already starts with the label's word ("Closed for the season…") needs no label.
        const label = T(el.dataset.label || "Closed");
        el.innerHTML = list[0].toLowerCase().startsWith(label.toLowerCase()) ? `${esc(list.join("; "))}.` : `<b>${esc(label)}:</b> ${esc(list.join("; "))}.`;
      }
    }).catch(() => { el.textContent = T("See the calendar for times."); });
  });

  // ── One pool's page ─────────────────────────────────────────────────────────
  const single = document.getElementById("today");
  if (single) {
    const pool = POOLS.find((p) => p.slug === single.dataset.pool);
    load(single.dataset.view, TODAY, addDays(TODAY, 14)).then((byFac) => {
      const evs = byFac[pool.facility] || [];
      const d = dayOf(pool, evs, TODAY, "any");
      single.innerHTML = `<div class="pool"><div>
        <p class="state ${d.state}" style="margin-top:0"><span class="dot"></span>${esc(d.line)}</p>
        ${d.sessions.length ? timeline(d.sessions, TODAY) + `<div class="tlscale"><span>5am</span><span>${T("noon")}</span><span>5pm</span><span>10pm</span></div>` + sessionList(d.sessions, TODAY) : ""}
      </div></div>`;
    }).catch(() => { single.innerHTML = `<p class="muted">The live schedule didn't load. The calendar below has every session.</p>`; });
    if (!document.getElementById("week")) return;
  }

  // ── This week, pool by pool, with how many lanes ───────────────────────────
  // One column per pool (data-pools="50-Meter Pool|25-Yard Pool"), plus one for hours booked
  // on the whole center before FGCU has posted which pool and how many lanes.
  const week = document.getElementById("week");
  if (week) {
    const days7 = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
    if (!week.dataset.pools) {
      // One pool's week by kind of session: lap swim, open swim, lessons & teams.
      load(week.dataset.view, TODAY, addDays(TODAY, 7)).then((byFac) => {
        const p = POOLS.find((x) => x.slug === week.dataset.pool) || POOLS[0];
        const evs = byFac[p.facility] || [];
        const wk = evs.filter((o) => !o.allDay && o.date >= days7[0] && o.date <= days7[6]);
        const kinds = [["lap", "Lap swim"], ["learn", "Lessons, classes & teams"], ["other", "Other"]].filter(([k]) => wk.some((o) => o.kinds.includes(k)));
        const iv = (list) => { const out = []; list.map((o) => [mins(o.start), mins(o.end)]).sort((a, b) => a[0] - b[0])
          .forEach(([a, b]) => { if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b); else out.push([a, b]); });
          return out.map(([a, b]) => span(hhmm(a), hhmm(b))).join(", "); };
        const rows = days7.map((d) => {
          const head = `<th>${weekday(d, "short")} ${monthDay(d)}</th>`;
          const closure = evs.find((o) => o.allDay && o.date <= d && (o.endDate || o.date) >= d && /clos/i.test(o.orig || o.title));
          if (closure) return `<tr>${head}<td class="muted" colspan="${kinds.length}">${esc(closure.title)}</td></tr>`;
          const on = evs.filter((o) => !o.allDay && o.date === d);
          return `<tr>${head}${kinds.map(([k]) => { const t = iv(on.filter((o) => o.kinds.includes(k))); return `<td>${t ? `<span class="k k-${k}"></span>${t}` : `<span class="muted">—</span>`}</td>`; }).join("")}</tr>`;
        }).join("");
        week.innerHTML = `<div class="tblwrap"><table class="lanes"><thead><tr><th></th>${kinds.map(([, h]) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }).catch(() => { week.innerHTML = `<p class="muted">The live schedule didn't load. The calendar below has every session.</p>`; });
      return;
    }
    const cols = [...week.dataset.pools.split("|"), ""];
    const heads = [...week.dataset.pools.split("|"), "Pool not posted yet"];
    load(week.dataset.view, TODAY, addDays(TODAY, 7)).then((byFac) => {
      const p = POOLS.find((x) => x.slug === week.dataset.pool) || POOLS[0];
      const evs = byFac[p.facility] || [];
      const lanesOf = (o) => (o.laneText || "").replace(/^all (\d+) lanes$/, "all $1 lanes").replace(/ of \d+ lanes$/, " lanes");
      const used = new Set(evs.filter((o) => !o.allDay && o.date >= TODAY && o.date <= days7[6]).map((o) => o.where));
      const shown = cols.map((c, i) => [c, heads[i]]).filter(([c]) => used.has(c) || c !== "");
      const rows = days7.map((d) => {
        const closure = evs.find((o) => o.allDay && o.date <= d && (o.endDate || o.date) >= d && /clos/i.test(o.orig || o.title));
        const head = `<th>${weekday(d, "short")} ${monthDay(d)}</th>`;
        if (closure) return `<tr>${head}<td class="muted" colspan="${shown.length}">${esc(closure.title)}</td></tr>`;
        const cell = (c) => {
          const on = evs.filter((o) => !o.allDay && o.date === d && o.where === c);
          if (!on.length) return `<td><span class="muted">—</span></td>`;
          return `<td>${on.map((o) => `<div>${span(o.start, o.end)}${lanesOf(o) ? ` <span class="n">${esc(lanesOf(o))}</span>` : ""}${` <span class="n">${esc(o.title)}</span>`}</div>`).join("")}</td>`;
        };
        return `<tr>${head}${shown.map(([c]) => cell(c)).join("")}</tr>`;
      }).join("");
      week.innerHTML = `<div class="tblwrap"><table class="lanes"><thead><tr><th></th>${shown.map(([, h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }).catch(() => { week.innerHTML = `<p class="muted">The live schedule didn't load. The calendar below has every session.</p>`; });
    return;
  }

  // ── The citywide finder ─────────────────────────────────────────────────────
  const root = document.getElementById("finder");
  if (!root) return;
  const state = { day: root.dataset.day === "today" ? TODAY : root.dataset.day || "now", kind: root.dataset.kind || "any", area: "all", me: null };
  // Every pool is also measured from the pool it stands in for, so the list reads "how far
  // from the Laguna Beach pool" before anyone shares a location.
  const origin = root.dataset.origin ? (([lat, lng]) => ({ lat, lng }))(JSON.parse(root.dataset.origin)) : null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
  const dayChips = [["now", "Right now"], [TODAY, "Today"], ...days.slice(1).map((d, i) => [d, i === 0 ? "Tomorrow" : weekday(d, "short")])];
  const areas = ["all", ...Array.from(new Set(POOLS.filter((p) => p.kind === "yearRound").map((p) => p.area))).sort()];

  const chipRow = (name, items, cur) => `<div class="chips" role="group">${items.map(([v, l]) =>
    `<button type="button" class="chip" data-${name}="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join("")}</div>`;
  root.innerHTML = `
    <div class="bar">
      <fieldset><legend>When</legend>${chipRow("day", dayChips, state.day)}</fieldset>
      <fieldset><legend>To do</legend>${chipRow("kind", [["any", "Anything"], ...Object.entries(KINDS).map(([k, v]) => [k, v.label])], state.kind)}</fieldset>
      ${areas.length > 2 ? `<fieldset><legend>Where</legend>${chipRow("area", areas.map((a) => [a, a === "all" ? (root.dataset.allLabel || "Everywhere") : a]), state.area)}
        <div class="chips" style="margin-top:6px"><button type="button" class="chip near" data-near aria-pressed="false">📍 Nearest to me</button></div></fieldset>` : ""}
    </div>
    <div class="summary" aria-live="polite"><span class="muted">Loading every pool's schedule…</span></div>
    <div class="split"><ol class="results"></ol><div id="map" role="region" aria-label="Map of pools"></div></div>
    <div class="legend"><span class="k-lap">Lap swim</span><span class="k-learn">Classes &amp; teams</span><span class="k-other">Other</span></div>`;
  const list = root.querySelector(".results");
  const summary = root.querySelector(".summary");

  let map = null, markers = {};
  function drawMap(rows) {
    if (!window.L) return;
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false }).setView(JSON.parse(root.dataset.center || "[34.03,-118.35]"), +(root.dataset.zoom || 10));
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
    }
    Object.values(markers).forEach((m) => m.remove()); markers = {};
    const color = { open: "#1f8a4c", soon: "#c27c0e", shut: "#8a8278" };
    for (const r of rows) {
      const m = L.circleMarker([r.p.lat, r.p.lng], {
        radius: r.p.kind === "yearRound" ? (r.d.state === "shut" ? 6 : 9) : 4,
        color: "#fff", weight: 1.5, fillColor: color[r.d.state], fillOpacity: r.p.kind === "yearRound" ? 0.95 : 0.5,
      }).addTo(map);
      m.bindPopup(`<b>${esc(r.p.name)}</b><br>${esc(r.d.line)}<br><a href="${esc(r.p.href)}">Hours and details</a>`);
      m.on("click", () => { const el = document.getElementById("p-" + r.p.slug); if (el) { el.classList.add("hl"); el.scrollIntoView({ block: "nearest", behavior: "smooth" }); setTimeout(() => el.classList.remove("hl"), 1600); } });
      markers[r.p.slug] = m;
    }
    if (origin) {
      markers.__origin = L.circleMarker([origin.lat, origin.lng], { radius: 8, color: "#fff", weight: 2, fillColor: "#b3261e", fillOpacity: 1 })
        .addTo(map).bindPopup(esc(root.dataset.originName || "Origin"));
    }
    if (state.me) {
      markers.__me = L.circleMarker([state.me.lat, state.me.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#2f6fb3", fillOpacity: 1 }).addTo(map).bindPopup("You are here");
    }
  }

  let byFac = null;
  function render() {
    const day = state.day === "now" ? TODAY : state.day;
    const yr = POOLS.filter((p) => p.kind === "yearRound" && (state.area === "all" || p.area === state.area));
    const rows = yr.map((p) => {
      const d = p.facility ? dayOf(p, byFac[p.facility], day, state.kind)
        : { state: "shut", line: p.closedNote || "Closed", sessions: [], live: [] };
      return { p, d, dist: state.me ? miles(state.me, p) : origin ? miles(origin, p) : null };
    });
    const rank = { open: 0, soon: 1, shut: 2 };
    rows.sort((a, b) => {
      if (state.day === "now" || day === TODAY) { const r = rank[a.d.state] - rank[b.d.state]; if (r) return r; }
      else { const r = (a.d.state === "shut") - (b.d.state === "shut"); if (r) return r; }
      if (state.me || origin) return a.dist - b.dist;
      const sa = a.d.live[0]?.end || a.d.sessions.find((o) => day !== TODAY || mins(o.end) > NOW)?.start || "99";
      const sb = b.d.live[0]?.end || b.d.sessions.find((o) => day !== TODAY || mins(o.end) > NOW)?.start || "99";
      return sa.localeCompare(sb) || a.p.name.localeCompare(b.p.name);
    });
    const shown = state.day === "now" ? rows.filter((r) => r.d.state === "open") : rows.filter((r) => r.d.state !== "shut");
    const rest = rows.filter((r) => !shown.includes(r));
    const what = state.kind === "any" ? "" : ` for ${KINDS[state.kind].label.toLowerCase()}`;
    const where = state.area === "all" ? "" : ` in ${state.area}`;
    const when = state.day === "now" ? `right now (${clock(`${P.hour}:${P.minute}`)})` : day === TODAY ? "today" : `on ${weekday(day)}, ${monthDay(day)}`;
    summary.innerHTML = `<b>${shown.length} of ${rows.length} pools</b><span>open${what}${where} ${when}.</span>` +
      (state.day === "now" && !shown.length ? `<span class="muted">Try “Today” to see what opens later.</span>` : "");

    const card = (r) => {
      const { p, d } = r;
      const ses = d.sessions;
      return `<li class="pool" id="p-${p.slug}">
        <div class="ph" ${p.photo ? `style="background-image:url('${esc(p.photo)}')"` : ""} role="img" aria-label=""></div>
        <div>
          <h3><a href="${esc(p.href)}">${esc(p.name)}</a></h3>
          <div class="where">${esc(p.area)} · ${esc(p.address.replace(/, CA \d{5}$/, ""))}${r.dist != null ? ` · <b>${r.dist.toFixed(1)} mi</b>${state.me ? "" : ` <span class="muted">${esc(root.dataset.originLabel || "away")}</span>`}` : ""}</div>
          <p class="state ${d.state}"><span class="dot"></span>${esc(d.line)}</p>
          ${ses.length ? timeline(ses, day) + sessionList(ses, day, state.kind) : ""}
        </div></li>`;
    };
    list.innerHTML = (shown.length ? shown.map(card).join("") : `<li class="empty">No pool${where} matches. ${rest.length ? "The closest options are below." : ""}</li>`) +
      (rest.length ? `<li class="later-h">${state.day === "now" ? "Not open right now" : "No matching sessions that day"} · ${rest.length}</li>` + rest.map(card).join("") : "");
    drawMap(rows.concat(state.area === "all" ? POOLS.filter((p) => p.kind !== "yearRound").map((p) => ({ p, d: { state: "shut", line: p.closedNote || "Closed until summer" } })) : []));
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button.chip"); if (!b) return;
    if (b.hasAttribute("data-near")) {
      if (state.me) { state.me = null; b.setAttribute("aria-pressed", "false"); b.textContent = "📍 Nearest to me"; render(); return; }
      b.textContent = "📍 Finding you…";
      navigator.geolocation?.getCurrentPosition((pos) => {
        state.me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        b.setAttribute("aria-pressed", "true"); b.textContent = "📍 Nearest first";
        render();
        if (map) map.setView([state.me.lat, state.me.lng], 12);
      }, () => { b.textContent = "📍 Location unavailable"; });
      return;
    }
    for (const k of ["day", "kind", "area"]) {
      if (b.dataset[k] !== undefined) {
        state[k] = b.dataset[k];
        root.querySelectorAll(`[data-${k}]`).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset[k] === state[k])));
      }
    }
    if (byFac) render();
  });

  load(root.dataset.view, TODAY, addDays(TODAY, 7))
    .then((d) => { byFac = d; render(); })
    .catch(() => { summary.innerHTML = `<span>The live schedule didn't load. Each pool's page has its calendar.</span>`; });
})();
