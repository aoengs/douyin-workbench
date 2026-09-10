'use strict';
(()=>{
  const $=id=>document.getElementById(id), base='http://127.0.0.1:8767';
  let pair='', generation=0;
  async function response(service,path,body){
    if(!pair)throw new Error('请先连接本机工作台');
    if(!['extract','proofread'].includes(service)||!/^\/[a-z0-9]/i.test(path))throw new Error('不支持的请求');
    const headers={'X-Local-Token':pair};
    if(body!==undefined)headers['Content-Type']='application/json';
    let r;
    try{r=await fetch(base+'/api/'+service+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(55000)});}
    catch{throw new Error('无法连接本机。请确认启动在线版.command 正在运行，并允许浏览器访问本地网络。');}
    if(!r.ok){let d={};try{d=await r.json();}catch{}throw new Error(typeof d.detail==='string'?d.detail:'本机请求失败');}
    return r;
  }
  function switchTo(service){for(const name of ['extract','proofread']){$(name+'-frame').hidden=name!==service;$(name+'-tab').classList.toggle('active',name===service);}}
  window.workbench={
    request:async(service,path,body)=>(await response(service,path,body)).json(),
    download:async(service,path)=>{
      const r=await response(service,path), blob=await r.blob();
      let name=path.endsWith('/export')?'文案导出.zip':decodeURIComponent(path.split('/').pop());
      const disposition=r.headers.get('Content-Disposition')||'', utf=disposition.match(/filename\*=utf-8''([^;]+)/i), plain=disposition.match(/filename="([^"]+)"/i);
      try{if(utf)name=decodeURIComponent(utf[1]);else if(plain)name=plain[1];}catch{}
      name=name.replace(/[\\/\x00-\x1f]/g,'_');
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    },
    switchTo,
  };
  $('pair-form').onsubmit=async e=>{
    e.preventDefault();const attempt=++generation;pair=$('pair-code').value.trim();$('pair-code').value='';$('connect').disabled=true;$('connect-error').hidden=true;
    try{
      if(!/^[A-Za-z0-9_-]{40,80}$/.test(pair))throw new Error('请输入本机连接页显示的连接码；这里不填写千问密钥。');
      await Promise.all([window.workbench.request('extract','/info'),window.workbench.request('proofread','/info')]);
      if(attempt!==generation)return;
      $('extract-frame').src='extract.html';$('proofread-frame').src='proofread.html';$('connect-panel').hidden=true;$('workspace').hidden=false;$('disconnect').hidden=false;$('connection-state').textContent='已连接本机 · 文件保存在你的电脑';
      $('extract-tab').disabled=false;$('proofread-tab').disabled=false;switchTo('extract');
    }catch(e){pair='';$('connect-error').textContent=e.message;$('connect-error').hidden=false;}
    finally{$('connect').disabled=false;}
  };
  $('disconnect').onclick=()=>{pair='';generation++;for(const n of ['extract','proofread']){$(n+'-frame').src='about:blank';$(n+'-tab').disabled=true;}$('workspace').hidden=true;$('connect-panel').hidden=false;$('disconnect').hidden=true;$('connection-state').textContent='已断开网页连接 · 本机任务继续运行';};
  for(const name of ['extract','proofread'])$(name+'-tab').onclick=()=>switchTo(name);
})();
