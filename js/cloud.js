"use strict";
/* ========== 存云端 ==========
   各页面在自己文件末尾用 syncReg() 登记要上云的数据：
     dump(k)    这个号要上传的字段，会并进 data.json 里这个号的对象（如 {records:[…]}）
     dirty(k)   这个号这一块还有没有没上传的改动
     snap(k)    上传前记下「这次带上了哪些改动」
     ack(k,s)   上传成功后，只清掉 s 里那些改动的标记（上传途中新做的改动保留）
   启动时云端和本机怎么合并，在各页面的 xxxLoadData() 里做。 */
var SYNC=[],busy=false,again=false;
/* 本机留的云端副本：每次读到或存上云端就更新，读不到云端时先显示它（按仓库分开存） */
function cacheKey(){return "mhxy-cloud-cache-v1:"+(GH.repo()||"local")}
/* 合并时两台设备都改过、而且有一边的内容没进合并结果（留了备份）的：[[号, "跑环"], …]，合并后提示一次 */
var MERGED=[];
function syncReg(m){SYNC.push(m)}
function isDirty(k){return SYNC.some(function(m){return m.dirty(k)})}
function anyDirty(){return ACCOUNTS.some(function(a){return isDirty(a[0])})}

/* 要上传的整份数据：以打开页面时读到的云端为底（保留不认识的字段，免得旧页面删掉新功能的数据），再盖上各模块的数据 */
function fullState(){
  var o=clone(embedded||{});delete o.records;o.version=3;
  var acc=o.accounts&&typeof o.accounts==="object"?o.accounts:{};
  ACCOUNTS.forEach(function(a){
    var k=a[0],x=acc[k]&&typeof acc[k]==="object"?acc[k]:{};
    x.name=a[1];SYNC.forEach(function(m){Object.assign(x,m.dump(k))});acc[k]=x;
  });
  o.accounts=acc;return o;
}

/* 把两个号的全部数据提交到 GitHub data 分支的 data.json（每次一个版本）。
   show(文字, 类型)：结果显示在哪。opt.auto：自动存（成功不提示，出错不弹窗）。
   正在存的时候又要存：不丢，等这次存完自动再存一次。
   别的设备刚存过（冲突）：后台重读云端、合并，再存一次（最多两回），不刷新页面。 */
function publishAll(okMsg,show,opt){
  opt=opt||{};show=show||toast;
  var pre=okMsg?okMsg+"，":"",tries=opt.tries||0;
  clearTimeout(autoT);autoT=null;autoFirst=0;/* 这次会把所有改动都带上，自动存的计时作废 */
  if(busy){again=true;if(!opt.auto)show(pre+"等上一次存完会自动再存","dirty");return Promise.resolve(false)}
  if(pulling)return pulling.then(function(){return publishAll(okMsg,show,opt)});
  if(!GH.ready()){syncStatus();if(!opt.auto){show(pre+"只存在本机（还没设同步密钥）","dirty");openGh()}return Promise.resolve(false)}
  var snap={};ACCOUNTS.forEach(function(a){snap[a[0]]=SYNC.map(function(m){return m.snap(a[0])})});
  busy=true;again=false;syncStatus();if(show!==toast&&!opt.auto)show(pre+"正在存云端…","");
  var state=fullState();
  return GH.save(state,opt.auto?"自动存云端":(okMsg||"存云端")).then(function(){
    embedded=state;cloudData=true;lsSet(cacheKey(),state);
    ACCOUNTS.forEach(function(a){SYNC.forEach(function(m,i){m.ack(a[0],snap[a[0]][i])})});
    busy=false;autoErr="";lastSaved=Date.now();syncStatus();afterSync();show(pre+"已存云端","ok");
    if(again){again=false;if(anyDirty())publishAll("",autoShow,{auto:true})}
    return true;
  },function(err){
    busy=false;again=false;
    if(err&&err.code==="conflict"&&tries<2){
      if(!opt.auto)show(pre+"别的设备刚存过，正在合并…","");
      return pullMerge(true).then(function(ok){
        if(ok)return publishAll(okMsg,show,{auto:opt.auto,tries:tries+1});
        syncStatus();show(pre+"只存在本机（"+ghErr(err)+"）","err");return false;
      });
    }
    syncStatus();
    show(pre+"只存在本机（"+ghErr(err)+"）",err&&err.code==="conflict"?"err":"dirty");
    if(!opt.auto)ghAfterErr(err);/* 自动存出错不弹窗、不刷新，顶栏会显示「未存云端」 */
    return false;
  });
}

/* ========== 自动存云端 ==========
   两次存云端至少隔 AUTO_GAP，免得连着改的时候（一环一环地记）存个不停：
     离上次存已经满了 AUTO_GAP：改动停下 AUTO_IDLE 就存；一直在改的话，从第一次改动算起最多等 AUTO_MAX。
     还没满：等到满的那一刻再存。
   切走页面、网络恢复时也按这个间隔来；关页面时不管间隔马上存。手动点「存云端」、结算不受这个限制。
   没设密钥、云端没读到时不自动存。 */
