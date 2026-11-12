"use strict";
/* ========== 跑环记录 ========== */
var JIE=10; /* 接任务固定 10 万 */
/* 分数是游戏里固定的：找人1；一家/三药/烹饪/60环 2；70环 3；花、乐器 4；二家/80环 5；
   垃圾变异 5；指定变异 10；交了普通宝宝 -15；跳过 -20（不给修炼经验）。 */
var ITEMS=[
  ["w60","60武",2,"hz"],["a60","60装",2,"hz"],["w70","70武",3,"hz"],["a70","70装",3,"hz"],["w80","80武",5,"hz"],["a80","80装",5,"hz"],
  ["zr","找人",1,"jj"],["j1","一家",2,"jj"],["j2","二家",5,"jj"],["yao","三药",2,"jj"],["pr","烹饪",2,"jj"],
  ["baihe","百合",4,"hua"],["kang","康乃馨",4,"hua"],["mudan","牡丹",4,"hua"],["meigui","玫瑰",4,"hua"],
  ["suona","唢呐编钟",4,"yue"],["muyu","木鱼琵琶",4,"yue"],["shuqin","竖琴",4,"yue"],["dizi","笛子",4,"yue"],["xiaobo","萧钹",4,"yue"],
  ["ljby","垃圾变异",5,"bb"],["zdby","指定变异",10,"bb"],["ptbb","普通宝宝",-15,"bb"],["skip","跳过",-20,"bb"]
];
var IT={};ITEMS.forEach(function(x){IT[x[0]]={k:x[0],n:x[1],s:x[2],g:x[3]}});
IT.py={k:"py",n:"烹药1家",s:2,g:"old"};IT.m={k:"m",n:"手动",s:0,g:"old"};
var GROUPS=[["hz","环装"],["jj","找人 · 家具药品"],["hua","花"],["yue","乐器"],["bb","召唤兽 · 跳过"]];
var NOPRICE={zr:1,skip:1,zdby:1}; /* 指定变异每只价钱不一样，用“手动记一环” */
/* 手动记一环：算作哪一类 */
var MTYPES=[["zdby","指定变异 +10",10],["ljby","垃圾变异 +5",5],["ptbb","普通宝宝 −15",-15],["m5","其他 +5",5],["m4","其他 +4",4],["m3","其他 +3",3],["m2","其他 +2",2],["m1","其他 +1",1],["m0","其他 0",0]];
var EXTRA={"":"没给",guo:"修炼果",e200:"200 修炼经验",tu:"三级家具图"};
/* RUN[号]：定价设置 set + 当前这一轮 cur。本机多存两个字段：dirty 有没上传的改动；base 这份是基于云端哪个版本（云端的 u）改的
   ROUNDS[号]：结算过的轮次，本机新结算、还没上传的带 lo:true
   RDEL[号]：本机删掉、还没上传的轮次 id（删除记号，防止刷新后从云端「复活」） */
var RUN={},ROUNDS={},RDEL={},flashKey=null,flashTimer=null;
function runKey(a){return "mhxy-run-v1-"+a}
function rKey(a){return "mhxy-run-rounds-v1-"+a}
function delKey(a){return "mhxy-run-rdel-v1-"+a}
function blankCur(){return{t0:null,list:[],st:{}}}
function blankRun(){return{u:0,dirty:false,base:0,set:{lv:175,guo:null,jin:null,pt:null,t:0,p:{}},cur:blankCur()}}
function normRun(d){
  var r=blankRun();if(!d||typeof d!=="object")return r;
  r.u=+d.u||0;r.dirty=!!d.dirty;r.base=+d.base||0;
  var s=d.set||{};
  r.set.lv=s.lv==null?175:s.lv;r.set.guo=s.guo==null?null:s.guo;r.set.jin=s.jin==null?null:s.jin;r.set.pt=s.pt||null;r.set.t=+s.t||0;
  r.set.p=(s.p&&typeof s.p==="object")?clone(s.p):{};
  var c=d.cur||{};
  r.cur.t0=c.t0||null;r.cur.list=Array.isArray(c.list)?clone(c.list):[];r.cur.st=(c.st&&typeof c.st==="object")?clone(c.st):{};
  return r;
}
/* 启动时把云端和本机合并：
   本机没改过 → 用云端；本机改过、云端这期间没变（u 还是 base）→ 用本机；
   两边都改过 → mergeRun 合并，合并前的本机版本留备份（⚙ 里可恢复）。不比较两台设备的时钟。 */
