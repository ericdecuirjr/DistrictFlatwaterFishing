/* District Flatwater Fishing branded in-app launch: two seconds when ready,
   with a bounded fallback so startup errors never permanently obstruct the app.
   The native Android OS splash may add platform-dependent startup time. */
(()=>{
  'use strict';
  const splash=document.getElementById('df-launch-splash');
  if(!splash)return;
  const MIN_VISIBLE_MS=2000;
  const MAX_VISIBLE_MS=5000;
  const started=performance.now();
  let finished=false;
  let hideTimer=null;
  function finish(){
    if(finished)return;
    finished=true;
    if(hideTimer!==null)window.clearTimeout(hideTimer);
    splash.classList.add('df-splash-hide');
    splash.setAttribute('aria-hidden','true');
    window.setTimeout(()=>splash.remove(),300);
  }
  function ready(){
    if(finished)return;
    const remaining=Math.max(0,MIN_VISIBLE_MS-(performance.now()-started));
    if(hideTimer!==null)window.clearTimeout(hideTimer);
    hideTimer=window.setTimeout(finish,remaining);
  }
  document.addEventListener('df-catch-ready',ready,{once:true});
  if(window.__DF_CATCH_APP_BOOT?.initialized)ready();
  window.addEventListener('load',()=>{
    if(window.__DF_CATCH_APP_BOOT?.initialized)ready();
  },{once:true});
  // Never block access to Settings/Diagnostics after a failed initialization.
  window.setTimeout(finish,MAX_VISIBLE_MS);
})();