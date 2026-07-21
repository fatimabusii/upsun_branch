// ---------------------------------------------------------------------
// Central reactive store. All records are fetched once; every page
// filters/aggregates this in-memory set reactively via computed
// properties. Fine at this dataset size (thousands of rows) — would
// need server-side filtering at real production scale.
// ---------------------------------------------------------------------
// Named personas for the "Log in as" menu. Each bundles a tier with the
// scope that persona would realistically be locked to, so switching
// personas sets tier + country/region together in one click.
// NOTE: this is a demo convenience only — there is no real login and
// /api/records has no server-side auth. Anyone can still fetch the full
// dataset directly; this menu only changes what the UI chooses to show.
const PERSONAS = [
  { id: 'public', label: 'Public visitor', tier: 'public' },
  // Tier B (Country) and Tier C (Region) personas temporarily hidden —
  // the tier code paths work, but the visualizations don't yet fully
  // meet the docx brief for these tiers (missing cohort views at B/C,
  // early-warning indicators, regional benchmarking, etc.). Re-enable
  // once those gaps are closed.
  // { id: 'sa_moh', label: 'South Africa — Ministry of Health', tier: 'country', scopeCountry: 'South Africa' },
  // { id: 'kenya_moh', label: 'Kenya — Ministry of Health', tier: 'country', scopeCountry: 'Kenya' },
  // { id: 'au', label: 'African Union (regional)', tier: 'region', scopeRegion: 'Africa' },
  // { id: 'oas', label: 'Organization of American States (regional)', tier: 'region', scopeRegion: 'Americas' },
  { id: 'issup', label: 'ISSUP Leadership (global)', tier: 'global' },
  { id: 'scientific', label: 'Scientific Explorer (approved researcher)', tier: 'explorer' },
];

const store = Vue.observable({
  loading: true,
  allRecords: [],
  // For Public tier: pre-aggregated data from /api/summary. For all other
  // tiers this stays null and pages compute their own aggregates from
  // allRecords via filterRecords + countBy etc.
  summary: null,
  meta: null,

  personaId: 'public',

  // 'public' | 'country' | 'region' | 'global' | 'explorer' (Tier D-Plus)
  tier: 'public',
  scopeCountry: 'South Africa',
  scopeRegion: 'Africa',

  filters: {
    region: '',
    country: '',
    province: '',
    quarter: '', // '' | 'Q1'..'Q4'
    month: '', // '' | 'Jan'..'Dec'
    dateFrom: '',
    dateTo: '',
    ageGroup: '',
    gender: '',
    screeningMode: '',
    screeningVersion: '',
    substances: [], // multi-select; [] = all
    riskLevel: '',
  },
});

// Fetches meta once, plus either the summary or a scope-limited row
// set, depending on the current persona's tier. This is the real
// network-level data boundary:
//   Public → /api/summary (aggregated, no rows)
//   Country/Region → /api/records?scope_type=…&scope_value=… (rows within scope only)
//   Global/Explorer → /api/records (everything)
function loadData() {
  const persona = PERSONAS.find((p) => p.id === store.personaId) || PERSONAS[0];
  store.loading = true;

  const metaP = fetch('/api/meta').then((r) => r.json());

  if (persona.tier === 'public') {
    return Promise.all([metaP, fetch('/api/summary').then((r) => r.json())]).then(([meta, summary]) => {
      store.meta = meta;
      store.summary = summary;
      store.allRecords = [];
      store.loading = false;
    });
  }

  let url = '/api/records';
  if (persona.tier === 'country') {
    url += '?scope_type=country&scope_value=' + encodeURIComponent(persona.scopeCountry || store.scopeCountry);
  } else if (persona.tier === 'region') {
    url += '?scope_type=region&scope_value=' + encodeURIComponent(persona.scopeRegion || store.scopeRegion);
  }
  return Promise.all([metaP, fetch(url).then((r) => r.json())]).then(([meta, records]) => {
    store.meta = meta;
    store.allRecords = records;
    store.summary = null;
    store.loading = false;
  });
}

