const Overview = {
  template: `
    <div>
      <h1>Global Program Overview</h1>
      <p class="subtitle">Strategic snapshot for ISSUP leadership, funders, and technical partners.</p>
      <p v-if="loading" class="loading">Loading summary…</p>
      <div v-else class="tiles">
        <div class="tile">
          <div class="label">Total Screenings</div>
          <div class="value">{{ summary.totalScreenings.toLocaleString() }}</div>
        </div>
        <div class="tile">
          <div class="label">Countries Active</div>
          <div class="value">{{ summary.countriesActive }}</div>
        </div>
        <div class="tile">
          <div class="label">High-Risk Screens</div>
          <div class="value">{{ summary.highRiskScreens.toLocaleString() }}</div>
        </div>
        <div class="tile">
          <div class="label">Active Practitioners (Platform Adoption)</div>
          <div class="value">{{ summary.activePractitioners }}</div>
        </div>
        <div class="tile">
          <div class="label">Completion Trend ({{ summary.completionRate }}% overall)</div>
          <div style="height: 90px; margin-top: 8px; overflow: hidden;">
            <chart-widget endpoint="/api/adoption" path="months" type="line" compact></chart-widget>
          </div>
        </div>
      </div>
      <export-bar endpoint="/api/summary" shape="object" filename="global-summary"></export-bar>

      <div class="grid-2" style="margin-top: 20px;">
        <div class="card">
          <div class="card-header">
            <h2>Platform Adoption Over Time</h2>
            <export-bar endpoint="/api/adoption" path="months" shape="multiSeries"
              label-key="Month" filename="platform-adoption"></export-bar>
          </div>
          <chart-widget endpoint="/api/adoption" path="months" type="line"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Overall Risk Distribution</h2>
            <export-bar endpoint="/api/risk" path="overall" shape="series"
              label-key="Risk Level" value-key="Count" filename="risk-distribution"></export-bar>
          </div>
          <chart-widget endpoint="/api/risk" path="overall" type="doughnut"></chart-widget>
        </div>
      </div>
    </div>
  `,
  data() {
    return { loading: true, summary: null };
  },
  mounted() {
    fetch('/api/summary').then((r) => r.json()).then((data) => {
      this.summary = data;
      this.loading = false;
    });
  },
};

const GlobalMap = {
  template: `
    <div>
      <h1>Global Map</h1>
      <p class="subtitle">Screening density by province (South Africa) and by country.</p>
      <div class="card">
        <div class="card-header">
          <h2>Screening Density</h2>
          <export-bar endpoint="/api/geography" path="locations" shape="rows" filename="screening-density"></export-bar>
        </div>
        <p class="card-note">Bubble size reflects screening volume. Coordinates are approximate province/country centroids, for illustration.</p>
        <map-widget endpoint="/api/geography" path="locations"></map-widget>
      </div>
    </div>
  `,
};

const SubstanceTrends = {
  template: `
    <div>
      <h1>Substance Trends</h1>
      <p class="subtitle">Monthly screening volume per substance across the year. Click a legend item to isolate it.</p>
      <div class="card">
        <div class="card-header">
          <h2>Substances Over Time</h2>
          <export-bar endpoint="/api/substance-trends" path="months" shape="multiSeries"
            label-key="Month" filename="substance-trends"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget endpoint="/api/substance-trends" path="months" type="line"></chart-widget>
        </div>
      </div>
    </div>
  `,
};

const Demographics = {
  template: `
    <div>
      <h1>Demographics</h1>
      <p class="subtitle">Age and gender breakdown of everyone screened.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Age Group</h2>
            <export-bar endpoint="/api/demographics" path="ageGroups" shape="series"
              label-key="Age Group" value-key="Count" filename="demographics-age"></export-bar>
          </div>
          <chart-widget endpoint="/api/demographics" path="ageGroups" type="bar"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Gender</h2>
            <export-bar endpoint="/api/demographics" path="genders" shape="series"
              label-key="Gender" value-key="Count" filename="demographics-gender"></export-bar>
          </div>
          <chart-widget endpoint="/api/demographics" path="genders" type="doughnut"></chart-widget>
        </div>
      </div>
    </div>
  `,
};

