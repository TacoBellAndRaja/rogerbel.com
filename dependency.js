// dependency.js

if (typeof d3 === 'undefined') console.error('D3 missing');

// ──────────────────────────────────────────────────────────────────
// Build pillars & teams
// ──────────────────────────────────────────────────────────────────
const pillars = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i));
const teams = [];
const baseCount = Math.floor(150 / pillars.length);
const extra     = 150 % pillars.length;

pillars.forEach((p, i) => {
  const cnt = baseCount + (i < extra ? 1 : 0);
  for (let j = 1; j <= cnt; j++) {
    teams.push({ id: `Team${p}-${j}`, pillar: `Pillar${p}` });
  }
});
const teamPillar = new Map(teams.map(t => [t.id, t.pillar]));
const teamIds    = Array.from(teamPillar.keys());

// ──────────────────────────────────────────────────────────────────
// Generate randomized sample data with many teams & reciprocals
// ──────────────────────────────────────────────────────────────────
let rawData = [];
function genSample() {
  const numLinks  = 200;
  const numRecips = 50;

  rawData = [];

  // random one-way dependencies
  for (let i = 0; i < numLinks; i++) {
    const a = teamIds[Math.floor(Math.random() * teamIds.length)];
    let   b = teamIds[Math.floor(Math.random() * teamIds.length)];
    while (b === a) b = teamIds[Math.floor(Math.random() * teamIds.length)];

    rawData.push({
      DrivingTeam:    a,
      DependentTeam:  b,
      DrivingPillar:  teamPillar.get(a),
      DependentPillar:teamPillar.get(b),
      Count:          Math.ceil(Math.random() * 10)
    });
  }

  // guaranteed reciprocals
  for (let i = 0; i < numRecips; i++) {
    const idx  = Math.floor(Math.random() * rawData.length);
    const link = rawData[idx];
    rawData.push({
      DrivingTeam:    link.DependentTeam,
      DependentTeam:  link.DrivingTeam,
      DrivingPillar:  link.DependentPillar,
      DependentPillar:link.DrivingPillar,
      Count:          Math.ceil(link.Count / 2) || 1
    });
  }
}

// ──────────────────────────────────────────────────────────────────
// Excel parsing
// ──────────────────────────────────────────────────────────────────
function parseFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb   = XLSX.read(data, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws);
    rawData = json.map(r => ({
      DrivingTeam:    r.DrivingTeam,
      DependentTeam:  r.DependentTeam   || null,
      DrivingPillar:  r.DrivingPillar,
      DependentPillar:r.DependentPillar || null,
      Count:          +r.Count          || 0
    }));
    buildFilters();
    updateGraph();
  };
  reader.readAsArrayBuffer(file);
}

// ──────────────────────────────────────────────────────────────────
// UI controls & combobox setup
// ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.checkboxes').forEach(c => c.style.display = 'none');
document.getElementById('upload').addEventListener('change', e => {
  if (e.target.files[0]) parseFile(e.target.files[0]);
});
document.querySelectorAll('input[name="mode"]').forEach(r =>
  r.addEventListener('change', () => { buildFilters(); updateGraph(); })
);

function getSelected(id) {
  return Array.from(
    document.getElementById(id)
      .querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.value);
}

function setupCombobox(selectId, containerId, selectAllId, deselectAllId, placeholderId, items, onChange) {
  const box         = document.getElementById(selectId);
  const container   = document.getElementById(containerId);
  const placeholder = document.getElementById(placeholderId);

  container.innerHTML = `
    <div class="actions">
      <a href="#" id="${selectAllId}">Select All</a> |
      <a href="#" id="${deselectAllId}">Deselect All</a>
    </div>
  `;

  items.forEach(item => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${item}" checked> ${item}`;
    container.appendChild(label);
    label.querySelector('input').addEventListener('change', () => {
      updatePlaceholder();
      onChange();
    });
  });

  container.querySelector(`#${selectAllId}`).onclick = e => {
    e.preventDefault();
    container.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
    updatePlaceholder(); onChange();
  };
  container.querySelector(`#${deselectAllId}`).onclick = e => {
    e.preventDefault();
    container.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    updatePlaceholder(); onChange();
  };

  box.onclick = e => {
    e.stopPropagation();
    document.querySelectorAll('.checkboxes').forEach(c => {
      if (c !== container) c.style.display = 'none';
    });
    container.style.display = container.style.display === 'block' ? 'none' : 'block';
  };

  document.addEventListener('click', e => {
    if (!box.contains(e.target) && !container.contains(e.target)) {
      container.style.display = 'none';
    }
  });

  function updatePlaceholder() {
    const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked'))
                         .map(cb => cb.value);
    placeholder.textContent =
      checked.length === 0            ? 'None' :
      checked.length === items.length ? 'All'  :
      `${checked.length} selected`;
  }
  updatePlaceholder();
}

