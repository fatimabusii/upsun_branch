# Simple Dashboard

A minimal Go + Vue 2 dashboard: a landing page, a top nav bar, an Overview
page, and Page 1 through Page 5. No build step, no database, no npm —
Vue 2 and Vue Router are loaded from a CDN in `web/index.html`, and a tiny
Go server just serves that static file.

## Project layout

```
.
├── .upsun/config.yaml   # Upsun deployment config
├── go.mod
├── main.go              # static file server
└── web/
    └── index.html       # Vue 2 app: nav bar + pages
```

## Run locally

```bash
go run main.go
```

Then open http://localhost:8888

## Deploy to Upsun

1. Create a new Upsun project (the free plan is enough for this app).
2. From this directory:
   ```bash
   git init
   git add .
   git commit -m "Initial dashboard"
   upsun project:set-remote <PROJECT_ID>
   upsun push
   ```
3. Once the push finishes, open the URL Upsun gives you.

## Adding a real page later

Each page is currently a one-line Vue component defined in
`web/index.html` (see the `makePage` helper and the `routes` array).
To add real content, replace a page's template string, or split pages
into separate `.vue`-style components once you outgrow the single-file
setup.
