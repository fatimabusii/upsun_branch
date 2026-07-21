const PALETTE = ['#4338ca', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0d9488', '#ea580c', '#64748b'];

// ---- chart-widget: Chart.js, re-renders whenever `data` prop changes ----
// data shape: { labels, values } for bar/doughnut, or { labels, series:[{name,values}] } for line/stackedBar
Vue.component('chart-widget', {
  props: {
    data: { type: Object, required: true },
    type: { type: String, default: 'bar' },
    horizontal: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
  },
  template: `
    <div class="chart-wrap" :class="{ compact: compact }">
      <canvas ref="canvas"></canvas>
    </div>
  `,
  data() {
    return { chart: null };
  },
  mounted() {
    this.render();
  },
  watch: {
    data: {
      deep: true,
      handler() {
        this.render();
      },
    },
    type() {
      this.render();
    },
  },
  beforeDestroy() {
    if (this.chart) this.chart.destroy();
  },
  methods: {
    render() {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
      const ctx = this.$refs.canvas.getContext('2d');
      const data = this.data;
      if (!data || !data.labels) return;

      if (this.type === 'stackedBar') {
        this.chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.labels,
            datasets: (data.series || []).map((s, i) => ({
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
          data: { labels: data.labels, datasets: [{ data: data.values, backgroundColor: PALETTE }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
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
              borderWidth: 2,
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: !this.compact, position: 'bottom' } },
            scales: this.compact ? { x: { display: false }, y: { display: false } } : { y: { beginAtZero: true } },
          },
        });
        return;
      }

      this.chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: data.labels, datasets: [{ label: 'Count', data: data.values, backgroundColor: PALETTE[1] }] },
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

// ---- grid-widget: ag-Grid, updates rowData reactively ----
Vue.component('grid-widget', {
  props: {
    rows: { type: Array, required: true },
    columnDefs: { type: Array, required: true },
    pageSize: { type: Number, default: 20 },
  },
  template: `<div class="grid-wrap" ref="grid"></div>`,
  data() {
    return { gridApi: null };
  },
  mounted() {
    this.gridApi = agGrid.createGrid(this.$refs.grid, {
      columnDefs: this.columnDefs,
      rowData: this.rows,
      defaultColDef: { sortable: true, filter: true, resizable: true },
      pagination: true,
      paginationPageSize: this.pageSize,
    });
  },
  watch: {
    rows(newRows) {
      if (this.gridApi) this.gridApi.setGridOption('rowData', newRows);
    },
    columnDefs(newDefs) {
      if (this.gridApi) this.gridApi.setGridOption('columnDefs', newDefs);
    },
  },
  beforeDestroy() {
    if (this.gridApi) this.gridApi.destroy();
  },
});

// ---- map-widget: Leaflet bubble map, redraws markers on data change ----
Vue.component('map-widget', {
  props: {
    locations: { type: Array, required: true }, // [{name, lat, lng, count}]
  },
  template: `<div class="map-wrap" ref="mapEl"></div>`,
  data() {
    return { map: null, layer: null };
  },
  mounted() {
    this.map = L.map(this.$refs.mapEl, { scrollWheelZoom: false }).setView([8, 15], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 8,
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.draw();
  },
  watch: {
    locations: {
      deep: true,
      handler() {
        this.draw();
      },
    },
  },
  beforeDestroy() {
    if (this.map) this.map.remove();
  },
  methods: {
    draw() {
      if (!this.layer) return;
      this.layer.clearLayers();
      if (!this.locations.length) return;
      const maxCount = Math.max(...this.locations.map((l) => l.count));
      this.locations.forEach((loc) => {
        const radius = 6 + (loc.count / maxCount) * 26;
        L.circleMarker([loc.lat, loc.lng], {
          radius,
          color: PALETTE[0],
          weight: 1,
          fillColor: PALETTE[0],
          fillOpacity: 0.35,
        })
          .addTo(this.layer)
          .bindPopup(`<strong>${loc.name}</strong><br>${loc.count.toLocaleString()} screenings`);
      });
    },
  },
});

// ---- sankey-widget: D3 sankey, re-renders on graph change ----
Vue.component('sankey-widget', {
  props: {
    graph: { type: Object, required: true }, // { nodes:[{name}], links:[{source,target,value}] }
  },
  template: `<div class="sankey-wrap"><svg ref="svg" width="900" height="360"></svg></div>`,
  mounted() {
    this.render();
  },
  watch: {
    graph: {
      deep: true,
      handler() {
        this.render();
      },
    },
  },
  methods: {
    render() {
      const svg = d3.select(this.$refs.svg);
      svg.selectAll('*').remove();
      if (!this.graph || !this.graph.nodes || !this.graph.nodes.length) return;

      const width = 900;
      const height = 360;
      const sankey = d3.sankey().nodeWidth(16).nodePadding(18).extent([[1, 1], [width - 1, height - 6]]);
      const { nodes, links } = sankey({
        nodes: this.graph.nodes.map((d) => Object.assign({}, d)),
        links: this.graph.links.map((d) => Object.assign({}, d)),
      });

      svg.append('g').selectAll('rect').data(nodes).join('rect')
        .attr('x', (d) => d.x0).attr('y', (d) => d.y0)
        .attr('height', (d) => d.y1 - d.y0).attr('width', (d) => d.x1 - d.x0)
        .attr('fill', (d, i) => PALETTE[i % PALETTE.length]);

      svg.append('g').attr('fill', 'none').selectAll('path').data(links).join('path')
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('stroke', PALETTE[0]).attr('stroke-opacity', 0.18)
        .attr('stroke-width', (d) => Math.max(1, d.width));

      svg.append('g').style('font', '12px IBM Plex Sans, sans-serif')
        .selectAll('text').data(nodes).join('text')
        .attr('x', (d) => (d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8))
        .attr('y', (d) => (d.y0 + d.y1) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => (d.x0 < width / 2 ? 'start' : 'end'))
        .text((d) => `${d.name} (${d.value.toLocaleString()})`);
    },
  },
});

// ---- funnel-widget: simple proportional horizontal bars ----
Vue.component('funnel-widget', {
  props: {
    stages: { type: Array, required: true }, // [{label, value}], first stage = 100% baseline
  },
  template: `
    <div class="funnel">
      <div class="funnel-row" v-for="(s, i) in stages" :key="s.label">
        <div class="funnel-label">{{ s.label }}</div>
        <div class="funnel-track">
          <div class="funnel-bar" :style="{ width: pctWidth(s.value) + '%' }"></div>
        </div>
        <div class="funnel-value">{{ s.value.toLocaleString() }} ({{ pctWidth(s.value) }}%)</div>
      </div>
    </div>
  `,
  methods: {
    pctWidth(v) {
      const base = this.stages[0] ? this.stages[0].value : 1;
      if (!base) return 0;
      return Math.round((v / base) * 1000) / 10;
    },
  },
});

// ---- export-bar: CSV / Excel / PDF from an already-resolved rows array ----
Vue.component('export-bar', {
  props: {
    rows: { type: Array, required: true },
    filename: { type: String, default: 'export' },
  },
  template: `
    <div class="export-bar">
      <button @click="exportAs('csv')">CSV</button>
      <button @click="exportAs('xlsx')">Excel</button>
      <button @click="exportAs('pdf')">PDF</button>
    </div>
  `,
  methods: {
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
    exportAs(kind) {
      const rows = this.rows;
      if (!rows || !rows.length) return;

      if (kind === 'csv') {
        const ws = XLSX.utils.json_to_sheet(rows);
        this.download(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv' }), this.filename + '.csv');
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
