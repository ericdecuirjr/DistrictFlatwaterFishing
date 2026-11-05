import {estimateFishLength} from './photo-measurement.mjs';

export async function measurePhoto(blob, previous) {
  const url=URL.createObjectURL(blob), image=new Image();
  try { image.src=url; await image.decode(); } catch(e) { URL.revokeObjectURL(url); throw Error('Cannot load this photo for measurement.'); }
  const dialog=document.createElement('dialog');
  dialog.style.cssText='width: min(94vw,760px);height:90dvh;max-height:90dvh;overflow:auto;overflow-anchor:none;padding:16px;border-radius:16px;border:1px solid #758579;color:#173c2d;background:#fff;';
  dialog.innerHTML=`<h2>Measure fish</h2><p>Use a known-size object alongside the fish at approximately the same distance from the camera. Perspective, tilted objects and curved fish reduce accuracy.</p>
    <label>Reference object <select data-role="preset"><option value="custom">Custom / lure / boat detail</option><option value="3.375">Standard payment card — long edge, 3.375 in</option><option value="0.955">US quarter — diameter, 0.955 in</option></select></label>
    <label>Known distance <input data-role="dimension" type="number" min="0" step="any" inputmode="decimal"></label>
    <label>Units <select data-role="unit"><option value="in">Inches</option><option value="cm">Centimeters</option></select></label>
    <label>Zoom <input data-role="zoom" type="range" min="100" max="400" step="25" value="100"></label>
    <label><input data-role="pan" type="checkbox" style="width:auto;padding:0"> Pan photo while zoomed</label><p>Select an endpoint below, then tap its position on the photo. Drag a marker to adjust it. Arrow keys move the selected marker; Shift moves it farther.</p>
    <div data-role="points" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    <div data-role="viewport" style="overflow:auto;overflow-anchor:none;max-height:45dvh;border:1px solid #758579;margin-top:12px"><div data-role="surface" style="position:relative;width:100%;line-height:0"><img alt="Catch photo for measurement" style="display:block;width:100%;height:auto"><svg data-role="overlay" tabindex="0" role="application" aria-label="Photo endpoint editor" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></svg></div></div>
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
    try {const m=calculate();q('status').textContent='Estimated length: '+m.length.toFixed(1)+' '+m.unit+'. Approximate photo measurement, not a verified length.';q('apply').disabled=false;} catch(e) {q('status').textContent=points.every(Boolean)?e.message:'Mark all four endpoints. Selected: '+labels[selected]+'.';q('apply').disabled=true;}
  }
  function place(e){const r=q('overlay').getBoundingClientRect();points[selected]={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};render();}
  q('overlay').onpointerdown=e=>{e.preventDefault();const index=e.target.getAttribute('data-index');if(index!==null)selected=Number(index);dragging=true;q('overlay').setPointerCapture(e.pointerId);place(e);};
  q('overlay').onpointermove=e=>{if(dragging)place(e);};
  q('overlay').onpointerup=e=>{if(!dragging)return;dragging=false;if(selected<3&&!points[selected+1])selected++;render();};
  q('overlay').onpointercancel=()=>{dragging=false;};
  q('overlay').onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();const p=points[selected]||{x:.5,y:.5},n=e.shiftKey?10:1;points[selected]={x:Math.max(0,Math.min(1,p.x+delta[0]*n/image.naturalWidth)),y:Math.max(0,Math.min(1,p.y+delta[1]*n/image.naturalHeight))};render();};
  q('preset').onchange=()=>{if(q('preset').value!=='custom'){q('dimension').value=q('preset').value;q('unit').value='in';}render();};
  q('dimension').oninput=render;q('unit').onchange=render;
  q('pan').onchange=()=>{q('overlay').style.pointerEvents=q('pan').checked?'none':'auto';};
  q('zoom').oninput=()=>{q('surface').style.width=q('zoom').value+'%';render();};
  q('reset').onclick=()=>{points=[null,null,null,null];selected=0;render();};
  document.body.append(dialog);
  return new Promise(resolve=>{
    const observer=new ResizeObserver(render);observer.observe(q('surface'));
    dialog.addEventListener('close',()=>{observer.disconnect();URL.revokeObjectURL(url);dialog.remove();resolve(result);},{once:true});
    q('cancel').onclick=()=>dialog.close();
    q('apply').onclick=()=>{try{result=calculate();dialog.close();}catch(e){q('status').textContent=e.message;}};
    dialog.showModal();render();
  });
}
