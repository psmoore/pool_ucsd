#!/usr/bin/env python3
"""Build the UC San Diego Recreation Aquatics preview: Aquatics, Canyonview Aquatic Center, the Natatorium, Aquatic Classes,
Masters Swimming, and Clubs & Varsity, with every hour, class time, practice and home event read live from Pool Relay by
finder.js (#finder, #today, #week, data-live). Nothing about WHEN a pool is open is typed here; only prices, ages,
policies and facts about the water.
Run: python3 build.py"""
import hashlib, html, json

E = html.escape
V = {"canyonview": "cKyAVO7EZFuRYQSwQe1in4", "natatorium": "xT8SP4qsZAvolwR9xYrNIq"}  # Pool Relay share tokens
FEED = ",".join(V.values())
REC = "https://recreation.ucsd.edu/facilities/"
REG = "https://rec.ucsd.edu/Program?classificationId=bc16f05e-a9c6-4ea5-aa2d-1d9360855ed8"
POOLS = [
    dict(slug="canyonview", name="Canyonview Aquatic Center", short="Canyonview", facility="Canyonview Aquatic Center", area="La Jolla campus", kind="yearRound",
         address="3302 Voigt Dr, La Jolla, CA 92093", phone="(858) 534-5375", href="canyonview.html",
         blurb="Two outdoor, heated, Olympic-size pools across Voigt Drive from the Central Campus trolley stop: the Ronald “Sickie” Marcikic Pool "
               "and the Triton Pool. Lap swim, Masters, diving, club water polo, and the Tritons' home water."),
    dict(slug="natatorium", name="Main Gym Natatorium", short="Natatorium", facility="Main Gym Natatorium", area="La Jolla campus", kind="yearRound",
         address="2995 Scholars Ln, La Jolla, CA 92093", phone="(858) 822-4815", href="natatorium.html",
         blurb="An indoor 25-yard pool at the Main Gym complex, bright under glass walls and skylights. Recreation's adult and youth swim "
               "lessons and Swim Conditioning are here."),
]

def live(mode, pool, **kw):
    attrs = "".join(f' data-{k.replace("_", "-")}="{E(str(v))}"' for k, v in kw.items())
    return f'data-live="{mode}" data-view="{V[pool]}" data-pool="{pool}"{attrs}'

MENU = [("Facility Hours & Maps", None), ("Aquatics", "index.html"), ("Canyonview Aquatic Center", "canyonview.html"),
        ("Natatorium", "natatorium.html"), ("Aquatic Classes", "aquatic-classes.html"), ("Masters Swimming", "masters.html"),
        ("Clubs & Varsity", "clubs.html"), ("Memberships", None)]

VER = hashlib.sha1((open("finder.js").read() + open("style.css").read()).encode()).hexdigest()[:8]  # cache-busts both on change

def page(file, title, body, contact):
    menu = "".join(f'<a class="{"sub" if 1 < i < 7 else ""}{" here" if href == file else ""}" href="{href or "#"}">{E(label)}</a>'
                   for i, (label, href) in enumerate(MENU))
    doc = f"""<!doctype html>
<!-- UNOFFICIAL PREVIEW. Not a UC San Diego website. A mock-up of {REC}
     with the university's pools on one live Pool Relay schedule. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{E(title)} | UC San Diego Recreation preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Condensed:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css?v={VER}">
</head>
<body>
<div class="preview-note"><b>Unofficial preview.</b> Not a UC San Diego page &mdash; a mock-up of <a href="{REC}" target="_blank" rel="noopener noreferrer">Recreation's pool pages</a> with every pool on one live schedule.</div>
<header class="site"><div class="hdr">
  <a class="brand" href="index.html"><small>UC San Diego</small><span>Recreation</span></a>
  <div class="right"><div class="util"><span>Sign In</span><span>Current Occupancy</span><span>Contact</span></div>
    <nav aria-label="Main"><span>Memberships</span><span>Facilities</span><span>Classes &amp; Programs</span><span>Adventures</span><span>Competitive Sports</span></nav></div>
</div></header>
<div class="page">
  <aside class="side"><h2>Aquatics</h2><nav aria-label="Aquatics">{menu}</nav></aside>
  <main class="main"><h1>{E(title)}</h1>{body}</main>
  <aside class="contact"><h2>Contact</h2>{contact}</aside>
</div>
<footer class="site"><div class="in">
  <div><h4>UC San Diego Recreation</h4><p>9500 Gilman Drive, La Jolla, CA 92093<br>Customer Service (858) 534-3557<br>recreation@ucsd.edu</p></div>
  <div><h4>About this preview</h4><p>Built to demonstrate embedded <a href="https://www.poolrelay.com" target="_blank" rel="noopener">Pool Relay</a> schedules. Not operated by or affiliated with UC San Diego. Schedules entered from Recreation's facility, class, Masters and Sports Clubs pages and ucsdtritons.com on October 24, 2026; which pool and lanes each program uses is our estimate.</p></div>
</div></footer>
<script>window.POOLS = {json.dumps([{k: v for k, v in p.items() if k != "blurb"} for p in POOLS])};</script>
<script src="finder.js?v={VER}"></script>
</body>
</html>
"""
    open(file, "w").write(doc)