function runLoadData(){
ACCOUNTS.forEach(function(a){
  var k=a[0],ea=(embedded.accounts&&embedded.accounts[k])||{};
  /* 轮次：云端的（去掉本机删掉的）+ 本机新结算还没上传的 */
  var dl=lsGet(delKey(k));RDEL[k]=Array.isArray(dl)?dl:[];
  if(cloudData&&RDEL[k].length){/* 云端已经没有的就不用再记删除记号了 */
    var inCloud={};(Array.isArray(ea.rounds)?ea.rounds:[]).forEach(function(r){if(r)inCloud[r.id]=1});
    RDEL[k]=RDEL[k].filter(function(id){return inCloud[id]});lsSet(delKey(k),RDEL[k]);
  }
  var gone={};RDEL[k].forEach(function(id){gone[id]=1});
  var eR=(Array.isArray(ea.rounds)?ea.rounds:[]).filter(function(r){return r&&!gone[r.id]}),ids={};
  eR.forEach(function(r){ids[r.id]=1});
  var lR=(lsGet(rKey(k))||[]).filter(function(r){return r&&!gone[r.id]&&(cloudData?r.lo&&!ids[r.id]:true)});/* 没有云端数据时本机的全留着 */
  ROUNDS[k]=lR.concat(eR).sort(function(x,y){return(y.ts||0)-(x.ts||0)});
  lsSet(rKey(k),ROUNDS[k]);
  /* 定价和当前这一轮 */
  var raw=lsGet(runKey(k)),er=normRun(ea.run),lr=normRun(raw);
  if(raw&&typeof raw==="object"&&raw.dirty==null){lr.dirty=lr.u>er.u;lr.base=er.u}/* 旧版本机数据：按旧规则判断一次 */
  if(!cloudData){RUN[k]=lr}/* 没拿到云端数据：只用本机，不合并 */
  else if(!lr.dirty){er.dirty=false;er.base=er.u;RUN[k]=er}
  else if(lr.base===er.u){RUN[k]=lr}
  else if(runBody(lr)===runBody(er)){er.dirty=false;er.base=er.u;RUN[k]=er}/* 云端已经是本机这份（上次存上了，只是没收到回复） */
  else{
    var m=mergeRun(lr,er,ROUNDS[k]),lostL=lostSome(lr,m),lostC=lostSome(er,m);
    /* 哪一边有环或定价没进合并结果，就把那一边留个备份并提示；两边都完整并进去了就不打扰 */
    if(lostL)backupAdd(k,"run",raw,"本机");
    if(lostC)backupAdd(k,"run",ea.run,"云端");
    if(lostL||lostC)MERGED.push([k,"跑环"]);
    RUN[k]=m;m.dirty=true;m.base=er.u;
  }
  lsSet(runKey(k),RUN[k]);
});
}
/* 两台设备都改过同一个号：
   定价设置取后改的那边；当前这一轮：同一轮就按每一环（记录时间）合并，已经在别处结算掉的那一轮不再保留，两边是不同的轮就留环数多的 */
function runBody(r){return JSON.stringify({u:r.u,set:r.set,cur:r.cur})}
function ringKey(e){return e.t!=null?"t"+e.t:JSON.stringify(e)}
function lostSome(from,to){
  var have={};to.cur.list.forEach(function(e){have[ringKey(e)]=1});
  return from.cur.list.some(function(e){return !have[ringKey(e)]})||JSON.stringify(from.set.p)!==JSON.stringify(to.set.p);
}
function mergeRun(L,C,rounds){
  var r=clone(C);
  if((L.set.t||L.set.pt||L.u)>(C.set.t||C.set.pt||C.u))r.set=clone(L.set);
  var done={};rounds.forEach(function(x){if(x&&x.t0)done[x.t0]=1});
  var lc=L.cur.t0&&done[L.cur.t0]?blankCur():L.cur,cc=C.cur.t0&&done[C.cur.t0]?blankCur():C.cur;
  if(!lc.list.length)r.cur=clone(cc);
  else if(!cc.list.length)r.cur=clone(lc);
  else if(lc.t0===cc.t0){
    var m={};
    cc.list.forEach(function(e){m[ringKey(e)]=e});lc.list.forEach(function(e){m[ringKey(e)]=e});
    var list=Object.keys(m).map(function(x){return m[x]}).sort(function(x,y){return(x.t||0)-(y.t||0)}).slice(0,100);
    var st=clone(cc.st||{});Object.keys(lc.st||{}).forEach(function(f){var v=lc.st[f];if(v!=null&&v!=="")st[f]=v});
    r.cur={t0:lc.t0,list:clone(list),st:st};
  }
  else r.cur=clone(lc.list.length>=cc.list.length?lc:cc);
  r.u=Math.max(L.u,C.u);
  return r;
}
function sc(v){return(v>0?"+":v<0?"−":"")+Math.abs(v)}
function stats(c){
  var o={cost:JIE,score:0,n:c.list.length,skips:0,cnt:{}};
  c.list.forEach(function(e){o.cost+=(+e.c||0);o.score+=(+e.s||0);o.cnt[e.i]=(o.cnt[e.i]||0)+1;if(e.i==="skip")o.skips++});
  return o;
}
/* 书铁等级 = 积分 + 人物等级/3 − 130，按 10 取整，最高 150 */
function tieLv(score,lv){var v=Math.floor((score+Math.floor((lv||175)/3)-130)/10)*10;return v>150?150:v}
function need150(lv){return 280-Math.floor((lv||175)/3)}
/* 修炼经验：100 环固定 760，跳过的环不给（按每环约 7.6 扣）；附加给修炼果算 150，给 200 经验算 200 */
function estExp(o){return Math.round(7.6*(o.n-o.skips))}
/* 藏宝阁估价：把「跑出」里选的东西（如 140 枪书）在价格表里找出来，折成游戏币（万）=（元 − 藏宝阁手续费）÷ 金价 × 3000。
   没认出来返回 null；认出来但没价（没人卖、价格表没读到）返回 {none:true}。
   两条例外：100 级以下的书铁不值钱，按 0 记（zero）；藏宝阁只挂 10 元的是垃圾、卖不动，按 50 万记（junk）。
   auto：没手填估价、号和价格表又是同一个服 → 直接按这个价算。这个数不存进当前这一轮，每次现算，结算那一刻才定下来 */