var AUTO_IDLE=8000,AUTO_MAX=60000,AUTO_GAP=600000,autoT=null,autoFirst=0,autoErr="",lastSaved=0;
function autoSave(){
  if(!GH.ready()||!GH.canSave()||!anyDirty())return;
  var now=Date.now();if(!autoFirst)autoFirst=now;
  clearTimeout(autoT);
  autoT=setTimeout(autoRun,Math.max(0,Math.min(AUTO_IDLE,autoFirst+AUTO_MAX-now),lastSaved+AUTO_GAP-now));
  syncStatus();
}
function autoRun(){autoT=null;autoFirst=0;if(anyDirty())publishAll("",autoShow,{auto:true})}
/* force：不管离上次存了多久都存（关页面时用） */
function flushSave(force){if(GH.ready()&&GH.canSave()&&anyDirty()&&(force===true||Date.now()-lastSaved>=AUTO_GAP)){clearTimeout(autoT);autoRun()}}
/* 自动存的提示：成功不打扰（顶栏显示「已存云端」）；出错只提示一次，直到下次存成功 */
function autoShow(t,kind){if((kind!=="err"&&kind!=="dirty")||t===autoErr)return;autoErr=t;toast(t,kind)}

/* ========== 自动拉取：不刷新页面，重新读云端并合并 ==========
   切回页面、窗口获得焦点、网络恢复、定时（POLL_MS）、存的时候冲突了，都会调 pullMerge。
   force：不管离上次多久都读（冲突时用）。返回 true = 读到了云端（不管有没有变化） */
var pulling=null,lastPull=0,PULL_GAP=5000,POLL_MS=60000;
function pullMerge(force){
  if(pulling)return pulling;
  if(busy||!GH.repo()||!canStore||storeBad)return Promise.resolve(false);
  if(!force&&Date.now()-lastPull<PULL_GAP)return Promise.resolve(false);
  lastPull=Date.now();
  pulling=GH.refresh().then(function(x){
    pulling=null;
    if(!x){syncStatus();return false}
    if(x.changed&&x.data&&typeof x.data==="object")applyCloud(x.data);else syncStatus();
    autoSave();
    return true;
  },function(){pulling=null;return false});
  return pulling;
}
/* 用新读到的云端数据重新合并（各页面的 xxxLoadData 从本机存储和 embedded 合并），再重画当前页面 */
function applyCloud(data){
  embedded=data;cloudData=true;lsSet(cacheKey(),data);
  MERGED=[];priceLoadData();runLoadData();calcLoadData();
  redraw();
  if(MERGED.length)toast(mergedMsg(),"err");
}
function mergedMsg(){return "两台设备都改过："+MERGED.map(function(m){return acctName(m[0])+"的"+m[1]}).join("、")+"，已自动合并，另一份在 ⚙ 里可以恢复"}
/* 存完以后，重画跟「有没有存上」有关的地方 */
function afterSync(){renderRounds();markTabs();if(!hasDraft)initialStatus()}

/* 顶栏的同步状态 */
function syncStatus(){
  var el=$("run-sync"),t,k,any=anyDirty();
  if(busy){t="存云端中…";k=""}
  else if(!canStore||storeBad){t="本机存不了，记得存云端";k="err"}
  else if(!GH.repo()){t="没设同步";k="dirty"}
  else if(!GH.canSave()){t=any?"未存云端 · 云端没读到":"云端没读到";k="err"}
  else if(any){t=GH.ready()?(autoT?"稍后自动存云端":"未存云端"):"未存云端 · 没设密钥";k="dirty"}
  else{t="已存云端";k="ok"}
  el.textContent=t;el.className="status"+(k?" "+k:"");
  var b=$("run-cloud");if(b){b.disabled=busy;b.classList.toggle("ghost",!any)}
}
var toastTimer=null;
function toast(t,kind){var el=$("toast");if(!t){return}el.textContent=t;el.className="toast show"+(kind?" "+kind:"");clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className="toast"+(kind?" "+kind:"")},kind==="ok"?2200:Math.max(4500,t.length*120))}
function ghErr(e){var c=e&&e.code;
  return c==="conflict"?"别的设备刚存过，马上重新读取并合并；本机改动都还在，读完再点一次存云端":
    c==="stale"?"打开页面时没读到最新的云端数据，刷新页面后再存":
    c==="bad"?"云端数据文件读不出来，为免覆盖先不存（⚙ 里「历史版本」能找回旧数据）":
    c==="nobranch"?"云端仓库里没有 data 分支":
    c==="ratelimit"?"GitHub 限流了，过几分钟再存":
    c==="badtoken"?"密钥不对或过期了，点 ⚙ 重新粘贴":c==="noperm"?"密钥没有这个仓库的写入权限":
    c==="notoken"?"还没设同步密钥":c==="net"?"连不上 GitHub":"云端没存上"+(e&&e.status?"（"+e.status+"）":"")}
