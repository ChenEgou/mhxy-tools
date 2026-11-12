"use strict";
/* ========== 等级计算 ========== */
var SKILLS=[[201,"强身术",140,"qs"],[202,"冥想",140,"t2"],[203,"暗器技巧",160,"t2"],[204,"打造技巧",160,"t3"],[205,"裁缝技巧",160,"t3"],[206,"中药医理",160,"t2"],[207,"炼金术",160,"t3"],[208,"烹饪技巧",160,"t2"],[209,"追捕技巧",160,"t2"],[210,"逃离技巧",160,"t2"],[211,"养生之道",160,"t2"],[212,"健身术",160,"t2"],[216,"巧匠之术",160,"t2"],[217,"熔炼技巧",160,"t2"],[218,"灵石技巧",120,"ls"],[230,"强壮",60,"qz"],[231,"淬灵之术",160,"t3"],[237,"神速",60,"qz"],[239,"风之感应",20,"qz"],[240,"雨之感应",20,"qz"],[241,"雪之感应",20,"qz"]];
function skillRow(sk,L){/* 第 L 级（从 L-1 升到 L）的 [经验, 金钱] */
  var i=L-1,t=sk[3];
  if(t==="ls")return[GD.t5e[i],GD.t5c[i]];
  if(t==="qz")return[GD.t6e[i],GD.t6e[i]/4];
  var e=GD.t2e[i],c=GD.t2c[i];
  if(t==="qs"&&i>=120)e=GD.t0eTail[i-120];
  if(t==="t3"&&i>=150){e=GD.t3eTail[i-150];c=GD.t3cTail[i-150]}
  return[e,c];
}
var CALC_KEY="mhxy-calc-v1";
var CDEF={l1f:69,l1t:175,l2l:159,l2e:10,l2u:"1e8",q1f:0,q1t:50,x1t:"atk",x1f:0,x1t2:25,y1f:0,y1t:9,b1s:"211",b1f:0,b1t:160,m1l:175,m1e:100,m1u:"1e8",m1h:0,m1q:200,z1af:0,z1at:20,z1bf:0,z1bt:20,z1cf:0,z1ct:20,z1df:0,z1dt:20,z1ax:0,z1bx:0,z1cx:0,z1dx:0,z1g:null,s1f:0,s1t:180,s1n:7,v1l:175,v1s:160,v1h:0};
/* 等级计算：两个号分开存（本机 + 云端）。
   CALC[号] 输入值；CALCU[号] 修改时间；CALCD[号] 有没上传的改动；CALCB[号] 这份基于云端哪个版本（云端的 u）
   合并规则同跑环：本机没改用云端；本机改了、云端没变用本机；两边都改了取后改的，本机那份输了就留备份 */
