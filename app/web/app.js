const filteredMixin = {
  computed: {
    filtered() {
      return filterRecords(store.allRecords, store.filters);
    },
  },
};

const Overview = {
  template: `
    <div>
      <h1>Program Overview</h1>
      <p class="subtitle">High-level snapshot, scoped to your current tier and filters.</p>
      <div class="tiles">
        <div class="tile">
          <div class="label">Total Screenings</div>
          <div class="value">{{ kpis.totalScreenings.toLocaleString() }}</div>
        </div>
        <div class="tile">
          <div class="label">Countries Active</div>
          <div class="value">{{ kpis.countriesActive }}</div>
        </div>
        <div class="tile">
          <div class="label">High-Risk Screens</div>
          <div class="value">{{ kpis.highRiskCount.toLocaleString() }}</div>
        </div>
        <div class="tile">
          <div class="label">Most Screened Substance</div>
          <div class="value" style="font-size: 18px;">{{ kpis.topSubstance }}</div>
        </div>
        <div class="tile">
          <div class="label">Automated Narrative Summary</div>
          <div class="narrative" style="margin-top: 8px;">{{ narrative }}</div>
        </div>
      </div>
      <export-bar :rows="[summaryRow]" filename="overview-summary"></export-bar>

      <div class="grid-2" style="margin-top: 18px;">
        <div class="card">
          <div class="card-header">
            <h2>Completion Trend</h2>
            <export-bar :rows="trendRows" filename="completion-trend"></export-bar>
          </div>
          <chart-widget :data="trendData" type="line"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Risk Distribution</h2>
            <export-bar :rows="riskRows" filename="risk-distribution"></export-bar>
          </div>
          <chart-widget :data="riskData" type="doughnut"></chart-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    kpis() { return getKpis(); },
    narrative() { return getNarrative(); },
    summaryRow() {
      return {
        totalScreenings: this.kpis.totalScreenings,
        countriesActive: this.kpis.countriesActive,
        highRiskScreens: this.kpis.highRiskCount,
        topSubstance: this.kpis.topSubstance,
      };
    },
    riskData() { return getRiskDistribution(); },
    riskRows() {
      return this.riskData.labels.map((l, i) => ({ 'Risk Level': l, Count: this.riskData.values[i] }));
    },
    trendData() { return getMonthlyTrend(); },
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
    locations() { return getMapLocations(); },
  },
};

const Demographics = {
  template: `
    <div>
      <h1>Demographics</h1>
      <p class="subtitle">Age and gender breakdown of everyone screened, under the current filters.</p>
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
    ageData() { return getAgeGroup(); },
    ageRows() {
      return this.ageData.labels.map((l, i) => ({ 'Age Group': l, Count: this.ageData.values[i] }));
    },
    genderData() { return getGender(); },
    genderRows() {
      return this.genderData.labels.map((l, i) => ({ Gender: l, Count: this.genderData.values[i] }));
    },
  },
};

const Substances = {
  template: `
    <div>
      <h1>Substances</h1>
      <p class="subtitle">{{ isPublic ? 'Screening volume per substance.' : 'Screening volume per substance, and how often each results in a high-risk score.' }}</p>
      <div :class="{ 'grid-2': !isPublic }">
        <div class="card">
          <div class="card-header">
            <h2>Screenings by Substance</h2>
            <export-bar :rows="volumeRows" filename="substances-volume"></export-bar>
          </div>
          <chart-widget :data="volumeData" type="bar"></chart-widget>
        </div>
        <div class="card" v-if="!isPublic">
          <div class="card-header">
            <h2>% Scored High-Risk</h2>
            <export-bar :rows="riskPctRows" filename="substances-high-risk-pct"></export-bar>
          </div>
          <chart-widget :data="riskPctData" type="bar" horizontal></chart-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    isPublic() { return store.tier === 'public'; },
    volumeData() { return getSubstanceVolume(); },
    volumeRows() {
      return this.volumeData.labels.map((l, i) => ({ Substance: l, Count: this.volumeData.values[i] }));
    },
    riskPctData() { return getSubstanceHighRiskPct(); },
    riskPctRows() {
      return this.riskPctData.labels.map((l, i) => ({ Substance: l, '% High Risk': this.riskPctData.values[i] }));
    },
  },
};

const RiskProfiles = {
  template: `
    <div>
      <h1>Risk Profiles</h1>
      <p class="subtitle">{{ isPublic ? 'Overall risk level distribution.' : 'Risk levels overall, and broken down by substance.' }}</p>
      <div class="card">
        <div class="card-header">
          <h2>Overall Risk Levels</h2>
          <export-bar :rows="overallRows" filename="risk-overall"></export-bar>
        </div>
        <chart-widget :data="overallData" type="doughnut"></chart-widget>
      </div>
      <div class="card" v-if="!isPublic">
        <div class="card-header">
          <h2>Risk Level by Substance</h2>
          <export-bar :rows="bySubstanceRows" filename="risk-by-substance"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget :data="bySubstanceData" type="stackedBar"></chart-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    isPublic() { return store.tier === 'public'; },
    overallData() { return getRiskDistribution(); },
    overallRows() {
      return this.overallData.labels.map((l, i) => ({ 'Risk Level': l, Count: this.overallData.values[i] }));
    },
    bySubstanceData() { return getRiskBySubstance(); },
    bySubstanceRows() {
      return this.bySubstanceData.labels.map((l, i) => {
        const row = { Substance: l };
        this.bySubstanceData.series.forEach((s) => (row[s.name] = s.values[i]));
        return row;
      });
    },
  },
};