var RES_LV=[80,90,100,110,120,130,140,150];/* 「跑出」能选的书铁等级 */
var LOW_LV=100;   /* 这个等级以下的书铁不值钱：默认按 0 记，不查藏宝阁 */
/* 藏宝阁卖道具，平台向卖家收信息费：成交价的 5%，不足 1 分按 1 分收，最高 1000 元。估价按扣完到手的钱折 */
var CBG_FEE=0.05,CBG_FEE_MAX=1000;
function cbgFee(yuan){return Math.min(CBG_FEE_MAX,Math.ceil(yuan*CBG_FEE*100-1e-6)/100)}
var JUNK_YUAN=10,JUNK_WAN=50;/* 藏宝阁最低只能挂 10 元：挂 10 元的其实卖不动，默认按 50 万记 */
/* 「跑出」的物品下拉：铁、战魄、26 种书（防具、武器分两组）。选项的值就是存进 st.res 的那几个字 */
var BOOK_NOTE={"头盔":"男头","发钗":"女头","铠甲":"男衣","靴":"鞋"};
function resItemOpts(){
  function grp(label,list){return '<optgroup label="'+label+'">'+list.map(function(k){return '<option value="'+k+'书">'+k+'书'+(BOOK_NOTE[k]?"（"+BOOK_NOTE[k]+"）":"")+'</option>'}).join("")+'</optgroup>'}
  return '<option value="">没选</option><option value="铁">铁</option><option value="战魄">战魄（160）</option>'+grp("防具书",CBG.armor)+grp("武器书",CBG.weapon);
}
/* st.res 存的是文字：「枪书」（等级按积分）、「130 枪书」（自己选了等级）、「130级」（只选了等级）、「战魄」；以前手写的也可能在里面。
   这里拆成两个下拉要显示的值；认不出来的旧文字单独当一个选项留着（raw） */