function buildFilters() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const drivingItems = mode === 'team'
    ? [...new Set(rawData.map(d => d.DrivingTeam))]
    : [...new Set(rawData.map(d => d.DrivingPillar))];
  const dependentItems = mode === 'team'
    ? [...new Set(rawData.map(d => d.DependentTeam).filter(Boolean))]
    : [...new Set(rawData.map(d => d.DependentPillar).filter(Boolean))];

  setupCombobox('drivingBox', 'drivingCheckboxes', 'driveSelectAll','driveDeselectAll','drivingPlaceholder', drivingItems, updateGraph);
  setupCombobox('dependentBox','dependentCheckboxes','depSelectAll','depDeselectAll','dependentPlaceholder', dependentItems, updateGraph);
}

// ──────────────────────────────────────────────────────────────────
// D3 setup & markers
// ──────────────────────────────────────────────────────────────────
const svg            = d3.select('#graph')
                          .attr('width', window.innerWidth)
                          .attr('height', window.innerHeight);
const containerGroup = svg.append('g');
svg.call(d3.zoom().scaleExtent([0.2,5]).on('zoom', e => {
  containerGroup.attr('transform', e.transform);
}));
const defs = svg.append('defs');
['#333','#f00'].forEach(color => {
  defs.append('marker')
    .attr('id', `arrow${color.replace('#','')}`)
    .attr('viewBox','-0 -5 10 10')
    .attr('refX',10).attr('refY',0)
    .attr('orient','auto')
    .attr('markerWidth',6).attr('markerHeight',6)
    .append('path').attr('d','M0,-5L10,0L0,5').attr('fill',color);
});
const linkG = containerGroup.append('g').attr('class','links');
const nodeG = containerGroup.append('g').attr('class','nodes');

const simulation = d3.forceSimulation()
  .force('link',    d3.forceLink().id(d => d.id).distance(220))
  .force('charge',  d3.forceManyBody().strength(-400))
  .force('center',  d3.forceCenter(window.innerWidth/2, window.innerHeight/2))
  .force('collide', d3.forceCollide().radius(120))
  .velocityDecay(0.2)
  .alphaDecay(0.03);

// helper fns
function boxIntersection(x1,y1,x2,y2,w,h) {
  const dx = x2 - x1, dy = y2 - y1;
  const t  = Math.abs(dx)*h > Math.abs(dy)*w
           ? (w/2)/Math.abs(dx)
           : (h/2)/Math.abs(dy);
  return { x: x1 + dx*t, y: y1 + dy*t };
}
function perpOffset(x1,y1,x2,y2,offset) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx,dy);
  return { x: (dy/len)*offset, y: (-dx/len)*offset };
}

