// ---------------------------------------------------------------------
// Central reactive store. Records are fetched once; every page filters
// this in-memory set reactively via computed properties. Fine at this
// dataset size — would need server-side filtering at real production
// scale with a much larger dataset.
// ---------------------------------------------------------------------
const store = Vue.observable({
  loading: true,
  allRecords: [],
  meta: null,

  filters: {
    region: '',
    country: '',
    province: '',
    quarter: '',
    month: '',
    dateFrom: '',
    dateTo: '',
    substances: [], // multi-select; [] = all
  },
});

function loadData() {
  return Promise.all([
    fetch('/api/records').then((r) => r.json()),
    fetch('/api/meta').then((r) => r.json()),
  ]).then(([records, meta]) => {
    store.allRecords = records;
    store.meta = meta;
    store.loading = false;
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_MONTHS = { Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11] };

function filterRecords(records, filters) {
  return records.filter((rec) => {
    if (filters.region && rec.region !== filters.region) return false;
    if (filters.country && rec.country !== filters.country) return false;
    if (filters.province && rec.province !== filters.province) return false;
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
  return { labels: MONTHS, series: names.map((n) => ({ name: n, values: groups[n] })) };
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

// Aggregates records into map-ready locations. Uses province centroids
// when the filtered set is entirely South Africa (the only country we
// have sub-national centroids for), otherwise aggregates by country.
function computeLocations(records, meta) {
  const useProvinces = records.length > 0 && records.every((r) => r.country === 'South Africa');
  if (useProvinces) {
    const { labels, values } = countBy(records.filter((r) => r.province), (r) => r.province);
    return labels.map((name, i) => ({ name, count: values[i], ...toLatLng(meta, name) })).filter((l) => l.lat !== undefined);
  }
  const { labels, values } = countBy(records, (r) => r.country);
  return labels.map((name, i) => ({ name, count: values[i], ...toLatLng(meta, name) })).filter((l) => l.lat !== undefined);
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
