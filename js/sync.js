/* 数据存在 GitHub 仓库 data 分支的 data.json：打开时读，点“存云端”时提交一次（每次都是一个版本）。
   网站代码在 main 分支，存数据只动 data 分支，不会触发网站重新部署，也不会和代码提交混在一起。 */
var GH=(function(){
  var TK="mhxy-gh-token",RK="mhxy-gh-repo",PATH="data.json",BRANCH="data",API="https://api.github.com/repos/";
  var sha=null,via="none",loadedRepo="",tokenBad=false;
  function ls(k,v){try{var st=window.localStorage;if(v===undefined)return st.getItem(k);if(v===null)st.removeItem(k);else st.setItem(k,v)}catch(e){return null}}
  function detect(){var m=/^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);if(!m)return "";var seg=location.pathname.split("/").filter(Boolean)[0];return m[1]+"/"+(seg&&!/\.html?$/i.test(seg)?seg:m[1]+".github.io")}
  function repo(){return ls(RK)||detect()}
  function token(){return ls(TK)||""}
  function hdr(t){var h={Accept:"application/vnd.github+json"};if(t)h.Authorization="Bearer "+t;return h}
  function enc(x){return btoa(unescape(encodeURIComponent(x)))}
  function dec(x){return decodeURIComponent(escape(atob(String(x).replace(/\s/g,""))))}
  function parse(t){try{var o=JSON.parse(t);return o&&typeof o==="object"?o:null}catch(e){return null}}
  function fileUrl(r){return API+r+"/contents/"+PATH+"?ref="+BRANCH+"&_="+Date.now()}
  function readText(url,kind){
    return fetch(url,{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.text()})
      .then(function(t){via=kind;return{data:parse(t),via:via}},function(){via="none";return{data:null,via:via}});
  }
  /* 本地开发（不在 github.io 上、也没设仓库）：读同目录下的 data.json，这个文件不进 git */
  function viaLocal(){return readText(PATH+"?_="+Date.now(),"local")}
  /* API 读不到时的备用：直接读 data 分支的原文件。GitHub 会缓存几分钟，可能不是最新，所以这种情况下不让存云端 */
  function viaRaw(r){return readText("https://raw.githubusercontent.com/"+r+"/"+BRANCH+"/"+PATH+"?_="+Date.now(),"raw")}
  function jsonOf(res){return res.json().then(null,function(){return{}})}
  /* via 表示这次打开页面时云端数据是怎么读到的：
     api 正常 / missing 云端还没有数据文件 / nobranch 没有 data 分支 / bad 文件读不出来
     raw 接口不通、读的是有缓存的原文件 / local 本地开发 / none 什么都没读到。只有 api、missing 允许存云端 */
  function getApi(r,t){
    return fetch(fileUrl(r),{headers:hdr(t),cache:"no-store"}).then(function(res){
      if(res.status===401&&t){tokenBad=true;return getApi(r,"")}
      if(res.status===404)return jsonOf(res).then(function(j){
        sha=null;via=/no commit found|branch/i.test(j.message||"")?"nobranch":"missing";return{data:null,via:via}});
      if(!res.ok)throw{status:res.status};
      return res.json().then(function(j){
        sha=j.sha||null;
        var got=j.content&&j.encoding==="base64"?Promise.resolve(dec(j.content)):
          /* 超过 1MB 时 GitHub 不直接给内容：再按原文读一次（不走缓存，保证是最新的） */
          fetch(fileUrl(r),{headers:Object.assign(hdr(t),{Accept:"application/vnd.github.raw+json"}),cache:"no-store"}).then(function(x){if(!x.ok)throw{status:x.status};return x.text()});
        return got.then(function(text){var d=parse(text);via=d?"api":"bad";return{data:d,via:via}});
      });
    });
  }
  function load(){
    var r=repo();loadedRepo=r;
    if(!r)return viaLocal();
    return getApi(r,token()).then(function(x){
      if(x.via==="nobranch")x.msg="云端仓库里没有 data 分支，暂时存不了云端";
      else if(x.via==="bad")x.msg="云端数据文件读不出来，先用本机数据；为免覆盖，暂时不能存云端";
      else if(tokenBad)x.msg="密钥过期或不对，点 ⚙ 重新粘贴";
      return x;
    },function(e){
      var why=e&&e.status?"GitHub 返回 "+e.status:"连不上 GitHub";
      return viaRaw(r).then(function(x){
        x.msg=x.via==="raw"?"没连上 GitHub 接口（"+why+"），先显示几分钟前的云端数据，暂时不能存云端":"读取云端失败（"+why+"），先用本机数据";
        return x;
      });
    });
  }
  /* 不刷新页面重新读云端（切回页面、定时检查、存的时候冲突了）：
     读成功才更新 sha / via；读失败保持原样，免得一次网络抖动就不让存。返回 null = 没读到 */
  function refresh(){
    var r=repo();if(!r||r!==loadedRepo)return Promise.resolve(null);
    var oldSha=sha,oldVia=via;
    return getApi(r,token()).then(function(x){
      if(x.via!=="api"&&x.via!=="missing"){sha=oldSha;via=oldVia;return null}
      return{data:x.data,via:x.via,changed:sha!==oldSha||oldVia!==x.via};
    },function(){sha=oldSha;via=oldVia;return null});
  }
  function save(st,msg){
    var r=repo(),t=token();
    if(!r||!t)return Promise.reject({code:"notoken"});
    if(via==="bad"||via==="nobranch")return Promise.reject({code:via});
    if(r!==loadedRepo||(via!=="api"&&via!=="missing"))return Promise.reject({code:"stale"});
    var d=new Date(),p=function(n){return(n<10?"0":"")+n};
    var body={message:(msg||"存云端")+" · "+(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes()),content:enc(JSON.stringify(st,null,1)+"\n"),branch:BRANCH};
    if(sha)body.sha=sha;
    var h=hdr(t),b=JSON.stringify(body);h["Content-Type"]="application/json";
    /* keepalive：关页面、切走时请求也能发完（浏览器只允许 64KB 以内） */
    return fetch(API+r+"/contents/"+PATH,{method:"PUT",headers:h,body:b,keepalive:b.length<60000}).then(function(res){
      if(res.ok)return res.json().then(function(j){sha=(j&&j.content&&j.content.sha)||sha;via="api";tokenBad=false;return true});
      var c=res.status,rl=res.headers.get("x-ratelimit-remaining")==="0";
      return jsonOf(res).then(function(j){
        var m=j.message||"",code=
          c===401?"badtoken":
          c===403&&(rl||/rate limit/i.test(m))?"ratelimit":
          (c===404||c===422)&&/branch/i.test(m)?"nobranch":
          c===409||c===422?"conflict":
          c===403||c===404?"noperm":"http";
        throw{code:code,status:c};
      });
    },function(){throw{code:"net"}});
  }
  function check(r,t){return fetch(API+r,{headers:hdr(t),cache:"no-store"}).then(function(res){return res.status},function(){return 0})}
  return{
    repo:repo,token:token,detect:detect,load:load,refresh:refresh,save:save,check:check,branch:BRANCH,path:PATH,
    ready:function(){return !!(repo()&&token())},
    setRepo:function(v){ls(RK,v&&v!==detect()?v:null)},
    setToken:function(v){ls(TK,v||null);if(v)tokenBad=false},
    loadedRepo:function(){return loadedRepo},
    via:function(){return via},
    canSave:function(){return via==="api"||via==="missing"}
  };
})();