function ghAfterErr(e){var c=e&&e.code;if(c==="conflict")setTimeout(function(){location.reload()},2200);else if(c==="badtoken"||c==="noperm")openGh()}

/* ========== 冲突备份：两台设备都改过同一块时，被合并 / 被换掉的那份留下来，⚙ 里可恢复 ========== */
var BK_KEY="mhxy-backup-v1";
function backupAdd(k,part,data,from){var l=lsGet(BK_KEY)||[];l.unshift({id:newId(),ts:Date.now(),k:k,part:part,from:from||"本机",data:data});lsSet(BK_KEY,l.slice(0,10))}
function bkDesc(b){
  var from=(b.from||"本机")+"的版本";
  if(b.part==="run"){var c=b.data&&b.data.cur,n=c&&Array.isArray(c.list)?c.list.length:0;return "跑环（"+from+"，当前这一轮 "+n+" 环）"}
  return "等级计算（"+from+"）";
}
function renderBackups(){
  var l=lsGet(BK_KEY)||[],el=$("gh-bk");
  if(!l.length){el.hidden=true;el.innerHTML="";return}
  el.hidden=false;
  el.innerHTML='<div class="bk-h">两台设备冲突时留下的备份</div>'+l.map(function(b){
    return '<div class="bk-r"><span>'+esc(acctName(b.k))+' · '+bkDesc(b)+' · '+fmtTime(b.ts)+'</span>'+
      '<button type="button" class="ghost" data-bkr="'+esc(b.id)+'">恢复</button><button type="button" class="del" data-bkd="'+esc(b.id)+'">删</button></div>';
  }).join("");
}
function backupRestore(id){
  var b=null;(lsGet(BK_KEY)||[]).forEach(function(x){if(x.id===id)b=x});
  if(!b||!RUN[b.k])return;
  var k=b.k;
  if(b.part==="run"){var r=normRun(b.data);r.base=RUN[k].base;RUN[k]=r;touch(k)}
  else{CALC[k]=normCalc(b.data&&b.data.v);CALCU[k]=Date.now();CALCD[k]=true;calcStore(k)}
  if(k===acct){renderRun({fillSet:true});calcLoad()}
  markTabs();syncStatus();autoSave();
  ghMsg("已恢复「"+acctName(k)+"」的"+(b.part==="run"?"跑环":"等级计算")+"，稍后会自动存云端","ok");
}
function backupDel(id){lsSet(BK_KEY,(lsGet(BK_KEY)||[]).filter(function(x){return x.id!==id}));renderBackups()}

/* ========== 同步设置弹窗 ========== */
function ghMsg(t,k){var el=$("gh-msg");el.textContent=t||"";el.className="ghmsg"+(k?" "+k:"")}
function openGh(){
  var r=GH.repo();$("gh-repo").value=r;$("gh-token").value="";
  $("gh-token").placeholder=GH.token()?"已设置（不换就留空）":"github_pat_…";
  var a=$("gh-hist"),b=$("gh-file");
  if(r){a.href="https://github.com/"+r+"/commits/"+GH.branch+"/"+GH.path;b.href="https://github.com/"+r+"/blob/"+GH.branch+"/"+GH.path;a.hidden=b.hidden=false}else{a.hidden=b.hidden=true}
  renderBackups();
  ghMsg("");$("ghset").hidden=false;setTimeout(function(){(r?$("gh-token"):$("gh-repo")).focus()},30);
}
function closeGh(){$("ghset").hidden=true}
function ghOk(){
  var rv=$("gh-repo").value.trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/+$/,""),tv=$("gh-token").value.trim();
  if(!/^[\w.-]+\/[\w.-]+$/.test(rv)){ghMsg("仓库要填成 用户名/仓库名，比如 abc/mhxy","err");return}
  var t=tv||GH.token();
  if(!t){ghMsg("把密钥粘贴进来","err");return}
  ghMsg("正在检查…");$("gh-ok").disabled=true;
  GH.check(rv,t).then(function(st){
    $("gh-ok").disabled=false;
    if(st===401){ghMsg("密钥不对或已过期","err");return}
    if(st===404){ghMsg("找不到这个仓库，检查一下名字","err");return}
    if(st!==200){ghMsg(st?"GitHub 返回 "+st+"，稍后再试":"连不上 GitHub","err");return}
    var changed=rv!==GH.loadedRepo();
    GH.setRepo(rv);if(tv)GH.setToken(tv);syncStatus();
    if(changed){ghMsg("已保存，正在读取这个仓库的数据…","ok");setTimeout(function(){location.reload()},900);return}
    closeGh();
    if(anyDirty())publishAll("",toast);else toast("同步设好了","ok");
  });
}
