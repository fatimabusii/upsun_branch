// Shared chart/grid palette for the "Clinical Navy" design.
const PALETTE = ['#0f2a4a', '#14b8a6', '#5b8def', '#f59e0b', '#ef4444', '#8b5cf6'];

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

// Generic Chart.js-backed widget. Usage:
// <chart-widget endpoint="/api/x" path="provinces" type="bar"></chart-widget>
Vue.component('chart-widget', {
  props: {
    endpoint: { type: String, required: true },
    path: { type: String, default: '' },
    type: { type: String, default: 'bar' }, // bar | line | doughnut | stackedBar
    horizontal: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
  },
  template: `
    <div class="chart-wrap">
      <p v-if="loading" class="loading">Loading chart…</p>
      <canvas v-show="!loading" ref="canvas"></canvas>
    </div>
  `,
  data() {
    return { loading: true, chart: null };
  },
  mounted() {
    fetch(this.endpoint)
      .then((res) => res.json())
      .then((json) => {
        const data = this.path ? resolvePath(json, this.path) : json;
        this.render(data);
        this.loading = false;
      });
  },
  beforeDestroy() {
    if (this.chart) this.chart.destroy();
  },
  methods: {
    render(data) {
      const ctx = this.$refs.canvas.getContext('2d');
      if (this.type === 'stackedBar') {
        this.chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.labels,
            datasets: data.series.map((s, i) => ({
              label: s.name,
              data: s.values,
              backgroundColor: PALETTE[i % PALETTE.length],
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            plugins: { legend: { position: 'bottom' } },
          },
        });
        return;
      }

      if (this.type === 'doughnut') {
        this.chart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: data.labels,
            datasets: [{ data: data.values, backgroundColor: PALETTE }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
          },
        });
        return;
      }

      if (this.type === 'line') {
        this.chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: (data.series || [{ name: 'Value', values: data.values }]).map((s, i) => ({
              label: s.name,
              data: s.values,
              borderColor: PALETTE[i % PALETTE.length],
              backgroundColor: PALETTE[i % PALETTE.length] + '22',
              fill: true,
              tension: 0.3,
              pointRadius: this.compact ? 0 : 3,
              borderWidth: this.compact ? 2 : 2,
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: !this.compact, position: 'bottom' } },
            scales: this.compact
              ? { x: { display: false }, y: { display: false } }
              : { y: { beginAtZero: true } },
          },
        });
        return;
      }

      // default: bar
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{ label: 'Count', data: data.values, backgroundColor: PALETTE[1] }],
        },
        options: {
          indexAxis: this.horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true }, y: { beginAtZero: true } },
        },
      });
    },
  },
});

// Generic export button row: CSV / Excel / PDF, from any endpoint shape.
// shape: 'rows' (already an array of objects), 'series' ({labels,values}),
// or 'multiSeries' ({labels, series:[{name,values}]}).
Vue.component('export-bar', {
  props: {
    endpoint: { type: String, required: true },
    path: { type: String, default: '' },
    shape: { type: String, default: 'rows' },
    filename: { type: String, default: 'export' },
    labelKey: { type: String, default: 'Category' },
    valueKey: { type: String, default: 'Value' },
  },
  template: `
    <div class="export-bar">
      <button @click="exportAs('csv')" title="Download CSV">CSV</button>
      <button @click="exportAs('xlsx')" title="Download Excel">Excel</button>
      <button @click="exportAs('pdf')" title="Download PDF">PDF</button>
    </div>
  `,
  methods: {
    async fetchRows() {
      const res = await fetch(this.endpoint);
      const json = await res.json();
      const data = this.path ? resolvePath(json, this.path) : json;

      if (this.shape === 'object') return [data];
      if (this.shape === 'rows') return data;

      if (this.shape === 'series') {
        return data.labels.map((l, i) => ({
          [this.labelKey]: l,
          [this.valueKey]: data.values[i],
        }));
      }

      if (this.shape === 'multiSeries') {
        return data.labels.map((l, i) => {
          const row = { [this.labelKey]: l };
          data.series.forEach((s) => {
            row[s.name] = s.values[i];
          });
          return row;
        });
      }

      return [];
    },
    download(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    async exportAs(kind) {
      const rows = await this.fetchRows();
      if (!rows || !rows.length) return;

      if (kind === 'csv') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const csv = XLSX.utils.sheet_to_csv(ws);
        this.download(new Blob([csv], { type: 'text/csv' }), this.filename + '.csv');
        return;
      }

      if (kind === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.writeFile(wb, this.filename + '.xlsx');
        return;
      }

      if (kind === 'pdf') {
        // Cap very large exports so PDF generation stays fast client-side.
        const pdfRows = rows.length > 200 ? rows.slice(0, 200) : rows;
        const cols = Object.keys(pdfRows[0]);
        const body = pdfRows.map((r) => cols.map((c) => String(r[c])));
        const doc = new jspdf.jsPDF();
        doc.setFontSize(13);
        doc.text(this.filename.replace(/-/g, ' '), 14, 16);
        if (rows.length > 200) {
          doc.setFontSize(9);
          doc.text('(first 200 of ' + rows.length + ' rows)', 14, 22);
        }
        doc.autoTable({ head: [cols], body, startY: rows.length > 200 ? 26 : 22, styles: { fontSize: 8 } });
        doc.save(this.filename + '.pdf');
      }
    },
  },
});
// Generic ag-Grid-backed widget. Usage:
// <grid-widget endpoint="/api/reports" :column-defs="cols"></grid-widget>
Vue.component('grid-widget', {
  props: {
    endpoint: { type: String, required: true },
    columnDefs: { type: Array, required: true },
    pageSize: { type: Number, default: 20 },
  },
  template: `<div class="grid-wrap" ref="grid"></div>`,
  data() {
    return { gridApi: null };
  },
  mounted() {
    fetch(this.endpoint)
      .then((res) => res.json())
      .then((rows) => {
        this.gridApi = agGrid.createGrid(this.$refs.grid, {
          columnDefs: this.columnDefs,
          rowData: rows,
          defaultColDef: { sortable: true, filter: true, resizable: true },
          pagination: true,
          paginationPageSize: this.pageSize,
        });
      });
  },
  beforeDestroy() {
    if (this.gridApi) this.gridApi.destroy();
  },
});