const Trends = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Trends</h1>
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

const Comparative = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Comparative Analytics</h1>
      <p class="subtitle">Rank {{ dimensionLabel.toLowerCase() }}s by volume, completion rate, and high-risk share.</p>
      <div class="card">
        <div class="card-header">
          <h2>Compare by</h2>
          <select v-model="dimension" style="font-family: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px;">
            <option v-for="d in availableDimensions" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <div class="card-header">
          <export-bar :rows="rows" filename="comparative-league-table"></export-bar>
        </div>
        <table class="plain">
          <thead>
            <tr><th>{{ dimensionLabel }}</th><th>Volume</th><th>Completion Rate</th><th>High-Risk %</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row[dimensionLabel]">
              <td>{{ row[dimensionLabel] }}</td>
              <td>{{ row.Volume }}</td>
              <td>{{ row['Completion Rate'] }}%</td>
              <td><span class="pill">{{ row['High-Risk %'] }}%</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  data() {
    return { dimension: 'Country' };
  },
  computed: {
    availableDimensions() {
      if (store.tier === 'country') return ['Province'];
      if (store.tier === 'region') return ['Country'];
      return ['Region', 'Country'];
    },
    dimensionLabel() {
      return this.availableDimensions.includes(this.dimension) ? this.dimension : this.availableDimensions[0];
    },
    rows() {
      const keyFn = {
        Region: (r) => r.region,
        Country: (r) => r.country,
        Province: (r) => r.province,
      }[this.dimensionLabel];
      const groups = {};
      this.filtered.forEach((r) => {
        const k = keyFn(r);
        if (!k) return;
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
      });
      return Object.keys(groups)
        .map((k) => {
          const recs = groups[k];
          const completed = recs.filter((r) => r.completed).length;
          const high = recs.filter((r) => r.riskLevel === 'High').length;
          return {
            [this.dimensionLabel]: k,
            Volume: recs.length,
            'Completion Rate': pct(completed, recs.length),
            'High-Risk %': pct(high, recs.length),
          };
        })
        .sort((a, b) => b.Volume - a.Volume);
    },
  },
};

const Funnel = {
  template: `
    <div>
      <h1>Screening Funnel</h1>
      <p class="subtitle">Started vs. completed, split by self-screen and practitioner-assisted pathways.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h2>Self-Screen</h2></div>
          <funnel-widget :stages="selfStages"></funnel-widget>
        </div>
        <div class="card">
          <div class="card-header"><h2>Practitioner-Assisted</h2></div>
          <funnel-widget :stages="practitionerStages"></funnel-widget>
        </div>
      </div>
    </div>
  `,
  computed: {
    stages() { return getFunnelStages(); },
    selfStages() { return this.stages.selfScreen; },
    practitionerStages() { return this.stages.practitioner; },
  },
};

const Cohorts = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Cohort Analytics</h1>
      <p class="subtitle">Adolescents vs. adults vs. older adults, and the screening pathway from risk to suggested intervention.</p>
      <p class="card-note">Note: this tool's youngest bracket is 12-17, so there's no under-12 "children" cohort in the data.</p>
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
      <p class="subtitle">Row-level screening data under your current filters. Sort, filter, and page through every record.</p>
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
        { field: 'screeningMode', headerName: 'Mode', flex: 1.2 },
        { field: 'substance', headerName: 'Substance', flex: 1.1 },
        { field: 'riskLevel', headerName: 'Risk', width: 100 },
        { field: 'intervention', headerName: 'Suggested Intervention', flex: 1.4 },
        { field: 'practitionerId', headerName: 'Practitioner', width: 120 },
        { field: 'completed', headerName: 'Completed', width: 110, valueFormatter: (p) => (p.value ? 'Yes' : 'No') },
      ];
    },
  },
};