function calcKey(a){return "mhxy-calc-v2-"+a}
function normCalc(v){var o=clone(CDEF);if(v&&typeof v==="object")Object.keys(o).forEach(function(k){if(v[k]!=null)o[k]=v[k]});return o}
var CALC={},CALCU={},CALCD={},CALCB={},CS=null;
function calcStore(k){lsSet(calcKey(k),{u:CALCU[k]||0,v:CALC[k],base:CALCB[k]||0,dirty:!!CALCD[k]})}
function calcLoadData(){
  var old=lsGet(CALC_KEY);/* 旧版两个号共用的一份：只当没有任何记录时的起点，果价按各号自己的 */
  if(old&&typeof old==="object"){old=clone(old);delete old.z1g}
  ACCOUNTS.forEach(function(a){
    var k=a[0],ea=(embedded.accounts&&embedded.accounts[k])||{},ec=ea.calc&&typeof ea.calc==="object"?ea.calc:null,eu=ec?+ec.u||0:0;
    var lc=lsGet(calcKey(k));if(!lc||typeof lc!=="object")lc=null;
    if(lc&&lc.dirty==null){lc.dirty=(+lc.u||0)>eu;lc.base=eu}/* 旧版本机数据：按旧规则判断一次 */
    if(!cloudData&&lc){CALC[k]=normCalc(lc.v);CALCU[k]=+lc.u||0;CALCD[k]=!!lc.dirty;eu=+lc.base||0}/* 没拿到云端数据：只用本机，不合并 */
    else if(lc&&lc.dirty&&(!ec||+lc.base===eu)){CALC[k]=normCalc(lc.v);CALCU[k]=+lc.u||0;CALCD[k]=true}
    else if(lc&&lc.dirty&&JSON.stringify(normCalc(lc.v))===JSON.stringify(normCalc(ec.v))){CALC[k]=normCalc(ec.v);CALCU[k]=eu;CALCD[k]=false}/* 内容一样：已同步 */
    else if(lc&&lc.dirty&&(+lc.u||0)>eu){MERGED.push([k,"等级计算"]);backupAdd(k,"calc",ec,"云端");CALC[k]=normCalc(lc.v);CALCU[k]=+lc.u||0;CALCD[k]=true}/* 两边都改了、本机的更新：云端那份留备份 */
    else{
      if(lc&&lc.dirty){MERGED.push([k,"等级计算"]);backupAdd(k,"calc",lc,"本机")}/* 两边都改了、云端的更新：本机那份留备份 */
      CALC[k]=normCalc(ec?ec.v:old);CALCU[k]=eu;CALCD[k]=false;
    }
    CALCB[k]=eu;
    if(CALC[k].z1g==null||CALC[k].z1g===""){var g=RUN[k]&&RUN[k].set.guo;if(g!=null)CALC[k].z1g=g}
    calcStore(k);
  });
}
function calcSave(){CALCU[acct]=Date.now();CALCD[acct]=true;calcStore(acct);syncStatus();autoSave()}
var CMODS=[
  ["升级经验","l"],["经验反算等级","e"],["潜能果","q"],["人物修炼","x"],["乾元丹","y"],
  ["帮派技能","b"],["转门派","m"],["召唤兽修炼","z"],["师门技能","s"],["体力活力","v"]
];
function nf(v){return Math.round(v).toLocaleString("en-US")}
function big(v){
  if(v==null||isNaN(v))return "—";var a=Math.abs(v);
  if(a>=1e4&&a<1e8){var w=f(v/1e4,a>=1e6?0:1);if(Math.abs(+w)<1e4)return w+'<small>万</small>'}/* 四舍五入到 10000 万的改用亿 */
  if(a>=1e4)return f(v/1e8,2)+'<small>亿</small>';
  return nf(v);
}
function cin(k,label,o){/* 数字输入 */
  o=o||{};
  return '<label class="cf'+(o.w?" "+o.w:"")+(o.t?" "+o.t:"")+'"><span>'+label+'</span><span class="cx"><input type="number" step="'+(o.step||1)+'"'+(o.min!=null?' min="'+o.min+'"':'')+(o.max!=null?' max="'+o.max+'"':'')+' inputmode="decimal" data-c="'+k+'" id="c-'+k+'">'+(o.u?'<i>'+o.u+'</i>':'')+'</span></label>';
}
function csel(k,label,opts){return '<label class="cf"><span>'+label+'</span><select data-c="'+k+'" id="c-'+k+'">'+opts.map(function(p){return '<option value="'+p[0]+'">'+p[1]+'</option>'}).join("")+'</select></label>'}
function cchk(k,label){return '<label class="cc"><input type="checkbox" data-c="'+k+'" id="c-'+k+'"><span>'+label+'</span></label>'}
var UNIT=[["1e8","亿"],["1e4","万"],["1","个"]];
function calcShell(){
  var h='<div class="cwrap"><aside class="ctoc" aria-label="计算器目录"><div class="ctoc-h">等级计算<small data-chip></small></div><nav class="ctoc-list">'+
    CMODS.map(function(m,i){return '<button type="button" class="ct" data-go="'+(i+1)+'"><i>'+(i<9?"0":"")+(i+1)+'</i><span>'+m[0]+'</span></button>'}).join("")+'</nav><div class="ctoc-f">数据取自网易官方工具箱</div></aside><div class="cgrid">';
  var body={
    l:cin("l1f","当前等级",{min:0,max:174})+cin("l1t","目标等级",{min:1,max:175}),
    e:cin("l2l","当前等级",{min:1,max:175})+cin("l2e","手上经验",{step:"any",min:0,w:"wide",t:"exp"})+csel("l2u","单位",UNIT),
    q:cin("q1f","已兑换",{min:0,max:200,u:"颗"})+cin("q1t","兑换到",{min:0,max:200,u:"颗"}),
    x:csel("x1t","类型",[["atk","攻击 / 法术"],["def","防御 / 抗法"],["hunt","猎术（到 20）"]])+cin("x1f","当前",{min:0,max:25})+cin("x1t2","目标",{min:0,max:25}),
    y:cin("y1f","当前",{min:0,max:9,u:"颗"})+cin("y1t","目标",{min:0,max:9,u:"颗"}),
    b:csel("b1s","技能",SKILLS.map(function(s){return[String(s[0]),s[1]+"（"+s[2]+"）"]}))+cin("b1f","当前",{min:0,max:160})+cin("b1t","目标",{min:0,max:160}),
    m:cin("m1l","角色等级",{min:60,max:175})+cin("m1e","总经验",{step:"any",min:0,w:"wide",t:"exp"})+csel("m1u","单位",UNIT)+cin("m1q","已有潜能果",{min:0,max:200,u:"颗"})+cchk("m1h","同种族转回历史门派（1 折）"),
    z:'<div class="ztab"><div class="zr zh"><span></span><span>当前</span><span class="zxh">当前级已有经验</span><span></span><span>目标</span><span></span></div>'+[["a","攻击"],["b","防御"],["c","法术"],["d","抗法"]].map(function(r){return '<div class="zr"><span class="zn">'+r[1]+'</span><input type="number" min="0" max="25" step="1" inputmode="numeric" data-c="z1'+r[0]+'f" id="c-z1'+r[0]+'f" aria-label="'+r[1]+'当前"><span class="zx"><input type="number" min="0" step="1" inputmode="numeric" data-c="z1'+r[0]+'x" id="c-z1'+r[0]+'x" aria-label="'+r[1]+'当前级已有修炼经验"><i id="zx-'+r[0]+'"></i></span><span class="zarr">→</span><input type="number" min="0" max="25" step="1" inputmode="numeric" data-c="z1'+r[0]+'t" id="c-z1'+r[0]+'t" aria-label="'+r[1]+'目标"><span class="zo" id="zo-'+r[0]+'"></span></div>'}).join("")+'</div>'+cin("z1g","修炼果价",{step:"any",min:0,u:"万",t:"money"}),
    s:cin("s1f","当前",{min:0,max:179})+cin("s1t","目标",{min:1,max:180})+cin("s1n","技能个数",{min:1,max:7}),
    v:cin("v1l","角色等级",{min:1,max:175})+cin("v1s","健身术 / 养生之道",{min:0,max:160})+cchk("v1h","吃海马（3 小时内恢复翻倍）")
  };
  CMODS.forEach(function(m,i){
    h+='<section class="card cm" id="cm-'+(i+1)+'"><div class="cm-h"><i>'+(i<9?"0":"")+(i+1)+'</i><h3>'+m[0]+'</h3><span class="cm-note" id="cn-'+m[1]+'"></span></div><div class="cm-in">'+body[m[1]]+'</div><div class="cm-out" id="co-'+m[1]+'"></div></section>';
  });
  h+='</div></div>';
  return h;
}
function cfill(){Object.keys(CS).forEach(function(k){var el=$("c-"+k);if(!el||document.activeElement===el)return;if(el.type==="checkbox")el.checked=!!CS[k];else el.value=CS[k]==null?"":CS[k]})}
function ci(k,lo,hi){var v=Math.round(parseFloat(CS[k]));if(isNaN(v))v=lo;return Math.max(lo,Math.min(hi,v))}/* 和输入框一样四舍五入 */
function cnum(k){var v=parseFloat(CS[k]);return isNaN(v)?0:v}
function res(items){return items.map(function(it){return '<div class="cr'+(it[3]?" "+it[3]:"")+'"><span class="k">'+it[0]+'</span><b>'+it[1]+'</b>'+(it[2]?'<small>'+it[2]+'</small>':'')+'</div>'}).join("")}
function bad(t){return '<div class="cbad">'+t+'</div>'}
function hm(min){var h=Math.floor(min/60),m=Math.round(min%60);return(h?h+" 小时 ":"")+(m||!h?m+" 分":"")}
function calcAll(){
  var o;
  /* 01 升级经验 */
  (function(){var a=ci("l1f",0,174),b=ci("l1t",1,175);
    if(b<=a){o=bad("目标等级要高于当前等级")}else{var s=0;for(var i=a;i<b;i++)s+=GD.role[i];o=res([["所需经验",big(s),nf(s),"exp"],["跨度",(b-a)+'<small>级</small>',a+" → "+b]])}
    $("co-l").innerHTML=o;$("cn-l").textContent="只算升级，不含技能、修炼等";})();
  /* 02 经验反算 */
  (function(){var L=ci("l2l",1,175),ex=cnum("l2e")*Number(CS.l2u||1),left=ex,used=0;
    while(L<175&&left>=GD.role[L]){left-=GD.role[L];used+=GD.role[L];L++}
    var start=ci("l2l",1,175),nx=L<175?GD.role[L]:null;
    o=res([["能升到",L+'<small>级</small>',start+" → "+L],["用掉",big(used),nf(used),"exp"],["剩余",big(left),nx?"离下一级还差 "+nf(nx-left):"已到 175","exp"]]);
    $("co-e").innerHTML=o;$("cn-e").textContent="只按经验表算，不管飞升渡劫条件";})();
  /* 03 潜能果 */
  (function(){var a=ci("q1f",0,200),b=ci("q1t",0,200);
    if(b<=a){o=bad("兑换到的数量要大于已兑换")}else{var s=0;for(var i=a+1;i<=b;i++)s+=GD.qng[i];s*=1e4;o=res([["所需经验",big(s),nf(s),"exp"],["兑换",(b-a)+'<small>颗</small>',"第 "+(a+1)+" 到第 "+b+" 颗"]])}
    $("co-q").innerHTML=o;})();
  /* 04 人物修炼 */
  (function(){var t=CS.x1t||"atk",max=t==="hunt"?20:25,a=ci("x1f",0,max),b=ci("x1t2",0,max);
    if(b<=a){o=bad("目标要高于当前（"+(t==="hunt"?"猎术最高 20":"最高 25")+"）")}else{var e=0,g=0;for(var i=a;i<b;i++){e+=GD.xlE[i];g=Math.max(g,GD.xlG[i])}
      var cash=e*(t==="def"?2000:3000);
      o=res([["修炼经验",nf(e),"","exp"],["金钱",big(cash),nf(cash),"money"],["资材",nf(e/2),""],["帮贡要求",nf(150*b),"历史帮贡门槛，不消耗"],["角色等级",g+'<small>级起</small>',""]])}
    $("co-x").innerHTML=o;})();
  /* 05 乾元丹 */
  (function(){var a=ci("y1f",0,9),b=ci("y1t",0,9);
    if(b<=a){o=bad("目标要多于当前")}else{var e=0,c=0;for(var i=a;i<b;i++){e+=GD.qyd[i][0];c+=GD.qyd[i][1]}o=res([["经验",big(e),nf(e),"exp"],["金钱",big(c),nf(c),"money"],["新增",(b-a)+'<small>颗</small>',""]])}
    $("co-y").innerHTML=o;})();
  /* 06 帮派技能 */
  (function(){var sk=null;SKILLS.forEach(function(s){if(String(s[0])===String(CS.b1s))sk=s});if(!sk)sk=SKILLS[10];
    var lim=sk[2],a=ci("b1f",0,lim),b=ci("b1t",0,lim);
    if(b<=a){o=bad("目标要高于当前（"+sk[1]+"最高 "+lim+"）")}else{var e=0,c=0,bg=0;for(var L=a+1;L<=b;L++){var r=skillRow(sk,L);e+=r[0];c+=r[1];bg+=L}
      o=res([["经验",big(e),nf(e),"exp"],["金钱",big(c),nf(c),"money"],["帮贡消耗",nf(bg),"每级消耗 = 级数"],["帮贡门槛",nf(5*b),"学到 "+b+" 级要有 "+nf(5*b)]])}
    $("co-b").innerHTML=o;$("cn-b").textContent=sk[1]+"最高 "+lim+" 级";})();
  /* 07 转门派 */
  (function(){var L=ci("m1l",60,175),tot=cnum("m1e")*Number(CS.m1u||1);
    var e=Math.floor(120*L*L*L+GD.lvExp[L-60]*0.2+tot*0.02);if(e>1e9)e=1e9;
    if(CS.m1h)e=Math.floor(e*0.1);
    var xy=Math.ceil(e/(L*450)),items=[["经验消耗",big(e),nf(e)+(e>=1e9&&!CS.m1h?"（封顶 10 亿）":""),"exp"],["全用仙玉抵扣",nf(xy)+'<small>仙玉</small>',"1 仙玉 = 等级 × 450 经验","money"]];
    if(L>=129){var own=ci("m1q",0,200),num=0,used=0;
      while(used<e&&num<own){used+=GD.qng[own-num]*1e4;num++}
      if(used<e){num=0;used=0;while(used<e&&num<200){num++;used+=GD.qng[num]*1e4}items.push(["潜能果","不够",(own?"你有 "+own+" 颗不够扣；":"")+"从第 1 颗算要 "+num+" 颗","neg"])}
      else items.push(["要扣潜能果",num+'<small>颗</small>',"从你最高的第 "+own+" 颗往下扣"]);
    }
    o=res(items);
    $("co-m").innerHTML=o;$("cn-m").textContent="公式：120×等级³ + 当前升级经验×0.2 + 总经验×2%；另有固定仙玉手续费，以游戏内为准";})();
  /* 08 召唤兽修炼 */
  (function(){var tot=0,maxT=0,badRows=[],hvSum=0;
    [["a","攻击"],["b","防御"],["c","法术"],["d","抗法"]].forEach(function(rr){var r=rr[0],a=ci("z1"+r+"f",0,25),b=ci("z1"+r+"t",0,25),need=a<25?GD.zhs[a+1]-GD.zhs[a]:0;
      var xel=$("c-z1"+r+"x"),raw=CS["z1"+r+"x"],hv=raw==null||raw===""?0:Number(raw),ok=a<25&&isFinite(hv)&&hv>=0&&hv<need&&Math.floor(hv)===hv;
      if(a>=25){hv=0;ok=true}
      $("zx-"+r).textContent=a<25?"/ "+nf(need):"满级";
      if(xel){xel.disabled=a>=25;xel.classList.toggle("inv",!ok);if(ok)xel.removeAttribute("aria-invalid");else xel.setAttribute("aria-invalid","true")}
      if(!ok){badRows.push(rr[1]);$("zo-"+r).innerHTML='<span class="zbad">'+a+' 级已有经验只能填 0 ~ '+nf(need-1)+'，已失效</span>';return}
      var e=b>a?GD.zhs[b]-GD.zhs[a]-hv:0;tot+=e;if(b>a)hvSum+=hv;if(b>a)maxT=Math.max(maxT,b);
      $("zo-"+r).innerHTML=b>a?'<span class="ze">'+nf(e)+'</span> <small>经验 · '+Math.ceil(e/150)+' 果</small>':'<small>—</small>'});
    var g=CS.z1g!=null&&CS.z1g!==""?cnum("z1g"):null,fr=Math.ceil(tot/150),ring=Math.ceil(tot/760);
    var items=[["合计经验",nf(tot),badRows.length?"不含："+badRows.join("、"):hvSum?"已扣掉已有的 "+nf(hvSum):"","exp"],["修炼果",nf(fr)+'<small>颗</small>',"每颗 150"],["宠环",nf(ring)+'<small>轮</small>',"每轮 100 环 760"]];
    if(g!=null)items.push(["吃果子要花",big(fr*g*1e4),"按 "+f(g,2)+" 万一颗","money"]);
    if(maxT)items.push(["角色等级",Math.max(maxT*5+20,65)+'<small>级起</small>',"修到 "+maxT+" 的要求"]);
    $("co-z").innerHTML=(badRows.length?bad(badRows.join("、")+" 的已有经验超出范围，没算进合计"):"")+res(items);})();
  /* 09 师门技能 */
  (function(){var a=ci("s1f",0,179),b=ci("s1t",1,180),n=ci("s1n",1,7);
    if(b<=a){o=bad("目标要高于当前")}else{var e=0,c=0;for(var i=a;i<b;i++){e+=GD.sm[i][0];c+=GD.sm[i][1]}e*=n;c*=n;o=res([["经验",big(e),nf(e),"exp"],["金钱",big(c),nf(c),"money"],["跨度",(b-a)+'<small>级</small>',n+" 个技能"]])}
    $("co-s").innerHTML=o;})();
  /* 10 体力活力 */
  (function(){var L=ci("v1l",1,175),s=ci("v1s",0,160),cap=L*5+50+s*4,per=Math.floor(cap*0.01)+Math.floor(L*0.02)+2,res4=Math.floor(cap/4);
    function ticks(target){if(!CS.v1h)return Math.ceil(target/per);var first=2*per*36;if(first>=target)return Math.ceil(target/(2*per));return 36+Math.ceil((target-first)/per)}
    $("co-v").innerHTML=res([["上限",nf(cap),"等级×5 + 50 + 技能×4"],["每 5 分钟",'+'+per+(CS.v1h?'<small>（海马时 +'+per*2+'）</small>':''),"上限×1% + 等级×2% + 2"],["储备上限",nf(res4),"上限 ÷ 4"],["从 0 回满",hm(ticks(cap)*5),"含储备 "+hm(ticks(cap+res4)*5)]]);
    $("cn-v").textContent="按一直在线、中途不用来算";})();
}
function calcLimits(){
  var sk=null;SKILLS.forEach(function(s){if(String(s[0])===String(CS.b1s))sk=s});if(!sk)sk=SKILLS[10];
  ["b1f","b1t"].forEach(function(k){var el=$("c-"+k);if(el)el.max=sk[2]});
  var xm=CS.x1t==="hunt"?20:25;["x1f","x1t2"].forEach(function(k){var el=$("c-"+k);if(el)el.max=xm});
  ["a","b","c","d"].forEach(function(r){var el=$("c-z1"+r+"x"),a=ci("z1"+r+"f",0,25);if(el)el.max=a<25?GD.zhs[a+1]-GD.zhs[a]-1:0});
}
function calcSanitize(){
  Array.prototype.forEach.call(document.querySelectorAll('#page-calc input[type=number][data-c]'),function(el){
    if(/^z1[a-d]x$/.test(el.dataset.c))return;/* 已有经验：等级改了以后超范围的标红失效，不偷偷改值 */
    if(clampNum(el,true))CS[el.dataset.c]=el.value;
  });
}
function calcInput(el){
  var k=el.dataset.c;if(!k)return;
  CS[k]=el.type==="checkbox"?(el.checked?1:0):el.value;
  if(k==="b1s"||k==="x1t"){calcLimits();calcSanitize()}
  if(/^z1[a-d]f$/.test(k))calcLimits();
  calcSave();calcAll();
}
function tocActive(n){Array.prototype.forEach.call(document.querySelectorAll(".ct"),function(b){var on=b.dataset.go===String(n);b.classList.toggle("on",on);if(on)b.setAttribute("aria-current","true");else b.removeAttribute("aria-current")})}
var tocLock=0;
function calcClick(el){
  if(el.dataset.go){var t=$("cm-"+el.dataset.go);if(t){tocActive(el.dataset.go);tocLock=Date.now();t.scrollIntoView({behavior:"smooth",block:"start"})}return true}
  return false;
}
function tocSpy(){
  if(page!=="calc"||Date.now()-tocLock<900)return;
  var best=1,y=window.innerHeight*0.32;
  for(var i=1;i<=CMODS.length;i++){var el=$("cm-"+i);if(!el)continue;var r=el.getBoundingClientRect();if(r.top-90<=y)best=i}
  if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4)best=CMODS.length;
  tocActive(best);
}
/* 换号时换成这个号自己的那份 */
function calcLoad(){CS=CALC[acct];cfill();calcLimits();calcSanitize();calcAll()}
function calcInit(){
  calcLoad();tocActive(1);
  var tk=null;window.addEventListener("scroll",function(){if(tk)return;tk=setTimeout(function(){tk=null;tocSpy()},80)},{passive:true});
}

/* 存云端登记：每个号上传 calc {u, v} */
syncReg({
  dump:function(k){return{calc:{u:CALCU[k]||0,v:CALC[k]}}},
  dirty:function(k){return !!CALCD[k]},
  snap:function(k){return CALCU[k]||0},
  ack:function(k,u){CALCB[k]=u;if((CALCU[k]||0)===u)CALCD[k]=false;calcStore(k)}
});
