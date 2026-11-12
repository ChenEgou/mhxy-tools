"use strict";
/* ========== 外壳：顶栏（页面 + 账号） ========== */
function shell(){
  var h='<header class="appbar"><div class="bar-in"><div class="brand">梦·工具</div>'+
    '<nav class="pseg" aria-label="选择页面">'+PAGES.map(function(p){return '<button type="button" data-page="'+p[0]+'">'+p[1]+'</button>'}).join("")+'</nav>'+
    '<div class="acct"><span class="lbl">账号</span><div class="aseg" role="group" aria-label="选择账号">'+ACCOUNTS.map(function(a){return '<button type="button" data-acct="'+a[0]+'">'+a[1]+'<span class="b" id="ab-'+a[0]+'"></span></button>'}).join("")+'</div></div>'+
    '<div class="cloud"><span id="run-sync" class="status"></span><button type="button" id="run-cloud" title="随时可以点，只是把数据提交到 GitHub，不会结算">存云端</button><button type="button" id="gh-open" class="ghost gear" title="同步设置" aria-label="同步设置">⚙</button></div>'+
    '</div></header><div class="toast" id="toast" role="status"></div>'+
    '<div class="ghset" id="ghset" hidden><div class="ghbox" role="dialog" aria-modal="true" aria-labelledby="gh-h"><h3 id="gh-h">同步设置</h3>'+
    '<label>仓库<input type="text" id="gh-repo" placeholder="用户名/mhxy" autocomplete="off" spellcheck="false"></label>'+
    '<label>写入密钥<input type="password" id="gh-token" autocomplete="off" spellcheck="false"></label>'+
    '<p class="note">密钥只存在这台设备的浏览器里。每台设备设一次。</p>'+
    '<div class="ghmsg" id="gh-msg" role="status"></div>'+
    '<div class="row"><button type="button" id="gh-ok">保存</button><button type="button" class="ghost" id="gh-cancel">取消</button><span class="sp"></span><button type="button" class="del" id="gh-clear">删除本机密钥</button></div>'+
    '<div class="bk" id="gh-bk" hidden></div>'+
    '<div class="links"><a id="gh-hist" target="_blank" rel="noopener">历史版本 ↗</a><a id="gh-file" target="_blank" rel="noopener">数据文件 ↗</a></div>'+
    '</div></div>'+
    '<div class="stale" id="stale" role="alert" hidden><span>数据在另一个标签页里改过了，这个页面是旧的，继续操作会盖掉那边的改动。</span><button type="button" id="stale-reload">刷新</button></div>';
  h+='<div class="wrap"><div class="page" id="page-price">'+priceShell()+'</div><div class="page" id="page-run" hidden>'+runShell()+'</div><div class="page" id="page-calc" hidden>'+calcShell()+'</div></div>';
  $("app").innerHTML=h;
}
function markTabs(){
  ACCOUNTS.forEach(function(a){
    var b=document.querySelector('.aseg [data-acct="'+a[0]+'"]'),on=a[0]===acct;
    b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false");
    var n=RUN[a[0]].cur.list.length;
    $("ab-"+a[0]).textContent=(page==="run"&&n)?n+"/100":"";
  });
  Array.prototype.forEach.call(document.querySelectorAll(".pseg [data-page]"),function(b){var on=b.dataset.page===page;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false")});
  Array.prototype.forEach.call(document.querySelectorAll("[data-chip]"),function(el){el.textContent=acctName(acct)});
}
function setHash(){var h="#"+acct+"/"+page;if(location.hash!==h){try{history.replaceState(null,"",h)}catch(e){try{location.hash=acct+"/"+page}catch(e2){}}}}
function isPage(p){return PAGES.some(function(x){return x[0]===p})}
function setPage(p){
  if(!isPage(p))return;
  page=p;PAGES.forEach(function(x){$("page-"+x[0]).hidden=x[0]!==p});
  markTabs();lsSet(PAGE_KEY,p);setHash();
}
/* 后台读到新的云端数据、合并完以后，重画当前号的所有页面（新增页面也要加到这里） */
function redraw(){
  loadAccount(acct);fill();update();initialStatus();
  renderRun({fillSet:true});calcLoad();markTabs();
}
function switchTo(k){
  if(!DATA[k]||k===acct)return;
  loadAccount(k);fill();update();initialStatus();
  $("m-price").value="";$("m-name").value="";runMsg("");stMsg("");hMsg("");
  renderRun({fillSet:true});calcLoad();markTabs();
  lsSet(TAB_KEY,k);setHash();
}
function onInput(e){
  var el=e.target;
  /* 离开输入框时自动纠正了数字（限位、取整、空了填默认值）：也要同步到数据，不然显示和计算对不上 */
  var fixed=clampNum(el,e.type==="change");
  if(el.closest&&el.closest("#page-calc")){if(e.type==="input"||fixed||el.tagName==="SELECT"||el.type==="checkbox")calcInput(el);return}
  if(el.closest&&el.closest("#page-run")){if(e.type==="input"||fixed||el.tagName==="SELECT")runInput(el);return}
  priceInput(el);
}
function onClick(e){
  if(e.target.id==="ghset"){closeGh();return}
  var el=e.target.closest?e.target.closest("button"):null;
  if(!el)return;
  if(el.id==="gh-open"){openGh();return}
  if(el.id==="gh-cancel"){closeGh();return}
  if(el.id==="gh-ok"){ghOk();return}
  if(el.id==="gh-clear"){GH.setToken("");$("gh-token").placeholder="github_pat_…";ghMsg("已删除这台设备上的密钥","ok");syncStatus();return}
  if(el.dataset.bkr){backupRestore(el.dataset.bkr);return}
  if(el.dataset.bkd){backupDel(el.dataset.bkd);return}
  if(el.id==="stale-reload"){location.reload();return}
  if(el.dataset.acct){switchTo(el.dataset.acct);return}
  if(el.dataset.page){setPage(el.dataset.page);return}
  if(el.id==="run-cloud"){publishAll("",toast);return}
  if(el.closest("#page-calc")){calcClick(el);return}
  if(el.closest("#page-run")){runClick(el);return}
  priceClick(el);
}
function onKey(e){
  if(e.key==="Escape"&&!$("ghset").hidden){closeGh();return}
  if(e.key==="Enter"&&(e.target.id==="gh-repo"||e.target.id==="gh-token")){e.preventDefault();ghOk();return}
  if(e.key==="Enter"&&(e.target.id==="m-name"||e.target.id==="m-price")){e.preventDefault();addManual()}
}

/* 藏宝阁价格表：后台读一次，再重画结算区（没变化也重画：「几分钟前」和「没在更新」的提示要跟着时间走）。force：不管离上次多久都读 */
function cbgPull(force){CBG.load(force).then(function(){cbgChanged()})}

/* ========== 启动：云端数据读到后执行 ========== */
function mhxyMain(data,BOOT){
/* 读到云端就更新本机副本；读不到就先用本机副本 */
var fromCache=false;
if(data&&typeof data==="object"){if(BOOT&&BOOT.via==="api")lsSet(cacheKey(),data)}
else{var c=lsGet(cacheKey());if(c&&typeof c==="object"){data=c;fromCache=true}}
cloudData=!!(data&&typeof data==="object");
embedded=cloudData?data:{};
CBG.init();/* 藏宝阁价格表：先用这台设备上次读到的，画完页面再读最新的 */
priceLoadData();runLoadData();calcLoadData();
var hs=(location.hash||"").replace("#","").split("/");
var start=hs[0];if(!DATA[start]){start=lsGet(TAB_KEY);if(!DATA[start])start="ruyi"}
var startPage=hs[1];if(!isPage(startPage)){startPage=lsGet(PAGE_KEY);if(!isPage(startPage))startPage="price"}
shell();loadAccount(start);fill();update();renderRun({fillSet:true});calcInit();setPage(startPage);initialStatus();
window.addEventListener("hashchange",function(){var p=(location.hash||"").replace("#","").split("/");if(DATA[p[0]])switchTo(p[0]);if(p[1])setPage(p[1])});
var app=$("app");
app.addEventListener("input",onInput);
app.addEventListener("change",onInput);
app.addEventListener("click",onClick);
app.addEventListener("keydown",onKey);
/* 启动提示：读云端出的问题 + 两台设备都改过、已自动合并的 */
var msgs=[];if(BOOT&&BOOT.msg)msgs.push(BOOT.msg);
if(fromCache&&BOOT&&BOOT.via!=="missing")msgs.push("先显示这台设备上次读到的云端数据");
if(MERGED.length)msgs.push(mergedMsg());
if(msgs.length)toast(msgs.join("；"),"err");
/* 同一台设备开了两个标签页：另一个标签页改了数据，这个页面就是旧的了。在后台就直接刷新，正在看就提示 */
window.addEventListener("storage",function(e){
  if(e.key!==null&&(String(e.key).indexOf("mhxy-")!==0||e.key===TAB_KEY||e.key===PAGE_KEY||e.key===CBG.key))return;/* 只是切了页面或账号、或者读到了新的藏宝阁价格表，不算 */
  if(document.hidden){location.reload();return}
  $("stale").hidden=false;
});
/* 自动同步：关页面时马上存，切走时离上次存够久了才存；切回页面、窗口获得焦点、网络恢复时检查云端有没有更新；页面开着时定时检查 */
document.addEventListener("visibilitychange",function(){
  if(document.hidden){flushSave();return}
  if(!$("stale").hidden){location.reload();return}
  pullMerge();cbgPull();
});
window.addEventListener("pagehide",function(){flushSave(true)});
window.addEventListener("focus",function(){pullMerge();cbgPull()});
window.addEventListener("online",function(){pullMerge(true)});
setInterval(function(){if(!document.hidden&&GH.ready())pullMerge()},POLL_MS);
setInterval(function(){if(!document.hidden)cbgPull()},10*60000);cbgPull(true);
lastPull=Date.now();/* 刚读过云端，不用马上再读 */
if(anyDirty())autoSave();/* 上次没存上的改动：打开后自动补存 */
}
GH.load().then(function(r){mhxyMain(r&&r.data,r)},function(){mhxyMain(null,{err:"读取失败"})});
