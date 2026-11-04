/* Short, accessible in-app launch bridge matching the Android branded startup screen. */
(()=>{
  'use strict';
  const splash=document.getElementById('df-launch-splash');
  if(!splash)return;
  let finished=false;
  function finish(){
    if(finished)return;
    finished=true;
    splash.classList.add('df-splash-hide');
    splash.setAttribute('aria-hidden','true');
    window.setTimeout(()=>splash.remove(),300);
  }
  // A slow or failed storage init must not obscure the log or Diagnostics tab.
  document.addEventListener('df-catch-ready',()=>window.setTimeout(finish,180),{once:true});
  window.addEventListener('load',()=>{
    if(window.__DF_CATCH_APP_BOOT?.initialized)window.setTimeout(finish,180);
  },{once:true});
  window.setTimeout(finish,2800);
})();