CONTACT = """<p><b>Canyonview Aquatic Center</b>3302 Voigt Drive<br>La Jolla, CA 92093<br>(858) 534-5375</p>
<p><b>Main Gym</b>2995 Scholars Lane<br>(858) 822-4815</p><p><b>Email</b>recreation@ucsd.edu</p>
<p><b>Parking</b>Lot P510 is nearest Canyonview; Scholars Parking Structure is nearest the Main Gym.</p>"""

# ── Aquatics ─────────────────────────────────────────────────────────────────
cards = "".join(f"""<div class="card"><h3><a href="{p['href']}">{E(p['name'])}</a></h3><p class="small muted">{E(p['address'])}</p>
  <p>{E(p['blurb'])}</p>
  <p class="small" {live("swims", p['slug'])}>…</p></div>""" for p in POOLS)
cards += """<div class="card"><h3><a href="https://www.mbaquaticcenter.com/" target="_blank" rel="noopener">Mission Bay Aquatic Center</a></h3>
  <p class="small muted">1001 Santa Clara Pl, San Diego, CA 92106 · (858) 488-1000</p>
  <p>Open water, not a pool: sailing, wakeboarding, waterskiing, surfing, stand-up paddling and kayaking on Mission Bay, run with
  Associated Students. Its classes book through mbaquaticcenter.com.</p></div>"""
page("index.html", "Aquatics", f"""
    <p class="lede">Recreation runs three pools on the La Jolla campus: the two 50-meter pools at Canyonview Aquatic Center and the indoor
      pool at the Main Gym Natatorium. Every time on these pages comes from the pools' live schedule, so when Recreation changes it, these pages change with it.</p>
    <h2 id="find">Where can I swim right now?</h2>
    <div id="finder" class="finder" data-view="{FEED}" data-all-label="Every pool"></div>
    <h2>The pools</h2>
    <div class="cards">{cards}</div>

    <h2>Who can swim</h2>
    <p>Lap swim and the spa at Canyonview are open to Recreation members, with a membership or day pass. Students' membership is included in
      registration fees. Classes and Masters have their own registration; see <a href="aquatic-classes.html">Aquatic Classes</a> and
      <a href="masters.html">Masters Swimming</a>.</p>

    <div class="replaces">
      <h2>What this replaces</h2>
      <ul>
        <li><b>"Natatorium Indoor Pool: CLOSED."</b> The Facility Hours page lists the Natatorium as closed, but four days a week it holds
          adult and youth swim lessons, Swim Conditioning and an intro diving class. Here the pool shows what is actually in the water.</li>
        <li><b>Class times one click at a time.</b> Each lesson time lives inside its own registration listing, and you have to open every offering to
          see its dates and pool. Here every class is on one calendar, by lane.</li>
        <li><b>"Canyonview Pool."</b> Registration sends divers to a "Canyonview Pool", while the facilities page names two pools, Marcikic and Triton.
          Here every booking names its pool.</li>
        <li><b>Lap swim that has to move.</b> Varsity games and meets in the Triton Pool, and club water polo in the evening, all take water
          during posted lap swim hours. Here lap swim shows which pool it's in on those days.</li>
        <li><b>Four websites for one pool deck.</b> Lap swim and Masters are on Recreation's hours page, classes on the registration site,
          club practices on each club's page, and home games on ucsdtritons.com. Here they are one schedule.</li>
      </ul>
    </div>
""", CONTACT)

