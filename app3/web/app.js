const filteredMixin = {
  computed: {
    filtered() {
      return filterRecords(store.allRecords, store.filters);
    },
  },
};

const Overview = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Global Program Overview</h1>
      <p class="subtitle">Strategic snapshot for ISSUP leadership, funders, and technical partners.</p>
      <div class="tiles">
        <div class="tile">
          <div class="label">Total Screenings</div>
          <div class="value">{{ filtered.length.toLocaleString() }}</div>
        </div>
        <div class="tile">
          <div class="label">Countries Active</div>
          <div class="value">{{ countriesActive }}</div>
        </div>
        <div class="tile">
          <div class="label">High-Risk Screens</div>
          <div class="value">{{ highRiskCount.toLocaleString() }}</div>
        </div>
        <div class="tile">
          <div class="label">Active Practitioners (Platform Adoption)</div>
          <div class="value">{{ store.meta.activePractitioners }}</div>
        </div>
        <div class="tile">
          <div class="label">Completion Rate</div>
          <div class="value">{{ completionRate }}%</div>
        </div>
      </div>
      <export-bar :rows="[summaryRow]" filename="global-summary"></export-bar>

      <div class="grid-2" style="margin-top: 20px;">
        <div class="card">
          <div class="card-header">
            <h2>Screenings Over Time</h2>
            <export-bar :rows="trendRows" filename="screenings-over-time"></export-bar>
          </div>
          <chart-widget :data="trendData" type="line"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Overall Risk Distribution</h2>
            <export-bar :rows="riskRows" filename="risk-distribution"></export-bar>
          </div>
          <chart-widget :data="riskData" type="doughnut"></chart-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    store() { return store; },
    countriesActive() {
      return new Set(this.filtered.map((r) => r.country)).size;
    },
    highRiskCount() {
      return this.filtered.filter((r) => r.riskLevel === 'High').length;
    },
    completionRate() {
      return pct(this.filtered.filter((r) => r.completed).length, this.filtered.length);
    },
    summaryRow() {
      return {
        totalScreenings: this.filtered.length,
        countriesActive: this.countriesActive,
        highRiskScreens: this.highRiskCount,
        completionRate: this.completionRate,
      };
    },
    riskData() {
      return countBy(this.filtered, (r) => r.riskLevel);
    },
    riskRows() {
      return this.riskData.labels.map((l, i) => ({ 'Risk Level': l, Count: this.riskData.values[i] }));
    },
    trendData() {
      const total = new Array(12).fill(0);
      const completed = new Array(12).fill(0);
      this.filtered.forEach((r) => {
        const m = new Date(r.date + 'T00:00:00').getMonth();
        total[m]++;
        if (r.completed) completed[m]++;
      });
      return { labels: MONTHS, series: [{ name: 'Total', values: total }, { name: 'Completed', values: completed }] };
    },
    trendRows() {
      return this.trendData.labels.map((m, i) => ({
        Month: m,
        Total: this.trendData.series[0].values[i],
        Completed: this.trendData.series[1].values[i],
      }));
    },
  },
};

