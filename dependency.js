// 1) Setup teams with pillars
const pillars = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i));
const teams = [];
const baseCount = Math.floor(150 / pillars.length);
const extra = 150 % pillars.length;
pillars.forEach((p, i) => {
  const cnt = baseCount + (i < extra ? 1 : 0);
  for (let j = 1; j <= cnt; j++) {
    teams.push({ id: `Team${p}-${j}`, pillar: `Pillar${p}` });
  }
});
const teamPillar = new Map(teams.map(t => [t.id, t.pillar]));
let rawData = [];

// 2) Sample data generator
function genSample() {
  rawData = [];
  for (let k = 0; k < 200; k++) {
    const src = teams[Math.floor(Math.random() * teams.length)];
    let tgt = teams[Math.floor(Math.random() * teams.length)];
    if (tgt.id === src.id || Math.random() < 0.1) tgt = null;
    rawData.push({
      DrivingTeam: src.id,
      DependentTeam: tgt ? tgt.id : null,
      Points: Math.ceil(Math.random() * 10)
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Launch with sample data
  genSample();

  // Initialize comboboxes and render
  setupCombobox('driving');
  setupCombobox('dependent');
  draw(rawData);

  // File upload handler
  document.getElementById('upload').addEventListener('change', handleFile);
});

function handleFile(e) {
  const f = e.target.files[0];
  const reader = new FileReader();
  reader.onload = ev => {
    const arr = new Uint8Array(ev.target.result);
    const wb = XLSX.read(arr, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rawData = XLSX.utils.sheet_to_json(ws, {
      header: ['Pillar', 'DrivingTeam', 'DependentTeam', 'Points'],
      range: 1
    });
    // Refresh selections
    refreshCombobox('driving');
    refreshCombobox('dependent');
    draw(rawData);
  };
  reader.readAsArrayBuffer(f);
}

// 3) Combobox setup & helpers
function setupCombobox(prefix) {
  const box = document.getElementById(prefix + 'Box');
  const container = document.getElementById(prefix + 'Checkboxes');
  // map prefix to action IDs
  const key = prefix === 'driving' ? 'drive' : 'dep';

  box.addEventListener('click', () => {
    container.style.display = container.style.display === 'block' ? 'none' : 'block';
  });
  document
    .getElementById(key + 'SelectAll')
    .addEventListener('click', e => {
      e.preventDefault();
      setAll(prefix, true);
    });
  document
    .getElementById(key + 'DeselectAll')
    .addEventListener('click', e => {
      e.preventDefault();
      setAll(prefix, false);
    });
  refreshCombobox(prefix);
}

function refreshCombobox(prefix) {
  const container = document.getElementById(prefix + 'Checkboxes');
  container.querySelectorAll('label').forEach(l => l.remove());
  // count edges
  const counts = {};
  rawData.forEach(d => {
    const key = prefix === 'driving' ? d.DrivingTeam : d.DependentTeam;
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  const items = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  items.forEach(id => {
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" value="${id}" checked> ${id} (${counts[id]})`;
    container.appendChild(lbl);
  });
  updatePlaceholder(prefix);
}

function setAll(prefix, checked) {
  document
    .querySelectorAll(`#${prefix}Checkboxes input`)
    .forEach(i => (i.checked = checked));
  updatePlaceholder(prefix);
  draw(rawData);
}

function getSelected(prefix) {
  return Array.from(
    document.querySelectorAll(`#${prefix}Checkboxes input:checked`)
  ).map(i => i.value);
}

function updatePlaceholder(prefix) {
  const sel = getSelected(prefix);
  const ph = document.getElementById(prefix + 'Placeholder');
  const total = document.querySelectorAll(
    `#${prefix}Checkboxes input`
  ).length;
  if (sel.length === 0) ph.textContent = 'None';
  else if (sel.length === total) ph.textContent = 'All';
  else ph.textContent = `${sel.length} selected`;
}

// 4) Main draw: filter, build, and render
function draw(data) {
  // apply filters
  const driveSel = getSelected('driving');
  const depSel = getSelected('dependent');
  const filtered = data.filter(
    d =>
      driveSel.includes(d.DrivingTeam) &&
      (!d.DependentTeam || depSel.includes(d.DependentTeam))
  );
  // build nodes & links
  const nm = new Map();
  filtered.forEach(d => {
    if (d.DrivingTeam) nm.set(d.DrivingTeam, {});
    if (d.DependentTeam) nm.set(d.DependentTeam, {});
  });
  const nodes = Array.from(nm.keys()).map(id => ({
    id,
    pillar: teamPillar.get(id)
  }));
  const links = filtered
    .filter(d => d.DependentTeam)
    .map(d => ({
      source: d.DrivingTeam,
      target: d.DependentTeam,
      points: d.Points
    }));

  // svg + zoom
  const svg = d3
    .select('#graph')
    .attr('width', window.innerWidth)
    .attr('height', window.innerHeight)
    .call(
      d3.zoom()
        .scaleExtent([0.2, 5])
        .on('zoom', ({ transform }) => g.attr('transform', transform))
    );
  svg.selectAll('*').remove();
  const g = svg.append('g');

  // arrowhead
  g.append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 46)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('class', 'link-marker');

  // simulation
  const sim = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-400))
    .force(
      'center',
      d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)
    );

  // draw links
  const linkG = g.append('g').selectAll('.link').data(links).enter();
  linkG.append('path').attr('class', 'link').attr('marker-end', 'url(#arrowhead)');
  linkG.append('text').attr('class', 'link-label').text(d => d.points);

  // draw nodes
  const nodeG = g.append('g').selectAll('.node').data(nodes).enter()
    .append('g')
    .attr('class', 'node')
    .call(
      d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    );
  nodeG.append('rect').attr('width', 80).attr('height', 28).attr('x', -40).attr('y', -14);
  nodeG.append('text').attr('class', 'id').text(d => d.id).attr('text-anchor', 'middle').attr('dy', -2);
  nodeG.append('text').attr('class', 'pillar').text(d => d.pillar).attr('text-anchor', 'middle').attr('dy', 10);

  // tick
  sim.on('tick', () => {
    g.selectAll('.link').attr('d', d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
    g.selectAll('.link-label')
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 - 4);
    nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // drag handlers
  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}