function resParse(raw){
  raw=String(raw||"").trim();
  var m=CBG.find(raw,1),lv=/^(\d{2,3})/.exec(raw),item="";
  if(m){var p=m.key.split(":");item=p[0]==="zhanpo"?"战魄":p[0]==="iron"?"铁":p[2]+"书"}
  return{item:item,lv:item==="战魄"||!lv?"":lv[1],raw:!m&&raw&&!/^\d{2,3}级$/.test(raw)?raw:""};
}
function cbgEst(a,run,tl){
  var st=run.cur.st||{},m=CBG.find(st.res,tl);if(!m)return null;
  var it=CBG.item(m.key),g=CBG.gold(),o={key:m.key,label:m.label,ref:CBG.server()!==ACCT_SERVER[a]};
  if(m.key.indexOf("zhanpo")!==0&&+m.key.split(":")[1]<LOW_LV){o.zero=true;o.ref=false;o.wan=0;o.auto=st.tie==null;return o}
  if(!it||!g){o.none=true;o.why=!CBG.has()?"藏宝阁的价格还没读到":!g?"金价还没查到，折不成游戏币":CBG.known(m.key)?"藏宝阁现在没有能买的":"藏宝阁的价格还没查到这一项";return o}
  o.yuan=it.min;o.gold=g;o.t=it.t;o.old=CBG.old(it.t);
  o.fee=CBG_FEE*100;o.net=Math.round((it.min-cbgFee(it.min))*100)/100;
  o.wan=Math.round(o.net/g*30000)/10;
  if(it.min<=JUNK_YUAN){o.junk=true;o.wan=JUNK_WAN}
  o.auto=!o.ref&&st.tie==null;
  return o;
}
function settleCalc(run,c,o,a){
  var st=c.st||{},lv=run.set.lv||175,tl=tieLv(o.score,lv),extraOk=o.score>=170;
  var ex=extraOk?(st.ex||""):"";
  var exp=estExp(o)+(ex==="guo"?150:ex==="e200"?200:0);
  var cb=cbgEst(a||acct,run,tl);
  var tie=st.tie!=null?(+st.tie||0):(cb&&cb.auto?cb.wan:0),tu=ex==="tu"?(+st.exv||0):0,guo=run.set.guo;
  var expVal=guo!=null?guo*exp/150:null,cash=tie+tu-o.cost;
  return{tl:tl,extraOk:extraOk,ex:ex,exp:exp,tie:tie,cb:cb,tu:tu,guo:guo,expVal:expVal,cash:cash,pl:expVal!=null?cash+expVal:null};
}
function pm(v,d){if(v==null||isNaN(v))return "—";var s=f(Math.abs(v),d==null?1:d);return v>0?"+"+s:v<0?"−"+s:s}
function roundView(r){
  var exp=r.tot!=null?r.tot:r.exp,cash=r.cash!=null?r.cash:-(+r.net||0);
  var pl=r.pl!=null?r.pl:(r.guo!=null&&exp>0?cash+r.guo*exp/150:null);
  return{exp:exp,cash:cash,pl:pl};
}
var PBLOCKS=[["环装",["w60","a60","w70","a70","w80","a80"],2],["花 · 乐器",["baihe","kang","mudan","meigui","suona","muyu","shuqin","dizi","xiaobo"],3],["家具 · 药品 · 变异",["j1","j2","yao","pr","ljby","ptbb"],2]];
function runShell(){
  var h='<section class="card" id="run-price" aria-label="定价"><div class="card-head"><h2>定价</h2><span class="hint" id="pt-hint"></span></div><div class="pblocks">'+
    PBLOCKS.map(function(b){return '<div class="pblock"><div class="pb-h">'+b[0]+'</div><div class="pgrid c'+b[2]+'">'+b[1].map(function(k){
      return '<label class="pc" for="ip-'+k+'"><span class="pn">'+IT[k].n+'</span><span class="unit"><input type="number" step="any" min="0" inputmode="decimal" id="ip-'+k+'" data-ip="'+k+'"><span>万</span></span></label>'}).join("")+'</div></div>'}).join("")+
    '</div></section>';
  h+='<div class="mainrow"><section class="card play" aria-label="跑环">'+
    '<div class="side">'+
      '<div class="nowbox">'+
        '<div class="now2"><div><span class="k">环数</span><b id="s-n"></b></div><div><span class="k">积分</span><b id="s-score"></b></div></div>'+
        '<div class="bar"><i id="s-bar"></i></div><div class="sm" id="s-score2"></div>'+
        '<div class="costrow" title="含接任务 10 万"><span class="k">总成本</span><b id="s-cost"></b></div>'+
      '</div>'+
      '<div class="zform"><div class="zf-h">指定变异 / 手填</div>'+
        '<input type="text" id="m-name" maxlength="12" placeholder="BB 名 / 物品名" aria-label="名称">'+
        '<div class="zf-r"><div class="unit"><input type="number" step="any" min="0" inputmode="decimal" id="m-price" placeholder="价格" aria-label="价格" title="只填价格再点右边的格子 = 这一环按这个价记"><span>万</span></div>'+
        '<select id="m-type" aria-label="算几分">'+MTYPES.map(function(t){return '<option value="'+t[0]+'">'+t[1]+'</option>'}).join("")+'</select></div>'+
        '<button type="button" id="m-add">记一环</button></div>'+
    '</div>'+
    '<div class="tcol"><div class="tgrid" id="run-tiles"></div><div class="run-msg" id="run-msg" role="status"></div></div>'+
    '</section>';
  h+='<section class="card logc" aria-label="记录"><div class="card-head"><h2>记录</h2><div class="head-r"><button type="button" class="ghost" id="run-undo">撤回</button><button type="button" class="del" id="run-clear">清零</button></div></div>'+
    '<div class="log-body"><div class="log-wrap"><table class="log"><thead><tr><th>环</th><th class="it-h">物品</th><th>分</th><th>万</th><th></th></tr></thead><tbody id="run-log"></tbody></table></div></div></section></div>';
  h+='<section class="card" aria-label="结算"><div class="card-head"><h2>结算</h2><span class="hint" id="st-gold"></span></div><div class="settle2">'+
    '<div class="st-in">'+
      '<div class="srow"><span class="sl">果价</span><div class="unit w-p"><input type="number" step="any" min="0" inputmode="decimal" id="st-guo" data-set="guo" aria-label="修炼果价"><span>万</span></div><span class="sl sl2">等级</span><input type="number" step="1" min="65" max="175" inputmode="numeric" class="w-lvl" id="set-lv" data-set="lv" data-def="175" aria-label="角色等级"></div>'+
      '<div class="srow"><span class="sl">跑出</span><select id="st-lv" aria-label="书铁等级" title="不选就按这一轮的积分算出来的等级"><option value="">按积分</option>'+RES_LV.map(function(v){return '<option value="'+v+'">'+v+' 级</option>'}).join("")+'</select><select id="st-it" class="w-res" aria-label="跑出了什么">'+resItemOpts()+'</select><div class="unit w-p"><input type="number" step="any" min="0" inputmode="decimal" id="st-tie" data-st="tie" placeholder="估价" aria-label="估价" title="不填就按藏宝阁的价算；填了就按你填的"><span>万</span></div></div>'+
      '<div class="srow cbgrow" id="st-cbg" hidden></div>'+
      '<div class="srow"><span class="sl">额外</span><select id="st-ex" data-st="ex" aria-label="额外奖励">'+Object.keys(EXTRA).map(function(k){return '<option value="'+k+'">'+EXTRA[k]+'</option>'}).join("")+'</select><div class="unit w-p" id="st-exv-w"><input type="number" step="any" min="0" inputmode="decimal" id="st-exv" data-st="exv" placeholder="估价" aria-label="家具图估价"><span>万</span></div></div>'+
    '</div>'+
    '<div class="st-right"><div class="st-out" id="st-out"></div><div class="save-row"><span id="st-status" class="status"></span><button type="button" id="st-save" title="一轮跑完才点：结束这一轮、进历史，并自动存云端">结算这一轮</button></div></div>'+
    '</div></section>';
  h+='<section class="card" aria-label="历史"><div class="card-head"><h2>历史</h2><span id="h-status" class="status"></span></div>'+
    '<div class="sums" id="h-sum"></div>'+
    '<div class="scroll hist-wrap"><table class="hist rh"><thead><tr><th>日期</th><th>积分</th><th class="tl-h">跑出</th><th>额外</th><th>花费</th><th>修炼经验</th><th>盈亏</th><th></th></tr></thead><tbody id="h-body"></tbody></table></div></section>';
  return h;
}
/* 格子分块：找人单独最大；环装；家具药品；花乐器；宝宝。每块一个颜色 */
var TBLOCKS=[
  ["find","",[["zr"]],1],
  ["hz","环装",[["w60"],["w70"],["w80"],["a60"],["a70"],["a80"]],3],
  ["jj","家具 · 药品",[["j1"],["j2"],["yao"],["pr"]],4],
  ["hy","花 · 乐器",[["baihe"],["kang"],["mudan"],["meigui"],["suona"],["muyu"],["shuqin"],["dizi"]],4],
  ["bb","宝宝",[["ljby"],["zdby"],["ptbb"]],3],
  ["rare","少用",[["xiaobo"],["skip"]],4]
];
function tileHtml(k,o,p,span){
  var x=IT[k],n=o.cnt[k]||0,pr;
  if(k==="zr")pr="不花钱";else if(k==="skip")pr="无经验";else if(k==="zdby")pr="手填价";
  else if(p[k]==null)pr='<span class="miss">没填价</span>';else pr=f(p[k],2)+"万";
  var cls="tile"+(k==="zr"?" big":"")+(k==="skip"?" skip":"")+(x.s<0?" neg":"")+(flashKey===k?" flash":"");
  return '<button type="button" class="'+cls+'"'+(span>1?' style="grid-column:span '+span+'"':'')+' data-item="'+k+'" aria-label="'+x.n+(k==="zdby"?"，手填价":"，记一环")+'"><span class="nm">'+x.n+'</span><span class="meta"><span class="sc">'+sc(x.s)+'</span> · '+pr+'</span><span class="cnt'+(n?"":" zero")+'">'+n+'</span></button>';
}
function renderTiles(o){
  var p=RUN[acct].set.p,box=$("run-tiles");
  var fk=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.item:null;
  box.innerHTML=TBLOCKS.map(function(b){
    return '<div class="tb k-'+b[0]+'">'+(b[1]?'<div class="tb-h">'+b[1]+'</div>':'')+'<div class="tg c'+b[3]+'">'+b[2].map(function(t){return tileHtml(t[0],o,p,t[1]||1)}).join("")+'</div></div>';
  }).join("");
  if(fk){var bt=box.querySelector('[data-item="'+fk+'"]');if(bt)bt.focus()}
}
function entryName(e){var it=IT[e.i]||{n:e.i};return e.n?e.n:it.n}
function renderLog(){
  var list=RUN[acct].cur.list,h="";
  if(!list.length)h='<tr class="empty"><td colspan="5">还没开始</td></tr>';
  for(var i=list.length-1;i>=0;i--){var e=list[i],sub=(e.n&&IT[e.i]&&IT[e.i].g!=="old")?IT[e.i].n:"";
    h+='<tr title="'+hhmm(e.t)+'"><td class="num">'+(i+1)+'</td><td class="it'+(e.i==="skip"?" skip":"")+'">'+esc(entryName(e))+(sub?'<small>'+esc(sub)+'</small>':'')+'</td>'+
      '<td><input type="number" step="1" min="-20" max="10" data-def="0" class="w-s" data-le="'+i+':s" value="'+esc(e.s)+'" aria-label="第'+(i+1)+'环分数"></td>'+
      '<td><input type="number" step="any" min="0" inputmode="decimal" data-le="'+i+':c" value="'+esc(e.c)+'" aria-label="第'+(i+1)+'环花费"></td>'+
      '<td><button type="button" class="del x" data-ldel="'+i+'" aria-label="删除第'+(i+1)+'环">×</button></td></tr>';
  }
  $("run-log").innerHTML=h;
}
function renderStats(o){
  var run=RUN[acct],lv=run.set.lv||175,need=need150(lv),tl=tieLv(o.score,lv);
  $("s-n").innerHTML=o.n+'<small>/100</small>';
  $("s-score").textContent=o.score;
  $("s-bar").style.width=Math.min(100,o.n)+"%";
  $("s-score2").textContent=o.n?((tl>0?tl+" 级 · ":"")+(o.score>=need?"够 150":"差 "+(need-o.score)+" 到 150")+(o.skips?" · 跳过 "+o.skips:"")):(need+" 分出 150");
  $("s-cost").innerHTML=f(o.cost,2)+'<small>万</small>';
}
function renderSettle(o){
  var run=RUN[acct],c=run.cur,st=c.st||{},s=settleCalc(run,c,o);
  setVal($("st-tie"),st.tie);
  var rp=resParse(st.res),lvSel=$("st-lv"),itSel=$("st-it"),rawOpt=itSel.querySelector('option[value="__raw"]');
  lvSel.options[0].text=s.tl>0?"按积分 "+s.tl+" 级":"按积分";
  if(rp.raw){if(!rawOpt){rawOpt=document.createElement("option");rawOpt.value="__raw";itSel.appendChild(rawOpt)}rawOpt.text=rp.raw}
  else if(rawOpt)itSel.removeChild(rawOpt);
  if(document.activeElement!==itSel)itSel.value=rp.raw?"__raw":rp.item;
  if(document.activeElement!==lvSel)lvSel.value=RES_LV.indexOf(+rp.lv)>=0?rp.lv:"";
  lvSel.disabled=rp.item==="战魄"||!!rp.raw;
  renderCbg(s,st);
  var exSel=$("st-ex");exSel.disabled=!s.extraOk;exSel.title=s.extraOk?"170 分以上，第 100 环额外随机给一样":"170 分以上才有";
  if(document.activeElement!==exSel)exSel.value=s.extraOk?(st.ex||""):"";
  $("st-exv-w").hidden=s.ex!=="tu";
  setVal($("st-exv"),st.exv);
  var big=s.pl!=null?s.pl:s.cash,cls=!o.n?"":big>=0?"pos":"neg";
  if(!o.n){$("st-out").innerHTML='<div class="pl-row"><span class="pl-l">盈亏</span><span class="pl">—</span></div>';$("st-save").disabled=true;return}
  var out='<div class="pl-row"><span class="pl-l">盈亏'+(s.pl==null&&o.n?"（没算经验）":"")+'</span><span class="pl '+cls+'">'+(o.n?pm(big):"—")+'<small>万</small></span></div><dl class="ledger">'+
    '<div><dt>花费</dt><dd class="neg">'+pm(-o.cost)+'</dd></div>'+
    '<div><dt>跑出 <span>'+esc(s.cb?s.cb.label:(st.res||(s.tl>0?s.tl+" 级":"")))+'</span></dt><dd'+(s.tie?' class="pos"':'')+'>'+pm(s.tie)+'</dd></div>'+
    (s.ex==="tu"?'<div><dt>家具图</dt><dd'+(s.tu?' class="pos"':'')+'>'+pm(s.tu)+'</dd></div>':'')+
    '<div><dt>修炼经验 '+s.exp+' <span>≈ '+f(s.exp/150,1)+' 果</span></dt><dd'+(s.expVal?' class="pos"':'')+'>'+(s.expVal==null?'<span class="hint">填果价</span>':pm(s.expVal))+'</dd></div>'+
    '</dl>';
  $("st-out").innerHTML=out;
  $("st-save").disabled=!o.n;
}
/* 结算区里跟藏宝阁有关的两处：金价一行、估价下面那行说明 */
function renderCbg(s,st){
  var gl=CBG.goldLine(),ge=$("st-gold");ge.textContent=gl.t;ge.className="hint"+(gl.bad?" bad":"");
  var cb=s.cb,row=$("st-cbg");
  $("st-tie").placeholder=cb&&cb.auto?(cb.zero?"0":"≈"+f(cb.wan,0)):"估价";
  if(!cb){row.hidden=true;row.innerHTML="";return}
  var t,bad=false,btn=false;
  if(cb.none)t=cb.label+"："+cb.why+"，估价自己填";
  else if(cb.zero){t=cb.label+"："+LOW_LV+" 级以下的书铁不值钱"+(cb.auto?"，按 0 记":"");btn=!cb.auto}
  else if(cb.junk){t=(cb.ref?CBG.server()+"参考价 · ":"藏宝阁 ")+cb.label+" 只挂 "+f(cb.yuan,2)+" 元，是卖不动的垃圾价"+(cb.auto?"，按 "+JUNK_WAN+" 万记":"（默认记 "+JUNK_WAN+" 万）");btn=!cb.auto}
  else{
    t=(cb.ref?CBG.server()+"参考价 · ":"藏宝阁 ")+cb.label+" "+f(cb.yuan,2)+" 元"+(cb.fee?"，扣 "+f(cb.fee,1)+"% 手续费到手 "+f(cb.net,2)+" 元":"")+" ≈ "+f(cb.wan,0)+" 万 · "+CBG.ago(cb.t)+(cb.old?"的价":"")+(cb.auto?" · 已按这个价算":"");
    bad=cb.old;btn=!cb.auto;
  }
  row.hidden=false;
  row.innerHTML='<span class="sl"></span><span class="cbgt'+(bad?" bad":"")+'">'+esc(t)+'</span>'+(btn?'<button type="button" class="ghost" id="st-cbg-use">用这个价</button>':'');
}
/* 价格表重新读过了：只重画结算区（估价是现算的，不改数据、不触发存云端） */
function cbgChanged(){if($("st-out")&&RUN[acct])renderSettle(stats(RUN[acct].cur))}
function fmtTime(t){var d=new Date(t),m=d.getMonth()+1,dd=d.getDate();return(m<10?"0":"")+m+"-"+(dd<10?"0":"")+dd+" "+hhmm(t)}
function renderSet(){
  var run=RUN[acct];
  setVal($("set-lv"),run.set.lv);setVal($("st-guo"),run.set.guo);
  ITEMS.forEach(function(x){var el=$("ip-"+x[0]);if(el)setVal(el,run.set.p[x[0]])});
  renderPt();
}
function renderPt(){var run=RUN[acct];$("pt-hint").textContent=run.set.pt?"改价 "+fmtTime(run.set.pt):""}
function renderRounds(){
  var list=ROUNDS[acct]||[],h="",sPl=0,nPl=0,sExp=0,sCost=0;
  list.forEach(function(r){
    var v=roundView(r);sExp+=+v.exp||0;sCost+=+r.cost||0;if(v.pl!=null){sPl+=v.pl;nPl++}
    var ex=r.ex==="tu"?"家具图":(r.ex?EXTRA[r.ex]:"—");
    h+='<tr><td class="date">'+esc(String(r.date||"").slice(5))+(r.lo?' <span class="hint">本机</span>':'')+'</td><td>'+r.score+'</td>'+
      '<td class="res"'+(r.cbg?' title="'+(r.cbg.j?'藏宝阁只挂 '+esc(f(r.cbg.p,2))+' 元（垃圾价），按 '+JUNK_WAN+' 万记的':'按藏宝阁价估的：'+esc(f(r.cbg.p,2))+' 元'+(r.cbg.f?'，扣 '+esc(f(r.cbg.f,1))+'% 手续费':'')+'，当时金价 '+esc(f(r.cbg.g,1))+' 元/3000万')+'"':'')+'>'+esc(r.res||(r.tl>0?r.tl+" 级":"—"))+(r.tie?' <span class="hint">'+f(r.tie,1)+' 万'+(r.cbg?' · ¥'+f(r.cbg.p,2):'')+'</span>':'')+'</td><td>'+esc(ex)+'</td>'+
      '<td>'+f(r.cost,1)+'</td><td>'+f(v.exp,0)+'</td>'+
      '<td class="'+(v.pl==null?"":v.pl>=0?"good":"bad")+'"><b>'+pm(v.pl)+'</b></td>'+
      '<td><button type="button" class="del x" data-rdel="'+esc(r.id)+'" aria-label="删除这一轮">×</button></td></tr>';
  });
  if(!list.length)h='<tr><td colspan="8" class="hint">还没有</td></tr>';
  $("h-body").innerHTML=h;
  $("h-sum").innerHTML=
    '<div class="sumc"><div class="k">轮数</div><div class="v">'+list.length+'</div></div>'+
    '<div class="sumc"><div class="k">修炼经验</div><div class="v">'+f(sExp,0)+'<small>≈ '+f(sExp/150,1)+' 果</small></div></div>'+
    '<div class="sumc"><div class="k">总盈亏</div><div class="v '+(sPl>=0?"pos":"neg")+'">'+(nPl?pm(sPl):"—")+'<small>万</small></div></div>'+
    '<div class="sumc"><div class="k">平均每轮</div><div class="v '+(sPl>=0?"pos":"neg")+'">'+(nPl?pm(sPl/nPl):"—")+'<small>万</small></div></div>';
}
function renderRun(opt){
  opt=opt||{};
  var o=stats(RUN[acct].cur);
  renderStats(o);renderTiles(o);
  if(!opt.keepLog)renderLog();
  renderSettle(o);
  if(opt.fillSet)renderSet();else renderPt();
  renderRounds();syncStatus();disarm();
}
function runMsg(t,kind){var el=$("run-msg");el.textContent=t||"";el.className="run-msg"+(kind?" "+kind:"")}
function hMsg(t,kind){var el=$("h-status");el.textContent=t||"";el.className="status"+(kind?" "+kind:"")}
function stMsg(t,kind){var el=$("st-status");el.textContent=t||"";el.className="status"+(kind?" "+kind:"")}
function touch(a){RUN[a].u=Date.now();RUN[a].dirty=true;lsSet(runKey(a),RUN[a]);syncStatus();autoSave()}
function cleanRounds(list){return list.map(function(r){var x=clone(r);delete x.lo;return x})}
/* 「再点一次确认」的按钮：4 秒没确认、或者换号/有别的操作就复原，免得误点到别的号 */
var ARM_TXT={"run-clear":"清零","st-save":"结算这一轮"};
function arm(el,txt){
  el.classList.add("armed");el.textContent=txt;clearTimeout(el._armT);
  el._armT=setTimeout(function(){if(el.classList.contains("armed")){el.classList.remove("armed");el.textContent=ARM_TXT[el.id]}},4000);
}
function disarm(){Object.keys(ARM_TXT).forEach(function(id){var b=$(id);if(b&&b.classList.contains("armed")){b.classList.remove("armed");b.textContent=ARM_TXT[id]}})}
function flash(k){flashKey=k;clearTimeout(flashTimer);flashTimer=setTimeout(function(){flashKey=null;var b=document.querySelector('.tile.flash');if(b)b.classList.remove("flash")},700)}
function pushEntry(e,label){
  var run=RUN[acct],c=run.cur,n=c.list.length+1;
  if(!c.list.length)c.t0=Date.now();
  c.list.push(e);
  $("m-price").value="";$("m-name").value="";
  touch(acct);flash(e.i);renderRun();markTabs();
  return n;
}
function checkAdd(k,score){
  var o=stats(RUN[acct].cur);
  if(o.n>=100){runMsg("满 100 环了，先结算","err");return null}
  if(k==="skip"&&o.score<20){runMsg("积分不到 20，跳不了","err");return null}
  return o;
}
function addEntry(k){
  var run=RUN[acct],it=IT[k];
  var mp=readNum($("m-price"));
  if(k==="zdby"&&mp==null){
    $("m-type").value="zdby";$("m-name").focus();
    runMsg("指定变异：填 BB 名和价格，点「记一环」","dirty");return;
  }
  if(!checkAdd(k))return;
  var cost=mp!=null?mp:(NOPRICE[k]?0:run.set.p[k]);
  var miss=cost==null;if(miss)cost=0;
  var e={i:k,s:it.s,c:cost,t:Date.now()};
  if(k==="zdby"){var nm=$("m-name").value.trim();if(nm)e.n=nm}
  var n=pushEntry(e);
  runMsg("第 "+n+" 环 · "+entryName(e)+" "+sc(it.s)+" · "+f(cost,2)+" 万"+(miss?"（没填价，按 0 记）":""),miss?"dirty":"ok");
}
function addManual(){
  var t=$("m-type").value,mt=null;
  MTYPES.forEach(function(x){if(x[0]===t)mt=x});if(!mt)return;
  if(!checkAdd(t))return;
  var nm=$("m-name").value.trim(),pr=readNum($("m-price"));
  var key=IT[t]?t:"m";
  var e={i:key,s:mt[2],c:pr==null?0:pr,t:Date.now(),n:nm||(IT[t]?IT[t].n:"其他")};
  var n=pushEntry(e);
  runMsg("第 "+n+" 环 · "+e.n+" "+sc(e.s)+" · "+f(e.c,2)+" 万"+(pr==null?"（没填价，按 0 记）":""),pr==null?"dirty":"ok");
}
function runClick(el){
  var run=RUN[acct];
  if(el.dataset.item){addEntry(el.dataset.item);return true}
  if(el.id==="m-add"){addManual();return true}
  if(el.id==="run-undo"){
    var e=run.cur.list.pop();if(!e)return true;
    if(!run.cur.list.length)run.cur.t0=null;
    touch(acct);renderRun();markTabs();runMsg("已撤回第 "+(run.cur.list.length+1)+" 环 · "+entryName(e),"ok");return true;
  }
  if(el.id==="run-clear"){
    if(!run.cur.list.length)return true;
    if(!el.classList.contains("armed")){arm(el,"确认清零");return true}
    run.cur=blankCur();touch(acct);renderRun();markTabs();runMsg("已清零","ok");return true;
  }
  if(el.dataset.ldel!=null){
    if(!el.classList.contains("armed")){el.classList.add("armed");el.textContent="删?";return true}
    var i=+el.dataset.ldel,gone=run.cur.list.splice(i,1)[0];
    if(!run.cur.list.length)run.cur.t0=null;
    touch(acct);renderRun();markTabs();runMsg("已删第 "+(i+1)+" 环 · "+entryName(gone),"ok");return true;
  }
  if(el.id==="st-cbg-use"){
    /* 同一个服：清掉手填的估价，改回按藏宝阁价现算；别的服只是参考价：照抄一次当手填 */
    var cb=settleCalc(run,run.cur,stats(run.cur)).cb;
    if(cb&&cb.wan!=null){(run.cur.st||(run.cur.st={})).tie=cb.ref?cb.wan:null;touch(acct);renderRun({keepLog:true})}
    return true;
  }
  if(el.id==="st-save"){
    if(!el.classList.contains("armed")){arm(el,"确认结算？再点一次");return true}
    disarm();saveRound();return true;
  }
  if(el.dataset.rdel){
    if(!el.classList.contains("armed")){el.classList.add("armed");el.textContent="删?";return true}
    var id=el.dataset.rdel,was=null;
    ROUNDS[acct]=ROUNDS[acct].filter(function(r){if(r.id===id)was=r;return r.id!==id});lsSet(rKey(acct),ROUNDS[acct]);
    if(was&&!was.lo){RDEL[acct].push(id);lsSet(delKey(acct),RDEL[acct])}/* 云端也有的才需要删除记号 */
    renderRounds();markTabs();syncStatus();
    publishAll("已删除这一轮",hMsg);return true;
  }
  return false;
}
function runInput(el){
  var run=RUN[acct];
  if(el.dataset.ip){run.set.p[el.dataset.ip]=readNum(el);run.set.pt=run.set.t=Date.now();touch(acct);renderRun({keepLog:true});return}
  if(el.dataset.set){var k=el.dataset.set;run.set[k]=readNum(el);run.set.t=Date.now();if(k==="lv"&&run.set.lv==null)run.set.lv=175;
    Array.prototype.forEach.call(document.querySelectorAll('[data-set="'+k+'"]'),function(o){if(o!==el)setVal(o,run.set[k])});
    touch(acct);renderRun({keepLog:true});return}
  if(el.id==="st-lv"||el.id==="st-it"){
    var L=$("st-lv").value,it=$("st-it").value;if(it==="__raw")return;
    (run.cur.st||(run.cur.st={})).res=it==="战魄"?"战魄":it?(L?L+" ":"")+it:(L?L+"级":"");
    touch(acct);renderRun({keepLog:true});return;
  }
  if(el.dataset.st){var st=run.cur.st||(run.cur.st={}),fk=el.dataset.st;st[fk]=(fk==="ex"||fk==="res")?el.value:readNum(el);touch(acct);renderRun({keepLog:true});return}
  if(el.dataset.le){var pr=el.dataset.le.split(":"),e=run.cur.list[+pr[0]];if(!e)return;var v=readNum(el);e[pr[1]]=v==null?0:v;touch(acct);renderRun({keepLog:true});return}
}
function saveRound(){
  var run=RUN[acct],c=run.cur,o=stats(c);
  if(!o.n)return;
  var s=settleCalc(run,c,o),st=c.st||{};
  var r={id:newId(),ts:Date.now(),date:today(),n:o.n,skips:o.skips,score:o.score,lv:run.set.lv||175,cost:r2(o.cost),
    tl:s.tl,res:s.cb?s.cb.label:(st.res||"").trim(),tie:s.tie,ex:s.ex,exv:s.tu,exp:s.exp,guo:s.guo,cash:r2(s.cash),pl:s.pl==null?null:r2(s.pl),cnt:o.cnt,t0:c.t0||null,lo:true};
  /* 估价是按藏宝阁价算的：把当时的价格、金价一起记下来留底（k 哪一项，p 元，g 金价，t 这个价是什么时候查的，f 扣的手续费 %，j=1 挂 10 元的垃圾价、按 50 万记的） */
  if(s.cb&&s.cb.auto&&!s.cb.zero){r.cbg={k:s.cb.key,p:s.cb.yuan,g:s.cb.gold,t:s.cb.t};if(s.cb.junk)r.cbg.j=1;else if(s.cb.fee)r.cbg.f=s.cb.fee}
  ROUNDS[acct].unshift(r);lsSet(rKey(acct),ROUNDS[acct]);
  run.cur=blankCur();touch(acct);renderRun();markTabs();
  runMsg("","");
  publishAll("已结算"+(s.pl!=null?"（盈亏 "+pm(s.pl)+" 万）":""),stMsg);
}


/* 存云端登记：每个号上传 run（去掉本机用的 dirty/base）和 rounds */
syncReg({
  dump:function(k){var r=clone(RUN[k]);delete r.dirty;delete r.base;return{run:r,rounds:cleanRounds(ROUNDS[k])}},
  dirty:function(k){return !!RUN[k].dirty||RDEL[k].length>0||ROUNDS[k].some(function(r){return r.lo})},
  snap:function(k){return{u:RUN[k].u,lo:ROUNDS[k].filter(function(r){return r.lo}).map(function(r){return r.id}),del:RDEL[k].slice()}},
  ack:function(k,s){
    var run=RUN[k];run.base=s.u;if(run.u===s.u)run.dirty=false;lsSet(runKey(k),run);
    var ids={};s.lo.forEach(function(id){ids[id]=1});ROUNDS[k].forEach(function(r){if(ids[r.id])delete r.lo});lsSet(rKey(k),ROUNDS[k]);
    var dd={};s.del.forEach(function(id){dd[id]=1});RDEL[k]=RDEL[k].filter(function(id){return !dd[id]});lsSet(delKey(k),RDEL[k]);
  }
});
