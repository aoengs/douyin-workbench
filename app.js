'use strict';
const $ = id => document.getElementById(id);
const statuses = {queued:'准备中',collecting:'收集作品',waiting_login:'等待登录 / 验证',loading_model:'加载模型',processing:'提取中',paused:'已暂停',done:'已完成',partial:'部分完成',failed:'失败',stopped:'已停止',interrupted:'运行中断'};
const rowStatuses = {pending:'等待处理',downloading:'下载视频',transcribing:'识别口播',done:'已完成',failed:'失败',skipped:'已跳过'};
const active = new Set(['queued','collecting','waiting_login','loading_model','processing','paused']);
let token='', current=null, selectedId=null, filter='all', previewId=null, listSignature='', pendingControl=false, polls=0;
const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,body){return window.parent.workbench.request('extract',path,body);}
function error(message){$('alert').textContent=message;$('alert').hidden=!message;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,2600);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{error('无法访问剪贴板，请选中文字后使用 ⌘C 复制。');}}
function minutes(value){if(!value)return '—';return Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');}
function render(state){
  current=state;
  const running=active.has(state.status);
  $('empty-state').hidden=true;$('task-content').hidden=false;
  $('task-title').textContent=state.author||(running?'正在读取博主主页…':'主页提取任务');
  $('status-pill').textContent=statuses[state.status]||state.status;
  $('status-pill').className='pill'+(running?' running':['failed','partial','interrupted'].includes(state.status)?' error':'');
  const n=state.items.length, done=state.items.filter(x=>x.status==='done').length, failed=state.items.filter(x=>x.status==='failed').length, skipped=state.items.filter(x=>x.status==='skipped').length;
  $('total').textContent=n;$('done').textContent=done;$('failed').textContent=failed;$('pending').textContent=n-done-failed-skipped;
  $('message').textContent=state.message;$('progress-label').textContent=n?`${done+failed+skipped} / ${n}`:'';
  $('progress').value=n?(done+failed+skipped)/n*100:0;
  $('warning').textContent=state.warning||'';$('warning').hidden=!state.warning;
  $('pause').hidden=!running;$('pause').textContent=state.status==='paused'?'继续':'暂停';
  $('pause').disabled=pendingControl;
  $('stop').hidden=!running;$('stop').disabled=pendingControl;
  $('retry').hidden=running||state.status==='done';
  $('finish-collection').hidden=!['collecting','waiting_login'].includes(state.status)||!n;
  $('start').disabled=running;
  $('export').href=`/api/jobs/${state.id}/export`;
  $('export').hidden=!n;
  const collection=state.collection_complete?'已确认到达主页末页':state.collection_reason==='limit'?'已达到设置数量':state.warning?'采集不完整':'';
  $('collection-note').textContent=[collection,skipped?`已跳过 ${skipped} 条图文`:null,`模型 ${state.model}`].filter(Boolean).join(' · ');
  const signature=JSON.stringify([filter,state.items.map(x=>[x.id,x.title,x.status,x.progress,x.error])]);
  if(signature!==listSignature){
    listSignature=signature;
    const rows=state.items.map((x,i)=>({x,i})).filter(({x})=>filter==='all'||x.status===filter);
    $('no-rows').hidden=!!rows.length;
    $('rows').innerHTML=rows.map(({x,i})=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td class="title">${escapeHTML(x.title)}${x.error?`<small>${escapeHTML(x.error)}</small>`:''}</td><td class="duration-cell muted">${minutes(x.duration)}</td><td><span class="status ${x.status}">${x.status==='done'?'✓ ':x.status==='transcribing'?'◌ ':''}${rowStatuses[x.status]||escapeHTML(x.status)}${x.status==='transcribing'&&x.progress?' '+x.progress+'%':''}</span></td><td><div class="row-buttons">${x.status==='done'?`<button data-preview="${x.id}">查看</button>`:''}<button data-copy="${x.id}">链接</button></div></td></tr>`).join('');
  }
}
async function loadHistory(){
  const jobs=await api('/jobs');
  $('history').innerHTML=jobs.length?jobs.map(x=>`<button class="history-item ${x.id===selectedId?'selected':''}" data-job="${x.id}"><strong>${escapeHTML(x.author||'主页提取任务')}</strong><small>${escapeHTML(x.created_at.slice(5,16).replace('T',' '))} · ${x.count} 条 · ${statuses[x.status]||escapeHTML(x.status)}</small></button>`).join(''):'<p class="muted">你的提取任务会保存在这里</p>';
  if(!selectedId&&jobs.length){selectedId=jobs[0].id;render(await api('/jobs/'+selectedId));}
  return jobs;
}
async function refresh(){
  try {if(selectedId)render(await api('/jobs/'+selectedId));await loadHistory();if(++polls%6===0)await refreshInfo();}
  catch(e){error('连接中断：'+e.message+'。请确认启动终端仍在运行。');}
  finally{setTimeout(refresh,1800);}
}
$('start-form').addEventListener('submit',async event=>{
  event.preventDefault();error('');$('start').disabled=true;
  try{const s=await api('/jobs',{link:$('link').value,limit:Number($('limit').value),model:$('model').value,keep_video:$('keep-video').checked});selectedId=s.id;listSignature='';render(s);await loadHistory();}
  catch(e){error(e.message);$('start').disabled=false;}
});
$('paste').onclick=async()=>{try{$('link').value=await navigator.clipboard.readText();$('link').focus();}catch{toast('请点击输入框，使用 ⌘V 粘贴');$('link').focus();}};
$('history').onclick=async event=>{const button=event.target.closest('[data-job]');if(!button)return;try{selectedId=button.dataset.job;listSignature='';render(await api('/jobs/'+selectedId));await loadHistory();}catch(e){error(e.message);}};
$('refresh-history').onclick=()=>loadHistory().catch(e=>error(e.message));
async function control(action){if(!current)return;error('');pendingControl=true;try{await api(`/jobs/${current.id}/control`,{action});toast(action==='pause'?'已请求暂停，当前分段完成后生效':action==='stop'?'正在停止，已完成的文案会保留':'操作已提交');}catch(e){error(e.message);}finally{pendingControl=false;}}
$('pause').onclick=()=>control(current.status==='paused'?'resume':'pause');$('stop').onclick=()=>control('stop');$('retry').onclick=()=>control('retry');$('finish-collection').onclick=()=>control('finish_collection');
$('open-folder').onclick=async()=>{try{await api(`/jobs/${current.id}/open-folder`,{});}catch(e){error(e.message);}};
$('filter-group').onclick=event=>{const button=event.target.closest('[data-filter]');if(!button)return;filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('selected',b===button));render(current);};
$('rows').onclick=event=>{
  const copyButton=event.target.closest('[data-copy]');if(copyButton){copy(current.items.find(x=>x.id===copyButton.dataset.copy).url);return;}
  const button=event.target.closest('[data-preview]');if(!button)return;
  const item=current.items.find(x=>x.id===button.dataset.preview);previewId=item.id;
  $('preview-title').textContent=item.title;$('preview-author').textContent=item.author;$('preview-text').textContent=item.text;
  $('original').href=item.url;
  for(const ext of ['txt','srt']){const file=item.files.find(x=>x.endsWith('.'+ext));$('download-'+ext).href=`/api/jobs/${current.id}/files/${encodeURIComponent(file)}`;}
  $('preview').showModal();
};
$('copy-text').onclick=()=>copy(current.items.find(x=>x.id===previewId).text);
$('close-preview').onclick=()=>$('preview').close();$('help-button').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();
async function refreshInfo(){const info=await api('/info');token=info.token;$('storage-text').textContent='保存至 '+info.storage_root;$('machine').textContent=info.machine;$('disk-status').textContent=info.storage_ready?'磁盘已连接':'磁盘未就绪';$('disk-status').classList.toggle('error',!info.storage_ready);if(!info.storage_ready)error(info.storage_error);}
async function init(){try{await refreshInfo();await loadHistory();refresh();}catch(e){error(e.message);}}
init();
