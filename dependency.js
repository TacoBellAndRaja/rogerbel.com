// 1) Build 150 teams across PillarA–PillarM
typeof d3==='undefined'&&console.error('D3 missing');
const pillars=Array.from({length:13},(_,i)=>String.fromCharCode(65+i));
const teams=[];
const baseCount=Math.floor(150/pillars.length),extra=150%pillars.length;
pillars.forEach((p,i)=>{const cnt=baseCount+(i<extra?1:0);for(let j=1;j<=cnt;j++)teams.push({id:`Team${p}-${j}`,pillar:`Pillar${p}`});});
const teamPillar=new Map(teams.map(t=>[t.id,t.pillar]));
let rawData=[];

// 2) Generate sample dataset
genSample();

function genSample(){rawData=[];for(let k=0;k<200;k++){const s=teams[Math.floor(Math.random()*teams.length)];let t=teams[Math.floor(Math.random()*teams.length)];if(t.id===s.id||Math.random()<0.1)t=null;rawData.push({DrivingTeam:s.id,DependentTeam:t?t.id:null,Points:Math.ceil(Math.random()*10)});} }

document.addEventListener('DOMContentLoaded',()=>{
  setupCombobox('driving');
  setupCombobox('dependent');
  draw(rawData);
  document.getElementById('upload').addEventListener('change',handleFile);
});

function handleFile(e){const f=e.target.files[0],r=new FileReader();r.onload=ev=>{const a=new Uint8Array(ev.target.result),wb=XLSX.read(a,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];rawData=XLSX.utils.sheet_to_json(ws,{header:['Pillar','DrivingTeam','DependentTeam','Points'],range:1});refreshCombobox('driving');refreshCombobox('dependent');draw(rawData);};r.readAsArrayBuffer(f);}

// 3) Combobox helpers
function setupCombobox(prefix){const box=document.getElementById(prefix+'Box'),ct=document.getElementById(prefix+'Checkboxes'),key=prefix==='driving'?'drive':'dep';box&&(box.addEventListener('click',()=>ct.style.display=ct.style.display==='block'?'none':'block'));document.getElementById(key+'SelectAll').addEventListener('click',e=>{e.preventDefault();setAll(prefix,true);});document.getElementById(key+'DeselectAll').addEventListener('click',e=>{e.preventDefault();setAll(prefix,false);});refreshCombobox(prefix);}function refreshCombobox(prefix){const ct=document.getElementById(prefix+'Checkboxes');ct.querySelectorAll('label').forEach(l=>l.remove());const cnts={};rawData.forEach(d=>{const k=prefix==='driving'?d.DrivingTeam:d.DependentTeam;k&&(cnts[k]=(cnts[k]||0)+1);});const items=Object.keys(cnts).sort((a,b)=>cnts[b]-cnts[a]);items.forEach(id=>{const lbl=document.createElement('label');lbl.innerHTML=`<input type="checkbox" value="${id}" checked> ${id} (${cnts[id]})`;ct.appendChild(lbl);});updatePlaceholder(prefix);}function setAll(prefix,ch){document.querySelectorAll(`#${prefix}Checkboxes input`).forEach(i=>i.checked=ch);updatePlaceholder(prefix);draw(rawData);}function getSelected(prefix){return Array.from(document.querySelectorAll(`#${prefix}Checkboxes input:checked`)).map(i=>i.value);}function updatePlaceholder(prefix){const s=getSelected(prefix),ph=document.getElementById(prefix+'Placeholder'),tot=document.querySelectorAll(`#${prefix}Checkboxes input`).length;ph.textContent=s.length===0?'None':s.length===tot?'All':`${s.length} selected`;}

// 4) Draw graph with D3
function draw(data){const ds=getSelected('driving'),dp=getSelected('dependent'),fil=data.filter(d=>ds.includes(d.DrivingTeam)&&(!d.DependentTeam||dp.includes(d.DependentTeam)));const nm=new Map();fil.forEach(d=>{d.DrivingTeam&&nm.set(d.DrivingTeam,{});d.DependentTeam&&nm.set(d.DependentTeam,{});});const nodes=Array.from(nm.keys()).map(id=>({id,pillar:teamPillar.get(id)}));const links=fil.filter(d=>d.DependentTeam).map(d=>({source:d.DrivingTeam,target:d.DependentTeam,points:d.Points}));const svg=d3.select('#graph').attr('width',innerWidth).attr('height',innerHeight).call(d3.zoom().scaleExtent([0.2,5]).on('zoom',({transform})=>g.attr('transform',transform)));svg.selectAll('*').remove();const g=svg.append('g');g.append('defs').append('marker').attr('id','arrowhead').attr('viewBox','-0 -5 10 10').attr('refX',46).attr('refY',0).attr('orient','auto').attr('markerWidth',6).attr('markerHeight',6).append('path').attr('d','M0,-5L10,0L0,5').attr('class','link-marker');const sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(d=>d.id).distance(120)).force('charge',d3.forceManyBody().strength(-400)).force('center',d3.forceCenter(innerWidth/2,innerHeight/2));const linkG=g.append('g').selectAll('.link').data(links).enter();linkG.append('path').attr('class','link').attr('marker-end','url(#arrowhead)');linkG.append('text').attr('class','link-label').text(d=>d.points);const nodeG=g.append('g').selectAll('.node').data(nodes).enter().append('g').attr('class','node').call(d3.drag().on('start',dragstarted).on('drag',dragged).on('end',dragended));nodeG.append('rect').attr('width',80).attr('height',28).attr('x',-40).attr('y',-14);nodeG.append('text').attr('class','id').text(d=>d.id).attr('text-anchor','middle').attr('dy',-2);nodeG.append('text').attr('class','pillar').text(d=>d.pillar).attr('text-anchor','middle').attr('dy',10);sim.on('tick',()=>{g.selectAll('.link').attr('d',d=>`M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);g.selectAll('.link-label').attr('x',d=>(d.source.x+d.target.x)/2).attr('y',d=>(d.source.y+d.target.y)/2-4);nodeG.attr('transform',d=>`translate(${d.x},${d.y})`);});function dragstarted(e,d){if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;}function dragged(e,d){d.fx=e.x;d.fy=e.y;}function dragended(e,d){if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;}}
