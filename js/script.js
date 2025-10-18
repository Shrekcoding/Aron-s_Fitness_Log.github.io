/* ========= Helpers ========= */
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const todayISO=()=>new Date().toISOString().slice(0,10);
const fmtNum=(n)=>Number.isFinite(n)?n.toLocaleString():'0';
const poundsToKg=(lb)=>lb*0.45359237;
const kgToPounds=(kg)=>kg/0.45359237;
const getISOWeekKey=(d)=>{
  const dt=new Date(d+'T00:00:00'); if(isNaN(+dt))return'';
  const dayNum=(dt.getUTCDay()+6)%7; dt.setUTCDate(dt.getUTCDate()-dayNum+3);
  const firstThursday=new Date(Date.UTC(dt.getUTCFullYear(),0,4));
  const week=1+Math.round(((dt-firstThursday)/86400000-3+((firstThursday.getUTCDay()+6)%7))/7);
  const year=dt.getUTCFullYear(); return `${year}-W${String(week).padStart(2,'0')}`;
};
const isSameWeek=(dateStr,weekKey)=>getISOWeekKey(dateStr)===weekKey;

/* ========= App State ========= */
const storageKey='fitness_compare_v1';
const defaultState={
  unit:'lb',
  week:getISOWeekKey(todayISO()),
  cardio:[],
  strength:[],
  avg:{ cardioMin:150, sessions:2, volumeLb:20000, reps:10, sets:10, avgWeightLb:10 },
  ui:{volExercise:'__all__', chartExercise:'__all__', chartGroup:'__all__'},
  notes:{} // workout title/desc overrides
};
let state=loadState();
function loadState(){
  try{
    const raw=localStorage.getItem(storageKey);
    if(!raw) return {...defaultState};
    const parsed=JSON.parse(raw);
    return {...defaultState, ...parsed,
      avg:{...defaultState.avg, ...(parsed.avg||{})},
      ui:{...defaultState.ui, ...(parsed.ui||{})},
      notes: parsed.notes || {}
    };
  }catch(e){ return {...defaultState}; }
}
function saveState(){ localStorage.setItem(storageKey, JSON.stringify(state)); }

/* ========= Header ========= */
const unitsToggle=$('#unitsToggle');
const weekPicker=$('#weekPicker');
const resetWeek=$('#resetWeek');
const exportJson=$('#exportJson');
const exportPdf=$('#exportPdf');

function initHeader(){
  const refreshUnitBtns=()=>{
    $$('.toggle button', unitsToggle).forEach(btn=>{
      const active = btn.dataset.unit===state.unit;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active?'true':'false');
    });
  };
  $$('.toggle button', unitsToggle).forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.unit===state.unit);
    btn.setAttribute('aria-pressed', btn.dataset.unit===state.unit ? 'true' : 'false');
    btn.onclick=()=>{
      state.unit=btn.dataset.unit;
      $('#unitLabel').textContent=state.unit;
      $$('.weightCellUnit').forEach(n=> n.textContent=state.unit);
      renderAll(); ensureCharts(); refreshUnitBtns(); saveState();
    };
  });
  weekPicker.value=state.week;
  weekPicker.onchange=(e)=>{ state.week=e.target.value || getISOWeekKey(todayISO()); renderAll(); ensureCharts(); saveState(); };
  resetWeek.onclick=()=>{
    state.cardio=state.cardio.filter(x=>!isSameWeek(x.date,state.week));
    state.strength=state.strength.filter(x=>!isSameWeek(x.date,state.week));
    renderAll(); ensureCharts(); saveState();
  };
  exportJson.onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`fitness_${state.week}.json`; a.click(); URL.revokeObjectURL(url);
  };
  exportPdf.onclick=()=> exportWeeklyPDF();
}

/* ========= Cardio ========= */
const cardioPreset=$('#cardioPreset'), cardioDate=$('#cardioDate'), cardioMinutes=$('#cardioMinutes'), saveCardio=$('#saveCardio'), cardioTableBody=$('#cardioTable tbody');
function initCardio(){
  cardioDate.value=todayISO();
  saveCardio.onclick=()=>{
    const name=cardioPreset.value||'Custom Cardio';
    const date=cardioDate.value||todayISO();
    const minutes=parseInt(cardioMinutes.value||0);
    if(!minutes || minutes<0){ alert('Enter minutes > 0'); return; }
    state.cardio.push({date,name,minutes}); saveState(); renderAll(); ensureCharts(); cardioMinutes.value='';
  };
}
function renderCardio(){
  const rows=state.cardio.filter(x=>isSameWeek(x.date,state.week)).sort((a,b)=>a.date.localeCompare(b.date));
  cardioTableBody.innerHTML=rows.map((r,i)=>{
    const idx=state.cardio.findIndex(x=>x===rows[i]);
    return `<tr><td>${r.date}</td><td>${r.name}</td><td>${fmtNum(r.minutes)}</td><td><button class="btn" data-del-cardio="${idx}">Delete</button></td></tr>`;
  }).join('') || `<tr><td colspan="4" class="hint">No cardio logged this week yet.</td></tr>`;
  $$('button[data-del-cardio]').forEach(btn=> btn.onclick=()=>{
    const idx=parseInt(btn.dataset.delCardio,10); if(idx>=0){ state.cardio.splice(idx,1); saveState(); renderAll(); ensureCharts(); }
  });
}