# ── Canyonview ───────────────────────────────────────────────────────────────
cv = POOLS[0]
page("canyonview.html", "Canyonview Aquatic Center", f"""
    <p class="lede">{E(cv['blurb'])}</p>
    <div class="top2">
      <section class="now" aria-live="polite"><h2>Right now</h2>
        <div id="today" data-view="{V['canyonview']}" data-pool="canyonview"><p class="muted">Loading today’s schedule…</p></div></section>
      <aside class="hours"><h2>Lap swim &amp; spa</h2>
        <div {live("hours", "canyonview", format="dl", title="Lap Swim", whole=0)}><p class="muted">…</p></div>
        <p class="small" style="margin:0"><b>Masters workouts:</b> <span {live("when", "canyonview", title="Masters Swim Workout", gap=0)}>…</span></p>
        <div class="adjusted" {live("exceptions", "canyonview", title="Lap Swim")} hidden></div>
        <p class="small muted" style="margin:6px 0 0">Entry ends 30 minutes before closing.</p>
      </aside>
    </div>
    <h2>This week, pool by pool</h2>
    <div id="week" data-view="{V['canyonview']}" data-pool="canyonview" data-pools="Marcikic Pool|Triton Pool"><p class="muted">Loading the week…</p></div>
    <h2>Lane by lane</h2>
    <p class="small muted">Pick a day to see who is in each of Marcikic's 20 short-course lanes and the Triton Pool's 8 long-course lanes.</p>
    <div class="frame"><iframe src="https://www.poolrelay.com/embed/{V['canyonview']}" height="820" title="Canyonview Aquatic Center, lane by lane" loading="lazy"></iframe></div>
    <h2>The pools</h2>
    <div class="facts">
      <div><h3>Ronald “Sickie” Marcikic Pool</h3><ul><li>East side, the original pool, named in 2026 for Recreation's Masters director of 43 years</li>
        <li>20 lanes × 25 yards, 7-foot-wide lanes</li><li>Lanes 1–4: dive well, 15 feet deep, with two 1-meter springboards and two 3-meter platforms</li>
        <li>Lanes 19–20: family lanes, 3 feet deep</li><li>80–85°F · spa for 12 · north sun deck</li></ul></div>
      <div><h3>Triton Pool</h3><ul><li>West side, opened 2006, home to the Tritons' meets and games</li><li>50 meters × 25 yards: 8 long-course or 19 short-course lanes</li>
        <li>7 feet deep throughout · 680,000 gallons</li><li>Bleachers for 1,000 · deck lights for night use</li></ul></div>
    </div>
    <p class="small muted">Both pools have men's and women's locker rooms, showers and a weight room. Canyonview Fitness Gym is next door.</p>
""", f"""<p><b>Canyonview Aquatic Center</b>{E(cv['address'])}<br>{E(cv['phone'])}</p><p><b>Parking</b>Lot P510</p><p><b>Email</b>recreation@ucsd.edu</p>""")