const QueryBuilder = {
  mixins: [filteredMixin],
  template: `
    <div>
      <h1>Scientific Explorer — Query Builder</h1>
      <p class="subtitle">Build a custom cross-tabulation from the current filtered dataset.</p>
      <div class="card">
        <div class="card-header">
          <h2>Query</h2>
        </div>
        <div style="display:flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
          <div>
            <label style="font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;">Rows</label><br>
            <select v-model="rowDim" style="margin-top:4px;font-family:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;">
              <option v-for="d in dimensions" :key="d">{{ d }}</option>
            </select>
          </div>
          <div>
            <label style="font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;">Columns</label><br>
            <select v-model="colDim" style="margin-top:4px;font-family:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;">
              <option v-for="d in dimensions" :key="d">{{ d }}</option>
            </select>
          </div>
        </div>
        <div class="card-header">
          <h2>Results ({{ filtered.length.toLocaleString() }} records)</h2>
          <export-bar :rows="exportRows" filename="scientific-explorer-crosstab"></export-bar>
        </div>
        <grid-widget :rows="exportRows" :column-defs="columnDefs"></grid-widget>
      </div>
    </div>
  `,
  data() {
    return {
      rowDim: 'Substance',
      colDim: 'Risk Level',
      dimensionKeyFns: {
        Country: (r) => r.country,
        Province: (r) => r.province || 'N/A',
        Region: (r) => r.region,
        'Age Group': (r) => r.ageGroup,
        Gender: (r) => r.gender,
        Substance: (r) => r.substance,
        'Risk Level': (r) => r.riskLevel,
        'Screening Mode': (r) => r.screeningMode,
        Cohort: (r) => r.cohort,
      },
    };
  },
  computed: {
    dimensions() {
      return Object.keys(this.dimensionKeyFns);
    },
    table() {
      return crossTab(this.filtered, this.dimensionKeyFns[this.rowDim], this.dimensionKeyFns[this.colDim]);
    },
    exportRows() {
      return this.table.rowLabels.map((rl, i) => {
        const row = { [this.rowDim]: rl };
        this.table.colLabels.forEach((cl, j) => {
          row[cl] = this.table.matrix[i][j];
        });
        return row;
      });
    },
    columnDefs() {
      const cols = [{ field: this.rowDim, headerName: this.rowDim, pinned: 'left', flex: 1.2 }];
      this.table.colLabels.forEach((cl) => {
        cols.push({ field: cl, headerName: cl, flex: 1 });
      });
      return cols;
    },
  },
};

const router = new VueRouter({
  mode: 'hash',
  routes: [
    { path: '/', component: Overview },
    { path: '/map', component: GlobalMap },
    { path: '/demographics', component: Demographics },
    { path: '/substances', component: Substances },
    { path: '/risk', component: RiskProfiles },
    { path: '/trends', component: Trends },
    { path: '/comparative', component: Comparative },
    { path: '/funnel', component: Funnel },
    { path: '/cohorts', component: Cohorts },
    { path: '/reports', component: Reports },
    { path: '/explorer', component: Explorer },
    { path: '/query-builder', component: QueryBuilder },
  ],
});

new Vue({
  router,
  data() {
    return { store, filtersOpen: false };
  },
  computed: {
    personas() {
      return PERSONAS;
    },
    currentPersona() {
      return PERSONAS.find((p) => p.id === store.personaId) || PERSONAS[0];
    },
    tierBadge() {
      return (
        {
          public: 'Tier A — Public',
          country: 'Tier B — Country',
          region: 'Tier C — Region',
          global: 'Tier D — Global',
          explorer: 'Tier D+ — Scientific Explorer',
        }[store.tier] || ''
      );
    },
    allCountries() {
      if (!store.meta) return [];
      return Object.values(store.meta.countriesByRegion).flat();
    },
    countryOptions() {
      if (!store.meta) return [];
      if (store.filters.region) return store.meta.countriesByRegion[store.filters.region] || [];
      return this.allCountries;
    },
    provinceOptions() {
      if (!store.meta || !store.filters.country) return [];
      return store.meta.provincesByCountry[store.filters.country] || [];
    },
    showGeography() {
      return true;
    },
    showTrends() {
      return store.tier !== 'public';
    },
    showComparative() {
      return store.tier !== 'public';
    },
    showFunnel() {
      return true;
    },
    showCohorts() {
      return store.tier === 'global' || store.tier === 'explorer';
    },
    showReports() {
      return store.tier !== 'public';
    },
    showExplorer() {
      return store.tier === 'explorer';
    },
    showQueryBuilder() {
      return store.tier === 'explorer';
    },
  },
  methods: {
    onTierChange() {
      applyTierScope();
    },
    onPersonaChange(personaId) {
      loginAsPersona(personaId);
    },
    toggleSubstance(s) {
      const idx = store.filters.substances.indexOf(s);
      if (idx === -1) store.filters.substances.push(s);
      else store.filters.substances.splice(idx, 1);
    },
    clearFilters() {
      store.filters.province = '';
      store.filters.quarter = '';
      store.filters.month = '';
      store.filters.dateFrom = '';
      store.filters.dateTo = '';
      store.filters.ageGroup = '';
      store.filters.gender = '';
      store.filters.screeningMode = '';
      store.filters.screeningVersion = '';
      store.filters.substances = [];
      store.filters.riskLevel = '';
      if (store.tier === 'global' || store.tier === 'explorer') {
        store.filters.region = '';
        store.filters.country = '';
      } else {
        applyTierScope();
      }
    },
  },
  mounted() {
    loginAsPersona(store.personaId);
  },
}).$mount('#app');