const GlobalMap = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Global Map</h1>
      <p class="subtitle">Screening density — province-level when scoped to South Africa, country-level otherwise.</p>
      <div class="card">
        <div class="card-header">
          <h2>Screening Density</h2>
          <export-bar :rows="locations" filename="screening-density"></export-bar>
        </div>
        <p class="card-note">Bubble size reflects screening volume. Coordinates are approximate centroids, for illustration.</p>
        <map-widget :locations="locations"></map-widget>
      </div>
    </div>
  `,
  computed: {
    locations() {
      return computeLocations(this.filtered, store.meta);
    },
  },
};

const SubstanceTrends = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Substance Trends</h1>
      <p class="subtitle">Monthly screening volume per substance across the year. Click a legend item to isolate it.</p>
      <div class="card">
        <div class="card-header">
          <h2>Substances Over Time</h2>
          <export-bar :rows="trendRows" filename="substance-trends"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget :data="trendData" type="line"></chart-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    trendData() {
      return monthlyMultiSeries(this.filtered, (r) => r.substance);
    },
    trendRows() {
      return this.trendData.labels.map((m, i) => {
        const row = { Month: m };
        this.trendData.series.forEach((s) => (row[s.name] = s.values[i]));
        return row;
      });
    },
  },
};

const Demographics = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Demographics</h1>
      <p class="subtitle">Age and gender breakdown of everyone screened.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Age Group</h2>
            <export-bar :rows="ageRows" filename="demographics-age"></export-bar>
          </div>
          <chart-widget :data="ageData" type="bar"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Gender</h2>
            <export-bar :rows="genderRows" filename="demographics-gender"></export-bar>
          </div>
          <chart-widget :data="genderData" type="doughnut"></chart-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    ageData() {
      return countBy(this.filtered, (r) => r.ageGroup);
    },
    ageRows() {
      return this.ageData.labels.map((l, i) => ({ 'Age Group': l, Count: this.ageData.values[i] }));
    },
    genderData() {
      return countBy(this.filtered, (r) => r.gender);
    },
    genderRows() {
      return this.genderData.labels.map((l, i) => ({ Gender: l, Count: this.genderData.values[i] }));
    },
  },
};

const Cohorts = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Cohort Analytics</h1>
      <p class="subtitle">Adolescents vs. adults vs. older adults, and the screening pathway from risk to suggested intervention.</p>
      <p class="card-note">Note: this screening tool's youngest bracket is 12-17, so there's no under-12 "children" cohort in the data.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Screenings by Cohort</h2>
            <export-bar :rows="totalsRows" filename="cohort-totals"></export-bar>
          </div>
          <chart-widget :data="totalsData" type="doughnut"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Risk Level by Cohort</h2>
            <export-bar :rows="byRiskRows" filename="cohort-risk"></export-bar>
          </div>
          <chart-widget :data="byRiskData" type="stackedBar"></chart-widget>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h2>Screening Pathway: Screen &rarr; Risk &rarr; Suggested Intervention</h2></div>
        <sankey-widget :graph="sankeyGraph"></sankey-widget>
      </div>
    </div>
  `,
  computed: {
    totalsData() {
      return countBy(this.filtered, (r) => r.cohort);
    },
    totalsRows() {
      return this.totalsData.labels.map((l, i) => ({ Cohort: l, Count: this.totalsData.values[i] }));
    },
    byRiskData() {
      const cohorts = ['Adolescents', 'Adults', 'Older Adults'];
      const levels = ['Low', 'Moderate', 'High'];
      const series = levels.map((lvl) => ({
        name: lvl,
        values: cohorts.map((c) => this.filtered.filter((r) => r.cohort === c && r.riskLevel === lvl).length),
      }));
      return { labels: cohorts, series };
    },
    byRiskRows() {
      return this.byRiskData.labels.map((l, i) => {
        const row = { Cohort: l };
        this.byRiskData.series.forEach((s) => (row[s.name] = s.values[i]));
        return row;
      });
    },
    sankeyGraph() {
      return buildSankeyGraph(this.filtered);
    },
  },
};

const RegionalConcerns = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Regional Concerns</h1>
      <p class="subtitle">Provinces flagged for a month-over-month increase of 8+ percentage points in high-risk screening share.</p>
      <p class="card-note">Read with caution on low-volume months — a handful of screenings can swing a percentage sharply. This flags where to look, not a confirmed trend.</p>
      <div class="card">
        <div class="card-header">
          <h2>Flagged Months</h2>
          <export-bar :rows="rows" filename="regional-concerns"></export-bar>
        </div>
        <p v-if="rows.length === 0" class="loading">No months currently meet the flagging threshold under the current filters.</p>
        <table v-else class="plain">
          <thead>
            <tr>
              <th>Province</th><th>Month</th><th>High-Risk % (this month)</th>
              <th>High-Risk % (prev month)</th><th>Change</th><th>Volume</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.province + row.month">
              <td>{{ row.province }}</td>
              <td>{{ row.month }}</td>
              <td>{{ row.highRiskPctThisMonth }}%</td>
              <td>{{ row.highRiskPctPrevMonth }}%</td>
              <td><span class="pill">+{{ row.deltaPoints }} pts</span></td>
              <td>{{ row.screeningVolume }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  computed: {
    rows() {
      const total = {};
      const high = {};
      this.filtered.forEach((rec) => {
        if (!rec.province) return;
        const m = new Date(rec.date + 'T00:00:00').getMonth();
        const key = rec.province + '|' + m;
        total[key] = (total[key] || 0) + 1;
        if (rec.riskLevel === 'High') high[key] = (high[key] || 0) + 1;
      });

      const provinceList = [...new Set(this.filtered.filter((r) => r.province).map((r) => r.province))];
      const out = [];
      provinceList.forEach((prov) => {
        for (let m = 1; m < 12; m++) {
          const thisKey = prov + '|' + m;
          const prevKey = prov + '|' + (m - 1);
          if (!total[thisKey] || !total[prevKey]) continue;
          const thisPct = pct(high[thisKey] || 0, total[thisKey]);
          const prevPct = pct(high[prevKey] || 0, total[prevKey]);
          const delta = Math.round((thisPct - prevPct) * 10) / 10;
          if (delta >= 8) {
            out.push({
              province: prov,
              month: MONTHS[m],
              highRiskPctThisMonth: thisPct,
              highRiskPctPrevMonth: prevPct,
              deltaPoints: delta,
              screeningVolume: total[thisKey],
            });
          }
        }
      });
      return out.sort((a, b) => b.deltaPoints - a.deltaPoints);
    },
  },
};