# ── Natatorium ───────────────────────────────────────────────────────────────
nat = POOLS[1]
page("natatorium.html", "Natatorium", f"""
    <p class="lede">{E(nat['blurb'])} The Natatorium has no drop-in swim; it is booked for classes, and the Tritons hold some winter workouts here.</p>
    <div class="top2">
      <section class="now" aria-live="polite"><h2>Today</h2>
        <div id="today" data-view="{V['natatorium']}" data-pool="natatorium"><p class="muted">Loading today’s schedule…</p></div></section>
      <aside class="hours"><h2>In the pool</h2>
        <div {live("hours", "natatorium", format="dl")}><p class="muted">…</p></div>
        <p class="small muted" style="margin:0">First class to last. Class by class on <a href="aquatic-classes.html">Aquatic Classes</a>.</p>
      </aside>
    </div>
    <h2>This week</h2>
    <div id="week" data-view="{V['natatorium']}" data-pool="natatorium"><p class="muted">Loading the week…</p></div>
    <h2>Lane by lane</h2>
    <div class="frame"><iframe src="https://www.poolrelay.com/embed/{V['natatorium']}" height="720" title="Main Gym Natatorium, lane by lane" loading="lazy"></iframe></div>
    <h2>The pool</h2>
    <ul><li>Six lanes × 25 yards, 7-foot-wide lanes, 80–83°F</li><li>Glass walls and skylights; outdoor patio and spa (12 people) to the south</li>
      <li>One men's and one women's restroom; no showers</li><li>Six sets of four-row bleachers on deck</li>
      <li>Rentable for pool parties, inner-tube water polo and dive-in movies</li></ul>
""", f"""<p><b>Main Gym Natatorium</b>{E(nat['address'])}<br>{E(nat['phone'])}</p><p><b>Parking</b>Scholars Parking Structure</p><p><b>Email</b>recreation@ucsd.edu</p>""")

# ── Aquatic classes ──────────────────────────────────────────────────────────
CLASSES = [
    ("Adult Swim Lessons", None, [
        ("Level 1", "Floating, kicking and a first freestyle; must be comfortable in 3.5 feet of water", "Adult Swim Lessons - Level 1"),
        ("Level 2", "Building on Level 1", "Adult Swim Lessons - Level 2"),
        ("Level 3", "Stroke work", "Adult Swim Lessons - Level 3"),
        ("Level 4", "Stroke refinement", "Adult Swim Lessons - Level 4")],
     "Ages 16+. Free, thanks to a donor; listed at $0–$78. A REC or student membership is required. Each fall session meets twice a week for four or five weeks."),
    ("Youth Swim Lessons", None, [
        ("Shallow End / Beginner", "Ages 3–9", "Youth Swim Lessons - Shallow End/Beginner"),
        ("Middle / Intermediate", "Ages 5–11", "Youth Swim Lessons - Middle/Intermediate"),
        ("Deep End / Advanced", "Ages 6–14", "Youth Swim Lessons - Deep End/Advanced")],
     "25-minute classes (50 minutes for Deep End). Saturday mornings or Monday and Wednesday after school."),
    ("Swim Conditioning", "natatorium", [("Swim Conditioning", "Coached workouts for adults 16+", "Swim Conditioning")], "$5 drop-in to $70 for the quarter."),
    ("Springboard Diving", None, [
        ("Springboard Intro", "Adults 16+", "Springboard Diving Intro"),
        ("Youth Springboard Intro", "Ages 8–16", "Youth Springboard Diving Intro")], "$42–$53 adults, from $64 youth."),
]
def where_rows(rows):
    return "".join(f'<tr><th>{E(n)}<div class="small muted" style="font-weight:400">{E(a)}</div></th>'
                   f'<td class="when" data-live="when" data-view="{FEED}" data-pool="natatorium|canyonview" data-title="{E(t)}" data-gap="0">…</td></tr>'
                   for n, a, t in rows)
blocks = "".join(f"""<h2>{E(h)}</h2><div class="tblwrap"><table class="prog">{where_rows(rows)}</table></div><p class="small">{E(note)}</p>"""
                 for h, _, rows, note in CLASSES)
page("aquatic-classes.html", "Aquatic Classes", f"""
    <p class="lede">Swim lessons for adults and kids, Swim Conditioning and intro diving. Days and times below come from the live schedule;
      register on <a href="{REG}" target="_blank" rel="noopener">rec.ucsd.edu</a>.</p>
    <div class="policy">Registration opens by membership: UCSD students first, then REC members, then Session 2 offerings. Classes stay open until they fill or close.</div>
    {blocks}
    <p class="small muted">Lanes for each class are on the
      <a href="natatorium.html">Natatorium</a> and <a href="canyonview.html">Canyonview</a> calendars.</p>
""", CONTACT)

