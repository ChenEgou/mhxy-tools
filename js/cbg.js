"use strict";
/* ========== 价格表（只读） ==========
   读仓库 cbg 分支的 cbg.json：{v,server,t,status,last_ok,gold:{min,t},items:{"iron:140":{min,n,pg,t},"book:140:枪":{…},"zhanpo:160":{…}}}
   价格 min 的单位是元；金价是 元 / 3000 万；时间都是毫秒。
   读不到就先用这台设备上次读到的那份。这里不存任何要同步的数据。 */
var CBG=(function(){
  var KEY="mhxy-cbg-cache-v1",BRANCH="cbg",FILE="cbg.json";
  var GAP=10*60000;          /* 两次读取至少隔这么久 */
  var GOLD_OLD=2*3600000;    /* 金价超过这么久没更新就标红（正常每小时一次） */
  var ITEM_OLD=30*3600000;   /* 书铁价超过这么久没更新就标红（正常 8~12 小时轮一遍） */
  /* 制造指南书的种类，叫法跟藏宝阁一致；分成防具、武器两组给下拉用 */
  var ARMOR=["头盔","发钗","铠甲","女衣","项链","腰带","靴"];
  var WEAPON=["枪","斧","剑","双剑","刀","巨剑","锤","鞭","扇","爪刺","飘带","魔棒","长杖","弓","宝珠","双环","灯笼","伞","棍"];
  var KINDS=ARMOR.concat(WEAPON);
  /* 平时的叫法 → 藏宝阁的叫法 */
  var ALIAS={"鞋":"靴","鞋子":"靴","靴子":"靴","男衣":"铠甲","衣服":"铠甲","盔甲":"铠甲","男头":"头盔","帽子":"头盔","头":"头盔","女头":"发钗","钗":"发钗",
    "链":"项链","带":"腰带","腰":"腰带","枪矛":"枪","斧钺":"斧","斧头":"斧","法杖":"长杖","杖":"长杖","弓弩":"弓","环":"双环","环圈":"双环",
    "短剑":"双剑","双短剑":"双剑","爪":"爪刺","棒":"魔棒","珠":"宝珠","灯":"灯笼","扇子":"扇","巨":"巨剑","棍子":"棍","飘":"飘带","鞭子":"鞭","锤子":"锤","雨伞":"伞"};
  var data=null,last=0,loading=null;
  function ok(d){return !!(d&&typeof d==="object"&&d.items&&typeof d.items==="object")}
  /* 没设仓库（本地开发）：读同目录下的 cbg.json，这个文件不进 git */
  function url(){var r=GH.repo();return(r?"https://raw.githubusercontent.com/"+r+"/"+BRANCH+"/":"")+FILE+"?_="+Date.now()}
  function init(){var c=lsGet(KEY);data=ok(c)?c:null}
  /* 读一次价格表。force：不管离上次多久都读。返回 true = 内容有变化 */
  function load(force){
    if(loading)return loading;
    if(!force&&Date.now()-last<GAP)return Promise.resolve(false);
    last=Date.now();
    loading=fetch(url(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
      loading=null;if(!ok(d))return false;
      var ch=!data||data.t!==d.t;data=d;lsSet(KEY,d);return ch;
    },function(){loading=null;return false});
    return loading;
  }
  function gold(){return data&&data.gold&&data.gold.min>0?data.gold.min:null}
  function item(key){var x=data&&data.items[key];return x&&x.min>0?x:null}
  /* 把「140 枪书」「铁」「战魄」这样的文字（结算区下拉选出来的，或者以前手写的）认成价格表里的一项。lv：没写等级时用的等级（这一轮的书铁等级） */
  function find(text,lv){
    var s=String(text||"").replace(/\s+/g,"");if(!s)return null;
    var m=/^(\d{2,3})?级?(.+)$/.exec(s);if(!m)return null;
    var L=m[1]?+m[1]:(lv>0?lv:0),name=m[2];
    if(name==="战魄")return{key:"zhanpo:160",label:"160 战魄"};
    if(!L)return null;
    if(/^(百炼)?精?铁$/.test(name))return{key:"iron:"+L,label:L+" 铁"};
    name=name.replace(/(制造)?(指南)?书$/,"");
    var k=ALIAS[name]||name;
    return KINDS.indexOf(k)<0?null:{key:"book:"+L+":"+k,label:L+" "+k+"书"};
  }
  function ago(t){
    var m=Math.round((Date.now()-t)/60000);
    return m<1?"刚刚":m<60?m+" 分钟前":m<48*60?Math.round(m/60)+" 小时前":Math.round(m/1440)+" 天前";
  }
  /* 金价那一行的文字；bad = 要标红（太久没更新、登录过期、采集出错停了） */
  function goldLine(){
    if(!data)return{t:"",bad:false};
    var g=gold(),why=data.status==="expired"?"藏宝阁登录过期，等重新登录":(data.status==="blocked"||data.status==="error")?"采集停了":"";
    if(!g)return{t:"藏宝阁金价还没查到"+(why?" · "+why:""),bad:!!why};
    var old=Date.now()-data.gold.t>GOLD_OLD;
    return{t:(data.server||"")+"金价 "+f(g,1)+" 元/3000万 · "+ago(data.gold.t)+(why?" · "+why:old?" · 没在更新":""),bad:!!why||old};
  }
  return{
    key:KEY,init:init,load:load,gold:gold,item:item,find:find,armor:ARMOR,weapon:WEAPON,ago:ago,goldLine:goldLine,
    has:function(){return !!data},
    known:function(key){return !!(data&&data.items[key])},/* 价格表里有没有这一项（有但没价 = 现在没人卖） */
    server:function(){return data?data.server||"":""},
    old:function(t){return Date.now()-t>ITEM_OLD}
  };
})();