const Reports = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Reports</h1>
      <p class="subtitle">Monthly summary — export-ready table (sort, filter, and page below).</p>
      <div class="card">
        <div class="card-header">
          <h2>Monthly Summary</h2>
          <export-bar :rows="rows" filename="monthly-reports"></export-bar>
        </div>
        <grid-widget :rows="rows" :column-defs="columnDefs"></grid-widget>
      </div>
    </div>
  `,
  computed: {
    rows() {
      const totals = new Array(12).fill(0);
      const completed = new Array(12).fill(0);
      const minutesSum = new Array(12).fill(0);
      this.filtered.forEach((r) => {
        const m = new Date(r.date + 'T00:00:00').getMonth();
        totals[m]++;
        minutesSum[m] += r.minutes;
        if (r.completed) completed[m]++;
      });
      return MONTHS.map((m, i) => ({
        month: m,
        total: totals[i],
        completed: completed[i],
        completionRate: pct(completed[i], totals[i]),
        avgMinutes: totals[i] ? Math.round((minutesSum[i] / totals[i]) * 10) / 10 : 0,
      }));
    },
    columnDefs() {
      return [
        { field: 'month', headerName: 'Month', width: 100 },
        { field: 'total', headerName: 'Total Screenings', flex: 1 },
        { field: 'completed', headerName: 'Completed', flex: 1 },
        { field: 'completionRate', headerName: 'Completion Rate', flex: 1, valueFormatter: (p) => p.value + '%' },
        { field: 'avgMinutes', headerName: 'Avg. Minutes', flex: 1, valueFormatter: (p) => p.value + ' min' },
      ];
    },
  },
};

const Explorer = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Advanced Explorer</h1>
      <p class="subtitle">Row-level screening data under the current filters, including cohort, intervention, and practitioner.</p>
      <div class="card">
        <div class="card-header">
          <h2>All Records ({{ filtered.length.toLocaleString() }})</h2>
          <export-bar :rows="filtered" filename="advanced-explorer-data"></export-bar>
        </div>
        <grid-widget :rows="filtered" :column-defs="columnDefs" :page-size="25"></grid-widget>
      </div>
    </div>
  `,
  computed: {
    columnDefs() {
      return [
        { field: 'id', headerName: 'ID', width: 90 },
        { field: 'date', headerName: 'Date', width: 120 },
        { field: 'region', headerName: 'Region', flex: 1 },
        { field: 'country', headerName: 'Country', flex: 1 },
        { field: 'province', headerName: 'Province', flex: 1.1 },
        { field: 'cohort', headerName: 'Cohort', flex: 1 },
        { field: 'gender', headerName: 'Gender', flex: 1 },
        { field: 'substance', headerName: 'Substance', flex: 1.1 },
        { field: 'riskLevel', headerName: 'Risk', width: 100 },
        { field: 'intervention', headerName: 'Suggested Intervention', flex: 1.4 },
        { field: 'practitionerId', headerName: 'Practitioner', width: 120 },
        { field: 'completed', headerName: 'Completed', width: 110, valueFormatter: (p) => (p.value ? 'Yes' : 'No') },
      ];
    },
  },
};

const router = new VueRouter({
  mode: 'hash',
  routes: [
    { path: '/', component: Overview },
    { path: '/map', component: GlobalMap },
    { path: '/substance-trends', component: SubstanceTrends },
    { path: '/demographics', component: Demographics },
    { path: '/cohorts', component: Cohorts },
    { path: '/regional-concerns', component: RegionalConcerns },
    { path: '/reports', component: Reports },
    { path: '/explorer', component: Explorer },
  ],
});

new Vue({
  router,
  data() {
    return { store, filtersOpen: false };
  },
  computed: {
    countryOptions() {
      if (!store.meta) return [];
      if (store.filters.region) return store.meta.countriesByRegion[store.filters.region] || [];
      return Object.values(store.meta.countriesByRegion).flat();
    },
    provinceOptions() {
      if (!store.meta || !store.filters.country) return [];
      return store.meta.provincesByCountry[store.filters.country] || [];
    },
  },
  methods: {
    toggleSubstance(s) {
      const idx = store.filters.substances.indexOf(s);
      if (idx === -1) store.filters.substances.push(s);
      else store.filters.substances.splice(idx, 1);
    },
    clearFilters() {
      store.filters.region = '';
      store.filters.country = '';
      store.filters.province = '';
      store.filters.quarter = '';
      store.filters.month = '';
      store.filters.dateFrom = '';
      store.filters.dateTo = '';
      store.filters.substances = [];
    },
  },
  mounted() {
    loadData();
  },
}).$mount('#app');