# ── Masters ──────────────────────────────────────────────────────────────────
page("masters.html", "Masters Swimming", f"""
    <p class="lede">Coached workouts for adult swimmers of every level in the Ronald “Sickie” Marcikic Pool at Canyonview, led for more than 43 years by
      Head Coach Ron “Sickie” Marcikic. Each workout is 90 minutes.</p>
    <div class="top2">
      <aside class="hours"><h2>Workouts</h2>
        <p style="margin:0" {live("when", "canyonview", title="Masters Swim Workout", gap=0)}>…</p>
        <div class="adjusted" {live("exceptions", "canyonview", title="Masters Swim Workout")} hidden></div>
        <p class="small muted" style="margin:6px 0 0">Weekend workouts can be cancelled for other aquatic events; when they are, this changes too.</p></aside>
      <section class="now"><h2>Contact</h2><p class="small" style="margin:0">Ron “Sickie” Marcikic, Masters Swim Director<br>(858) 534-8124 · sickie@ucsd.edu</p></section>
    </div>
    <h2>Pricing</h2>
    <table class="fees"><tr><th></th><th>Monthly</th><th>Quarterly</th><th>Annual</th></tr>
      <tr><td>Rec member</td><td>$40</td><td>$120</td><td>$480</td></tr>
      <tr><td>Staff, faculty, seniors</td><td>$50</td><td>$150</td><td>$600</td></tr>
      <tr><td>Community</td><td>$60</td><td>$180</td><td>$720</td></tr>
      <tr><td>Students</td><td>Free</td><td>Free</td><td>—</td></tr></table>
    <p class="small">Visitors: $15 a day or $50 a week.</p>
""", CONTACT)

# ── Clubs & varsity ──────────────────────────────────────────────────────────
CLUBS = "UC San Diego Recreation / Sports Clubs"
page("clubs.html", "Clubs & Varsity", f"""
    <p class="lede">Sports Clubs and the Tritons share Canyonview's water with lap swimmers. Practice times and home events below come from the
      same live schedule as the pool calendars.</p>
    <h2>Men's Club Water Polo</h2>
    <p>National champions in 2022, 2023 and 2024, with A, B and C teams in the Collegiate Water Polo Association's Southwest Division. Practices start after Labor Day.</p>
    <p class="small"><b>Practice:</b> <span {live("when", "canyonview", group=f"{CLUBS} / Men's Water Polo")}>…</span> · Instagram @ucsdmcwp</p>
    <h2>Women's Club Water Polo</h2>
    <p>An A team that finished 4th in the nation in 2025 and a B team for developing players. Drop in for a few practices to see if it's for you.</p>
    <p class="small"><b>Practice:</b> <span {live("when", "canyonview", group=f"{CLUBS} / Women's Water Polo")}>…</span> · Instagram @ucsdwomensclubpolo</p>
    <h2>Club Swim</h2>
    <p>More than 120 members, competing in College Club Swimming and at CCS Nationals every year since 2023 (17th in 2026). Five coached swim practices a week at Canyonview,
      plus two lifting sessions at Spanos Athletic Performance Center.</p>
    <p class="small muted">Club Swim hasn't published its practice times. When they are entered, they appear here and on the Canyonview calendar. ucsdclubswim@gmail.com</p>
    <h2>Triathlon</h2>
    <p>More than 70 athletes racing Sprint and Olympic distances in the West Coast Collegiate Triathlon Conference. ucsdtriathlon@gmail.com</p>

    <h2>Triton home events at Canyonview</h2>
    <div class="top2">
      <section class="now"><h2>Men's water polo</h2><div class="small" {live("dates", "canyonview", group="UC San Diego Athletics / Men's Water Polo", show_title="", strip="Men's Water Polo", empty="No more home games scheduled.")}>…</div></section>
      <section class="now"><h2>Swimming &amp; diving</h2><div class="small" {live("dates", "canyonview", group="UC San Diego Athletics / Swimming & Diving", show_title="", strip="Swimming & Diving", empty="No more home meets this quarter.")}>…</div></section>
    </div>
    <p class="small muted">Start times from ucsdtritons.com. During home events the Triton Pool is closed to lap swim; see <a href="canyonview.html">Canyonview</a> for where lap swim moves.</p>
""", CONTACT)
print("built 6 pages")
