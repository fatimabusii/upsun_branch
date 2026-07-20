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

## Deploy

Push to the branch connected to your GitHub integration as usual:

```bash
git add .
git commit -m "Add app2 with slide-out menu, restructure into multi-app layout"
git push
```

Upsun will build and deploy both apps from the one `.upsun/config.yaml`.
