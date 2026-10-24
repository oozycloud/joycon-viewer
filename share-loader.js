(async()=>{
 const params=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 const initialFragmentToken=fragment.get('share');window.addEventListener('hashchange',()=>{const next=new URLSearchParams(location.hash.slice(1)).get('share');if(next!==initialFragmentToken&&(next!==null||initialFragmentToken!==null))location.reload()});
 const present=params.has('share')||fragment.has('share');
 if(present){
  window.__VIEWER_GUEST_SHARE=true;
  if(params.get('overlay')==='1')document.body.classList.add('overlay');
  const status=document.getElementById('empty-hint');status.textContent='Loading shared design…';
  try{window.__VIEWER_SHARE_CONFIG=await ViewerShares.read(fragment.get('share')??params.get('share'));const value=window.__VIEWER_SHARE_CONFIG;if(!['pair','pair2','pro','generic'].includes(value.layout))throw Error('This shared design has an invalid controller layout.');ControllerDesignCore.validate(value.designs);ControllerPackCore.validate(value.partAssets)}
  catch(error){status.textContent=error.message;status.style.cssText='display:block!important;color:#fff;background:#25272b;padding:20px;max-width:540px;white-space:normal';status.setAttribute('role','alert');document.getElementById('status').textContent='Design link failed';return}
 }
 const script=document.createElement('script');script.src='app.js?v=design-shares-1';script.onerror=()=>{document.getElementById('empty-hint').textContent='Viewer failed to load. Reload this page.'};document.body.append(script);
})();
