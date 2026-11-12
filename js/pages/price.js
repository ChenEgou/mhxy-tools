"use strict";
/* ========== 环装比价 ========== */
var TYPES=[["w60","60 武器"],["a60","60 防具"],["w70","70 武器"],["a70","70 防具"],["w80","80 武器"],["a80","80 防具"]];
var PARAMS=[["dianka","点卡价","万/点"]];
var JL_PER_DK=10; /* 1 点卡 = 10 精力，固定 */
var FISH={1:10,2:100,3:1000}; /* 每条鱼的精力，固定 */
var DRAFT_KEY="mhxy-ring-draft-v1",LOCAL_KEY="mhxy-ring-records-v1";
function sortList(list){list.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0})}
/* DATA[号]：比价记录（每天一条）。
   PEND[号]：本机改了、还没上传的：{up:{日期:{r:记录,v:改动时间}}, del:{日期:删除时间}}。按天记，存上云端后逐条清掉 */
var DATA={},PEND={};
function pendKey(a){return "mhxy-ring-pending-v1-"+a}
function pendOf(a){return PEND[a]||(PEND[a]={up:{},del:{}})}
function pendSave(a){lsSet(pendKey(a),pendOf(a))}
function pendCount(a){var p=pendOf(a);return Object.keys(p.up).length+Object.keys(p.del).length}
/* 启动时：云端的记录，再按天盖上本机没上传的改动和删除 */
function priceLoadData(){
ACCOUNTS.forEach(function(a){
  var k=a[0],x=embedded.accounts&&embedded.accounts[k];
  var cloud=embedded.accounts?((x&&x.records)||[]).slice():(k==="ruyi"&&Array.isArray(embedded.records)?embedded.records.slice():[]);
  var p=lsGet(pendKey(k));PEND[k]=p&&typeof p==="object"?{up:p.up||{},del:p.del||{}}:{up:{},del:{}};
  /* 旧版本机存的是整份列表：只把云端没有的日期当成本机改动，云端已有的以云端为准，然后删掉旧副本 */
  var old=lsGet(LOCAL_KEY+"-"+k)||[];if(k==="ruyi")old=old.concat(lsGet(LOCAL_KEY)||[]);
  if(old.length){
    var have={};cloud.forEach(function(r){have[r.date]=1});
    old.forEach(function(r){if(r&&r.date&&!have[r.date]&&!PEND[k].up[r.date])PEND[k].up[r.date]={r:r,v:Date.now()}});
    lsDel(LOCAL_KEY+"-"+k);if(k==="ruyi")lsDel(LOCAL_KEY);pendSave(k);
  }
  var m={};cloud.forEach(function(r){if(r&&r.date)m[r.date]=r});
  if(cloudData){/* 已经在云端的本机改动（上次存上了，只是没收到回复）不用再传 */
    var ch=false,P=PEND[k];
    Object.keys(P.up).forEach(function(d){if(m[d]&&JSON.stringify(m[d])===JSON.stringify(P.up[d].r)){delete P.up[d];ch=true}});
    Object.keys(P.del).forEach(function(d){if(!m[d]){delete P.del[d];ch=true}});
    if(ch)pendSave(k);
  }
  Object.keys(PEND[k].del).forEach(function(d){delete m[d]});
  Object.keys(PEND[k].up).forEach(function(d){m[d]=PEND[k].up[d].r});
  DATA[k]=Object.keys(m).map(function(d){return m[d]});sortList(DATA[k]);
});
}
var DEFAULT={date:today(),p:{dianka:1.5},t:{}};
var DEF_ORDER={w60:[2,1],a60:[2,1],w70:[1,6],a70:[1,6],w80:[2,4],a80:[2,4]};
TYPES.forEach(function(t){var o=DEF_ORDER[t[0]];DEFAULT.t[t[0]]={lv:o[0],n:o[1],cm:null,stall:null}});
var records=[],latest=null,cur=null,hasDraft=false;
function sortRecs(){sortList(records)}
function draftKey(){return DRAFT_KEY+"-"+acct}
function loadAccount(k){
  acct=k;records=DATA[k];sortRecs();latest=records.length?records[records.length-1]:null;
  cur=clone(latest||DEFAULT);hasDraft=false;
  var d=lsGet(draftKey());
  if(!d&&k==="ruyi")d=lsGet(DRAFT_KEY);
  if(d&&d.base===(latest?latest.date:"")&&d.cur){cur=d.cur;hasDraft=true}
  cur.date=today();
}
function compute(c){
  var p=c.p||{},jlPrice=p.dianka==null||isNaN(p.dianka)?null:p.dianka/JL_PER_DK;/* 没填点卡价：宝匣成本算不出来 */
  var rows={};
  TYPES.forEach(function(tt){
    var k=tt[0],r=(c.t||{})[k]||{};
    var fishCost=FISH[r.lv]||FISH[2];
    var jl=(r.n||0)*fishCost+(r.cm||0);
    var box=jlPrice==null?null:jl*jlPrice;
    var diff=(box!=null&&r.stall!=null&&!isNaN(r.stall))?r.stall-box:null;
    rows[k]={jl:jl,box:box,diff:diff};
  });
  return {jlPrice:jlPrice,rows:rows};
}
function priceShell(){
  var h='<section class="card" aria-label="今日点卡价"><div class="pricebar"><label for="p-dianka" class="pb-label">今日点卡价</label><div class="unit pb-input"><input type="number" step="any" min="0" inputmode="decimal" id="p-dianka" data-p="dianka"><span>万/点</span></div><div class="readout" id="o-jl">1 精力 = <b>—</b> 梦幻币</div></div></section>';
  h+='<section class="card" aria-label="六种环比价"><div class="card-head"><h2>六种环：摊位还是鱼市</h2><div class="legend-row"><span><i class="dot" style="background:var(--stall)"></i>摊位便宜</span><span><i class="dot" style="background:var(--box)"></i>鱼市宝匣便宜</span></div></div><div class="scroll"><table class="price"><thead>'+
     '<tr><th rowspan="2" class="tl">种类</th><th colspan="3" class="fill">鱼市订单 <em>（填）</em></th><th rowspan="2">宝匣成本</th><th rowspan="2" class="fill">摊位价 <em>（填，万）</em></th><th rowspan="2" class="tl">结论</th></tr>'+
     '<tr><th>鱼等级</th><th>条数</th><th>车马资源</th></tr></thead><tbody>';
  TYPES.forEach(function(tt){
    var k=tt[0];
    h+='<tr id="row-'+k+'"><td class="name">'+tt[1]+'</td>'+
       '<td class="in"><select class="w-lv" id="t-'+k+'-lv" data-t="'+k+'" data-f="lv" aria-label="'+tt[1]+'鱼等级"><option value="1">1 级</option><option value="2">2 级</option><option value="3">3 级</option></select></td>'+
       '<td class="in"><span class="x">×</span><input class="w-n" type="number" step="1" min="0" inputmode="numeric" id="t-'+k+'-n" data-t="'+k+'" data-f="n" aria-label="'+tt[1]+'鱼条数"></td>'+
       '<td class="in"><input class="w-cm" type="number" step="1" min="0" inputmode="numeric" id="t-'+k+'-cm" data-t="'+k+'" data-f="cm" aria-label="'+tt[1]+'车马资源"></td>'+
       '<td class="box-cell" id="c-'+k+'-box"><div class="cost"><b id="o-'+k+'-box"></b><small id="o-'+k+'-jl"></small></div></td>'+
       '<td class="in st-cell" id="c-'+k+'-st"><input class="w-st" type="number" step="any" min="0" inputmode="decimal" id="t-'+k+'-stall" data-t="'+k+'" data-f="stall" aria-label="'+tt[1]+'摊位价"></td>'+
       '<td id="o-'+k+'-v"></td></tr>';
  });
  h+='</tbody></table></div>'+
     '<div class="save-row"><span id="status" class="status"></span><div class="save-actions"><label for="save-date" class="hint">日期</label><input type="date" id="save-date"><button id="btn-reset" class="ghost" type="button">恢复上次保存</button><button id="btn-save" type="button">保存这一天</button></div></div></section>';
  h+='<section class="card" aria-label="比价历史记录"><div class="card-head"><h2>历史记录</h2><div class="legend"><span><i style="background:var(--box)"></i>鱼市宝匣</span><span><i style="background:var(--stall)"></i>摊位</span></div></div>'+
     '<div class="seg" id="seg">'+TYPES.map(function(tt){return '<button type="button" data-ct="'+tt[0]+'">'+tt[1]+'</button>'}).join("")+'</div>'+
     '<div class="chart-wrap" id="chart"></div>'+
     '<div class="scroll hist-wrap"><table class="hist"><thead><tr><th>日期</th><th>点卡</th>';
  TYPES.forEach(function(tt){h+='<th><span class="th-t">'+tt[1]+'</span><span class="th-s">宝匣 / 摊位</span></th>'});
  h+='<th></th></tr></thead><tbody id="hist-body"></tbody></table></div></section>';
  return h;
}
function fill(){
  /* setVal 会跳过正在输入的框（后台拉取云端后重画时，不打断输入） */
  PARAMS.forEach(function(pp){setVal($("p-"+pp[0]),cur.p[pp[0]])});
  TYPES.forEach(function(tt){var k=tt[0],r=cur.t[k]||{};
    ["lv","n","cm","stall"].forEach(function(fl){setVal($("t-"+k+"-"+fl),r[fl])});
  });
  setVal($("save-date"),cur.date||today());
  markSeg();
}
function update(){
  var c=compute(cur);
  $("o-jl").innerHTML=c.jlPrice==null?'填了点卡价才能算宝匣成本':'1 精力 = <b>'+f(c.jlPrice*10000,0)+'</b> 梦幻币';
  TYPES.forEach(function(tt){
    var k=tt[0],r=c.rows[k];
    $("o-"+k+"-jl").textContent=f(r.jl,0)+" 精力";
    $("o-"+k+"-box").textContent=wan(r.box);
    var row=$("row-"+k),bc=$("c-"+k+"-box"),sc=$("c-"+k+"-st"),v=$("o-"+k+"-v");
    row.classList.remove("win-box","win-stall");bc.classList.remove("win");sc.classList.remove("win");
    if(r.diff==null){v.innerHTML='<span class="hint">'+(r.box==null?"填点卡价后比较":"填摊位价后比较")+'</span>'}
    else if(Math.abs(r.diff)<0.005){v.innerHTML='<div class="verdict"><span class="tag tie">一样</span></div>'}
    else if(r.diff>0){row.classList.add("win-box");bc.classList.add("win");v.innerHTML='<div class="verdict"><span class="tag box">走鱼市</span><span class="save box">省 <b>'+f(r.diff,2)+'</b> 万</span></div>'}
    else{row.classList.add("win-stall");sc.classList.add("win");v.innerHTML='<div class="verdict"><span class="tag stall">买摊位</span><span class="save stall">省 <b>'+f(-r.diff,2)+'</b> 万</span></div>'}
  });
  renderHistory();
}
function renderHistory(){
  var body=$("hist-body"),h="";
  if(!records.length){h='<tr><td colspan="10" class="hint">还没有保存过。填好今天的数后点“保存这一天”。</td></tr>'}
  records.slice().reverse().forEach(function(rec){
    var c=compute(rec);
    h+='<tr><td class="date">'+esc(rec.date)+'</td><td class="num">'+f(rec.p.dianka,3)+'</td>';
    TYPES.forEach(function(tt){var r=c.rows[tt[0]],st=(rec.t[tt[0]]||{}).stall;
      var bw=st!=null&&r.box!=null&&r.box<st-0.005,sw=st!=null&&r.box!=null&&st<r.box-0.005;
      h+='<td class="hc"><span class="v'+(bw?' win box':'')+'">'+f(r.box,1)+'</span><span class="sep"> / </span><span class="v'+(sw?' win stall':'')+'">'+(st==null?"—":f(st,1))+'</span></td>'});
    h+='<td><button type="button" class="del" data-del="'+esc(rec.date)+'">删除</button></td></tr>';
  });
  body.innerHTML=h;
  drawChart();
}
var chartType="w80";
function markSeg(){Array.prototype.forEach.call(document.querySelectorAll("#seg button"),function(b){var on=b.dataset.ct===chartType;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false")})}
function drawChart(){
  var k=chartType;
  var pts=records.map(function(rec){var c=compute(rec);return{d:rec.date,box:c.rows[k].box,stall:(rec.t[k]||{}).stall}});
  var el=$("chart");
  if(!pts.length){el.innerHTML='<p class="hint">保存后这里会画出走势。</p>';return}
  var W=640,H=210,L=44,R=40,T=18,B=28;
  var vals=[];pts.forEach(function(p){if(p.box!=null)vals.push(p.box);if(p.stall!=null)vals.push(p.stall)});
  if(!vals.length){el.innerHTML='<p class="hint">这种环还没有可画的数（要填点卡价或摊位价）。</p>';return}
  var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
  var pad=Math.max((hi-lo)*0.3,hi*0.1,0.5);
  var min=Math.max(0,lo-pad),max=hi+pad;
  var step=niceStep((max-min)/4);min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
  function x(i){return pts.length===1?(L+(W-L-R)/2):L+i*(W-L-R)/(pts.length-1)}
  function y(v){return T+(H-T-B)*(1-(v-min)/(max-min))}
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="宝匣成本与摊位价走势">';
  for(var g=min;g<=max+1e-9;g+=step){s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(g)+'" y2="'+y(g)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(L-8)+'" y="'+(y(g)+4)+'" font-size="11" fill="var(--muted)" text-anchor="end">'+f(g,1)+'</text>'}
  var last=pts[pts.length-1],boxHigher=last.stall==null||last.box>=last.stall;
  function line(key,color,above){var d="",n=0;pts.forEach(function(p,i){var v=p[key];if(v==null||isNaN(v))return;d+=(n?"L":"M")+x(i)+","+y(v);n++});
    var out=d?'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>':'';
    var lastI=-1;pts.forEach(function(p,i){if(p[key]!=null&&!isNaN(p[key]))lastI=i});
    pts.forEach(function(p,i){var v=p[key];if(v==null||isNaN(v))return;out+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="'+(i===lastI?5:3)+'" fill="'+color+'" stroke="var(--sunken)" stroke-width="2"/>'});
    if(lastI>=0){var lv=pts[lastI][key];out+='<text x="'+(x(lastI)+9)+'" y="'+(y(lv)+(above?-6:15))+'" font-size="12" font-weight="700" fill="'+color+'">'+f(lv,1)+'</text>'}
    return out}
  s+=line("stall","var(--stall)",!boxHigher)+line("box","var(--box)",boxHigher);
  var every=Math.max(1,Math.ceil(pts.length/7));
  var lastX=x(pts.length-1);
  pts.forEach(function(p,i){if(i===pts.length-1||(i%every===0&&lastX-x(i)>=40))s+='<text x="'+x(i)+'" y="'+(H-6)+'" font-size="11" fill="var(--muted)" text-anchor="middle">'+esc(p.d.slice(5))+'</text>'});
  s+='</svg>';
  if(pts.length===1)s='<p class="hint">目前只有一天的记录，多存几天就能看出涨跌。单位：万。</p>'+s;
  el.innerHTML=s;
}
function niceStep(v){if(v<=0)return 1;var e=Math.pow(10,Math.floor(Math.log(v)/Math.LN10)),m=v/e;return(m<=1?1:m<=2?2:m<=5?5:10)*e}
function priceInput(el){
  if(el.dataset.p){cur.p[el.dataset.p]=readNum(el)}
  else if(el.dataset.t){var r=cur.t[el.dataset.t]||(cur.t[el.dataset.t]={});r[el.dataset.f]=el.dataset.f==="lv"?parseInt(el.value,10):readNum(el)}
  else if(el.id==="save-date"){cur.date=el.value;return}
  else return;
  lsSet(draftKey(),{base:latest?latest.date:"",cur:cur});
  setStatus("有改动还没保存","dirty");
  update();
}
function setStatus(t,kind){var el=$("status");el.textContent=t||"";el.className="status"+(kind?" "+kind:"")}
/* 改这个号某一天的记录（rec 为空 = 删掉这一天），先记到本机，再存云端 */
function priceSetDay(d,rec,msg){
  var a=acct,p=pendOf(a),v=Date.now();
  DATA[a]=DATA[a].filter(function(r){return r.date!==d});
  if(rec){DATA[a].push(rec);p.up[d]={r:clone(rec),v:v};delete p.del[d]}
  else{delete p.up[d];p.del[d]=v}
  sortList(DATA[a]);pendSave(a);
  records=DATA[a];latest=records[records.length-1]||null;
  if(rec){lsDel(draftKey());if(a==="ruyi")lsDel(DRAFT_KEY);hasDraft=false}
  renderHistory();markTabs();syncStatus();
  publishAll(msg,setStatus);
}
function priceClick(el){
  if(el.id==="btn-save"){
    var d=$("save-date").value||today();
    var rec=clone(cur);rec.date=d;
    priceSetDay(d,rec,"已保存 "+d);return true;
  }
  if(el.id==="btn-reset"){lsDel(draftKey());cur=clone(latest||DEFAULT);cur.date=today();fill();update();setStatus("已恢复成上次保存的数","ok");return true}
  if(el.dataset.ct){chartType=el.dataset.ct;markSeg();drawChart();return true}
  if(el.dataset.del){
    if(!el.classList.contains("armed")){el.classList.add("armed");el.textContent="确认删除";return true}
    var dd=el.dataset.del;priceSetDay(dd,null,"已删除 "+dd);return true;
  }
  return false;
}
function initialStatus(){
  if(hasDraft)setStatus("已载入上次没保存的改动，确认后点“保存这一天”","dirty");
  else if(pendCount(acct))setStatus("这个号有 "+pendCount(acct)+" 天的比价改动还没存云端","dirty");
  else setStatus("");
}


/* 存云端登记：每个号上传 records；成功后按天清掉已上传的本机改动 */
syncReg({
  dump:function(k){return{records:DATA[k]}},
  dirty:function(k){return pendCount(k)>0},
  snap:function(k){var p=pendOf(k),s={up:{},del:{}};Object.keys(p.up).forEach(function(d){s.up[d]=p.up[d].v});Object.keys(p.del).forEach(function(d){s.del[d]=p.del[d]});return s},
  ack:function(k,s){var p=pendOf(k);
    Object.keys(s.up).forEach(function(d){if(p.up[d]&&p.up[d].v===s.up[d])delete p.up[d]});
    Object.keys(s.del).forEach(function(d){if(p.del[d]===s.del[d])delete p.del[d]});
    pendSave(k)}
});