// ──────────────────────────────────────────────────────────────────
// Main rendering & updated tick handler
// ──────────────────────────────────────────────────────────────────
function updateGraph() {
  if (!rawData.length) genSample();

  const mode      = document.querySelector('input[name="mode"]:checked').value;
  const sourceKey = mode === 'team' ? 'DrivingTeam'   : 'DrivingPillar';
  const targetKey = mode === 'team' ? 'DependentTeam' : 'DependentPillar';
  const drivingSel   = getSelected('drivingCheckboxes');
  const dependentSel = getSelected('dependentCheckboxes');

  // filter & group
  const rawLinks = rawData
    .filter(d =>
      d[sourceKey] &&
      d[targetKey] &&
      drivingSel.includes(d[sourceKey]) &&
      dependentSel.includes(d[targetKey])
    )
    .map(d => ({ source: d[sourceKey], target: d[targetKey], count: d.Count }));

  const grouped = new Map();
  rawLinks.forEach(l => {
    const key = `${l.source}|${l.target}`;
    grouped.set(key, (grouped.get(key)||0) + l.count);
  });

  const links = Array.from(grouped.entries()).map(([key,count]) => {
    const [source, target] = key.split('|');
    return { source, target, count };
  });

  // assign offsets for reciprocals
  const linkSet = new Set(links.map(l => `${l.source}|${l.target}`));
  links.forEach(l => {
    const revKey    = `${l.target}|${l.source}`;
    const offsetMag = 30;
    l.offset = linkSet.has(revKey)
      ? (l.source < l.target ? -offsetMag : offsetMag)
      : 0;
  });

  // node stats
  const inCount={}, outCount={};
  links.forEach(l => {
    outCount[l.source] = (outCount[l.source] || 0) + l.count;
    inCount[l.target]  = (inCount[l.target]  || 0) + l.count;
  });
  const nodes = Array.from(new Set(links.flatMap(l=>[l.source,l.target])))
    .map(id => ({
      id,
      pillar: teamPillar.get(id),
      dep:    inCount[id]  || 0,
      dri:    outCount[id] || 0,
      ratio:  (inCount[id]||0)/((inCount[id]||0)+(outCount[id]||0))
    }));

  const colorScale = d3.scaleLinear().domain([0,0.5,1]).range(['green','white','red']);

  // LINK join
  const linkSel   = linkG.selectAll('g.link').data(links, d=>`${d.source}-${d.target}`);
  linkSel.exit().remove();
  const linkEnter = linkSel.enter().append('g').attr('class','link');
  linkEnter.append('path');
  linkEnter.append('rect').attr('width',30).attr('height',18).attr('rx',3).attr('fill','#fff');
  linkEnter.append('text').attr('text-anchor','middle').attr('alignment-baseline','middle').attr('font-size','12px');
  const allLinks = linkEnter.merge(linkSel);
  allLinks.select('path')
    .attr('fill','none')
    .attr('stroke',     d => d.offset !== 0 ? 'red' : '#333')
    .attr('stroke-width',d => Math.sqrt(d.count))
    .attr('marker-end', d => `url(#arrow${d.offset !== 0 ? 'f00' : '333'})`);
  allLinks.select('text').text(d => d.count);

  // NODE join
  const nodeSel   = nodeG.selectAll('g.node').data(nodes, d=>d.id);
  nodeSel.exit().remove();
  const nodeEnter = nodeSel.enter().append('g').attr('class','node')
    .call(d3.drag().on('start', dragStart).on('drag', dragged).on('end', dragEnd));
  nodeEnter.append('rect').attr('width',200).attr('height',70).attr('rx',4).attr('fill',d=>colorScale(d.ratio));
  nodeEnter.append('text').attr('class','id').attr('x',100).attr('y',20).text(d=>d.id);
  nodeEnter.append('text').attr('x',10).attr('y',66).attr('font-size','12px').text(d=>`Dep: ${d.dep}`);
  nodeEnter.append('text').attr('x',190).attr('y',66).attr('text-anchor','end').attr('font-size','12px').text(d=>`Dri: ${d.dri}`);
  nodeEnter.append('text').attr('class','pillar').attr('x',100).attr('y',50).text(d=>d.pillar);
  nodeEnter.merge(nodeSel).select('rect').attr('fill',d=>colorScale(d.ratio));

  // restart sim
  simulation.nodes(nodes).on('tick', ticked);
  simulation.force('link').links(links);
  simulation.alpha(1).restart();
}

// ──────────────────────────────────────────────────────────────────
// Tick handler with corrected perpendicular offsets
// ──────────────────────────────────────────────────────────────────
function ticked() {
  nodeG.selectAll('g.node')
    .attr('transform', d => `translate(${d.x-100},${d.y-35})`);

  linkG.selectAll('g.link').each(function(d) {
    const g  = d3.select(this);
    const sx = d.source.x, sy = d.source.y;
    const tx = d.target.x, ty = d.target.y;
    const dx = tx - sx, dy = ty - sy;

    if (dx === 0 && dy === 0 && d.offset === 0) return;

    let s = boxIntersection(sx, sy, tx, ty, 200, 70);
    let t = boxIntersection(tx, ty, sx, sy, 200, 70);
    if (![s.x,s.y,t.x,t.y].every(isFinite)) return;

    if (d.offset) {
      // Compute a consistent perpendicular direction
      const absOff = Math.abs(d.offset);
      // Determine canonical endpoints by lex order
      const forward = d.source.id < d.target.id;
      const x1 = forward ? sx : tx;
      const y1 = forward ? sy : ty;
      const x2 = forward ? tx : sx;
      const y2 = forward ? ty : sy;
      const rawPerp = perpOffset(x1, y1, x2, y2, absOff);
      // Apply sign of original offset
      const sign = d.offset < 0 ? -1 : 1;
      const off = { x: rawPerp.x * sign, y: rawPerp.y * sign };
      s = { x: s.x + off.x, y: s.y + off.y };
      t = { x: t.x + off.x, y: t.y + off.y };
    }

    g.select('path').attr('d', `M${s.x},${s.y}L${t.x},${t.y}`);
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    g.select('rect').attr('x', mx - 15).attr('y', my - 9);
    g.select('text').attr('x', mx).attr('y', my + 1);
  });
}

// ──────────────────────────────────────────────────────────────────
// Drag handlers
// ──────────────────────────────────────────────────────────────────
function dragStart(e, d) { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
function dragged(e, d)   { d.fx = e.x; d.fy = e.y; }
function dragEnd(e, d)   { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

// Initialize
genSample();
buildFilters();
updateGraph();
