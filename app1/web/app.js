// ---- Landing page: KPI tiles ----
const Landing = {
  template: `
    <div>
      <h1>Screening Program Overview</h1>
      <p class="subtitle">A snapshot of screening activity across all partner sites.</p>
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
          <div class="label">Most Screened Substance</div>
          <div class="value" style="font-size: 20px;">{{ summary.topSubstance }}</div>
        </div>
        <div class="tile">
          <div class="label">Completion Trend ({{ summary.completionRate }}% overall)</div>
          <div style="height: 90px; margin-top: 8px; overflow: hidden;">
            <chart-widget endpoint="/api/trends" path="months" type="line" compact></chart-widget>
          </div>
        </div>
      </div>
      <export-bar endpoint="/api/summary" shape="object" filename="summary"></export-bar>
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

const Overview = {
  template: `
    <div>
      <h1>Overview</h1>
      <p class="subtitle">Risk distribution, screening volume, and the most frequently screened substances.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Overall Risk Distribution</h2>
            <export-bar endpoint="/api/risk" path="overall" shape="series"
              label-key="Risk Level" value-key="Count" filename="risk-distribution"></export-bar>
          </div>
          <chart-widget endpoint="/api/risk" path="overall" type="doughnut"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Screenings vs Completions by Month</h2>
            <export-bar endpoint="/api/trends" path="months" shape="multiSeries"
              label-key="Month" filename="monthly-trends"></export-bar>
          </div>
          <chart-widget endpoint="/api/trends" path="months" type="line"></chart-widget>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h2>Screening Volume by Substance</h2>
          <export-bar endpoint="/api/substances" path="counts" shape="series"
            label-key="Substance" value-key="Count" filename="substance-volume"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget endpoint="/api/substances" path="counts" type="bar" horizontal></chart-widget>
        </div>
      </div>
    </div>
  `,
};

const Geography = {
  template: `
    <div>
      <h1>Geography</h1>
      <p class="subtitle">Where screenings are taking place, by province and by country.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Screenings by Province (South Africa)</h2>
            <export-bar endpoint="/api/geography" path="provinces" shape="series"
              label-key="Province" value-key="Count" filename="screenings-by-province"></export-bar>
          </div>
          <chart-widget endpoint="/api/geography" path="provinces" type="bar"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>Screenings by Country</h2>
            <export-bar endpoint="/api/geography" path="countries" shape="series"
              label-key="Country" value-key="Count" filename="screenings-by-country"></export-bar>
          </div>
          <chart-widget endpoint="/api/geography" path="countries" type="doughnut"></chart-widget>
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

const Substances = {
  template: `
    <div>
      <h1>Substances</h1>
      <p class="subtitle">Screening volume per substance, and how often each results in a high-risk score.</p>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Screenings by Substance</h2>
            <export-bar endpoint="/api/substances" path="counts" shape="series"
              label-key="Substance" value-key="Count" filename="substances-volume"></export-bar>
          </div>
          <chart-widget endpoint="/api/substances" path="counts" type="bar"></chart-widget>
        </div>
        <div class="card">
          <div class="card-header">
            <h2>% Scored High-Risk</h2>
            <export-bar endpoint="/api/substances" path="highRiskPct" shape="series"
              label-key="Substance" value-key="% High Risk" filename="substances-high-risk-pct"></export-bar>
          </div>
          <chart-widget endpoint="/api/substances" path="highRiskPct" type="bar" horizontal></chart-widget>
        </div>
      </div>
    </div>
  `,
};

const RiskProfiles = {
  template: `
    <div>
      <h1>Risk Profiles</h1>
      <p class="subtitle">Risk levels overall, and broken down by substance.</p>
      <div class="card">
        <div class="card-header">
          <h2>Overall Risk Levels</h2>
          <export-bar endpoint="/api/risk" path="overall" shape="series"
            label-key="Risk Level" value-key="Count" filename="risk-overall"></export-bar>
        </div>
        <chart-widget endpoint="/api/risk" path="overall" type="doughnut"></chart-widget>
      </div>
      <div class="card">
        <div class="card-header">
          <h2>Risk Level by Substance</h2>
          <export-bar endpoint="/api/risk" path="bySubstance" shape="multiSeries"
            label-key="Substance" filename="risk-by-substance"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget endpoint="/api/risk" path="bySubstance" type="stackedBar"></chart-widget>
        </div>
      </div>
    </div>
  `,
};

const Trends = {
  template: `
    <div>
      <h1>Trends</h1>
      <p class="subtitle">Monthly screening volume and completion trend across the year.</p>
      <div class="card">
        <div class="card-header">
          <h2>Screenings vs Completions Over Time</h2>
          <export-bar endpoint="/api/trends" path="months" shape="multiSeries"
            label-key="Month" filename="trends-monthly"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget endpoint="/api/trends" path="months" type="line"></chart-widget>
        </div>
      </div>
    </div>
  `,
};

const Comparative = {
  template: `
    <div>
      <h1>Comparative Analytics</h1>
      <p class="subtitle">Compare risk-level outcomes across screening pathways.</p>
      <div class="card">
        <div class="card-header">
          <h2>Risk Level by Pathway</h2>
          <export-bar endpoint="/api/comparative" path="byPathway" shape="multiSeries"
            label-key="Pathway" filename="comparative-by-pathway"></export-bar>
        </div>
        <div class="chart-wrap tall">
          <chart-widget endpoint="/api/comparative" path="byPathway" type="stackedBar"></chart-widget>
        </div>
      </div>
    </div>
  `,
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
        {
          field: 'completionRate', headerName: 'Completion Rate', flex: 1,
          valueFormatter: (p) => p.value + '%',
        },
        {
          field: 'avgMinutes', headerName: 'Avg. Minutes', flex: 1,
          valueFormatter: (p) => p.value + ' min',
        },
      ],
    };
  },
};

const Explorer = {
  template: `
    <div>
      <h1>Advanced Explorer</h1>
      <p class="subtitle">Row-level screening data. Sort, filter, and page through every record.</p>
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
        { field: 'pathway', headerName: 'Pathway', flex: 1.3 },
        { field: 'assessmentType', headerName: 'Type', flex: 1 },
        { field: 'country', headerName: 'Country', flex: 1 },
        { field: 'province', headerName: 'Province', flex: 1.2 },
        { field: 'ageGroup', headerName: 'Age Group', width: 110 },
        { field: 'gender', headerName: 'Gender', flex: 1 },
        { field: 'substance', headerName: 'Substance', flex: 1.1 },
        { field: 'riskLevel', headerName: 'Risk', width: 100 },
        {
          field: 'completed', headerName: 'Completed', width: 110,
          valueFormatter: (p) => (p.value ? 'Yes' : 'No'),
        },
        { field: 'minutes', headerName: 'Minutes', width: 100 },
      ],
    };
  },
};

const router = new VueRouter({
  mode: 'hash',
  routes: [
    { path: '/', component: Landing },
    { path: '/overview', component: Overview },
    { path: '/geography', component: Geography },
    { path: '/demographics', component: Demographics },
    { path: '/substances', component: Substances },
    { path: '/risk', component: RiskProfiles },
    { path: '/trends', component: Trends },
    { path: '/comparative', component: Comparative },
    { path: '/reports', component: Reports },
    { path: '/explorer', component: Explorer },
  ],
});

new Vue({ router }).$mount('#app');
