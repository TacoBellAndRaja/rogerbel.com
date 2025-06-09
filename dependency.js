// Setup teams
const pillars = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i));
const teams = [];
const baseCount = Math.floor(150 / pillars.length);
const extra = 150 % pillars.length;
pillars.forEach((p, idx) => {
  const count = baseCount + (idx < extra ? 1 : 0);
  for (let j = 1; j <= count; j++) teams.push({ id: `Team${p}-${j}` });
});

// Generate sample dependencies
const sampleData = [];
for (let k = 0; k < 200; k++) {
  const src = teams[Math.floor(Math.random() * teams.length)].id;
  let tgt = teams[Math.floor(Math.random() * teams.length)].id;
  if (tgt === src || Math.random() < 0.1) tgt = null;
  sampleData.push({ DrivingTeam: src, DependentTeam: tgt, Points: Math.ceil(Math.random() * 10) });
}

// File upload
document.getElementById('upload').addEventListener('change', handleFile, false);
function handleFile(evt) {
  const f = evt.target.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const arr = new Uint8Array(e.target.result);
    const wb = XLSX.read(arr, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: ['Pillar','DrivingTeam','DependentTeam','Points'], range: 1 });
    draw(raw);
  };
  reader.readAsArrayBuffer(f);
}

// Initial draw
window.onload = () => draw(sampleData);

function draw(data) {
  // Compute imbalance for heatmap
  const outCount = {}, inCount = {};
  data.forEach(d => {
    if (d.DrivingTeam) outCount[d.DrivingTeam] = (outCount[d.DrivingTeam] || 0) + 1;
    if (d.DependentTeam) inCount[d.DependentTeam] = (inCount[d.DependentTeam] || 0) + 1;
  });
  const imbalance = teams.map(t => Math.abs((outCount[t.id]||0) - (inCount[t.id]||0)));
  const maxImb = Math.max(...imbalance);
  const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, maxImb || 1]);

  // Build nodes & links
  const nodesMap = new Map();
  data.forEach(d => {
    if (d.DrivingTeam) nodesMap.set(d.DrivingTeam, { id: d.DrivingTeam });
    if (d.DependentTeam) nodesMap.set(d.DependentTeam, { id: d.DependentTeam });
  });
  const nodes = Array.from(nodesMap.values());
  const links = data.filter(d => d.DrivingTeam && d.DependentTeam)
    .map(d => ({ source: d.DrivingTeam, target: d.DependentTeam, points: d.Points }));

  // SVG and zoom container
  const svg = d3.select('#graph')
    .attr('width', window.innerWidth)
    .attr('height', window.innerHeight)
    .call(d3.zoom().scaleExtent([0.2, 5]).on('zoom', ({transform}) => container.attr('transform', transform)));
  svg.selectAll('*').remove();
  const container = svg.append('g');

  // Arrowhead
  const defs = container.append('defs');
  defs.append('marker')
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

  // Force simulation
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(window.innerWidth/2, window.innerHeight/2));

  // Links
  const linkGroup = container.append('g').selectAll('.link').data(links).enter();
  linkGroup.append('path').attr('class', 'link').attr('marker-end', 'url(#arrowhead)');
  linkGroup.append('text').attr('class', 'link-label').text(d => d.points);

  // Nodes
  const nodeGroup = container.append('g').selectAll('.node').data(nodes).enter()
    .append('g')
      .attr('class', 'node')
      .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));
  nodeGroup.append('rect')
    .attr('width', 80).attr('height', 24).attr('x', -40).attr('y', -12)
    .attr('fill', d => colorScale(Math.abs((outCount[d.id]||0) - (inCount[d.id]||0))));
  nodeGroup.append('text')
    .text(d => d.id)
    .attr('text-anchor', 'middle')
    .attr('dy', 4);

  // Tick
  sim.on('tick', () => {
    container.selectAll('.link')
      .attr('d', d => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`);
    container.selectAll('.link-label')
      .attr('x', d => (d.source.x + d.target.x)/2)
      .attr('y', d => (d.source.y + d.target.y)/2 - 4);
    nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Drag handlers
  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }
}