/* ========= Strength ========= */
const strDate=$('#strDate'), strGroup=$('#strGroup'), strExercise=$('#strExercise'), strWeight=$('#strWeight'), strReps=$('#strReps'), strSets=$('#strSets'), saveStrength=$('#saveStrength'), strengthTableBody=$('#strengthTable tbody');
function initStrength(){
  strDate.value=todayISO();
  saveStrength.onclick=()=>{
    const date=strDate.value||todayISO();
    const group=strGroup.value;
    const exercise=strExercise.value||'Exercise';
    const weight=parseFloat(strWeight.value||0);
    const reps=parseInt(strReps.value||0);
    const sets=parseInt(strSets.value||0);
    if(weight<=0||reps<=0||sets<=0){ alert('Enter weight, reps, and sets > 0'); return; }
    const weightLb=state.unit==='lb'? weight : kgToPounds(weight);
    state.strength.push({date,group,exercise,weightLb,reps,sets});
    saveState(); renderAll(); ensureCharts();
    strExercise.value=''; strWeight.value=''; strReps.value=''; strSets.value='';
  };
}
function renderStrength(){
  const rows=state.strength.filter(x=>isSameWeek(x.date,state.week)).sort((a,b)=>a.date.localeCompare(b.date));
  strengthTableBody.innerHTML=rows.map((r,i)=>{
    const weightDisp=state.unit==='lb'? r.weightLb : poundsToKg(r.weightLb);
    const volLb=r.weightLb*r.reps*r.sets;
    const volDisp=state.unit==='lb'? volLb : poundsToKg(volLb);
    const idx=state.strength.findIndex(x=>x===rows[i]);
    return `<tr>
      <td>${r.date}</td><td>${r.group}</td><td>${r.exercise.replace(/</g,'&lt;')}</td>
      <td>${Math.round(weightDisp)} <span class="weightCellUnit">${state.unit}</span></td>
      <td>${r.reps}</td><td>${r.sets}</td><td>${Math.round(volDisp)} ${state.unit}</td>
      <td><button class="btn" data-del-strength="${idx}">Delete</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="hint">No strength logged this week yet.</td></tr>`;
  $$('button[data-del-strength]').forEach(btn=> btn.onclick=()=>{
    const idx=parseInt(btn.dataset.delStrength,10); if(idx>=0){ state.strength.splice(idx,1); saveState(); renderAll(); ensureCharts(); }
  });
}

/* ========= Aggregations & Overall ========= */
function getWeekDatesFromKey(weekKey){
  const [yearStr,wStr]=weekKey.split('-W'); const year=parseInt(yearStr,10); const week=parseInt(wStr,10);
  const simple=new Date(Date.UTC(year,0,4)); const dow=(simple.getUTCDay()+6)%7;
  const week1=new Date(simple); week1.setUTCDate(simple.getUTCDate()-dow+3);
  const target=new Date(week1); target.setUTCDate(week1.getUTCDate()+(week-1)*7);
  const monday=new Date(target); monday.setUTCDate(target.getUTCDate()-3);
  const days=[]; for(let i=0;i<7;i++){ const d=new Date(monday); d.setUTCDate(monday.getUTCDate()+i); days.push(d.toISOString().slice(0,10)); }
  return days;
}
function aggregateCurrentWeek(){
  const w=state.week;
  const cardio=state.cardio.filter(x=>isSameWeek(x.date,w));
  const strength=state.strength.filter(x=>isSameWeek(x.date,w));
  const totalCardioMin=cardio.reduce((s,x)=>s+(x.minutes||0),0);
  const weekDays=getWeekDatesFromKey(w);
  const volByDayLb = weekDays.map(d => strength.filter(x=>x.date===d).reduce((s,x)=> s + (x.weightLb*x.reps*x.sets), 0));
  const repsByDay = weekDays.map(d => strength.filter(x=>x.date===d).reduce((s,x)=> s + (x.reps*x.sets), 0));
  const setsByDay = weekDays.map(d => strength.filter(x=>x.date===d).reduce((s,x)=> s + x.sets, 0));
  const avgWeightByDayLb = weekDays.map(d=>{
    const day=strength.filter(x=>x.date===d); const totalSets=day.reduce((s,x)=> s+x.sets,0);
    if(!totalSets) return 0; const sum=day.reduce((s,x)=> s + x.weightLb*x.sets,0); return sum/totalSets;
  });
  return { totalCardioMin, weekDays, strength, cardio, volByDayLb, repsByDay, setsByDay, avgWeightByDayLb };
}

function uniqueExercisesThisWeek(){
  const w=state.week;
  return Array.from(new Set(state.strength.filter(x=>isSameWeek(x.date,w)).map(x=>x.exercise))).sort((a,b)=>a.localeCompare(b));
}
function populateExerciseFilters(){
  const list=uniqueExercisesThisWeek();
  const html=['<option value="__all__">All exercises</option>', ...list.map(n=>`<option>${n.replace(/</g,'&lt;')}</option>`)].join('');
  $$('.pill-select.exerciseFilter').forEach(sel=>{
    sel.innerHTML=html;
    sel.value = list.includes(state.ui.volExercise) ? state.ui.volExercise : '__all__';
    sel.onchange=(e)=>{
      state.ui.volExercise=e.target.value;
      $$('.pill-select.exerciseFilter').forEach(o=>{ if(o!==e.target) o.value=state.ui.volExercise; });
      saveState(); renderOverall();
    };
  });
  const chartsSel = $('#chartsExerciseFilter');
  chartsSel.innerHTML=html;
  chartsSel.value = list.includes(state.ui.chartExercise) ? state.ui.chartExercise : '__all__';
  chartsSel.onchange=(e)=>{ state.ui.chartExercise=e.target.value; saveState(); ensureCharts(); };

  const chartGroupSel = $('#chartsGroupFilter');
  chartGroupSel.value=state.ui.chartGroup || '__all__';
  chartGroupSel.onchange=(e)=>{ state.ui.chartGroup=e.target.value; saveState(); ensureCharts(); };
}

function renderOverall(){
  const agg=aggregateCurrentWeek();
  const avg=state.avg, unit=state.unit;
  const filter=state.ui.volExercise;
  const weekStrength=agg.strength.filter(x=>isSameWeek(x.date,state.week));
  const filtered = filter==='__all__' ? weekStrength : weekStrength.filter(x=>x.exercise===filter);

  const volLb = filtered.reduce((s,x)=> s + x.weightLb*x.reps*x.sets, 0);
  const reps = filtered.reduce((s,x)=> s + x.reps*x.sets, 0);
  const sets = filtered.reduce((s,x)=> s + x.sets, 0);
  const setsTotal = sets || 0;
  const avgWlb = setsTotal ? filtered.reduce((s,x)=> s + x.weightLb*x.sets, 0)/setsTotal : 0;
  const sess = new Set(filtered.map(x=>x.date)).size;

  const byGroup={};
  filtered.forEach(x=>{ const v=x.weightLb*x.reps*x.sets; byGroup[x.group]=(byGroup[x.group]||0)+v; });
  const top = Object.entries(byGroup).sort((a,b)=>b[1]-a[1])[0] || ['—',0];

  const volDisp = unit==='lb'? volLb : poundsToKg(volLb);
  const avgWDisp = unit==='lb'? avgWlb : poundsToKg(avgWlb);
  const topVolDisp = unit==='lb'? top[1] : poundsToKg(top[1]);

  $('#statCardio').textContent = `${fmtNum(agg.totalCardioMin)} min`;
  $('#statVolume').textContent = `${fmtNum(Math.round(volDisp))} ${unit}`;
  $('#statSessions').textContent = fmtNum(sess);
  $('#statTopGroup').textContent = top[0];
  $('#statTopGroupVol').textContent = `${fmtNum(Math.round(topVolDisp))} ${unit}`;

  setDelta($('#statCardioDelta'), agg.totalCardioMin - avg.cardioMin, 'min');
  const volDeltaEl=$('#statVolumeDelta');
  if(filter==='__all__'){
    const avgVolDisp = unit==='lb'? avg.volumeLb : poundsToKg(avg.volumeLb);
    setDelta(volDeltaEl, volDisp - avgVolDisp, unit);
  }else{ volDeltaEl.textContent='filtered by exercise'; volDeltaEl.className='pill info'; }

  const sessDeltaEl=$('#statSessionsDelta');
  if(filter==='__all__'){ setDelta(sessDeltaEl, sess - avg.sessions, 'sessions'); }
  else { sessDeltaEl.textContent='filtered by exercise'; sessDeltaEl.className='pill info'; }

  $('#statReps').textContent=fmtNum(reps);
  $('#statSets').textContent=fmtNum(sets);
  $('#statAvgWeight').textContent=`${fmtNum(Math.round(avgWDisp))} ${unit}`;

  const badgeText = filter==='__all__' ? 'All exercises' : filter;
  $('#statRepsBadge').textContent=badgeText;
  $('#statSetsBadge').textContent=badgeText;
  $('#statAvgWeightBadge').textContent=badgeText;
}
function setDelta(el,delta,unit){
  const sign=delta>0?'+':(delta<0?'−':'±'); const abs=Math.abs(Math.round(delta));
  el.textContent=`vs avg: ${sign}${fmtNum(abs)} ${unit}`;
  el.className='pill ' + (delta>=0?'ok':'warn');
}

/* ========= Charts ========= */
let minutesChart, volumeChart, repsChart, setsChart, avgWeightChart;

/* ✅ Your requested per-group average working weights */
const avgWeightByGroupLb = {
  "Chest": 135,
  "Back": 135,
  "Shoulders": 65,
  "Biceps": 25,      // per your spec
  "Triceps": 25,     // per your spec
  "Leg Press": 100,
  "Leg Extensions": 78,
  "Legs": 100        // per your spec
};

function computeChartSeries(){
  const unit=state.unit;
  const agg=aggregateCurrentWeek();
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Filter by exercise for "You" series
  const exFilter=state.ui.chartExercise;
  const weekStrength=agg.strength.filter(x=>isSameWeek(x.date,state.week));
  const strength=(exFilter==='__all__')? weekStrength : weekStrength.filter(x=>x.exercise===exFilter);

  const byDay=(fn)=> agg.weekDays.map(d => strength.filter(x=>x.date===d).reduce((s,x)=> s + fn(x), 0));
  const volByDayLb=byDay(x=>x.weightLb*x.reps*x.sets);
  const repsByDay=byDay(x=>x.reps*x.sets);
  const setsByDay=byDay(x=>x.sets);
  const avgWeightByDayLb = agg.weekDays.map(d=>{
    const day=strength.filter(x=>x.date===d); const totalSets=day.reduce((s,x)=> s+x.sets,0);
    if(!totalSets) return 0; const sum=day.reduce((s,x)=> s + x.weightLb*x.sets,0); return sum/totalSets;
  });

  // Baseline logic: prefer selected Group; else infer from selected Exercise; else global fallback
  let baselineLb;
  if (state.ui.chartGroup && state.ui.chartGroup !== '__all__') {
    baselineLb = avgWeightByGroupLb[state.ui.chartGroup] ?? state.avg.avgWeightLb;
  } else if (state.ui.chartExercise && state.ui.chartExercise !== '__all__') {
    // Find any set this week with that exercise and use its group
    const exRow = weekStrength.find(x => x.exercise === state.ui.chartExercise);
    baselineLb = exRow ? (avgWeightByGroupLb[exRow.group] ?? state.avg.avgWeightLb)
                       : state.avg.avgWeightLb;
  } else {
    baselineLb = state.avg.avgWeightLb;
  }

  const volDisp=(lbs)=> unit==='lb'? lbs : poundsToKg(lbs);
  const wtDisp=(lbs)=> unit==='lb'? lbs : poundsToKg(lbs);

  return {
    labels,
    cardioByDay: agg.weekDays.map(d => agg.cardio.filter(x=>x.date===d).reduce((s,x)=>s+x.minutes,0)),
    volYou: volByDayLb.map(volDisp),
    repsYou: repsByDay,
    setsYou: setsByDay,
    avgWeightYou: avgWeightByDayLb.map(wtDisp),
    volAvg: Array(7).fill(volDisp(state.avg.volumeLb/7)),
    repsAvg: Array(7).fill(state.avg.reps),
    setsAvg: Array(7).fill(state.avg.sets),
    avgWeightAvg: Array(7).fill(wtDisp(baselineLb))
  };
}
function makeBarLine(ctx,labelBar,dataBar,yTitle,labelLine,dataLine){
  return new Chart(ctx,{ type:'bar',
    data:{ labels: chartData.labels, datasets:[
      {label:labelBar, data:dataBar, borderWidth:1},
      {label:labelLine, data:dataLine, type:'line', borderWidth:2}
    ] },
    options:{ responsive:true, maintainAspectRatio:false,
      scales:{ y:{ beginAtZero:true, title:{display:true, text:yTitle} } },
      plugins:{ legend:{ labels:{ color:'#cfe3ff' } } }
    }
  });
}
let chartData;
function ensureCharts(){
  chartData = computeChartSeries();
  if(minutesChart) minutesChart.destroy();
  if(volumeChart) volumeChart.destroy();
  if(repsChart)   repsChart.destroy();
  if(setsChart)   setsChart.destroy();
  if(avgWeightChart) avgWeightChart.destroy();

  minutesChart = new Chart($('#minutesChart').getContext('2d'),{
    type:'bar',
    data:{ labels: chartData.labels, datasets:[
      {label:'You (min)', data: chartData.cardioByDay, borderWidth:1},
      {label:'Average (min)', data: Array(7).fill(state.avg.cardioMin/7), type:'line', borderWidth:2}
    ] },
    options:{ responsive:true, maintainAspectRatio:false,
      scales:{ y:{ beginAtZero:true, title:{display:true, text:'Minutes'} } },
      plugins:{ legend:{ labels:{ color:'#cfe3ff' } } }
    }
  });
  volumeChart = makeBarLine($('#volumeChart').getContext('2d'), `You (${state.unit})`, chartData.volYou, `Volume (${state.unit})`, `Average (${state.unit})`, chartData.volAvg);
  repsChart   = makeBarLine($('#repsChart').getContext('2d'), 'You (reps)', chartData.repsYou, 'Reps', 'Average (reps)', chartData.repsAvg);
  setsChart   = makeBarLine($('#setsChart').getContext('2d'), 'You (sets)', chartData.setsYou, 'Sets', 'Average (sets)', chartData.setsAvg);
  avgWeightChart = makeBarLine($('#avgWeightChart').getContext('2d'), `You (${state.unit})`, chartData.avgWeightYou, `Avg Weight (${state.unit})`, chartData.avgWeightAvg);
}

/* ========= PDF Export ========= */
async function exportWeeklyPDF(){
  const el = document.getElementById('weeklyStats');
  if(!el){ alert('Nothing to export'); return; }
  ensureCharts(); await new Promise(r=>requestAnimationFrame(r));
  const canvas = await html2canvas(el, { scale:2, backgroundColor:'#0b0f14', useCORS:true });
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight(), margin=28;
  pdf.setFillColor(11,15,20); pdf.rect(0,0,pageW,pageH,'F');
  pdf.setTextColor(255,255,255); pdf.setFontSize(14);
  pdf.text(`Weekly Fitness — ${state.week} (${state.unit})`, margin, margin+4);
  const imgW = pageW - margin*2, imgH = canvas.height*(imgW/canvas.width), maxH=pageH - margin*3, scale=Math.min(1, maxH/imgH);
  const finalW=imgW*scale, finalH=imgH*scale;
  pdf.addImage(imgData,'PNG',(pageW-finalW)/2, margin*2, finalW, finalH, undefined, 'FAST');
  pdf.setFontSize(10); pdf.setTextColor(200,210,225); pdf.text(`Exported ${new Date().toLocaleString()}`, margin, pageH - margin);
  pdf.save(`fitness_${state.week}.pdf`);
}

/* ========= Workout Explorer ========= */
const WORKOUT_LIBRARY = {
  "Chest": [
    { id:"bench", img:"https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1200&q=80", title:"Barbell Bench Press", desc:"Compound push targeting pectorals, anterior delts, and triceps. Keep feet planted, shoulder blades retracted, bar to mid-chest."},
    { id:"incline-db", img:"https://images.unsplash.com/photo-1546483875-ad9014c88eba?auto=format&fit=crop&w=1200&q=80", title:"Incline Dumbbell Press", desc:"Upper-chest emphasis. Neutral wrist, 30–45° bench angle, touch dumbbells lightly at the top."},
    { id:"flyes", img:"https://images.squarespace-cdn.com/content/v1/5b4d089b3917ee244485b3e4/1571905099843-K6V44OECUALUA76Y7V8D/Cable-chest-crossover-fly.jpg", title:"Cable Flyes", desc:"Isolation for chest adduction. Soft elbows, sweep hands together at sternum level.", title:"Cable Flyes", desc:"Isolation for chest adduction. Soft elbows, sweep hands together at sternum level."}
  ],
  "Back": [
    { id:"lat-pulldown", img:"https://images.unsplash.com/photo-1554344728-77cf90d9ed26?auto=format&fit=crop&w=1200&q=80", title:"Lat Pulldown", desc:"Vertical pull for lats. Pull to upper chest, slight lean back, drive elbows down."},
    { id:"row", img:"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUSERAVFhIWFhgWFRIYFxcWFRcVFhYfFxcVFRgaHzQgGRolGxcZITEiJSksLi4uFx8zODMtNyotLisBCgoKDg0NGRAQGDAlHyU1LjE3Nzc3NTU3MTc3KzctLSs3LS0rLS0rNS8rNzcrNy01Ly0tKysrLzA0Ky01LS03N//AABEIAOEA4QMBIgACEQEDEQH/xAAcAAEAAgMBAQEAAAAAAAAAAAAABQYDBAcCAQj/xABNEAABAwEFAQwFCAcIAQUBAAABAAIDEQQFEiExBhMiMkFRYXFygZGxwQc0UqGyFDNCYnODs9EVI1OCk8PhCENjkqLC0/BUJESj0uMW/8QAGAEBAAMBAAAAAAAAAAAAAAAAAAECAwT/xAAfEQEAAwACAwADAAAAAAAAAAAAAQIRAxIEMUETISL/2gAMAwEAAhEDEQA/AO2zTBoqdFpfpuAOLXPwuHKCBy66LJevAHW8iqhbLE+SZ+AtGENJxV0NBlTjzQXeG0Mfmx7XDmIPgshcOUKgWSwytlBMdWg8MObnQkHI0OoKkrxvEQtxvY7DWlasGZ0rVyC1GdvtN7wvJtTPbHeqpdt4Ondhiizwl1XPAFAQNWg8qkxYbR7EI+9ef5SCWNtZ7XuK0Z70cOCG60Fa6V115Fh/Rs/tRN7Hu/JakjuBUjN3eaHIdpQT1ltgflo6laeNFsqCsUZ3eOrcgyR1TyjC2g/z+5TqAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIg0r14A63kVC3W0G0Tgio3MZdgU1evAHWHgVDXT6xP8AZjwCDddCMEOEULiW8g4Ln1/0nvRsRaJAdQG/6j/RZm6Wbrn8GRLRrN0RoNC7PW/uT8YViVduz1v7k/GFYkGO0uoxx5j4KsStxT2dv18X+XfeSsV4Gkbuwd5UDY24rZH9Vjnd+9/3IJzWfqx/iO//ADW2tSL5+Q/4cY7Q6Q+DgttAREQEREBERAREQEREBERAREQEREBERAREQaV68AdbyKhrp9Yn+zHgFM3rwB1vIqGun1if7MeAQSbdLN1z+DIlo1m6I0bpZuufwZEtGs3RGg0Ls9b+5PxhWJV27PW/uT8YViQad6neDrDzKiLlFbXIeSMDvIPkpS9jk0c/l/VR2zgrNaD1B8SCVsR3832gHZuTD4krbWpd+Ye7lkf/AKTuf+xbaAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIg0r14A63kVDXT6xP8AZ+QUzevAHW8ioa6vWJ/sx4BBJjSzfaH8GRLRrN0RoNLN9ofwZEtGs3RGg0Ls9b+5PxhWJV27PW/uT8YViQR17ng9vktLZYZzu5ZKdwr5ravU75vR5/0Wvsl8088srj7mjyQSN1j9XXlfI4dDpHOHuK21qXR8xFXXc2V6cIW2gIiICIiAiIgIiICIiAiIgIiICIiAiIgIiINK9eAOt5FQ11esT/ZjwCmb14A6w8Coa6vWJ/sx4BBJjSzdc/gyJaNZuiNBpZuufwZEtGs3RGg0Ls9b+5PxhWJV27PW/uT8YViQQ97O3/Q38ysFyuwWFz+Okru4u/Jer5dnJzN/2pYmf+gDfbYWjpkJA97kE1CzC0NHEAO4UXtEQEREBERAREQEREBERAREQEREHP8A0jbfvsZ3Gywh81N/K8HcoqiobQEF7yCDSoABBz0XOYtu74eS4Wtwb7IigDR3xn3lXw3e2YTOko6QTSlzdaOxnIc1KU5qLw+4mNGQociWmvH/AN8EGtsn6TpN2ZBbw0tecLbQ0BpY46bq0ZUJ+kKUyqKVI6suL3lcUdNAOUf0XVtm5XPslnc81eYYy48pwCp7dUEkiIg0r14A63kVDXV6xP8AZjwCmb14A63kVDXV6xP9mPAIJMaWbrn8GRLRrN0RoNLN1z+DIlo1m6I0Ghdnrf3J+MKxKu3Z639wfjCsSCv3oMReOUhvfRq1oJHNLIA6rBuThXhDDOwa6UpzLYth3x6/g6vksFlztTOwe57/ABYEFoREQEREBERAREQEREBERAREQFhtkbnMc1jsLiCA7WnOsyIOZ7E2kUe0jC50spLSauH6wgNJ46ABvYrRFYi6SUudUPADW6gAAeart/bMvsxntTJ2EOkfI2Mh2Jz5X1EQocyXOoPBbly3mWtJe8F+j3jNrXCtI2e26vJXj6EEZfN0uL44sxukjIy4cQc6ji3nAxdy6VDEGtDWijWgNaBoABQDuVYtNoDp4fZEgLeWlaVPJm/3K1ICIiDSvXgDreRUNdXrE/2Y8Apm9eAOt5FVW13uyyfK7TI1zmRxAuDaFxqWtyqQOPlQWQaWbrn8GRLRrN0RqkzbTstDbmniEjI5rXI0tc7AaMZLEQ8NJBGIV10HPls3DtsLXbbdZNxDNwOESboHbpucpjqG4RStK6lBPXZ639yfjCsSrt2et/cn4wrC45IK5Kakc7j8JK83WK2oj2aO7mFv8xfTq3tPup5r7cQraZDzOB/+OngUFkREQEREBERAREQEREBERAREQFz/AGz9I24TGx2KNs1pGT3uruUTjo0hpq9+lQCKV1rktj0qbTSWWFkFncW2m0lzWvGscTQN0kHI7fNaOtXiXKLusG40c0EkGpcTmTWtefNa8fFN/StrRCZvDaK8bW9jJo4yI3YhgLo210qa1rUVHMD0127vtE4w4o2ARlwawVLQS4lxFCM+fiGXGa/dm5zIXNLd8C1o5zTFXozHYCugWO4mtYC7iFSfM+KyxZUrXfVHwte3DjErHUNQBuTiHA68Jo7le9nr+EzQ2QBslXNBrvZCzUt5DQVw8nLQ05RtRJW0McwbwOoOqRQk9IPvWvdO0TG2aGzxud8oZNjYCDn+sx712h0Aoafn1T41usT9Z/kjcd7REXK0aV68AdYeBVRvC44bYbTBOXBhY04mOwOBFKEcR6CCOZW69eAOt5FcO9Nx+aP+Lr90gt0GzNx2NkEcxspc17hI+0yRGQgtkdR4NBk4gUoNBxrNd77hs0ss9mlsUb5AMLhK2mu/EbS6jB1QMuZfnCQ1JJzJJJJzJJ4yeMryg/WGzl4Qz2kvgmjlZuRaXMc17cQc0kVadaEZc4VntB3juqfBcg/s9/Mu60vjGuuW07x3R4oIMjPs/wC+C82Abm5z2CjnGjuMENJplxdi9A505h7yfyX2wwPkjxxhp3zqBzi2tHGpqGmncgn4ZMTQeUL2o+J1oAA3GEAf4zz/ACl6x2n9nD/Eef8AYg3kWlW0ckQ7XnySlo9qEfuvP+5BuotHBaf2kP8ACef5i+blaf20P8B//Mg30WhuVp/bw/wH/wDMm5Wn9tD/AAH/APMg30WgIbT+3h/gu/5V63Gf9vH2RH/kQbqLR+Tzf+QOyMf/AGX35LL/AOQexjPMIMdotMpc4RCPC0b7GXDuI6CoCfbeGOYwzSsEoLRuLTiFHNxNdjpTOo46BbVva5tmmq7EQWh7iBUtx1dkMtDTk5VXp7SwR/RFebTsQVf0hW7dbdAGF0kkcRa8ZNaC7C9oB0JIdU04izlWHdgyMum3n1ab5x5AVhZQPayN7SXSl7XuoDv6gggajLi5Aojai0vdMWPcKMqN6KCg1IHKurx4teem5H1nyTERqz7C2xrppJDTIg9FWgDuA95Vmvja8SDcbPVzfpvGh+q08nKVRtidn5bQ6pqI61wcRPK/2hx4TlpkumHZ+OCPfHsJzJ5udZxatL7icmYzXKNoJ37oKtIABpzvdvQOytexS+wWyW6Sw2qUkMZM3AwU31Dwnc2Og5wCpu1bNx2iWF0heYWOcMLThD3nfGppXDQ0FCDkVdrNZ/10TWgNawVwgUAY0UDRxAVLe5b38vePrHufakcX9bKwoiLibNK9eAOt5FcO9N/919r/ACl3G9eAOt5FcO9N/wDdfa/ykHI3ar4vrtV8JQd3/s9/Mu60vjGut3if1Z7PELkn9nv5l3Wl8Y11i9DvOkj80ELZN9adz4tzxHl3py+JT1hsgiZhBJ5SaVJ56c1B2KEuYVtch5IgO8tPkrGgIiICIiAiIgIiICIiAiIgj7RdziS6OdzMWZbRrm9xFfeqdDsHXdazzE8GNpDQxgxEbzKpFGt1JPOugrFapmsY57zRjWlzjyNAqT3IPznOxrwcWbg6jnaBwJyfQ/8AeFyL5flyOgcA0l+MMwNJxEhwzoeQEEcw7FZNkdnHWqEueC3ESYz9JoJrSg1ByrU+ClbNZfk84htZrG3OOUNxA1zcxrvoEU0Iy59Vel+s6iY1Ztk7rdBZ44h885tXu5HUq7sBNBzALJtBE2MBgrJO/V5q7Ayu+dT6LedbTLzEMW7vad0lOGKL6TieC3mrWpPEFis9xTn/ANQZmmZ7QXt3zQK54A4Vq0CgzbxdirM7+0sIIZDQV3jnFpOpIcaGn1hUZcpVguazua0vkFJH5key36LezU85K17DdJxtkmw1aAGMaS4Agk43ONMTquPEAOnMTCgEREGlevAHW8iuHem/+6+1/lLuN68AdbyK4d6b/wC6+1/lIORu1Xwr6dacddONT13bE3jOKxWCfD7Tm7m3PkdJQHvQdY/s9/Mu60vjGurXsd60fW8j+a576HbgmsQMNoDRIRJJRrg6gcWAVIyrVp5Vf73PB7fJBH7Ois9oPIGD4vyVhUDsuN9O7lkp3D+qnkBERAREQEREBERARFr223xQtLppWRtAJLnuDQANTU8SDYXiWQNBc5wAGpJoB0kqi3ptlaJiWXfAQzT5VLva88UZFe144uCVCDZV8p3S0SbrJWuKZz5SD9WpDWjmaAEFxl28sdcMMhnI/ZYS3se4hrh0EqD2120h+RzwyRPaZ4nwjfRkgysLQXAOyGdePRVvavZw/JJRSOgDeCwg8NvKaLmtqgm3PcjK8x+w44gKimVeD2IO4bLWoENbG07mAN97VdAOZSm1Vmxwkhhx03rQNCMw48w1y5FxDZ4zMpucjmHmc5vgrfLftsazA+V5PEDR1aHI5hBJXbeL/ku6TPxS4jR7uE2NpG9B4s6V5aLq9mla5jXMza5oLT9Uio9y/L20lsnlcN1kJANKVFKk8YblXnOa716LLcZrrspOrGGE1/wXmIHtDAe1WvbtaZzERGRi1oiKqRERBpXrwB1h4FVuC57PabRIy02eOZoaC1sjGvANAKioyNFZL14A63kVE3H61L1B5IJK67istn9XssMX2cbWE9JAqVs3h827s8Qtha94fNu7PEIIW7PW/uT8YW/ep3zejxP9FoXZ639yfjC3L0O//dHiUGHZIfq5DyyuP+loU4qtYhPC0siljw1Jo+JzjnziQeC2xeVoH0YXf52fmgnkUGL3n47PH2TO8DEF7/TjhrZZD1XxH4nBBitM1qkxuieyONtc6VeaCvGCNKcmvGpixvLmNLuFTPkroVBNvRscbmOjkNRQOa0OBJYMhQ14uRY7RtS2GDEyz2mZ/FHHE6pBJIOJwDaUpx9hQWdFVrs2q3+G0BrGOaC2Sj20d9JkjXDe0yo6prnWlM5qO+rM7g2qE9EjD5oN9FgdbIw0vMjMIFS7EKAcpKq967UOdVtn3jdDM4b79xhyb0v/AMvGglb5vQh4hjcGupifJkcA4g0HLEdc60HFmFTL+u7dHs3Nr3hrsTq4v1hGTS8u4R46mugpkprZqyNJeQ10jid9I4nM6kuc7Psp7qLDfl52eDHu00sbWEY5GvkdGwvNGhxjILanLNBgstjtJphjbHTQucD3hlVM2a7ZiBjmA5mM83HyVesu4T0dZ7ya8czt078byVMWe63AfOMceUx/k5Bmva5QYZAAXOMbqOc6pqBUANAoMwFymyQxvJBI5RxdOa6VazMzMRA/WY9ze8U8yuR7UD5PaHUyjecTW1OVdWjSlDl0UQSMkIikIGnFzima2bRNiGI00p0DtyFef36GtWe9IxnQ17CFjt99imZA5qoNa+rRV2uQNdSch0r9Ceje7HWe7bPG8EPLTI5p1BmeZcJ5xjp2L813dtDHDaGTSWb5QxhruTnYGuI0xb01AOdOOnJUHpkH9oEfTuwjnbOD7jGEHbkXOdj/AEu2a32mOyts00ckmLC52BzKtYXkEg10aeJdGQEREGlevAHW8iom4/Wpeo3yUtevAHW8iom4/WpeoPJBY1r3h827s8QthRd93pBEwtlnjY40o1zgCc+IaoNG7PW/uT8YWzeTt+7mA8Kqt2zaqzWSVtomfWF7RFujKPa1z3VBdQ5N3pz6FP3o7OQ8x9zUGfZ2IGBri0Gpcc86Z01PRXtUibKz2R4LVuFtIIxyDPjzqVIINY2Fns+8rG+7m0yr3rdRBwLZPdf0ta4bXI50zGuaGyPLif1mPFC3RrcGA4RXKhodBdX30bPvRFijI/VnFhGL2a0IFT7zXOtVG+mG7nWW02W+oGVML2x2hvKw1a13MaOcyv1mcist3fJ7bAJoSHRSitOfjBHEQag84KCB2S9Itntsxs+B8E2eFkhG/LeE1pH0hTQ+RVkt95RxnDKCCQS0YcWMjVrKau6aZZ8Rpzu9/Rw1ttjms8r2OxiQgUNCDWoJ07VaprvDZS+0y0FKZurLIPZ+ozmby9KDSNmktMuMRsa1p3oADWs5S+QZySczSAMxXUmw3ZcrSWitfrEU7GAZNH/emPmt4c2jBhYBvWaF/sgj6LPeVJ3fe7ywBlktOOmVYXMB/eeA0d6CWvi3MskBwCsh3sbBq55yaAOlVe37KstFldZpppRuha+Utc3OUEOxZg8bQOgKbsmzsssgntcpa8VwRR0IjB+s4ZvI1IGVaDlNjstlZG3CxtBqeMk8ricyelBxR/objBxRW+VjhoTG11P8papWy7JXlE3Cy9mvHFjhcOzeyLrJjB1aO5eTZmew3uQcXvfZS+pRQW+zlvGBujD3ljiOwhVK0eiq8ga4YXnjImzPa8BfpI2Jns+8rwbvZz96D8xSej29G/8As3fuywnwetGfY+8G5usFo7GF/wAFV+qTdrfad7vyXg3Z9f3f1QfkuW5rS3h2S0N6YZB4tWjIMJo4UPIRQ9xX7AN2u4nDwWrarMWkYqGunHp0oONehbYe0m2R2+Ru5Qw4qNeCJJC+MtFG/RbR9anXKgNaj9AqIuHWbrt+AKXQEREFd2k2msUJEU1sgjlBBMbpGhwBGRcK1GvGq/8A/wBAWSOlsjY5xI0BsgkG5gCm+q3hZilAeJck9IOzlufeNreLFantfM4se2GR7XN0bhc1tCKALqno42KljsMLLVWJ4xl0WRcA6VzhU1IBoQaZ6oPj7VbLQ4NmtbmNcaYIBuYFfrcI9pXqLZEMNY5W4tcT4sbu/ECrzY7nhj4MYr7R3x9+nYto2dh+gO4IOV7UbFTWuDcTPGBiDsQa4He1ypU8quVptNGF8oArwmjfDPUCoFR2BTk9haQcIAdxE1I7gQom23FK9hZurKGlXYTXuqgwnZyI5/JY68oawHvGa+G5QNBM3qSzNH+l1FYrHE5rQHyF7uN2EN9w0WZBV/ksjdLTaG9L8X4jSvrXWgaWx568cR+FrVZ15cwHUDuQVG94J7RBJZ5pIHxSsLHAwvaaEagiXUag01C5H6Nb4fdtvlu61Pwsc8tBPBEo4DxyNe0jvav0ObMw/QHcuX+lr0Zutjm2qxsBnDdzkixhmMfQeHOFKtqag0qKUIpmFotZe1+JtKOyy4RoNAPNVu8bRasDz+jHvlrvP1zMFOJz8Jq5wH0TUaCq2fRzsBa7ITLbrc6V5jMbYQ5z2xgua6uN+ZO8AoAAM9VeTdg4nHuQRl33tZImhrY5IzTOtnmBrx1fgoT2rdG0dk47VE08jnBh/wBVF7N2nicO6i8Ou5/KD2n8kG5BeML+BNG7qvafArZVenuRruHZ43dLWHxWsNnom8GzBvUaWfAgtSKqfozDo+0N6J56dxdRetylHBtk4/hP+OMlBaUVZEtqGlqB68LT8BavbbfbBq6zu/ckZ/vcgsaKvC+LSNbNCeds7ge50Xmsn6feOFYpf3Hwu+J4QTqjb21b0HyWuNo2fSgtDfui/wDDJWOa8o5iNzx73UOjkjOemT2iuh0QZ7h1m67fgCl1EXDrN12/AFLoCIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAvjmg6gL6iDEbOw/QHcF4NiZ7PvK2EQabrvZzjt/NQF53nFE5zcLzhDjUYaHC1jsuyUdxVpkYHAtNaEEGhIOfIRmDzhUq+rhlL3iGIlmF7Wb4HLcoWtFXGurHDPkQSNhtLZYY5mhwbI4sAIGRBLRiNaAEig5yAqNbvSbY8eGK1tbTIl8EkjXGtMnteABx1zB5VeLlsM0dkiYYv1jTKS04CWk4yxwJPKRpnmvy5LdFpZRj7LM1xoA10TwSdKAEZlB3Oy7QkTxyiY7+WBu8JbC6OSVrcWEuIOJmdTU0cKUoadHhvZrnBmB4cThzAIqHPaakEgZxu9yq2yWxMW42Ka1wv+U2eGMCNzhubZGxhodgacJcNATmDVXYRN1wjuHOfEnvKD2iIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIg//2Q==", title:"Seated Cable Row", desc:"Mid-back focus. Neutral spine, squeeze shoulder blades, control the eccentric."}
  ],
  "Shoulders": [
    { id:"ohp", img:"https://www.endomondo.com/wp-content/uploads/2024/03/Seated-Dumbbell-Shoulder-Press.jpg", title:"Overhead Press", desc:"Anterior & medial delts, triceps. Brace glutes and core, press overhead in a straight line."},
    { id:"lateral-raise", img:"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMHBhMUEhMVExUXGRcWGRYYFxcYHRodFhgdIB0iGRkcHS0gGBslHR8bITIjJykrLi4wGCEzODMsNygtLisBCgoKDg0OGhAQGTclHSUuMTcrLS4rNzA1LTctNy0tKysrMDctNzYuKy0tKy0rMzg3NTcrLSsrLSstNS0tNzctK//AABEIAOEA4QMBIgACEQEDEQH/xAAcAAEAAgMBAQEAAAAAAAAAAAAABQYDBAcIAgH/xABDEAABAwIDAwkECAMHBQAAAAABAAIDBBEFEiEGMUEHEyJRYXGBkaEUMlKxI0JicoKSosEV0fAWM0NTg+HxCGOTsuL/xAAZAQEAAwEBAAAAAAAAAAAAAAAAAgMEAQX/xAAeEQEAAgMAAgMAAAAAAAAAAAAAAQIDESESMSJBYf/aAAwDAQACEQMRAD8A7iiIgIiICIiAiIgIiICIiAiKgcpu3jtm3Mp6ZofUyDNci7Y2k2BI+s4kGw3aEngCF/RcEjpsdqnCYzVd9+krg3/xNOT9K6PsBjdZUM5jEI7SgZo5bBvONFr5mjRrxe+gAIvoLILoiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgLlm0WGe1bcSSPaXNcWBruHQYAQO5wIXU1SNtYv4fLG8Xs6Qa8G3Njf8Th+bsQSUGKtoWtY5riTwbYkDibE+6OJ7VryV7ZdqIGtv0XuaSdM143jo23gEbzbdpdbtPUiowo3yhwFgTuudyi8OmvjjI+JlzGxzCzYTqOq5aNPtcUF0REQEREBERAREQEREBERAREQEREBRmI7Q0mFzZZ6qCF3wvlY069hN1SOWLbKTBKH2emfkle3M+Qb2MJsMnU9x0vw03XBHnlxzvJOpJuSdSSeJO8lB7LpqhlXAHxva9h1DmkOB7iNCsq8l7HbU1GyWJtlhc7my76SK5ySC4zC27Nbc7eD2XB6hU8uEdQ8tZBJC03tIQx5HV0QdPJ3cUHWq3EYqADnHtbfcOJ7mjU+CiP7Vxzh3MRvkt9Y9BvmdfRUrDKgYtHzkbhMx2rnjM65HB8h3a8NDYcBZY8Q2ljpY3MHTI95rLEn71ui0cLXtYbygskm3zomEmkfYGxIkaR4XAPovxm11TVszxwNY3qcC4+edvyWTAtnxVUAkqLukd0gwEhrNNB9ogcd3V27kuFxuiLHA23WDv5OQQ0HKlDG5zJoJRK0nSPK9rteBLhY9h8yvxvKnGH9Kknt9kxuPkXAeqxx7GwUUjnRxHUaBzr27jqfn4LRpaKKcuB0cDYtPArPe96z3034sOG8cnq40W2lJXwAxOc55uOaykPBG+4Og7727VHYs+TFa5rZmBsOUxuYDc/SjeXdYs3duueq6qVfTfwqrbKzQtIJA4gH+vMjirDT4qzFWZWkguLSSPrDNuB6gL347lbS8WhmzYppP41qVlbs9O9oa2piAvq7I/KOv6rvRbmzeKN9sfUywuYXNa1ob0+bDtekBrd1hrqOjw1vt1VQ6rjLfr5ebdwu5pcHeHRv+MKKkrPZMWmu3oSBuUi1g1gs0kbw3eb9pHFTUsm0e2tZT1vN09PG0WDs8pLjY/YaQG+LioCu2qxSopXN5xkd7dJkdnd1yTYd2vat2CvbWYi55BINg2/wtFh4218Vh2hxCKnjDRa7tBfQf8AA61km95tx6VcWOtI8ohpbPYy+orRHPFMXnc9mZ5PbcguHmrbXYRObGOpqAPhL3AeYIITZqppaGgGWdrjxII3+vkpb+Ie1SWjZLIDxDCG/mIDfVaa711hyTWZ+MaR9BSxR5ROJGSnjI8vv91xJv8ANbddS2aDHM+Jw3Fr3ZD3t1A8v5LXx3Z2oxRrTliLR/hue4HvztBs4dnmtSLZmfLYCaG3VOyRv6xf1UlbfgxaopPeIm72i5t1FvzAcPktbaXamqFEGUdOeedvc+xDB1tBI5xx3C9gN5vuO3BgVU5oD5YQOt0TXv8AS1j4rmW0vKHWbM7Sz04bHKYnZQ54Ooc0OBsDpvvvKCo4/tFiMVdaolqopDuBmmaT90Mc1m/4WgK58nXKhUUuKMpsQc58cjgxsrxZ7HONhmJAzMJ0udRe97bueS4nJiVY6SR73yPNyWkMc+2/M/8Aw4gNMo004WuY6qADyOjb7Li8eZ3+GiD2Oi5fyI7YSY3h8lLUOL5YA0sedS6M6dI8XNOl+Ic3ebldQQEREBERB5h5XKl79v61jjpnisOwQMt4W19VEbHMpX40PbAXRhrn5dSDkGYggb+iHacV17lj5PZcembV0bc8zWhkkVwC9o91zSTbM25FuItbUWPDKijlpJy18ckbxva5jmuHeCLhBIbQzmvxJzza+XMQ2wZG29msYBoG6iw45gTrdRBC+i8uaRfQ2v4blIYXUQ+2vdUNzAg20JF79Q7NBwCCb5LWNq9roqaUnm5s7SLNcMzWFwNnNI1y5d3HsXfqLYekpy3OHTBurWPyhg/02Naw+IK4jyK4U7EuUCORo+jpw+V3Zma5jBfru6/4CvSiDQdhEV+gDEf+2SweLR0T3kLQk2ddcllVMCfiyOA8Mo+ankQVCq2XqqjQ1pt2Mt8jf1VH0go3VEb3gxEtlZIc5s1xFweLdN1gRr49nVCOFNhrKtpAN5Dp2PaHAfqQhIYTBBjFA0lrX3AOt/luWUbNw05OSLLffYgA9+qgOT5/MwOiO+F74iOxp6HjlynxV8yEt0NwuREJTM/coWgw/ma8dVyRbrIsb9d9PyhfVVhccb7ZG2GgG4adgX3PP7PiUXa4N/Np81mmm59567kWHYePUuoobEyMPonOs1gAJ0W7guysBoWPniEkrxnfnu6xcL5cvu2G7d19ajcZg9qniiPSMkjGkb+jmBd+kHyKvCD4iibDGGtaGgbgAAB3AL7REBERAXIeXXY8VFKMQi96MNZM0D3mXsHd7Sdfs/dXXliqadtVTuY9ocx4LXNIuCHCxBHEEIPGwOngpPFjS8xF7PnzW+kzX36dfG992i6LtRyKTw1bnUD2SRE3Ecji17OwOsQ8dpIPfvWjg3ItXVdQPaHxU8fEh3OP/C0dHxLvBBv/APTzQufjdVNY5GxNivrYue4OsOBsG69WYda7qozZzAYNm8JZT07crG3NzqXOO9zjxcf9hYABSaAiIgIiIC/HAObY6g8F+og4NtryNz01Y+TD7SxEl3Mlwa9lz7rSbNe0cLkEDTXeq3hPJVimI1Ia6n9nbxkle0AdzWkuPgLdq9Oogruw2yMOx2DczES9zjmklIsXut1cGjcG8B1m5NiREBERAVXxL6HHJAfrta8HrsMp8RYeYVoUTtFh5rKUPZ/eR3c0fED7zfHh2gIOVjE34PtdO9ozRuLA9o3ghjdR19yu9JtZHJHcPaB2m3n1H+u6jYdSfxbHpNL9I6lxZmsBoOBcNPA9iu1LhMENMYzTNjBc0Fzg1xOlzZ2ptYDjxUK7W5PHUa9o+jxcY3tBGI3dFjs7nHQdEE2HxHQnTqKwu2hFHWvY4OHSJDrOs7XeNNdOCs87Y/o2QsuQTo0bhlN79Vxp4qOxipacVhAaQ4vYbWtuIvfw18FNU0tg6/8AtFtDNMATFA3I0njI/fbuaCPxroaqnJ3h3seGTSGxdPM+Q293SzBl7Oj6q1oCIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIi+JpRBC5ziA1oLiTwAFyUHPqSgZBUVNhdgmkD2jQtAeS1zTwy3tfqA6lKPj9loG2Jmu+93WJDWj6o47/Va+BVArS97LtcXvNnC1w5xcA4dx+alayIxxxZbEWcLa6at7P6sg0a+QyvYGxu0IOpDdG77Anjut2qOrKg1GL7jFzUcsjruBzAtLQAGnhe9+wKYqnOnqmaEFvSt1+W4Wv6KKp4vaamslk0LWNja0dpJJPXcgaILHsS8P2Xgy7gHNt1ZXuGvbopxQmxkHs+zsY6y9w7nyOIPiCD4qbQEREBERAREQEREBERAREQEREBERAREQEREBERAVS5VcQdhmw88jDZ2aFv5pmA+lx4q2qgcuMoZsC8fFLA0eEgd8mnyQVXZ/a6GunbmPMSW1v7ju87xrcgndc6kLpMdQHUUbrg67wQd4PHwXnbC2C11lixKSjmcI5HsF9Q1xHyOqDu1XWt58HMBofT9lVsfx+LDcNmJeM0hblaCMxy3uQOrXeepcwrMenl3yvPDef2WOOjIpi5/vOHkP5oPRXJ/N7TsTROJveGM+m7w3eCsC5xyFYj7Rsm+EnWCZ7bfZk6Y8MxePBdHQEREBERAREQEREBERAREQEREBERAREQEREBERAXOOXggbFMB3moit5PPyuujqm8p1M2pwqAPaHgTN0OouQ5vyJQcHw4XjUbiN2SkjxXoTZ3AKYyFpp4vda4dAHffge5R21+BU8LQRBC3OebcRGwWzizTu+K3mg4hhDDI/O7W2oVlpcMnqY7iKR2bdZpN1c9jaWNuHRhkTA9+cZg0XuJS3f2W9F0TD5ucxSSMe7G1jfEgk/sPBBzPkkpKjA9sJGSxujjnjI6Wl3xnM3T7peu0Kk4tHzGM0zxvFRG2/ZJdp9CrsgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAq9t5CJNnHO/wAt0cncGvF/0kqwrBX0orqGSN3uva5h7nCyCCwaQe1NPxMt+U//AEtTbqH2jCH5d9sw726j1CjsJqHQYfGXe/ESx47W3a7118Fs4jVmqit1kDzOqCD2MAbzTzo0e0SHsvKTY9oznxCuGA3bK97j74DvHMb/ADCouHkxVk0I3c8GDukJld8rdyuWLuNHTRhu8hw9L/t6INfGZOcxWmA41EX6XX/ZXNUHA4HV+00ZduiBee8iw8bkHwPUr8gIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgp+M0LqfHnZRdk7cx7Ht0PgRlPffrWOppjDsy15IzNe0E9jZLfL1U5j397Fa2bp2HYG3J7rhvmFp4uGv2VkadQWOB73fvc3QVKRnMPgmAvzjnS6ak824sPf0Hg+CsmGObjGKhxN2xNebfadZuvhm0UdicIpcKwxu6QAdHqDmAuv1DNlb/wrM6dtHROe7SzSXG3UEGPZLD/AGLDS52r5HOcXdYzHL6a97ipxa2GNyYdEPsM/wDULZQEREBERAREQEREBERAREQEREBERAREQEREBERAREQc9xvEHVG17w0m0bWwi32nAu8934ApHaI8zsvI4WzAPsDuza2v2Xtooulhy7XVBP8Ann15sj0eVJbZHmsOeL6F7Sey4/m1BpU9X/G8TfOBdhDAwbuiwA+HSufJWauY2pwZx35mho/Fp+6rWyGWLChci13Adwe63orNSSh2Hg8MzyO4F3+yDawGXncGhJ3hjWnvaLH1BW+o3ZvXA4j8Tc3g8lw9CpJAREQEREBERAREQEREBERAREQEREBERAREQEREBERBUNoqTmcWzjTOWOv25ebPl9EVH7VSGpwKZx0Jax3cY3EO8rqzbWU/O4O9w95gLh5a+G4/hUFUNGKYK4aWkDN43iQgOHmAfxIIeTCjg1YyPORCYo5B15rWf5uGb8aseIMczAY2N0c5jWD70tr+Wpssu2dMHvp3Ea5jEP8AUAN/ANPmtuoZz+M07BuZmkd4DK3yPzQS1LAKWmYxu5rQ0dzRYLKiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiIPmWMSxlp1BBB7iqRS2Zs85jQXOjDh1A2O7sFwPJXlc1ixF0WI1EbfdbJIzXjZxCC249K2rw+ne03DpI3tPZlLr/AJb+a/KGbnNo7aaQk+b2/wAlTa2vklwygy3ayEywvA+KMNay/aY+kPvFfUu0P8Nr4qht3ADK9o1zRmxNh8Q94d1uJQdORa9BWx4jSNlhe2Rjhdrmm4P+/ZwWwgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgLlGPYfLQ49UnKS1zzINNLOBd5Xv5FdXWKanZP7zQ7vAO9BzXZKrdTY3zcrWiOUBj2Os677nm3W69Cw9dx1KR2o2aEVQXRstE4h1xa0ZA3ZfhJHd0iNFcY8JhjmzBgDt97ngbi4vrYknvN1uoKNsFhT8MqDkaWsfcyDhmGlxYkF1+PVvV5QCwRAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERB//2Q==", title:"Dumbbell Lateral Raise", desc:"Medial delts. Lead with elbows, small weights, control the top position."}
  ],
  "Biceps": [
    { id:"curl", img:"data:image/jpeg;base64,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", title:"Dumbbell Curl", desc:"Elbow flexion. Pin elbows, avoid swinging, full stretch at bottom."}
  ],
  "Triceps": [
    { id:"pushdown", img:"data:image/jpeg;base64,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", title:"Cable Pushdown", desc:"Elbow extension. Keep shoulders down, lock upper arms by sides."}
  ],
  "Leg Press": [
    { id:"leg-press", img:"data:image/jpeg;base64,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", title:"Leg Press", desc:"Quads/glutes. Neutral spine, full foot pressure, control depth."}
  ],
  "Leg Extensions": [
    { id:"leg-ext", img:"data:image/jpeg;base64,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", title:"Leg Extension", desc:"Quad isolation. Align knees with pivot, pause and squeeze at top."}
  ],
  "Legs": [
    { id:"squat", img:"data:image/jpeg;base64,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", title:"Back Squat", desc:"Full-body squat pattern. Brace, sit between hips, keep mid-foot balance."}
  ],
  "Core": [
    { id:"plank", img:"data:image/jpeg;base64,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", title:"Plank", desc:"Anti-extension core hold. Ribs down, glutes tight, neutral neck."}
  ],
  "Full Body": [
    { id:"deadlift", img:"https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80", title:"Deadlift", desc:"Posterior chain. Lats tight, bar close, push floor away, lock out with hips."}
  ]
};

const wxGroupSel = $('#wxGroup');
const wxStrip = $('#wxStrip');
const wxDetails = $('#wxDetails');
const wxBadge = $('#wxBadge');
const wxTitle = $('#wxTitle');
const wxBody = $('#wxBody');
const wxEditBtn = $('#wxEditBtn');
const wxSaveBtn = $('#wxSaveBtn');
const wxCancelBtn = $('#wxCancelBtn');

let current = { group:null, id:null };

function renderStrip(){
  const group = wxGroupSel.value;
  const list = WORKOUT_LIBRARY[group] || [];
  wxStrip.innerHTML = list.map((w)=>`
    <button class="tile" role="option" aria-label="${w.title}" data-id="${w.id}">
      <img src="${w.img}" alt="${group}: ${w.title}">
      <span class="label">${w.title}</span>
    </button>
  `).join('');
  $$('.tile', wxStrip).forEach((btn, i)=>{
    const item = list[i];
    btn.addEventListener('click', ()=> openDetails(group, item));
    btn.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openDetails(group, item); }
    });
  });
  if(list.length){ openDetails(group, list[0], true); } else { clearDetails(); }
}
function clearDetails(){
  current={group:null,id:null};
  wxDetails.classList.add('ghost');
  $('#wxBadge').textContent='—';
  $('#wxTitle').textContent='Select a workout';
  $('#wxBody').innerHTML='<p>Pick an image above to see the workout description.</p>';
  wxEditBtn.disabled=true;
  wxEditorToggle(false);
}
function openDetails(group, item, silent){
  current={ group, id:item.id };
  const title = item.title;
  const desc = item.desc || '—';
  wxDetails.classList.remove('ghost');
  $('#wxBadge').textContent = group;
  $('#wxTitle').textContent = title;
  $('#wxBody').innerHTML = `<p>${desc.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}</p>`;
  wxEditBtn.disabled=false;
  if(!silent) wxDetails.scrollIntoView({behavior:'smooth', block:'nearest'});
  $('#wxEditTitle').value = title;
  $('#wxEditDesc').value = item.desc || '';
}
function wxEditorToggle(show){
  const wxEditor = document.getElementById('wxEditor');
  wxEditor.style.display = show ? '' : 'none';
  wxSaveBtn.style.display = show ? '' : 'none';
  wxCancelBtn.style.display = show ? '' : 'none';
  wxEditBtn.style.display = show ? 'none' : '';
}
wxEditBtn.onclick = ()=> wxEditorToggle(true);
wxCancelBtn.onclick = ()=> wxEditorToggle(false);
wxSaveBtn.onclick = ()=> wxEditorToggle(false);
wxGroupSel.onchange = renderStrip;

/* ========= Render & Boot ========= */
function renderAll(){ renderCardio(); renderStrength(); populateExerciseFilters(); renderOverall(); }
function boot(){
  initHeader(); initCardio(); initStrength();
  if(!state.ui.chartGroup) state.ui.chartGroup='__all__';
  document.getElementById('unitLabel').textContent=state.unit;
  if(!state.week) state.week=getISOWeekKey(todayISO());
  document.getElementById('weekPicker').value=state.week;
  renderAll(); ensureCharts();
  wxGroupSel.value = 'Chest'; renderStrip();

  const ro = new ResizeObserver(()=> ensureCharts());
  $$('.chart-box').forEach(el => ro.observe(el));
}
boot();
