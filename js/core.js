"use strict";
/* ========== 通用 ========== */
function $(id){return document.getElementById(id)}
function store(){try{return window.localStorage}catch(e){return null}}
function lsGet(k){var s=store();if(!s)return null;try{var v=s.getItem(k);return v?JSON.parse(v):null}catch(e){return null}}
/* 写本机存储；失败（不让存、存满了）时记下 storeBad，顶栏会提示「本机存不了」 */
var storeBad=false;
function lsSet(k,v){var s=store();if(!s){storeBad=true;return false}try{s.setItem(k,JSON.stringify(v));return true}catch(e){storeBad=true;return false}}
function lsDel(k){var s=store();if(!s)return;try{s.removeItem(k)}catch(e){}}
function testStore(){try{var x=window.localStorage;x.setItem("__t","1");x.removeItem("__t");return true}catch(e){return false}}
var canStore=testStore();
function newId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function clone(o){return JSON.parse(JSON.stringify(o))}
function today(){var d=new Date();var m=d.getMonth()+1,dd=d.getDate();return d.getFullYear()+"-"+(m<10?"0":"")+m+"-"+(dd<10?"0":"")+dd}
function hhmm(t){var d=new Date(t);var h=d.getHours(),m=d.getMinutes();return(h<10?"0":"")+h+":"+(m<10?"0":"")+m}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function f(v,d){if(v==null||isNaN(v))return "—";var k=Math.pow(10,d==null?2:d);return String(Math.round(v*k)/k)}
function wan(v){return v==null||isNaN(v)?"—":f(v,2)+" 万"}
function r2(v){return Math.round(v*100)/100}
function readNum(el){var v=String(el.value).trim();if(v==="")return null;var n=parseFloat(v);return isNaN(n)?null:n}
/* 数字框限位：超过上限立刻改成上限；负数立刻改成下限；其他低于下限的离开输入框时改成下限；整数格四舍五入。
   离开时是空的：有 data-def 就填它，否则有上下限的填下限。返回 true 表示框里的数被改了（调用方要同步到数据） */
function clampNum(el,final){
  if(!el||el.tagName!=="INPUT"||el.type!=="number")return false;
  var raw=el.value;
  if(raw===""){
    if(!final)return false;
    var df=el.getAttribute("data-def");
    if(df!=null){el.value=df;return true}
    if(el.min!==""&&el.max!==""){el.value=el.min;return true}
    return false;
  }
  var v=parseFloat(raw);if(isNaN(v))return false;
  var mn=el.min===""?null:parseFloat(el.min),mx=el.max===""?null:parseFloat(el.max),nv=v;
  if(final&&el.getAttribute("step")==="1")nv=Math.round(nv);
  if(mx!=null&&nv>mx)nv=mx;
  if(mn!=null&&nv<mn&&(final||nv<0))nv=mn;
  if(nv!==v){el.value=String(nv);return true}
  return false;
}
function setVal(el,v){if(!el||document.activeElement===el)return;var s=v==null?"":String(v);if(el.value!==s)el.value=s}

var ACCOUNTS=[["ruyi","如意岛丶龙宫"],["ciguang","慈光阁丶女儿"]];
/* 每个号在哪个服。藏宝阁价格表（js/cbg.js）是按服的：同一个服才自动估价，别的服只当参考 */
var ACCT_SERVER={ruyi:"如意岛",ciguang:"慈光阁"};
var PAGES=[["price","环装比价"],["run","跑环记录"],["calc","等级计算"]];
var TAB_KEY="mhxy-ring-tab-v1",PAGE_KEY="mhxy-page-v1";
function acctName(k){for(var i=0;i<ACCOUNTS.length;i++)if(ACCOUNTS[i][0]===k)return ACCOUNTS[i][1];return k}
var acct=null,page="price";
/* 云端读到的 data.json（启动时由 mhxyMain 填入）。cloudData：有没有拿到云端数据（或本机留的云端副本）；没有时各页面只用本机数据，不做合并 */
var embedded={},cloudData=false;
