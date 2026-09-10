'use strict';
document.addEventListener('click',async e=>{
  const a=e.target.closest('a');if(!a)return;
  const href=a.getAttribute('href')||'';
  if(['#extract','#proofread'].includes(href)){e.preventDefault();window.parent.workbench.switchTo(href.slice(1));return;}
  if(!href.startsWith('/api/'))return;
  e.preventDefault();
  try{await window.parent.workbench.download(document.body.dataset.service,href.slice(4));}
  catch(err){const alert=document.getElementById('alert');alert.textContent=err.message;alert.hidden=false;}
});