const Cohorts = {
  template: `
    <div>
      <h1>Cohort Analytics</h1>
      <p class="subtitle">Adolescents vs. adults vs. older adults, and the screening pathway from risk to suggested intervention.</p>
      <p class="card-note">Note: this screening tool's youngest bracket is 12-17, so there's no under-12 "children" cohort in the data — the closest honest mapping is Adolescents / Adults / Older Adults.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Screenings by Cohort</h2>
            <export-bar endpoint="/api/cohorts" path="totals" shape="series"
              label-key="Cohort" value-key="Count" filename="cohort-totals"></export-bar>
          </div>
          <chart-widget endpoint="/api/cohorts" path="totals" type="doughnut"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Risk Level by Cohort</h2>
            <export-bar endpoint="/api/cohorts" path="byRisk" shape="multiSeries"
              label-key="Cohort" filename="cohort-risk"></export-bar>
          </div>
          <chart-widget endpoint="/api/cohorts" path="byRisk" type="stackedBar"></chart-widget>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h2>Screening Pathway: Screen &rarr; Risk &rarr; Suggested Intervention</h2>
          <export-bar endpoint="/api/sankey" shape="rows" path="links" filename="screening-pathway"></export-bar>
        </div>
        <sankey-widget endpoint="/api/sankey"></sankey-widget>
      </div>
    </div>
  `,
};

const RegionalConcerns = {
  template: `
    <div>
      <h1>Regional Concerns</h1>
      <p class="subtitle">Provinces flagged for a month-over-month increase of 8+ percentage points in high-risk screening share.</p>
      <p class="card-note">Read with caution on low-volume months — a handful of screenings can swing a percentage sharply. This flags where to look, not a confirmed trend.</p>
      <div class="card">
        <div class="card-header">
          <h2>Flagged Months</h2>
          <export-bar endpoint="/api/regional-concerns" shape="rows" filename="regional-concerns"></export-bar>
        </div>
        <p v-if="loading" class="loading">Loading…</p>
        <p v-else-if="rows.length === 0" class="loading">No months currently meet the flagging threshold.</p>
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
  data() {
    return { loading: true, rows: [] };
  },
  mounted() {
    fetch('/api/regional-concerns').then((r) => r.json()).then((data) => {
      this.rows = data;
      this.loading = false;
    });
  },
};

const Reports = {
  template: `
    <div>
      <h1>Reports</h1>
      <p class="subtitle">Monthly summary — export-ready table (sort, filter, and page below).</p>
      <div class="card">
        <div class="card-header">
          <h2>Monthly Summary</h2>
          <export-bar endpoint="/api/reports" shape="rows" filename="monthly-reports"></export-bar>
        </div>
        <grid-widget endpoint="/api/reports" :column-defs="columnDefs"></grid-widget>
      </div>
    </div>
  `,
  data() {
    return {
      columnDefs: [
        { field: 'month', headerName: 'Month', width: 100 },
        { field: 'total', headerName: 'Total Screenings', flex: 1 },
        { field: 'completed', headerName: 'Completed', flex: 1 },
        { field: 'completionRate', headerName: 'Completion Rate', flex: 1, valueFormatter: (p) => p.value + '%' },
        { field: 'avgMinutes', headerName: 'Avg. Minutes', flex: 1, valueFormatter: (p) => p.value + ' min' },
      ],
    };
  },
};

const Explorer = {
  template: `
    <div>
      <h1>Advanced Explorer</h1>
      <p class="subtitle">Row-level screening data, including cohort, intervention, and practitioner. Sort, filter, and page through every record.</p>
      <div class="card">
        <div class="card-header">
          <h2>All Records</h2>
          <export-bar endpoint="/api/explorer" shape="rows" filename="advanced-explorer-data"></export-bar>
        </div>
        <grid-widget endpoint="/api/explorer" :column-defs="columnDefs" :page-size="25"></grid-widget>
      </div>
    </div>
  `,
  data() {
    return {
      columnDefs: [
        { field: 'id', headerName: 'ID', width: 90 },
        { field: 'date', headerName: 'Date', width: 120 },
        { field: 'pathway', headerName: 'Pathway', flex: 1.2 },
        { field: 'country', headerName: 'Country', flex: 1 },
        { field: 'province', headerName: 'Province', flex: 1.1 },
        { field: 'cohort', headerName: 'Cohort', flex: 1 },
        { field: 'gender', headerName: 'Gender', flex: 1 },
        { field: 'substance', headerName: 'Substance', flex: 1.1 },
        { field: 'riskLevel', headerName: 'Risk', width: 100 },
        { field: 'intervention', headerName: 'Suggested Intervention', flex: 1.4 },
        { field: 'practitionerId', headerName: 'Practitioner', width: 120 },
        { field: 'completed', headerName: 'Completed', width: 110, valueFormatter: (p) => (p.value ? 'Yes' : 'No') },
      ],
    };
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

new Vue({ router }).$mount('#app');
