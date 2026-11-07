import {estimateFishLength} from './photo-measurement.mjs';

export async function measurePhoto(blob, previous) {
  const url=URL.createObjectURL(blob), image=new Image();
  try { image.src=url; await image.decode(); } catch(e) { URL.revokeObjectURL(url); throw Error('Cannot load this photo for measurement.'); }
  const dialog=document.createElement('dialog');
  dialog.style.cssText='width: min(94vw,760px);height:90dvh;max-height:90dvh;overflow:auto;overflow-anchor:none;padding:16px;border-radius:16px;border:1px solid #758579;color:#173c2d;background:#fff;';
  dialog.innerHTML=`<h2>Measure fish</h2><p><strong>1 · Mark the reference &nbsp; 2 · Mark the fish &nbsp; 3 · Review the estimate</strong></p><p>Use a known-size object alongside the fish at approximately the same distance from the camera. Perspective, tilted objects and curved fish reduce accuracy.</p>
    <label>Reference object <select data-role="preset"><option value="custom">Custom / lure / boat detail</option><option value="3.375">Standard payment card — long edge, 3.375 in</option><option value="0.955">US quarter — diameter, 0.955 in</option></select></label>
    <p data-role="reference-guide">Measure the exact visible span of your reference object. Place it beside the fish on the same flat surface; avoid objects closer to the camera. A larger reference is easier to mark accurately.</p>
    <label>Known distance <input data-role="dimension" type="number" min="0" step="any" inputmode="decimal"></label>
    <label>Units <select data-role="unit"><option value="in">Inches</option><option value="cm">Centimeters</option></select></label>
    <label>Zoom <output data-role="zoom-value">100%</output><input data-role="zoom" aria-label="Photo zoom" type="range" min="25" max="400" step="25" value="100" style="padding:0;height:44px;touch-action:pan-y"></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;z-index:2;background:white;padding:8px 0"><button type="button" data-role="zoom-out" aria-label="Zoom out" style="min-width:48px;min-height:44px">−</button><button type="button" data-role="fit" style="min-height:44px">Fit photo</button><button type="button" data-role="zoom-in" aria-label="Zoom in" style="min-width:48px;min-height:44px">+</button></div>
    <label><input data-role="pan" type="checkbox" style="width:auto;padding:0"> Pan photo while zoomed</label><p>Select an endpoint below, then tap its position on the photo. Drag a marker to adjust it. Arrow keys move the selected marker; Shift moves it farther.</p>
    <div data-role="points" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    <div data-role="viewport" style="overflow:auto;overflow-anchor:none;height:48dvh;max-height:55dvh;border:1px solid #758579;margin-top:12px"><div data-role="surface" style="position:relative;width:100%;line-height:0;margin-inline:auto"><img alt="Catch photo for measurement" style="display:block;width:100%;height:auto"><svg data-role="overlay" tabindex="0" role="application" aria-label="Photo endpoint editor" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></svg></div></div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><canvas data-role="loupe" width="160" height="160" aria-label="Magnified selected endpoint" style="width:160px;height:160px;border:2px solid #173c2d;border-radius:8px"></canvas><div><strong>Endpoint detail · 4×</strong><p data-role="loupe-label">Select and place an endpoint to see its detail.</p><div data-role="nudge" style="display:grid;grid-template-columns:repeat(3,48px);gap:4px"><button type="button" data-dx="0" data-dy="-1" aria-label="Move endpoint up one photo pixel" style="grid-column:2">↑</button><button type="button" data-dx="-1" data-dy="0" aria-label="Move endpoint left one photo pixel" style="grid-column:1">←</button><button type="button" data-dx="0" data-dy="1" aria-label="Move endpoint down one photo pixel">↓</button><button type="button" data-dx="1" data-dy="0" aria-label="Move endpoint right one photo pixel">→</button></div><p>Each tap moves one photo pixel. Select an endpoint above to refine it.</p></div></div>
    <p data-role="status" aria-live="polite" style="min-height:4em"></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button data-role="apply" type="button">Use estimated length</button><button data-role="reset" type="button">Reset points</button><button data-role="cancel" type="button">Cancel</button></div>`;
  const q=r=>dialog.querySelector('[data-role="'+r+'"]');
  dialog.querySelector('img').src=url;
  const labels=['Reference start','Reference end','Fish nose','Fish tail'];
  let points=previous?.referencePoints?.length===2 && previous?.fishPoints?.length===2 ? [...previous.referencePoints,...previous.fishPoints].map(p=>({...p})) : [null,null,null,null];
  let selected=0, result=null, dragging=false;
  q('dimension').value=previous?.referenceLength||''; q('unit').value=previous?.unit==='cm'?'cm':'in';
  const buttons=labels.map((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{selected=i;render();};q('points').append(b);return b;});
  function calculate(){return estimateFishLength({referencePoints:points.slice(0,2),fishPoints:points.slice(2),referenceLength:Number(q('dimension').value),unit:q('unit').value,imageWidth:image.naturalWidth,imageHeight:image.naturalHeight});}
  const ns='http://www.w3.org/2000/svg';
  function shape(tag,attrs){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);q('overlay').append(el);return el;}
  function render(){
    buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(selected===i));b.style.fontWeight=selected===i?'bold':'normal';b.textContent=labels[i]+(points[i]?' ✓':'');});
    const svg=q('overlay');svg.replaceChildren();const w=svg.getBoundingClientRect().width,h=svg.getBoundingClientRect().height;
    for(const [a,b,color] of [[0,1,'#0468b1'],[2,3,'#a43213']])if(points[a]&&points[b])shape('line',{x1:points[a].x*w,y1:points[a].y*h,x2:points[b].x*w,y2:points[b].y*h,stroke:color,'stroke-width':3});
    points.forEach((p,i)=>{if(!p)return;shape('circle',{cx:p.x*w,cy:p.y*h,r:selected===i?10:7,fill:i<2?'#0468b1':'#a43213',stroke:'white','stroke-width':2,'data-index':i});});
    drawLoupe();
    try {const m=calculate();q('status').textContent='Estimated length: '+m.length.toFixed(1)+' '+m.unit+'. Approximate photo measurement, not a verified length.';q('apply').disabled=false;} catch(e) {q('status').textContent=points.every(Boolean)?e.message:'Mark all four endpoints. Selected: '+labels[selected]+'.';q('apply').disabled=true;}
  }
  function drawLoupe(){
    const canvas=q('loupe'),ctx=canvas.getContext('2d'),p=points[selected];ctx.fillStyle='#eef3ef';ctx.fillRect(0,0,160,160);
    for(const b of q('nudge').querySelectorAll('button'))b.disabled=!p;
    q('loupe-label').textContent=labels[selected]+(p?' · crosshair marks the exact point.':' · tap the photo to place this endpoint.');
    if(!p)return;ctx.drawImage(image,80-p.x*image.naturalWidth*4,80-p.y*image.naturalHeight*4,image.naturalWidth*4,image.naturalHeight*4);
    ctx.strokeStyle='white';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(65,80);ctx.lineTo(95,80);ctx.moveTo(80,65);ctx.lineTo(80,95);ctx.stroke();ctx.strokeStyle='#b52c19';ctx.lineWidth=1;ctx.stroke();
  }
  function nudge(dx,dy){const p=points[selected];if(!p)return;points[selected]={x:Math.max(0,Math.min(1,p.x+dx/image.naturalWidth)),y:Math.max(0,Math.min(1,p.y+dy/image.naturalHeight))};render();}
  for(const b of q('nudge').querySelectorAll('button'))b.onclick=()=>nudge(Number(b.dataset.dx),Number(b.dataset.dy));
  function place(e){const r=q('overlay').getBoundingClientRect();points[selected]={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};render();}
  q('overlay').onpointerdown=e=>{e.preventDefault();const index=e.target.getAttribute('data-index');if(index!==null)selected=Number(index);dragging=true;q('overlay').setPointerCapture(e.pointerId);place(e);};
  q('overlay').onpointermove=e=>{if(dragging)place(e);};
  q('overlay').onpointerup=e=>{if(!dragging)return;dragging=false;if(selected<3&&!points[selected+1])selected++;render();};
  q('overlay').onpointercancel=()=>{dragging=false;};
  q('overlay').onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();const p=points[selected]||{x:.5,y:.5},n=e.shiftKey?10:1;points[selected]={x:Math.max(0,Math.min(1,p.x+delta[0]*n/image.naturalWidth)),y:Math.max(0,Math.min(1,p.y+delta[1]*n/image.naturalHeight))};render();};
  q('preset').onchange=()=>{q('reference-guide').textContent=q('preset').value==='3.375'?'Mark the two ends of the card’s long edge, not its diagonal. Keep it beside the fish on the same flat surface.':q('preset').value==='0.955'?'Mark opposite edges through the center of the quarter. Its small size makes endpoint errors more significant; a larger reference is preferable.':'Measure the exact visible reference span. Use the same flat surface as the fish and keep both at the same distance from the camera.';if(q('preset').value!=='custom'){q('dimension').value=q('preset').value;q('unit').value='in';lastUnit='in';}render();};
  let lastUnit=q('unit').value;
  q('dimension').oninput=()=>{q('preset').value='custom';render();};q('unit').onchange=()=>{const value=Number(q('dimension').value);if(value>0)q('dimension').value=String(Number((lastUnit==='in'?value*2.54:value/2.54).toFixed(6)));lastUnit=q('unit').value;render();};
  q('pan').onchange=()=>{q('overlay').style.pointerEvents=q('pan').checked?'none':'auto';};
  function updateZoom(){
    const viewport=q('viewport'),zoom=Number(q('zoom').value);
    // 100% fits the WHOLE photo in both dimensions, including tall portraits.
    const fitWidth=Math.min(viewport.clientWidth,viewport.clientHeight*image.naturalWidth/image.naturalHeight);
    q('surface').style.width=Math.max(1,fitWidth*zoom/100)+'px';
    q('zoom-value').textContent=zoom+'%';
    render();
  }
  q('zoom').oninput=updateZoom;
  q('zoom-out').onclick=()=>{q('zoom').value=Math.max(25,Number(q('zoom').value)-25);updateZoom();};
  q('zoom-in').onclick=()=>{q('zoom').value=Math.min(400,Number(q('zoom').value)+25);updateZoom();};
  q('fit').onclick=()=>{q('zoom').value=100;updateZoom();q('viewport').scrollTo(0,0);};
  q('reset').onclick=()=>{points=[null,null,null,null];selected=0;render();};
  document.body.append(dialog);
  return new Promise(resolve=>{
    const observer=new ResizeObserver(updateZoom);observer.observe(q('viewport'));observer.observe(q('surface'));
    dialog.addEventListener('close',()=>{observer.disconnect();URL.revokeObjectURL(url);dialog.remove();resolve(result);},{once:true});
    q('cancel').onclick=()=>dialog.close();
    q('apply').onclick=()=>{try{result=calculate();dialog.close();}catch(e){q('status').textContent=e.message;}};
    dialog.showModal();updateZoom();
  });
}