// "Logs in" as a named persona: sets tier + scope in one go, then
// re-applies the usual tier-based filter locking and re-fetches data
// from the correct endpoint for the new tier.
function loginAsPersona(personaId) {
  const persona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];
  store.personaId = persona.id;
  store.tier = persona.tier;
  if (persona.scopeCountry) store.scopeCountry = persona.scopeCountry;
  if (persona.scopeRegion) store.scopeRegion = persona.scopeRegion;
  applyTierScope();
  return loadData();
}

// Applies tier-based scope locking. Called whenever the tier or the
// scope country/region changes.
function applyTierScope() {
  if (store.tier === 'country') {
    store.filters.region = '';
    store.filters.country = store.scopeCountry;
  } else if (store.tier === 'region') {
    store.filters.region = store.scopeRegion;
    if (store.filters.country && !(store.meta.countriesByRegion[store.scopeRegion] || []).includes(store.filters.country)) {
      store.filters.country = '';
    }
  } else if (store.tier === 'public') {
    // Public tier: no country/province drill-down, broad only.
    store.filters.region = '';
    store.filters.country = '';
    store.filters.province = '';
  }
  // 'global' and 'explorer' leave filters as the user set them.
}

const QUARTER_MONTHS = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
};

// ---------------------------------------------------------------------
// Pure filtering/aggregation helpers (no Vue dependency; reactivity
// comes from being called inside a component's computed getter, which
// synchronously reads store.filters.* — Vue 2 tracks that fine).
// ---------------------------------------------------------------------
function filterRecords(records, filters) {
  return records.filter((rec) => {
    if (filters.region && rec.region !== filters.region) return false;
    if (filters.country && rec.country !== filters.country) return false;
    if (filters.province && rec.province !== filters.province) return false;
    if (filters.ageGroup && rec.ageGroup !== filters.ageGroup) return false;
    if (filters.gender && rec.gender !== filters.gender) return false;
    if (filters.screeningMode && rec.screeningMode !== filters.screeningMode) return false;
    if (filters.screeningVersion && rec.screeningVersion !== filters.screeningVersion) return false;
    if (filters.riskLevel && rec.riskLevel !== filters.riskLevel) return false;
    if (filters.substances && filters.substances.length && !filters.substances.includes(rec.substance)) return false;

    if (filters.dateFrom && rec.date < filters.dateFrom) return false;
    if (filters.dateTo && rec.date > filters.dateTo) return false;

    if (filters.month) {
      const m = new Date(rec.date + 'T00:00:00').getMonth();
      if (MONTHS[m] !== filters.month) return false;
    }
    if (filters.quarter) {
      const m = new Date(rec.date + 'T00:00:00').getMonth();
      if (!QUARTER_MONTHS[filters.quarter].includes(m)) return false;
    }
    return true;
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function countBy(records, keyFn) {
  const counts = {};
  records.forEach((rec) => {
    const k = keyFn(rec);
    counts[k] = (counts[k] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  return { labels, values: labels.map((l) => counts[l]) };
}

function monthlyMultiSeries(records, groupKeyFn) {
  const groups = {};
  records.forEach((rec) => {
    const g = groupKeyFn(rec);
    const m = new Date(rec.date + 'T00:00:00').getMonth();
    if (!groups[g]) groups[g] = new Array(12).fill(0);
    groups[g][m]++;
  });
  const names = Object.keys(groups).sort();
  return {
    labels: MONTHS,
    series: names.map((n) => ({ name: n, values: groups[n] })),
  };
}

function crossTab(records, rowKeyFn, colKeyFn) {
  const rowSet = new Set();
  const colSet = new Set();
  const cell = {};
  records.forEach((rec) => {
    const rk = rowKeyFn(rec);
    const ck = colKeyFn(rec);
    rowSet.add(rk);
    colSet.add(ck);
    const key = rk + '|||' + ck;
    cell[key] = (cell[key] || 0) + 1;
  });
  const rowLabels = Array.from(rowSet).sort();
  const colLabels = Array.from(colSet).sort();
  const matrix = rowLabels.map((rl) => colLabels.map((cl) => cell[rl + '|||' + cl] || 0));
  return { rowLabels, colLabels, matrix };
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

// ---------------------------------------------------------------------
// Source-agnostic view getters. Every page that's visible at Public
// tier calls these instead of computing directly, so it works whether
// the data came pre-aggregated from /api/summary (Public) or has to be
// computed from filtered rows (every other tier).
// ---------------------------------------------------------------------

function filteredOrEmpty() {
  return filterRecords(store.allRecords, store.filters);
}

function getKpis() {
  if (store.summary) return store.summary.kpis;
  const f = filteredOrEmpty();
  const subCounts = countBy(f, (r) => r.substance);
  const topIdx = subCounts.values.length ? subCounts.values.indexOf(Math.max(...subCounts.values)) : -1;
  return {
    totalScreenings: f.length,
    countriesActive: new Set(f.map((r) => r.country)).size,
    highRiskCount: f.filter((r) => r.riskLevel === 'High').length,
    topSubstance: topIdx >= 0 ? subCounts.labels[topIdx] : '—',
  };
}

function getRiskDistribution() {
  if (store.summary) return store.summary.riskDistribution;
  return countBy(filteredOrEmpty(), (r) => r.riskLevel);
}

function getSubstanceVolume() {
  if (store.summary) return store.summary.substanceVolume;
  return countBy(filteredOrEmpty(), (r) => r.substance);
}

function getSubstanceHighRiskPct() {
  if (store.summary) return store.summary.substanceHighRiskPct;
  const f = filteredOrEmpty();
  const vol = countBy(f, (r) => r.substance);
  const values = vol.labels.map((s) => {
    const sub = f.filter((r) => r.substance === s);
    return pct(sub.filter((r) => r.riskLevel === 'High').length, sub.length);
  });
  return { labels: vol.labels, values };
}

function getRiskBySubstance() {
  if (store.summary) return store.summary.riskBySubstance;
  const f = filteredOrEmpty();
  const substances = countBy(f, (r) => r.substance).labels;
  const levels = ['Low', 'Moderate', 'High'];
  return {
    labels: substances,
    series: levels.map((lvl) => ({
      name: lvl,
      values: substances.map((s) => f.filter((r) => r.substance === s && r.riskLevel === lvl).length),
    })),
  };
}

function getAgeGroup() {
  if (store.summary) return store.summary.ageGroup;
  return countBy(filteredOrEmpty(), (r) => r.ageGroup);
}

function getGender() {
  if (store.summary) return store.summary.gender;
  return countBy(filteredOrEmpty(), (r) => r.gender);
}

function getMonthlyTrend() {
  if (store.summary) return store.summary.monthlyTrend;
  const total = new Array(12).fill(0);
  const completed = new Array(12).fill(0);
  filteredOrEmpty().forEach((r) => {
    const m = new Date(r.date + 'T00:00:00').getMonth();
    total[m]++;
    if (r.completed) completed[m]++;
  });
  return { labels: MONTHS, series: [{ name: 'Total', values: total }, { name: 'Completed', values: completed }] };
}

function getMapLocations() {
  if (store.summary) return store.summary.mapLocations;
  return computeLocations(filteredOrEmpty(), store.meta);
}

function getFunnelStages() {
  if (store.summary) return store.summary.funnel;
  const f = filteredOrEmpty();
  const self = f.filter((r) => r.screeningMode === 'Self-Screen');
  const prac = f.filter((r) => r.screeningMode === 'Practitioner-Assisted');
  return {
    selfScreen: [
      { label: 'Started', value: self.length },
      { label: 'Completed', value: self.filter((r) => r.completed).length },
    ],
    practitioner: [
      { label: 'Started', value: prac.length },
      { label: 'Completed', value: prac.filter((r) => r.completed).length },
    ],
  };
}

function getNarrative() {
  if (store.summary) return store.summary.narrative;
  return generateNarrative(filteredOrEmpty());
}

function generateNarrative(records) {
  if (!records.length) return 'No screenings match the current filters.';
  const total = records.length;
  const highRisk = records.filter((r) => r.riskLevel === 'High').length;
  const highRiskPct = pct(highRisk, total);

  const subCounts = countBy(records, (r) => r.substance);
  const topIdx = subCounts.values.indexOf(Math.max(...subCounts.values));
  const topSubstance = subCounts.labels[topIdx];

  let adolescentLine = '';
  const adolescents = records.filter((r) => r.cohort === 'Adolescents');
  if (adolescents.length) {
    const adoCounts = countBy(adolescents, (r) => r.substance);
    const adoTopIdx = adoCounts.values.indexOf(Math.max(...adoCounts.values));
    adolescentLine = ` Among adolescents (12–17), ${adoCounts.labels[adoTopIdx]} was the most frequently screened substance.`;
  }

  return (
    `Within the current filters, ${total.toLocaleString()} screenings were recorded. ` +
    `${topSubstance} was the most commonly screened substance, and ${highRiskPct}% of screenings were classified high-risk.` +
    adolescentLine
  );
}

// Aggregates records into map-ready locations. Uses province-level
// centroids when the view is scoped to South Africa specifically
// (the only country we have sub-national centroids for), otherwise
// aggregates by country.
function computeLocations(records, meta) {
  const useProvinces = records.length > 0 && records.every((r) => r.country === 'South Africa');
  if (useProvinces) {
    const { labels, values } = countBy(
      records.filter((r) => r.province),
      (r) => r.province
    );
    return labels
      .map((name, i) => ({ name, count: values[i], ...toLatLng(meta, name) }))
      .filter((l) => l.lat !== undefined);
  }
  const { labels, values } = countBy(records, (r) => r.country);
  return labels
    .map((name, i) => ({ name, count: values[i], ...toLatLng(meta, name) }))
    .filter((l) => l.lat !== undefined);
}

function toLatLng(meta, name) {
  const c = meta.geoCentroids[name];
  if (!c) return {};
  return { lat: c[0], lng: c[1] };
}

function buildSankeyGraph(records) {
  const riskLevelsOrder = ['Low', 'Moderate', 'High'];
  const interventionsOrder = ['Brief Advice', 'Brief Intervention', 'Referral to Treatment'];

  const nodes = [{ name: 'All Screenings' }];
  const nodeIndex = { 'All Screenings': 0 };
  riskLevelsOrder.forEach((lvl) => {
    nodeIndex[lvl] = nodes.length;
    nodes.push({ name: lvl });
  });
  interventionsOrder.forEach((iv) => {
    nodeIndex[iv] = nodes.length;
    nodes.push({ name: iv });
  });

  const riskCounts = {};
  const flowCounts = {};
  records.forEach((rec) => {
    riskCounts[rec.riskLevel] = (riskCounts[rec.riskLevel] || 0) + 1;
    const key = rec.riskLevel + '|||' + rec.intervention;
    flowCounts[key] = (flowCounts[key] || 0) + 1;
  });

  const links = [];
  riskLevelsOrder.forEach((lvl) => {
    if (riskCounts[lvl]) links.push({ source: 0, target: nodeIndex[lvl], value: riskCounts[lvl] });
  });
  riskLevelsOrder.forEach((lvl) => {
    interventionsOrder.forEach((iv) => {
      const v = flowCounts[lvl + '|||' + iv];
      if (v) links.push({ source: nodeIndex[lvl], target: nodeIndex[iv], value: v });
    });
  });

  return { nodes, links };
}