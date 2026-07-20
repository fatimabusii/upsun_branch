# Multi-App Dashboard

Two independent Go + Vue 2 dashboards deployed from a single Upsun project,
each on its own subdomain.

## Layout

```
.
├── .upsun/config.yaml   # defines BOTH apps + routing, lives at repo root
├── app1/                # original dashboard: top nav bar
│   ├── go.mod
│   ├── main.go
│   └── web/index.html
└── app2/                # "Part 2": hamburger button + slide-out left menu
    ├── go.mod
    ├── main.go
    └── web/index.html
```

Each app is a self-contained Go static file server (no shared code), so
`app1` and `app2` can be built, changed, and deployed independently even
though they live in one repo and one Upsun project.

## Routing

- `https://{default}/` → `app1` (your original site, top nav bar)
- `https://app2.{default}/` → `app2` (new site, hamburger + slide-out menu)

`{default}` is whatever domain Upsun assigns your project (or your custom
domain, if you add one later). No extra DNS setup is needed for the
`app2.` subdomain — Upsun's routing handles it automatically under its
own domain.

## Run either app locally

```bash
cd app1 && go run main.go   # http://localhost:8888
# or
cd app2 && go run main.go   # http://localhost:8888
```

(Run one at a time locally unless you change the port for one of them.)

## Deploy

Push to the branch connected to your GitHub integration as usual:

```bash
git add .
git commit -m "Add app2 with slide-out menu, restructure into multi-app layout"
git push
```

Upsun will build and deploy both apps from the one `.upsun/config.yaml`.
