# Screening Insights Dashboard

Two design directions for the same substance-use screening dashboard,
built on the same Go + Vue 2 stack, sharing one backend data shape so the
client can compare them side by side on identical numbers.

## Layout

```
.
├── .upsun/config.yaml   # defines BOTH apps + subdomain routing
├── app1/                # "Clinical Navy" design — top nav
│   ├── go.mod
│   ├── main.go
│   ├── data.go          # synthetic dataset + /api/* endpoints
│   └── web/
│       ├── index.html
│       ├── charts.js    # Chart.js + ag-Grid Vue components (navy/teal palette)
│       └── app.js        # pages + router
└── app2/                # "Warm Editorial" design — hamburger + slide-out sidebar
    ├── go.mod
    ├── main.go
    ├── data.go          # identical dataset/API as app1
    └── web/
        ├── index.html
        ├── charts.js    # same components, coral/plum/teal palette
        └── app.js
```

## The data

`data.go` (identical in both apps) generates **1,400 synthetic screening
records** shaped exactly like the client's real schema: pathway,
assessment type, country/province, age group, gender, substance, risk
level, completion status, and time taken. It's seeded (deterministic), so
both apps always show the same numbers.

Once the client has a preferred design, swap `data.go`'s
`generateRecords()` for a real database query (e.g. via `database/sql`
and the actual `assessment_detail` / `involvement_summary` tables) —
none of the frontend code needs to change, since it just calls the same
`/api/*` endpoints.

### API endpoints (shared by both apps)

| Endpoint | Powers |
|---|---|
| `/api/summary` | Landing page KPI tiles |
| `/api/geography` | Geography page (province + country) |
| `/api/demographics` | Demographics page (age group, gender) |
| `/api/substances` | Substances page (volume + % high-risk) |
| `/api/risk` | Risk Profiles page (overall + by substance) |
| `/api/trends` | Trends page (monthly volume vs completions) |
| `/api/comparative` | Comparative Analytics (risk by pathway) |
| `/api/reports` | Reports page — monthly summary table (ag-Grid) |
| `/api/explorer` | Advanced Explorer — full row-level data (ag-Grid) |

## The two designs

- **App1 — Clinical Navy:** navy/teal palette, top navigation, white
  cards with a teal accent border. Corporate, clinical, minimal.
- **App2 — Warm Editorial:** cream background, coral/plum/teal palette,
  hamburger + slide-out sidebar, rounded tinted KPI tiles, Poppins
  headings. Softer, more editorial feel.

Both use the same charting approach: **Chart.js** (bar, line, doughnut,
stacked bar) and **ag-Grid Community** for the two data-table pages —
both loaded from CDN, both fully free, no build step required.

## Run locally

```bash
cd app1 && go run .   # http://localhost:8888
# or
cd app2 && go run .   # http://localhost:8888
```

## Exporting data

Every page has a **CSV / Excel / PDF** export bar next to each chart or
table title. All three formats are generated fully client-side, using
only free/open-source libraries — no paid ag-Grid Enterprise license
needed:

- **CSV & Excel** — [SheetJS](https://sheetjs.com) (Apache-2.0, free).
  Both formats are built from the same in-memory worksheet, so one code
  path covers both.
- **PDF** — [jsPDF](https://github.com/parzibyte/jsPDF) + AutoTable
  (MIT, free), rendered as a simple title + data table.
- Large exports (Advanced Explorer's 1,400 rows) are capped at 200 rows
  for the PDF specifically, to keep client-side generation fast — CSV
  and Excel always export the full dataset.

Note: ag-Grid Community's own Excel export is an **Enterprise-only**
feature requiring a paid license, so it's deliberately not used here —
SheetJS gives the same result for free.

## App3 — Global Strategic Dashboard

A third design, built specifically against the client's "Global Strategic
Dashboard" brief (highest-level oversight for ISSUP leadership, funders,
research partners, technical collaborators). Visual style: **Minimal
Mono** — white background, single indigo accent, IBM Plex Sans, borders
instead of shadows, persistent left-rail navigation (a third distinct nav
pattern, alongside app1's top nav and app2's slide-out sidebar).

New capabilities specific to this brief:

| Page | What it covers |
|---|---|
| Overview | KPI tiles incl. **Active Practitioners** (platform adoption), plus an adoption-over-time chart and overall risk distribution |
| Global Map | A Leaflet bubble map — screening density by South African province and by country (approximate centroids, illustrative) |
| Substance Trends | Monthly screening volume **per substance** over the year (multi-line, click legend to isolate a substance) |
| Demographics | Age group + gender, same as app1/app2 |
| Cohort Analytics | Adolescents / Adults / Older Adults rollup, risk-by-cohort, and a **Sankey diagram** (Screening → Risk Level → Suggested Intervention) |
| Regional Concerns | Provinces flagged for an 8+ percentage-point month-over-month jump in high-risk share — a simple, transparent anomaly heuristic |
| Reports / Advanced Explorer | Same as app1/app2, extended with cohort, intervention, and practitioner fields |

**New libraries used (all free/open-source, CDN-loaded, no build step):**
- **Leaflet** (BSD-2-Clause) for the map.
- **D3 + d3-sankey** (ISC/BSD) for the Sankey diagram.

**Known simplifications, worth flagging to the client:**
- The dataset's youngest bracket is 12-17, so there's no true "Children"
  (under-12) cohort — mapped to Adolescents / Adults / Older Adults instead.
- Map coordinates are approximate province/country centroids, not precise
  GIS boundaries — fine for a density overview, not for spatial analysis.
- Regional Concerns flags are a simple month-over-month threshold on
  synthetic (random) data — real signal will only emerge once this runs
  against actual data; the mechanism itself is real and reusable.
- "Suggested Intervention" is currently a direct 1:1 mapping from risk
  level (Low → Brief Advice, Moderate → Brief Intervention, High →
  Referral to Treatment), matching the real ASSIST tool's bands — swap
  this for the real intervention field once connected to actual data.

## A note on resources

Each app gets its own small container (0.5 CPU / 224MB by default going by
your earlier deploy logs). Three apps in one project uses 3x that. If
your Upsun plan has a resource ceiling, this may be worth checking before
deploying — Upsun will tell you plainly in the build log if a plan limit
is hit, and the fix is just requesting more resources or upgrading plan
tier, not a code change.

## Deploy

Push to the branch connected to your GitHub integration as usual:

```bash
git add .
git commit -m "Add app2 with slide-out menu, restructure into multi-app layout"
git push
```

Upsun will build and deploy both apps from the one `.upsun/config.yaml`.
