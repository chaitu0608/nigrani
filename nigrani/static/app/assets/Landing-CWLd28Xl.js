import{A as e,C as t,D as n,E as r,F as i,I as a,L as o,M as s,N as c,O as l,P as u,R as d,S as f,T as p,_ as ee,a as te,b as m,c as ne,d as h,f as g,g as _,h as v,i as y,j as re,k as ie,l as ae,m as b,n as x,o as oe,p as se,r as S,s as ce,t as C,u as w,v as le,w as ue,x as T,y as de}from"./index-STirSAcP.js";function fe(...e){let t=!Array.isArray(e[0]),n=t?0:-1,r=e[0+n],i=e[1+n],a=e[2+n],o=e[3+n],s=ue(i,a,o);return t?s(r):s}var pe=50,E=()=>({current:0,offset:[],progress:0,scrollLength:0,targetOffset:0,targetLength:0,containerLength:0,velocity:0}),D=()=>({time:0,x:E(),y:E()}),O={x:{length:`Width`,position:`Left`},y:{length:`Height`,position:`Top`}},me=new WeakMap;function he(e,t){let n=e===document.scrollingElement,r=n&&document.body||e,i=me.get(r);i||me.set(r,i=getComputedStyle(r));let{writingMode:a,flexDirection:o}=i,s=t===`x`!==/^[vs]/.test(a);return(s?i.direction===`rtl`!=(a===`sideways-lr`):a.endsWith(`rl`))!==(!n&&i.display.includes(`flex`)&&(s===(o[0]===`c`)?i.flexWrap:o).endsWith(`reverse`))}function ge(e,t,n,r){let i=n[t],{length:a,position:o}=O[t],c=i.current,u=n.time,d=e[`scroll${o}`];i.current=he(e,t)?-d||0:d,i.containerLength=e[`client${a}`],i.targetLength=e[`scroll${a}`],i.scrollLength=i.targetLength-i.containerLength,i.offset.length=0,i.offset[0]=0,i.offset[1]=i.scrollLength,i.progress=s(0,1,ie(0,i.scrollLength,i.current));let f=r-u;i.velocity=f>pe?0:l(i.current-c,f)}function _e(e,t,n){for(let r in O)ge(e,r,t,n);t.time=n}var k={start:0,center:.5,end:1};function A(e,t,n=0){let r=0;if(e in k&&(e=k[e]),typeof e==`string`){let t=parseFloat(e);e.endsWith(`px`)?r=t:e.endsWith(`%`)?e=t/100:e.endsWith(`vw`)?r=t/100*document.documentElement.clientWidth:e.endsWith(`vh`)?r=t/100*document.documentElement.clientHeight:e=t}return typeof e==`number`&&(r=t*e),n+r}var ve=[0,0];function j(e,t,n,r){let i=Array.isArray(e)?e:ve,a=0,o=0;return typeof e==`number`?i=[e,e]:typeof e==`string`&&(e=e.trim(),i=e.includes(` `)?e.split(` `):[e,k[e]?e:`0`]),a=A(i[0],n,r),o=A(i[1],t),a-o}var ye={All:[[0,0],[1,1]]};function be(e,t){let n=e.length-1;if(n<1)return 0;let r=e[0]>e[n],i=t=>e[r?n-t:t];if(e[0]===e[1]&&t<i(0))return+!!r;let a=0;for(;a<n-1&&t>=i(a+1);)a++;let o=(a+ie(i(a),i(a+1),t))/n;return r?1-o:o}function xe(e,t){let{offset:n=ye.All,axis:r=`y`}=t,i=e[r];i.offset.length=0;let a=n.length;for(let e=0;e<a;e++)i.offset[e]=j(n[e],i.containerLength,i.targetLength,i.targetOffset);i.progress=s(0,1,be(i.offset,i.current))}function Se(e,t){let n={x:0,y:0},r=e;for(;r&&r!==t;)if(de(r))n.x+=r.offsetLeft,n.y+=r.offsetTop,r=r.offsetParent;else if(r.tagName===`svg`){let e=r.getBoundingClientRect();r=r.parentElement;let t=r.getBoundingClientRect();n.x+=e.left-t.left,n.y+=e.top-t.top}else if(r instanceof SVGGraphicsElement){let{x:e,y:t}=r.getBBox();n.x+=e,n.y+=t;let i=null,a=r.parentNode;for(;!i;)a.tagName===`svg`&&(i=a),a=r.parentNode;r=i}else break;return n}function Ce(e){return`getBBox`in e&&e.tagName!==`svg`?e.getBBox():{width:e.clientWidth,height:e.clientHeight}}function we(e,t,n,r={}){let{target:i}=r,a=i||r.offset;return{measure:t=>{if(a){n.time=t.time;for(let e in O){let r=e,{offset:i}=n[r];Object.assign(n[r],t[r]),n[r].offset=i}if(i&&i!==e){let t=Se(i,e),r=Ce(i);n.x.targetOffset=t.x,n.y.targetOffset=t.y,n.x.targetLength=r.width,n.y.targetLength=r.height}xe(n,r)}},notify:e=>t(a?n:e)}}var M=new WeakMap,Te=new WeakMap,N=new WeakMap,P=new WeakMap,F=e=>e===document.scrollingElement?window:e;function I(t,{container:i=document.scrollingElement,trackContentSize:a=!1,...o}={}){if(!i)return e;let s=N.get(i);s||(s=new Set,N.set(i,s));let c=we(i,t,D(),o);if(s.add(c),!M.has(i)){let e=D(),t=()=>{_e(i,e,n.timestamp);for(let t of s)t.measure(e);r.preUpdate(a)},a=()=>{for(let t of s)t.notify(e)},o=()=>r.read(t);M.set(i,o);let c=F(i);window.addEventListener(`resize`,o),i!==document.documentElement&&Te.set(i,b(i,o)),c.addEventListener(`scroll`,o),o()}if(a&&!P.has(i)){let e=M.get(i),t={width:i.scrollWidth,height:i.scrollHeight},n=r.read(()=>{let n=i.scrollWidth,r=i.scrollHeight;(t.width!==n||t.height!==r)&&(e(),t.width=n,t.height=r)},!0);P.set(i,n)}let l=M.get(i);return r.read(l,!1,!0),()=>{p(l);let e=N.get(i);if(!e||(e.delete(c),e.size))return;N.delete(i);let t=M.get(i);M.delete(i),t&&(F(i).removeEventListener(`scroll`,t),Te.get(i)?.(),window.removeEventListener(`resize`,t));let n=P.get(i);n&&(p(n),P.delete(i))}}function Ee(e){return typeof window>`u`?!1:e?t():f()}var L=new Map;function De({container:e,target:t,axis:n}){let r=L.get(e);r||(r=new Map,L.set(e,r));let i=t??`self`,a=r.get(i);return a||(a={},r.set(i,a)),a[n]||(a[n]=t?new ViewTimeline({subject:t,axis:n}):new ScrollTimeline({source:e,axis:n}))}var Oe=e=>{if(/v/u.test(e))return[];let t=j(e,0,0,0);return[j(e,0,1,0)-t,t-j(e,1,0,0),t]},R=([e,t,n])=>!n&&(t===0||t===1)&&`${t?`entry`:`exit`}-crossing ${e*100}%`;function z(e=ye.All){if(e.length!==2)return;let[t,n]=e.map(Oe),r=[R(t),R(n)],i=n[0]-t[0],a=t[1]-n[1];if(r[0]&&r[1]&&(i||a))return{points:r,a:i,b:a,cover:!t[0]&&i===1&&a===1}}function ke(e,t){let{target:n,container:r,axis:i}=t,a=n&&z(t.offset),o=Ee(n)&&(n?!!a:!t.offset),s=new Map,c=new Set,l,u=!1,d=(e,t)=>{let[n,r]=a.points;t.effect.updateTiming({direction:u?e===`normal`?`reverse`:`alternate-reverse`:e}),Object.assign(t,{rangeStart:u?r:n,rangeEnd:u?n:r}),t.play()},f=[e.attachTimeline({get timeline(){return o?De(t):void 0},onAttach:a&&(e=>{let t=e.effect.getTiming().direction;s.set(e,t),d(t,e)}),observe:e=>(e.pause(),c.add(e),l||=I(e=>{c.forEach(t=>{t.time=t.iterationDuration*e[i].progress})},t),()=>c.delete(e))})];if(o&&a){let{a:e,b:t}=a,o=i===`y`?`clientHeight`:`clientWidth`,c=()=>{u!==(u=e*n[o]+t*r[o]<0)&&s.forEach(d)};c(),e*t<0&&f.push(b(c),b([n,r],c))}return()=>{f.forEach(e=>e()),l?.()}}function B(t,{axis:n=`y`,source:r,container:i=document.scrollingElement,...a}={}){if(!i)return e;let o={axis:n,container:r||i,...a};if(typeof t==`function`){let e=le(t);return ee(I(t=>e(t[n].progress,t),o))}return ee(ke(t,o))}var V=d(o(),1),Ae=()=>({scrollX:T(0),scrollY:T(0),scrollXProgress:T(0),scrollYProgress:T(0)}),H=e=>e?!e.current:!1;function U(e,t,n,r){return{factory:i=>{let a,o=()=>{H(n)||H(r)?_.read(o):a=B(i,{...t,axis:e,container:n?.current||void 0,target:r?.current||void 0})};return _.read(o),()=>{v(o),a?.()}},times:[0,1],keyframes:[0,1],ease:e=>e,duration:1}}function je(e,n){return typeof window>`u`?!1:e?t()&&!!z(n):f()&&!n}function Me({container:e,target:t,...n}={}){let r=u(Ae);je(t,n.offset)&&(r.scrollXProgress.accelerate=U(`x`,n,e,t),r.scrollYProgress.accelerate=U(`y`,n,e,t));let i=(0,V.useRef)(null),a=(0,V.useRef)(!1),o=(0,V.useCallback)(()=>(i.current=B((e,{x:t,y:n})=>{r.scrollX.set(t.current),r.scrollXProgress.set(t.progress),r.scrollY.set(n.current),r.scrollYProgress.set(n.progress)},{...n,container:e?.current||void 0,target:t?.current||void 0}),()=>{i.current?.()}),[e,t,JSON.stringify(n.offset)]);return c(()=>{if(a.current=!1,H(e)||H(t))a.current=!0;else return o()},[o]),(0,V.useEffect)(()=>{if(!a.current)return;let n,r=()=>{let r=H(e),i=H(t);re(!r,`Container ref is defined but not hydrated`,`use-scroll-ref`),re(!i,`Target ref is defined but not hydrated`,`use-scroll-ref`),!r&&!i&&(n=o())};return _.read(r),()=>{v(r),n?.()}},[o]),r}function Ne(e){let t=u(()=>T(e)),{isStatic:n}=(0,V.useContext)(se);if(n){let[,n]=(0,V.useState)(e);(0,V.useEffect)(()=>t.on(`change`,n),[])}return t}function W(e,t){let n=Ne(t()),i=()=>n.set(t());return i(),c(()=>{let t=()=>r.preRender(i,!1,!0),n=e.map(e=>e.on(`change`,t));return i(),()=>{n.forEach(e=>e()),p(i)}}),n}function Pe(e){m.current=[],e();let t=W(m.current,e);return m.current=void 0,t}function G(e,t,n,r){if(typeof e==`function`)return Pe(e);if(n!==void 0&&!Array.isArray(n)&&typeof t!=`function`)return Fe(e,t,n,r);let i=typeof t==`function`?t:fe(t,n,r),a=Array.isArray(e)?K(e,i):K([e],([e])=>i(e)),o=Array.isArray(e)?void 0:e.accelerate;if(o&&!o.isTransformed&&typeof t!=`function`&&Array.isArray(n)&&r?.clamp!==!1){let e=r?.ease;a.accelerate={...o,times:[0,...t,1],keyframes:[n[0],...n,n[n.length-1]],isTransformed:!0,...e?{ease:Array.isArray(e)?[e[0],...e]:e}:{}}}return a}function K(e,t){let n=u(()=>[]);return W(e,()=>{n.length=0;let r=e.length;for(let t=0;t<r;t++)n[t]=e[t].get();return t(n)})}function Fe(e,t,n,r){let i=u(()=>Object.keys(n)),a=u(()=>({}));for(let o of i)a[o]=G(e,t,n[o],r);return a}var q={name:`bot`,size:24,node:[[`path`,{d:`M12 8V4H8`,key:`hb8ula`}],[`rect`,{width:`16`,height:`12`,x:`4`,y:`8`,rx:`2`,key:`enze0r`}],[`path`,{d:`M2 14h2`,key:`vft8re`}],[`path`,{d:`M20 14h2`,key:`4cs60a`}],[`path`,{d:`M15 13v2`,key:`1xurst`}],[`path`,{d:`M9 13v2`,key:`rq6x2g`}]]};q.node;var J=h(q),Ie={name:`boxes`,size:24,node:[[`path`,{d:`M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z`,key:`lc1i9w`}],[`path`,{d:`m7 16.5-4.74-2.85`,key:`1o9zyk`}],[`path`,{d:`m7 16.5 5-3`,key:`va8pkn`}],[`path`,{d:`M7 16.5v5.17`,key:`jnp8gn`}],[`path`,{d:`M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z`,key:`8zsnat`}],[`path`,{d:`m17 16.5-5-3`,key:`8arw3v`}],[`path`,{d:`m17 16.5 4.74-2.85`,key:`8rfmw`}],[`path`,{d:`M17 16.5v5.17`,key:`k6z78m`}],[`path`,{d:`M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z`,key:`1xygjf`}],[`path`,{d:`M12 8 7.26 5.15`,key:`1vbdud`}],[`path`,{d:`m12 8 4.74-2.85`,key:`3rx089`}],[`path`,{d:`M12 13.5V8`,key:`1io7kd`}]]};Ie.node;var Le=h(Ie),Re={name:`brain-circuit`,size:24,node:[[`path`,{d:`M12 13h4`,key:`1ku699`}],[`path`,{d:`M12 18h6a2 2 0 012 2v1`,key:`6s3bw4`}],[`path`,{d:`M12 8h8`,key:`1lhi5i`}],[`path`,{d:`M12 9a4.17 4.17 0 01-3 4`,key:`13l7kh`}],[`path`,{d:`M16 8V5a2 2 0 012-2`,key:`gais5y`}],[`path`,{d:`M6 18a4 4 0 01-2-7.465`,key:`1y2m15`}],[`path`,{d:`M6.004 5.125a4 4 0 00-2.526 5.77`,key:`3cw1ss`}],[`path`,{d:`M6.294 6.294A3 3 0 1112 5v13a4 4 0 11-7.967-.518`,key:`m2z1wm`}],[`circle`,{cx:`16`,cy:`13`,r:`0.5`,fill:`currentColor`,key:`9zzywh`}],[`circle`,{cx:`18`,cy:`3`,r:`0.5`,fill:`currentColor`,key:`i2xui6`}],[`circle`,{cx:`20`,cy:`21`,r:`0.5`,fill:`currentColor`,key:`1dobdp`}],[`circle`,{cx:`20`,cy:`8`,r:`0.5`,fill:`currentColor`,key:`r9nqlq`}]]};Re.node;var ze=h(Re),Be={name:`database`,size:24,node:[[`ellipse`,{cx:`12`,cy:`5`,rx:`9`,ry:`3`,key:`msslwz`}],[`path`,{d:`M3 5V19A9 3 0 0 0 21 19V5`,key:`1wlel7`}],[`path`,{d:`M3 12A9 3 0 0 0 21 12`,key:`mv7ke4`}]]};Be.node;var Ve=h(Be),He={name:`git-branch`,size:24,node:[[`path`,{d:`M15 6a9 9 0 0 0-9 9V3`,key:`1cii5b`}],[`circle`,{cx:`18`,cy:`6`,r:`3`,key:`1h7g24`}],[`circle`,{cx:`6`,cy:`18`,r:`3`,key:`fqmcym`}]]};He.node;var Ue=h(He),We={name:`scan-search`,size:24,node:[[`path`,{d:`M3 7V5a2 2 0 0 1 2-2h2`,key:`aa7l1z`}],[`path`,{d:`M17 3h2a2 2 0 0 1 2 2v2`,key:`4qcy5o`}],[`path`,{d:`M21 17v2a2 2 0 0 1-2 2h-2`,key:`6vwrx8`}],[`path`,{d:`M7 21H5a2 2 0 0 1-2-2v-2`,key:`ioqczr`}],[`circle`,{cx:`12`,cy:`12`,r:`3`,key:`1v7zrd`}],[`path`,{d:`m16 16-1.9-1.9`,key:`1dq9hf`}]]};We.node;var Ge=h(We),Y={name:`user-check`,size:24,node:[[`path`,{d:`m16 11 2 2 4-4`,key:`9rsbq5`}],[`path`,{d:`M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2`,key:`1yyitq`}],[`circle`,{cx:`9`,cy:`7`,r:`4`,key:`nufk8`}]]};Y.node;var Ke=h(Y),X=`# Real MCP session against \`nigrani.mcp_server\` (stdio)

Generated by \`python docs/mcp_demo.py\` (temp DB, copied registry).


## tools/list (23)
- \`list_alerts\` — Alert queue with filters (status open|assigned|escalated|closed, pattern pump|network) and pagination, highest score first.
- \`get_alert\` — Full alert record (status, assignee, disposition, audit trail) plus SHAP explanation. Id format YYYY-MM-DD:account.
- \`explain_alert\` — SHAP drivers for an account-day: score, threshold, top features with values and log-odds contributions.
- \`assign_alert\` — Assign an open/assigned/escalated alert to an analyst.
- \`escalate_alert\` — Escalate an alert to compliance with a written reason (min 5 chars). Raises priority to high.
- \`close_alert\` — Close an alert with disposition true_positive | false_positive | benign_explained. The disposition becomes a training label.
- \`record_feedback\` — Record an analyst verdict without closing (true_positive | false_positive | benign_explained | needs_more_info).
- \`draft_case_note\` — Draft an investigation note from SHAP drivers, network and timeline. A draft for human review, never a filed STR.
- \`queue_stats\` — Alert counts by status, dispositions, cases by status and realised analyst precision.
- \`get_account_timeline\` — Daily risk score, traded value, alert status and top symbols for an account over its last \`days\` trading days up to \`end\`.
- \`get_counterparty_network\` — Graph around an account-day: direct trades, same-side co-trading accounts over \`window\` days, and shared-KYC links.
- \`get_linked_accounts\` — Accounts sharing address / phone / bank with this one, and its resolved entity.
- \`get_account_trades\` — Raw trades for one account on one date (YYYY-MM-DD).
- \`create_case\` — Open an investigation case grouping one or more alerts.
- \`list_cases\` — Cases, newest first; status open | under_review | str_filed | closed_no_action.
- \`get_case\` — One case with alerts and notes.
- \`add_case_note\` — Append a note to a case.
- \`update_case_status\` — Move a case to open | under_review | str_filed | closed_no_action (the last two are final).
- \`score_account_day\` — Score one account-day from its feature vector (see model card for the feature list).
- \`model_card\` — Production model version, CV and test metrics, alert budgets, label-noise and protocol notes.
- \`model_versions\` — Model registry: versions, creation time, git sha, artifact hash and which is in production.
- \`drift_report\` — Population stability (PSI) of each feature and the score, development period vs live period.
- \`sync_alerts\` — Generate alerts from the production model's live-period scores at an alert budget (0.5% | 1.0% | 2.0%). Idempotent.

## resources / templates / prompts
- resource \`nigrani://model-card\`
- template \`nigrani://alerts/{alert_id}\`
- template \`nigrani://cases/{case_id}\`
- prompt \`triage_alert\`
- prompt \`weekly_summary\`

## tools/call \`sync_alerts\` {}
\`\`\`json
{
  "created": 63,
  "candidates": 63,
  "threshold": 0.0544,
  "budget": "1.0%",
  "model_version": "v1"
}
\`\`\`

## tools/call \`list_alerts\` {"pattern": "pump", "page_size": 3}
\`\`\`json
{
  "items": [
    {
      "alert_id": "2026-06-10:1557",
      "date": "2026-06-10",
      "account": 1557,
      "score": 0.9892,
      "pattern": "pump",
      "priority": "high",
      "status": "open",
      "assignee": null,
      "disposition": null,
      "case_id": null,
      "model_version": "v1",
      "escalation_reason": null,
      "created_at": "2026-10-26T13:26:50.071766",
      "updated_at": "2026-10-26T13:26:50.071766",
      "closed_at": null
    },
    {
      "alert_id": "2026-06-08:452",
      "date": "2026-06-08",
      "account": 452,
      "score": 0.9877,
      "pattern": "pump",
      "priority": "high",
      "status": "open",
      "assignee": null,
      "disposition": null,
      "case_id": null,
      "model_version": "v1",
      "escalation_reason": null,
      "created_at": "2026-10-26T13:26:50.071742",
      "updated_at": "2026-10-26T13:26:50.071743",
      "closed_at": null
    },
    {
      "alert_id": "2026-06-05:577",
      "date": "2026-06-05",
      "account": 577,
      "score": 0.9851,
      "pattern": "pump",
      "priority": "high",
      "status": "open",
      "assignee": null,
      "disposition": null,
      "case_id": null,
      …
\`\`\`

## tools/call \`explain_alert\` {"alert_id": "2026-06-10:1557"}
\`\`\`json
{
  "alert_id": "2026-06-10:1557",
  "score": 0.9892,
  "alert": true,
  "pattern": "pump",
  "threshold": 0.0544,
  "model_version": "v1",
  "base": "log-odds contributions (SHAP TreeExplainer)",
  "top_reasons": [
    {
      "feature": "mkt_ret_3d",
      "value": 819.0959,
      "shap": 3.5201
    },
    {
      "feature": "illiquid_share",
      "value": 1.0,
      "shap": 1.7964
    },
    {
      "feature": "entity_peers_same_side",
      "value": 3.0,
      "shap": 1.5346
    },
    {
      "feature": "impact_bps",
      "value": -238.3426,
      "shap": 1.4475
    },
    {
      "feature": "prior_net_5d",
      "value": 0.3393,
      "shap": 1.2127
    },
    {
      "feature": "mkt_vol_z",
      "value": 1.4665,
      "shap": 1.1464
    },
    {
      "feature": "crowd_5d",
      "value": 11.0,
      "shap": 0.8763
    },
    {
      "feature": "sym_day_volume_share",
      "value": 0.2925,
      "shap": 0.7475
    }
  ]
}
\`\`\`

## tools/call \`get_counterparty_network\` {"account": 1557, "date": "2026-06-10"}
\`\`\`json
{
  "account": 1557,
  "date": "2026-06-10",
  "window_days": [
    "2026-06-04",
    "2026-06-05",
    "2026-06-08",
    "2026-06-09",
    "2026-06-10"
  ],
  "nodes": [
    {
      "id": 452,
      "focus": false,
      "score": 0.9848,
      "acct_type": "active_trader",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 577,
      "focus": false,
      "score": 0.9752,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 585,
      "focus": false,
      "score": 0.5618,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 1520,
      "focus": false,
      "score": 0.0,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": false
    },
    {
      "id": 1526,
      "focus": false,
      "score": 0.0,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": false
    },
    {
      "id": 1557,
      "focus": true,
      "score": 0.9892,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 1670,
      "focus": false,
      "score": 0.7172,
      "acct_type": "retail",
      "entity_id": 1629,
      "alert" …
\`\`\`

## tools/call \`assign_alert\` {"alert_id": "2026-06-10:1557", "assignee": "ria"}
\`\`\`json
{
  "alert_id": "2026-06-10:1557",
  "date": "2026-06-10",
  "account": 1557,
  "score": 0.9892,
  "pattern": "pump",
  "priority": "high",
  "status": "assigned",
  "assignee": "ria",
  "disposition": null,
  "case_id": null,
  "model_version": "v1",
  "escalation_reason": null,
  "created_at": "2026-10-26T13:26:50.071766",
  "updated_at": "2026-10-26T13:26:50.444352",
  "closed_at": null
}
\`\`\`

## tools/call \`escalate_alert\` {"alert_id": "2026-06-10:1557", "reason": "same-side co-trading cluster in illiquid symbol"}
\`\`\`json
{
  "alert_id": "2026-06-10:1557",
  "date": "2026-06-10",
  "account": 1557,
  "score": 0.9892,
  "pattern": "pump",
  "priority": "high",
  "status": "escalated",
  "assignee": "ria",
  "disposition": null,
  "case_id": null,
  "model_version": "v1",
  "escalation_reason": "same-side co-trading cluster in illiquid symbol",
  "created_at": "2026-10-26T13:26:50.071766",
  "updated_at": "2026-10-26T13:26:50.452142",
  "closed_at": null
}
\`\`\`

## tools/call \`create_case\` {"title": "Pump ring around 1557", "alert_ids": ["2026-06-10:1557"]}
\`\`\`json
{
  "case_id": 1,
  "title": "Pump ring around 1557",
  "status": "open",
  "owner": "copilot",
  "summary": "",
  "alert_ids": [
    "2026-06-10:1557"
  ],
  "created_at": "2026-10-26T13:26:50.458689",
  "updated_at": "2026-10-26T13:26:50.458694",
  "notes": [
    {
      "author": "copilot",
      "body": "Case opened with alerts: 2026-06-10:1557",
      "ts": "2026-10-26T13:26:50.460745"
    }
  ]
}
\`\`\`

## tools/call \`add_case_note\` {"case_id": 1, "body": "Pulled 5-day trades; 4 KYC-linked accounts."}
\`\`\`json
{
  "case_id": 1,
  "title": "Pump ring around 1557",
  "status": "open",
  "owner": "copilot",
  "summary": "",
  "alert_ids": [
    "2026-06-10:1557"
  ],
  "created_at": "2026-10-26T13:26:50.458689",
  "updated_at": "2026-10-26T13:26:50.472301",
  "notes": [
    {
      "author": "copilot",
      "body": "Case opened with alerts: 2026-06-10:1557",
      "ts": "2026-10-26T13:26:50.460745"
    },
    {
      "author": "copilot",
      "body": "Pulled 5-day trades; 4 KYC-linked accounts.",
      "ts": "2026-10-26T13:26:50.473203"
    }
  ]
}
\`\`\`

## tools/call \`draft_case_note\` {"alert_id": "2026-06-10:1557"}
\`\`\`json
DRAFT surveillance case note: for analyst review, not a filed report
Alert 2026-06-10:1557 | account 1557 | trade date 2026-06-10 | status escalated (pattern head: pump)
Model v1 score 0.9892 vs threshold 0.0544
Top drivers (SHAP):
  - mkt_ret_3d = 819.0959 (SHAP +3.520)
  - illiquid_share = 1.0 (SHAP +1.796)
  - entity_peers_same_side = 3.0 (SHAP +1.535)
  - impact_bps = -238.3426 (SHAP +1.448)
  - prior_net_5d = 0.3393 (SHAP +1.213)
  - mkt_vol_z = 1.4665 (SHAP +1.146)
Network (5-day window): 0 direct counterparty legs, 4 accounts co-trading the same side on 2+ days in SYM022, 3 KYC-linked accounts.
Recent daily scores: 2026-06-04:0.9217, 2026-06-05:0.8172, 2026-06-08:0.9644, 2026-06-09:0.9242, 2026-06-10:0.9892
Analyst to verify: beneficial ownership of linked accounts, order-log intent (placement vs. cancellation), price impact versus market news, and whether an STR to FIU-IND is warranted.
\`\`\`

## tools/call \`queue_stats\` {}
\`\`\`json
{
  "alerts_by_status": {
    "open": 62,
    "assigned": 0,
    "escalated": 1,
    "closed": 0
  },
  "dispositions": {},
  "cases_by_status": {
    "open": 1
  },
  "analyst_precision": null
}
\`\`\`

## tools/call \`drift_report\` {"recent_days": 20}
\`\`\`json
Error executing tool drift_report
\`\`\`

## error path: close unknown alert
is_error=True
\`\`\`
Error executing tool close_alert: not_found: alert 1999-01-01:1 not found
\`\`\`

## prompts/get \`triage_alert\`
\`\`\`
Triage surveillance alert 2026-06-10:1557. 1) get_alert and explain_alert: which features drive the score? 2) get_account_timeline: is this a one-off or a build-up? 3) get_counterparty_network and get_linked_accounts: are there KYC-linked or co-trading accounts? 4) Classify the likely pattern (wash, circular, pump-and-dump, benign). 5) draft_case_note and recommend assign / escalate / close with a disposition. Do not close without analyst approval.
\`\`\`
`,Z=i();function qe(e){let t=X.indexOf(`## tools/call \`${e}\``),n=X.slice(t).split(`
`)[0].replace(`## tools/call \`${e}\` `,``),r=X.slice(t).split("```json")[1].split("```")[0];return{args:n,json:JSON.parse(r)}}var Je=qe(`explain_alert`),Q=Je.json,Ye=`{
  "alert_id": "${Q.alert_id}",
  "score": ${Q.score},
  "threshold": ${Q.threshold},
  "pattern": "${Q.pattern}",
  "top_reasons": [
${Q.top_reasons.slice(0,4).map(e=>`    { "feature": "${e.feature}", "value": ${e.value}, "shap": ${e.shap} }`).join(`,
`)},
    …
  ]
}`,Xe=(`# Real MCP session against \`nigrani.mcp_server\` (stdio)

Generated by \`python docs/mcp_demo.py\` (temp DB, copied registry).


## tools/list (23)
- \`list_alerts\` — Alert queue with filters (status open|assigned|escalated|closed, pattern pump|network) and pagination, highest score first.
- \`get_alert\` — Full alert record (status, assignee, disposition, audit trail) plus SHAP explanation. Id format YYYY-MM-DD:account.
- \`explain_alert\` — SHAP drivers for an account-day: score, threshold, top features with values and log-odds contributions.
- \`assign_alert\` — Assign an open/assigned/escalated alert to an analyst.
- \`escalate_alert\` — Escalate an alert to compliance with a written reason (min 5 chars). Raises priority to high.
- \`close_alert\` — Close an alert with disposition true_positive | false_positive | benign_explained. The disposition becomes a training label.
- \`record_feedback\` — Record an analyst verdict without closing (true_positive | false_positive | benign_explained | needs_more_info).
- \`draft_case_note\` — Draft an investigation note from SHAP drivers, network and timeline. A draft for human review, never a filed STR.
- \`queue_stats\` — Alert counts by status, dispositions, cases by status and realised analyst precision.
- \`get_account_timeline\` — Daily risk score, traded value, alert status and top symbols for an account over its last \`days\` trading days up to \`end\`.
- \`get_counterparty_network\` — Graph around an account-day: direct trades, same-side co-trading accounts over \`window\` days, and shared-KYC links.
- \`get_linked_accounts\` — Accounts sharing address / phone / bank with this one, and its resolved entity.
- \`get_account_trades\` — Raw trades for one account on one date (YYYY-MM-DD).
- \`create_case\` — Open an investigation case grouping one or more alerts.
- \`list_cases\` — Cases, newest first; status open | under_review | str_filed | closed_no_action.
- \`get_case\` — One case with alerts and notes.
- \`add_case_note\` — Append a note to a case.
- \`update_case_status\` — Move a case to open | under_review | str_filed | closed_no_action (the last two are final).
- \`score_account_day\` — Score one account-day from its feature vector (see model card for the feature list).
- \`model_card\` — Production model version, CV and test metrics, alert budgets, label-noise and protocol notes.
- \`model_versions\` — Model registry: versions, creation time, git sha, artifact hash and which is in production.
- \`drift_report\` — Population stability (PSI) of each feature and the score, development period vs live period.
- \`sync_alerts\` — Generate alerts from the production model's live-period scores at an alert budget (0.5% | 1.0% | 2.0%). Idempotent.

## resources / templates / prompts
- resource \`nigrani://model-card\`
- template \`nigrani://alerts/{alert_id}\`
- template \`nigrani://cases/{case_id}\`
- prompt \`triage_alert\`
- prompt \`weekly_summary\`

## tools/call \`sync_alerts\` {}
\`\`\`json
{
  "created": 63,
  "candidates": 63,
  "threshold": 0.0544,
  "budget": "1.0%",
  "model_version": "v1"
}
\`\`\`

## tools/call \`list_alerts\` {"pattern": "pump", "page_size": 3}
\`\`\`json
{
  "items": [
    {
      "alert_id": "2026-06-10:1557",
      "date": "2026-06-10",
      "account": 1557,
      "score": 0.9892,
      "pattern": "pump",
      "priority": "high",
      "status": "open",
      "assignee": null,
      "disposition": null,
      "case_id": null,
      "model_version": "v1",
      "escalation_reason": null,
      "created_at": "2026-10-26T13:26:50.071766",
      "updated_at": "2026-10-26T13:26:50.071766",
      "closed_at": null
    },
    {
      "alert_id": "2026-06-08:452",
      "date": "2026-06-08",
      "account": 452,
      "score": 0.9877,
      "pattern": "pump",
      "priority": "high",
      "status": "open",
      "assignee": null,
      "disposition": null,
      "case_id": null,
      "model_version": "v1",
      "escalation_reason": null,
      "created_at": "2026-10-26T13:26:50.071742",
      "updated_at": "2026-10-26T13:26:50.071743",
      "closed_at": null
    },
    {
      "alert_id": "2026-06-05:577",
      "date": "2026-06-05",
      "account": 577,
      "score": 0.9851,
      "pattern": "pump",
      "priority": "high",
      "status": "open",
      "assignee": null,
      "disposition": null,
      "case_id": null,
      …
\`\`\`

## tools/call \`explain_alert\` {"alert_id": "2026-06-10:1557"}
\`\`\`json
{
  "alert_id": "2026-06-10:1557",
  "score": 0.9892,
  "alert": true,
  "pattern": "pump",
  "threshold": 0.0544,
  "model_version": "v1",
  "base": "log-odds contributions (SHAP TreeExplainer)",
  "top_reasons": [
    {
      "feature": "mkt_ret_3d",
      "value": 819.0959,
      "shap": 3.5201
    },
    {
      "feature": "illiquid_share",
      "value": 1.0,
      "shap": 1.7964
    },
    {
      "feature": "entity_peers_same_side",
      "value": 3.0,
      "shap": 1.5346
    },
    {
      "feature": "impact_bps",
      "value": -238.3426,
      "shap": 1.4475
    },
    {
      "feature": "prior_net_5d",
      "value": 0.3393,
      "shap": 1.2127
    },
    {
      "feature": "mkt_vol_z",
      "value": 1.4665,
      "shap": 1.1464
    },
    {
      "feature": "crowd_5d",
      "value": 11.0,
      "shap": 0.8763
    },
    {
      "feature": "sym_day_volume_share",
      "value": 0.2925,
      "shap": 0.7475
    }
  ]
}
\`\`\`

## tools/call \`get_counterparty_network\` {"account": 1557, "date": "2026-06-10"}
\`\`\`json
{
  "account": 1557,
  "date": "2026-06-10",
  "window_days": [
    "2026-06-04",
    "2026-06-05",
    "2026-06-08",
    "2026-06-09",
    "2026-06-10"
  ],
  "nodes": [
    {
      "id": 452,
      "focus": false,
      "score": 0.9848,
      "acct_type": "active_trader",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 577,
      "focus": false,
      "score": 0.9752,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 585,
      "focus": false,
      "score": 0.5618,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 1520,
      "focus": false,
      "score": 0.0,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": false
    },
    {
      "id": 1526,
      "focus": false,
      "score": 0.0,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": false
    },
    {
      "id": 1557,
      "focus": true,
      "score": 0.9892,
      "acct_type": "retail",
      "entity_id": 452,
      "alert": true
    },
    {
      "id": 1670,
      "focus": false,
      "score": 0.7172,
      "acct_type": "retail",
      "entity_id": 1629,
      "alert" …
\`\`\`

## tools/call \`assign_alert\` {"alert_id": "2026-06-10:1557", "assignee": "ria"}
\`\`\`json
{
  "alert_id": "2026-06-10:1557",
  "date": "2026-06-10",
  "account": 1557,
  "score": 0.9892,
  "pattern": "pump",
  "priority": "high",
  "status": "assigned",
  "assignee": "ria",
  "disposition": null,
  "case_id": null,
  "model_version": "v1",
  "escalation_reason": null,
  "created_at": "2026-10-26T13:26:50.071766",
  "updated_at": "2026-10-26T13:26:50.444352",
  "closed_at": null
}
\`\`\`

## tools/call \`escalate_alert\` {"alert_id": "2026-06-10:1557", "reason": "same-side co-trading cluster in illiquid symbol"}
\`\`\`json
{
  "alert_id": "2026-06-10:1557",
  "date": "2026-06-10",
  "account": 1557,
  "score": 0.9892,
  "pattern": "pump",
  "priority": "high",
  "status": "escalated",
  "assignee": "ria",
  "disposition": null,
  "case_id": null,
  "model_version": "v1",
  "escalation_reason": "same-side co-trading cluster in illiquid symbol",
  "created_at": "2026-10-26T13:26:50.071766",
  "updated_at": "2026-10-26T13:26:50.452142",
  "closed_at": null
}
\`\`\`

## tools/call \`create_case\` {"title": "Pump ring around 1557", "alert_ids": ["2026-06-10:1557"]}
\`\`\`json
{
  "case_id": 1,
  "title": "Pump ring around 1557",
  "status": "open",
  "owner": "copilot",
  "summary": "",
  "alert_ids": [
    "2026-06-10:1557"
  ],
  "created_at": "2026-10-26T13:26:50.458689",
  "updated_at": "2026-10-26T13:26:50.458694",
  "notes": [
    {
      "author": "copilot",
      "body": "Case opened with alerts: 2026-06-10:1557",
      "ts": "2026-10-26T13:26:50.460745"
    }
  ]
}
\`\`\`

## tools/call \`add_case_note\` {"case_id": 1, "body": "Pulled 5-day trades; 4 KYC-linked accounts."}
\`\`\`json
{
  "case_id": 1,
  "title": "Pump ring around 1557",
  "status": "open",
  "owner": "copilot",
  "summary": "",
  "alert_ids": [
    "2026-06-10:1557"
  ],
  "created_at": "2026-10-26T13:26:50.458689",
  "updated_at": "2026-10-26T13:26:50.472301",
  "notes": [
    {
      "author": "copilot",
      "body": "Case opened with alerts: 2026-06-10:1557",
      "ts": "2026-10-26T13:26:50.460745"
    },
    {
      "author": "copilot",
      "body": "Pulled 5-day trades; 4 KYC-linked accounts.",
      "ts": "2026-10-26T13:26:50.473203"
    }
  ]
}
\`\`\`

## tools/call \`draft_case_note\` {"alert_id": "2026-06-10:1557"}
\`\`\`json
DRAFT surveillance case note: for analyst review, not a filed report
Alert 2026-06-10:1557 | account 1557 | trade date 2026-06-10 | status escalated (pattern head: pump)
Model v1 score 0.9892 vs threshold 0.0544
Top drivers (SHAP):
  - mkt_ret_3d = 819.0959 (SHAP +3.520)
  - illiquid_share = 1.0 (SHAP +1.796)
  - entity_peers_same_side = 3.0 (SHAP +1.535)
  - impact_bps = -238.3426 (SHAP +1.448)
  - prior_net_5d = 0.3393 (SHAP +1.213)
  - mkt_vol_z = 1.4665 (SHAP +1.146)
Network (5-day window): 0 direct counterparty legs, 4 accounts co-trading the same side on 2+ days in SYM022, 3 KYC-linked accounts.
Recent daily scores: 2026-06-04:0.9217, 2026-06-05:0.8172, 2026-06-08:0.9644, 2026-06-09:0.9242, 2026-06-10:0.9892
Analyst to verify: beneficial ownership of linked accounts, order-log intent (placement vs. cancellation), price impact versus market news, and whether an STR to FIU-IND is warranted.
\`\`\`

## tools/call \`queue_stats\` {}
\`\`\`json
{
  "alerts_by_status": {
    "open": 62,
    "assigned": 0,
    "escalated": 1,
    "closed": 0
  },
  "dispositions": {},
  "cases_by_status": {
    "open": 1
  },
  "analyst_precision": null
}
\`\`\`

## tools/call \`drift_report\` {"recent_days": 20}
\`\`\`json
Error executing tool drift_report
\`\`\`

## error path: close unknown alert
is_error=True
\`\`\`
Error executing tool close_alert: not_found: alert 1999-01-01:1 not found
\`\`\`

## prompts/get \`triage_alert\`
\`\`\`
Triage surveillance alert 2026-06-10:1557. 1) get_alert and explain_alert: which features drive the score? 2) get_account_timeline: is this a one-off or a build-up? 3) get_counterparty_network and get_linked_accounts: are there KYC-linked or co-trading accounts? 4) Classify the likely pattern (wash, circular, pump-and-dump, benign). 5) draft_case_note and recommend assign / escalate / close with a disposition. Do not close without analyst approval.
\`\`\`
`.match(/## tools\/list \((\d+)\)/)??[])[1],$={initial:{opacity:0,y:16},whileInView:{opacity:1,y:0},viewport:{once:!0,margin:`-80px`},transition:{duration:.6,ease:[.2,.7,.2,1]}};function Ze(){let{dark:e,toggle:t}=oe(),n=te(()=>ce.card()),r=n.data?.test.selected,i=r?.alert_budget[n.data.deployed_budget],o=(0,V.useRef)(null),{scrollYProgress:s}=Me({target:o,offset:[`start start`,`end start`]}),c=G(s,[0,1],[0,80]),l=G(s,[0,.8],[1,0]);return(0,Z.jsxs)(`div`,{className:`h-full overflow-y-auto overflow-x-hidden bg-bg`,children:[(0,Z.jsx)(`header`,{className:`sticky top-0 z-40 border-b border-line/60 bg-bg/70 backdrop-blur-xl`,children:(0,Z.jsxs)(`div`,{className:`mx-auto flex h-14 max-w-6xl items-center gap-8 px-6`,children:[(0,Z.jsxs)(a,{to:`/`,className:`flex items-center gap-2.5`,children:[(0,Z.jsx)(C,{}),(0,Z.jsx)(`span`,{className:`font-semibold tracking-tight`,children:`Nigrani`})]}),(0,Z.jsx)(`nav`,{className:`hidden items-center gap-6 text-[13px] text-fg-2 md:flex`,children:[[`How it works`,`#how`],[`Patterns`,`#patterns`],[`Results`,`#results`],[`MCP copilot`,`#mcp`]].map(([e,t])=>(0,Z.jsx)(`a`,{href:t,className:`transition-colors hover:text-fg`,children:e},t))}),(0,Z.jsxs)(`div`,{className:`ml-auto flex items-center gap-2`,children:[(0,Z.jsx)(x,{variant:`ghost`,size:`icon`,onClick:t,"aria-label":`Toggle theme`,children:e?(0,Z.jsx)(ne,{className:`h-4 w-4`}):(0,Z.jsx)(ae,{className:`h-4 w-4`})}),(0,Z.jsx)(a,{to:`/dashboard`,children:(0,Z.jsxs)(x,{variant:`primary`,children:[`Live demo `,(0,Z.jsx)(w,{className:`h-3.5 w-3.5`})]})})]})]})}),(0,Z.jsxs)(`section`,{ref:o,className:`relative`,children:[(0,Z.jsx)(`div`,{className:`grid-bg pointer-events-none absolute inset-0`}),(0,Z.jsx)(`div`,{className:`pointer-events-none absolute left-1/2 top-[-200px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]`}),(0,Z.jsxs)(g.div,{style:{y:c,opacity:l},className:`relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28`,children:[(0,Z.jsxs)(g.a,{href:`#how`,initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:`mx-auto inline-flex items-center gap-2 rounded-full border border-line-2 bg-bg-2/70 py-1 pl-1 pr-3 text-xs text-fg-2 backdrop-blur`,children:[(0,Z.jsx)(`span`,{className:`rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent`,children:`SEBI`}),`Broker trade surveillance, explained`,(0,Z.jsx)(w,{className:`h-3 w-3`})]}),(0,Z.jsxs)(g.h1,{initial:{opacity:0,y:14},animate:{opacity:1,y:0},transition:{delay:.05,duration:.7,ease:[.2,.7,.2,1]},className:`mx-auto mt-7 max-w-4xl text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[72px]`,children:[`Catch market manipulation.`,(0,Z.jsx)(`br`,{}),(0,Z.jsx)(`span`,{className:`bg-gradient-to-b from-fg-2 to-fg-3 bg-clip-text text-transparent`,children:`Explain every alert.`})]}),(0,Z.jsxs)(g.p,{initial:{opacity:0,y:14},animate:{opacity:1,y:0},transition:{delay:.12,duration:.7},className:`mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-fg-2`,children:[`SEBI requires every broker to surveil client trades for wash, circular and pump-and-dump activity. Rule engines drown analysts in alerts they can't justify. Nigrani ranks risk with ML, shows `,(0,Z.jsx)(`em`,{className:`not-italic text-fg`,children:`why`}),` with SHAP, and lets an AI copilot investigate through MCP.`]}),(0,Z.jsxs)(g.div,{initial:{opacity:0,y:14},animate:{opacity:1,y:0},transition:{delay:.2,duration:.7},className:`mt-9 flex flex-wrap justify-center gap-3`,children:[(0,Z.jsx)(a,{to:`/dashboard`,children:(0,Z.jsxs)(x,{variant:`primary`,size:`lg`,className:`h-11 px-5`,children:[`Open the live dashboard `,(0,Z.jsx)(w,{className:`h-4 w-4`})]})}),(0,Z.jsx)(`a`,{href:`#mcp`,children:(0,Z.jsxs)(x,{size:`lg`,className:`h-11 px-5`,children:[(0,Z.jsx)(J,{className:`h-4 w-4`}),`See the MCP copilot`]})})]}),(0,Z.jsx)($e,{})]})]}),(0,Z.jsxs)(`section`,{id:`results`,className:`border-y border-line bg-bg-2/40`,children:[(0,Z.jsx)(`div`,{className:`mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 md:grid-cols-4`,children:[[i?y(i.precision):`—`,`of alerts are real manipulation`,`precision at the ${n.data?.deployed_budget??`1.0%`} alert budget`],[r?y(r.recall_at_1pct):`—`,`of manipulative account-days caught`,`while reviewing only 1% of activity`],[r?r.pr_auc.toFixed(2):`—`,`PR-AUC on unseen weeks`,`vs ${n.data?.test.v2_baseline?.pr_auc.toFixed(2)??`—`} for the v2 baseline`],[r?.episode_recall_at_deployed_threshold?`${Object.values(r.episode_recall_at_deployed_threshold).reduce((e,t)=>e+t.detected,0)}/${Object.values(r.episode_recall_at_deployed_threshold).reduce((e,t)=>e+t.episodes,0)}`:`—`,`manipulation episodes detected`,`in the held-out test window`]].map(([e,t,n],r)=>(0,Z.jsxs)(g.div,{...$,transition:{...$.transition,delay:r*.06},className:`px-2 py-10 md:px-6`,children:[(0,Z.jsx)(`div`,{className:`tnum text-[40px] font-semibold tracking-[-0.04em]`,children:e}),(0,Z.jsx)(`div`,{className:`mt-1 text-[13px] text-fg`,children:t}),(0,Z.jsx)(`div`,{className:`mt-0.5 text-xs text-fg-3`,children:n})]},r))}),(0,Z.jsxs)(`p`,{className:`mx-auto max-w-6xl px-6 pb-6 text-[11px] text-fg-3 md:px-12`,children:[`Live from `,(0,Z.jsx)(`span`,{className:`font-mono`,children:`/v1/model/card`}),`: walk-forward CV with embargo, test window from `,n.data?.data.test_start??`…`,` never seen during training or model selection. Synthetic market data; `,n.data?.label_noise,`.`]})]}),(0,Z.jsxs)(`section`,{id:`how`,className:`mx-auto max-w-6xl px-6 py-28`,children:[(0,Z.jsx)(Qe,{eyebrow:`How it works`,title:`From raw trades to a decision an analyst can defend.`,body:`Every account-day becomes a feature vector built from the trade graph and the market. A pattern-aware model scores it, SHAP attributes the score, and the analyst, or Claude via MCP, takes it from there.`}),(0,Z.jsx)(tt,{})]}),(0,Z.jsx)(`section`,{id:`patterns`,className:`border-t border-line bg-bg-2/30`,children:(0,Z.jsxs)(`div`,{className:`mx-auto max-w-6xl px-6 py-28`,children:[(0,Z.jsx)(Qe,{eyebrow:`What it catches`,title:`Three manipulation patterns, one model.`,body:`Separate detection heads for network collusion and price manipulation, sharing graph and market features.`}),(0,Z.jsx)(`div`,{className:`mt-14 grid gap-4 md:grid-cols-3`,children:[{k:`wash`,title:`Wash trading`,body:`Linked accounts trade with each other, creating volume with no change in ownership.`,art:(0,Z.jsx)(rt,{})},{k:`circular`,title:`Circular trading`,body:`Shares rotate A → B → C → A to paint the tape and fake liquidity.`,art:(0,Z.jsx)(it,{})},{k:`pump_dump`,title:`Pump and dump`,body:`A KYC-linked ring buys an illiquid scrip in sync, runs the price, then exits.`,art:(0,Z.jsx)(at,{})}].map((e,t)=>(0,Z.jsxs)(g.div,{...$,transition:{...$.transition,delay:t*.08},className:`group overflow-hidden rounded-2xl border border-line bg-bg-2 transition-colors hover:border-line-2`,children:[(0,Z.jsx)(`div`,{className:`relative h-48 border-b border-line bg-bg`,children:e.art}),(0,Z.jsxs)(`div`,{className:`p-6`,children:[(0,Z.jsxs)(`div`,{className:`flex items-baseline justify-between`,children:[(0,Z.jsx)(`h3`,{className:`text-[15px] font-medium tracking-tight`,children:e.title}),r&&(0,Z.jsxs)(`span`,{className:`tnum font-mono text-xs text-accent`,children:[y(r.recall_at_1pct_by_type[e.k]),` recall`]})]}),(0,Z.jsx)(`p`,{className:`mt-2 text-[13px] leading-relaxed text-fg-3`,children:e.body})]})]},e.k))})]})}),(0,Z.jsx)(`section`,{id:`mcp`,className:`mx-auto max-w-6xl px-6 py-28`,children:(0,Z.jsxs)(`div`,{className:`grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]`,children:[(0,Z.jsxs)(g.div,{...$,children:[(0,Z.jsx)(`div`,{className:`text-xs font-medium text-accent`,children:`AI copilot via MCP`}),(0,Z.jsx)(`h2`,{className:`mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em]`,children:`Ask Claude to triage the queue. It uses the same API your analysts do.`}),(0,Z.jsxs)(`p`,{className:`mt-4 text-[15px] leading-relaxed text-fg-2`,children:[`Nigrani ships a Model Context Protocol server with `,Xe,` tools, resources and prompts. The copilot can list alerts, read SHAP drivers, walk the counterparty graph and draft a case note, with every write going through the same audit trail.`]}),(0,Z.jsx)(`ul`,{className:`mt-6 grid grid-cols-2 gap-3 text-[13px] text-fg-2`,children:[`explain_alert`,`get_counterparty_network`,`escalate_alert`,`draft_case_note`].map(e=>(0,Z.jsxs)(`li`,{className:`flex items-center gap-2`,children:[(0,Z.jsx)(`span`,{className:`h-1 w-1 rounded-full bg-accent`}),(0,Z.jsx)(`code`,{className:`font-mono text-xs`,children:e})]},e))})]}),(0,Z.jsxs)(g.div,{...$,transition:{...$.transition,delay:.1},className:`overflow-hidden rounded-2xl border border-line-2 bg-bg-2 shadow-2xl`,children:[(0,Z.jsxs)(`div`,{className:`flex items-center gap-2 border-b border-line px-4 py-3`,children:[(0,Z.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full bg-fg-3/30`}),(0,Z.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full bg-fg-3/30`}),(0,Z.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full bg-fg-3/30`}),(0,Z.jsx)(`span`,{className:`ml-3 font-mono text-[11px] text-fg-3`,children:`nigrani.mcp_server · stdio`})]}),(0,Z.jsxs)(`div`,{className:`space-y-4 p-5 font-mono text-[12px] leading-relaxed`,children:[(0,Z.jsxs)(`div`,{className:`flex gap-3`,children:[(0,Z.jsx)(`span`,{className:`text-fg-3`,children:`›`}),(0,Z.jsxs)(`div`,{children:[(0,Z.jsx)(`span`,{className:`text-accent`,children:`tools/call`}),` `,(0,Z.jsx)(`span`,{className:`text-fg`,children:`explain_alert`}),` `,(0,Z.jsx)(`span`,{className:`text-fg-3`,children:Je.args})]})]}),(0,Z.jsx)(`pre`,{className:`overflow-x-auto rounded-xl border border-line bg-bg p-4 text-fg-2`,children:Ye}),(0,Z.jsxs)(`div`,{className:`flex gap-3 rounded-xl bg-accent-soft p-3 font-sans text-[13px] leading-relaxed text-fg-2`,children:[(0,Z.jsx)(J,{className:`mt-0.5 h-4 w-4 shrink-0 text-accent`}),(0,Z.jsxs)(`span`,{children:[`Account `,Q.alert_id.split(`:`)[1],` scored `,Q.score,` against a `,Q.threshold,` threshold. The main drivers are a `,S(Q.top_reasons[0].feature).toLowerCase(),` and `,S(Q.top_reasons[2].feature).toLowerCase(),`, consistent with a coordinated pump. Want me to pull the counterparty network?`]})]}),(0,Z.jsxs)(`p`,{className:`font-sans text-[11px] text-fg-3`,children:[`Tool call and response verbatim from `,(0,Z.jsx)(`span`,{className:`font-mono`,children:`docs/mcp_demo.md`}),`, a recorded live session. The copilot reply is illustrative.`]})]})]})]})}),(0,Z.jsxs)(`section`,{className:`relative overflow-hidden border-t border-line`,children:[(0,Z.jsx)(`div`,{className:`pointer-events-none absolute bottom-[-260px] left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]`}),(0,Z.jsxs)(g.div,{...$,className:`relative mx-auto max-w-3xl px-6 py-28 text-center`,children:[(0,Z.jsxs)(`h2`,{className:`text-[40px] font-semibold leading-[1.05] tracking-[-0.04em]`,children:[`Fewer alerts. Better ones.`,(0,Z.jsx)(`br`,{}),(0,Z.jsx)(`span`,{className:`text-fg-3`,children:`Every one explained.`})]}),(0,Z.jsx)(`p`,{className:`mx-auto mt-5 max-w-xl text-[15px] text-fg-2`,children:`The demo runs on the real API with the production model: triage the queue, explore the network, open a case.`}),(0,Z.jsx)(a,{to:`/dashboard`,children:(0,Z.jsxs)(x,{variant:`primary`,size:`lg`,className:`mt-8 h-11 px-6`,children:[`Launch live demo `,(0,Z.jsx)(w,{className:`h-4 w-4`})]})})]}),(0,Z.jsxs)(`footer`,{className:`relative mx-auto flex max-w-6xl items-center justify-between border-t border-line px-6 py-6 text-xs text-fg-3`,children:[(0,Z.jsxs)(`span`,{className:`flex items-center gap-2`,children:[(0,Z.jsx)(C,{className:`h-4 w-4`}),`Nigrani · निगरानी, “surveillance”`]}),(0,Z.jsx)(`span`,{children:`FastAPI · CatBoost · SHAP · MCP`})]})]})]})}function Qe({eyebrow:e,title:t,body:n}){return(0,Z.jsxs)(g.div,{...$,className:`max-w-2xl`,children:[(0,Z.jsx)(`div`,{className:`text-xs font-medium text-accent`,children:e}),(0,Z.jsx)(`h2`,{className:`mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em]`,children:t}),(0,Z.jsx)(`p`,{className:`mt-4 text-[15px] leading-relaxed text-fg-2`,children:n})]})}function $e(){let e=Math.max(...Q.top_reasons.map(e=>e.shap));return(0,Z.jsxs)(g.div,{initial:{opacity:0,y:40,rotateX:12},animate:{opacity:1,y:0,rotateX:0},transition:{delay:.3,duration:1,ease:[.2,.7,.2,1]},style:{perspective:1200},className:`relative mx-auto mt-16 max-w-4xl text-left`,children:[(0,Z.jsx)(`div`,{className:`absolute -inset-px rounded-[20px] bg-gradient-to-b from-line-2 to-transparent`}),(0,Z.jsxs)(`div`,{className:`relative overflow-hidden rounded-[20px] border border-line bg-bg-2/90 shadow-[0_40px_120px_-40px_rgba(0,0,0,.5)] backdrop-blur`,children:[(0,Z.jsxs)(`div`,{className:`flex items-center gap-3 border-b border-line px-5 py-3.5`,children:[(0,Z.jsxs)(`span`,{className:`relative flex h-2 w-2`,children:[(0,Z.jsx)(`span`,{className:`absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60`}),(0,Z.jsx)(`span`,{className:`relative h-2 w-2 rounded-full bg-accent`})]}),(0,Z.jsxs)(`span`,{className:`text-[13px] font-medium`,children:[`Account `,Q.alert_id.split(`:`)[1]]}),(0,Z.jsx)(`span`,{className:`rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] text-fg-2`,children:`pump & dump`}),(0,Z.jsx)(`span`,{className:`ml-auto font-mono text-xs text-fg-3`,children:Q.alert_id}),(0,Z.jsx)(`span`,{className:`tnum rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent`,children:Q.score})]}),(0,Z.jsxs)(`div`,{className:`grid md:grid-cols-[1.3fr_1fr]`,children:[(0,Z.jsxs)(`div`,{className:`space-y-2.5 p-5`,children:[(0,Z.jsx)(`div`,{className:`mb-1 text-xs text-fg-3`,children:`Why this alert fired`}),Q.top_reasons.slice(0,5).map((t,n)=>(0,Z.jsxs)(`div`,{className:`grid grid-cols-[minmax(0,1fr)_120px_40px] items-center gap-3 text-[13px]`,children:[(0,Z.jsx)(`span`,{className:`truncate text-fg-2`,children:S(t.feature)}),(0,Z.jsx)(`div`,{className:`h-1.5 rounded-full bg-bg-3`,children:(0,Z.jsx)(g.div,{initial:{width:0},animate:{width:`${t.shap/e*100}%`},transition:{delay:.8+n*.08,duration:.8,ease:[.2,.7,.2,1]},className:`h-full rounded-full bg-accent`,style:{opacity:1-n*.12}})}),(0,Z.jsxs)(`span`,{className:`tnum text-right font-mono text-xs text-fg`,children:[`+`,t.shap.toFixed(2)]})]},t.feature))]}),(0,Z.jsx)(`div`,{className:`relative hidden border-l border-line md:block`,children:(0,Z.jsx)(et,{})})]})]})]})}function et(){let e=[[50,50],[22,28],[78,24],[84,66],[30,78],[58,86],[14,56]];return(0,Z.jsxs)(`svg`,{viewBox:`0 0 100 100`,className:`absolute inset-0 h-full w-full`,preserveAspectRatio:`xMidYMid meet`,children:[e.slice(1).map(([e,t],n)=>(0,Z.jsx)(g.line,{x1:50,y1:50,x2:e,y2:t,stroke:`var(--accent)`,strokeOpacity:n<3?.7:.25,strokeWidth:.4,strokeDasharray:n<3?`1.2 1.2`:void 0,initial:{pathLength:0},animate:{pathLength:1},transition:{delay:1+n*.1,duration:.6}},n)),(0,Z.jsx)(`line`,{x1:22,y1:28,x2:78,y2:24,stroke:`var(--fg-3)`,strokeOpacity:.3,strokeWidth:.3}),e.map(([e,t],n)=>(0,Z.jsx)(g.circle,{cx:e,cy:t,r:n===0?3.2:1.8,fill:n===0?`var(--accent)`:n<4?`var(--fg)`:`var(--bg-2)`,stroke:`var(--fg-3)`,strokeWidth:n===0||n<4?0:.4,initial:{scale:0},animate:{scale:1},transition:{delay:.9+n*.06,type:`spring`}},n)),(0,Z.jsx)(`circle`,{cx:50,cy:50,r:6,fill:`none`,stroke:`var(--accent)`,strokeOpacity:.3,strokeWidth:.4}),(0,Z.jsx)(`text`,{x:50,y:60,textAnchor:`middle`,fontSize:3.2,fill:`var(--fg-2)`,fontFamily:`Geist Mono Variable`,children:Q.alert_id.split(`:`)[1]})]})}function tt(){return(0,Z.jsxs)(`div`,{className:`relative mt-16`,children:[(0,Z.jsx)(`svg`,{className:`pointer-events-none absolute left-0 right-0 top-[38px] hidden h-2 w-full md:block`,preserveAspectRatio:`none`,viewBox:`0 0 100 2`,children:(0,Z.jsx)(`line`,{x1:`10`,y1:`1`,x2:`90`,y2:`1`,stroke:`var(--accent)`,strokeOpacity:`0.5`,strokeWidth:`0.15`,className:`flow-dash`,vectorEffect:`non-scaling-stroke`,style:{strokeWidth:1.5}})}),(0,Z.jsx)(`div`,{className:`grid gap-6 md:grid-cols-5`,children:[{icon:Ve,title:`Trades`,body:`Every fill, counterparty and KYC record`},{icon:Ue,title:`Graph + features`,body:`28 signals: cycles, co-trading, price impact`},{icon:ze,title:`Model`,body:`CatBoost pattern heads, 1% alert budget`},{icon:Ge,title:`SHAP`,body:`Per-alert reasons in plain language`},{icon:Ke,title:`Analyst or Claude`,body:`Triage, case, STR draft, feedback`}].map((e,t)=>(0,Z.jsxs)(g.div,{...$,transition:{...$.transition,delay:t*.1},className:`relative text-center`,children:[(0,Z.jsxs)(`div`,{className:`relative mx-auto grid h-[76px] w-[76px] place-items-center rounded-2xl border border-line-2 bg-bg-2 shadow-card`,children:[(0,Z.jsx)(g.div,{className:`absolute inset-0 rounded-2xl border border-accent`,initial:{opacity:0},animate:{opacity:[0,.8,0]},transition:{duration:2.5,repeat:1/0,delay:t*.5,repeatDelay:0}}),(0,Z.jsx)(e.icon,{className:`h-6 w-6 text-fg`,strokeWidth:1.5})]}),(0,Z.jsxs)(`div`,{className:`mt-2 font-mono text-[10px] text-fg-3`,children:[`0`,t+1]}),(0,Z.jsx)(`div`,{className:`mt-1 text-[14px] font-medium tracking-tight`,children:e.title}),(0,Z.jsx)(`div`,{className:`mx-auto mt-1 max-w-[180px] text-xs leading-relaxed text-fg-3`,children:e.body})]},e.title))}),(0,Z.jsxs)(g.div,{...$,className:`mx-auto mt-14 flex max-w-xl items-center justify-center gap-2 rounded-full border border-line bg-bg-2 px-4 py-2 text-xs text-fg-3`,children:[(0,Z.jsx)(Le,{className:`h-3.5 w-3.5 text-accent`}),`One service layer behind the dashboard, the REST API and the MCP server`]})]})}var nt=e=>({initial:{scale:0},whileInView:{scale:1},viewport:{once:!0},transition:{delay:e,type:`spring`,bounce:.4}});function rt(){return(0,Z.jsxs)(`svg`,{viewBox:`0 0 300 190`,className:`h-full w-full`,children:[(0,Z.jsx)(`defs`,{children:(0,Z.jsx)(`marker`,{id:`ah`,viewBox:`0 0 10 10`,refX:`8`,refY:`5`,markerWidth:`5`,markerHeight:`5`,orient:`auto`,children:(0,Z.jsx)(`path`,{d:`M0 0L10 5L0 10z`,fill:`var(--accent)`})})}),(0,Z.jsx)(`path`,{d:`M100 80 C 130 50, 170 50, 200 80`,fill:`none`,stroke:`var(--accent)`,strokeWidth:`1.5`,className:`flow-dash`,markerEnd:`url(#ah)`}),(0,Z.jsx)(`path`,{d:`M200 110 C 170 140, 130 140, 100 110`,fill:`none`,stroke:`var(--accent)`,strokeWidth:`1.5`,className:`flow-dash`,markerEnd:`url(#ah)`}),(0,Z.jsx)(`rect`,{x:`112`,y:`88`,width:`76`,height:`14`,rx:`7`,fill:`var(--bg-3)`}),(0,Z.jsx)(`text`,{x:`150`,y:`98`,textAnchor:`middle`,fontSize:`8`,fill:`var(--fg-3)`,fontFamily:`Geist Mono Variable`,children:`same KYC entity`}),[[85,95],[215,95]].map(([e,t],n)=>(0,Z.jsxs)(g.g,{...nt(n*.15),style:{transformOrigin:`${e}px ${t}px`},children:[(0,Z.jsx)(`circle`,{cx:e,cy:t,r:`18`,fill:`var(--bg-2)`,stroke:`var(--fg-3)`,strokeOpacity:`.5`}),(0,Z.jsx)(`circle`,{cx:e,cy:t,r:`6`,fill:n?`var(--fg)`:`var(--accent)`})]},n)),(0,Z.jsx)(`text`,{x:`150`,y:`40`,textAnchor:`middle`,fontSize:`9`,fill:`var(--fg-2)`,fontFamily:`Geist Mono Variable`,children:`BUY 500 SYM014`}),(0,Z.jsx)(`text`,{x:`150`,y:`160`,textAnchor:`middle`,fontSize:`9`,fill:`var(--fg-2)`,fontFamily:`Geist Mono Variable`,children:`SELL 500 SYM014`})]})}function it(){let e=[[150,40],[225,145],[75,145]];return(0,Z.jsxs)(`svg`,{viewBox:`0 0 300 190`,className:`h-full w-full`,children:[(0,Z.jsx)(`defs`,{children:(0,Z.jsx)(`marker`,{id:`ah2`,viewBox:`0 0 10 10`,refX:`8`,refY:`5`,markerWidth:`5`,markerHeight:`5`,orient:`auto`,children:(0,Z.jsx)(`path`,{d:`M0 0L10 5L0 10z`,fill:`var(--accent)`})})}),e.map(([t,n],r)=>{let[i,a]=e[(r+1)%3],o=t+(i-t)*.18,s=n+(a-n)*.18,c=t+(i-t)*.82,l=n+(a-n)*.82;return(0,Z.jsx)(`path`,{d:`M${o} ${s} L${c} ${l}`,stroke:`var(--accent)`,strokeWidth:`1.5`,className:`flow-dash`,markerEnd:`url(#ah2)`},r)}),(0,Z.jsx)(`circle`,{cx:`150`,cy:`110`,r:`22`,fill:`none`,stroke:`var(--line-2)`,strokeDasharray:`2 3`}),(0,Z.jsx)(`text`,{x:`150`,y:`113`,textAnchor:`middle`,fontSize:`8`,fill:`var(--fg-3)`,fontFamily:`Geist Mono Variable`,children:`in_cycle`}),e.map(([e,t],n)=>(0,Z.jsxs)(g.g,{...nt(n*.12),style:{transformOrigin:`${e}px ${t}px`},children:[(0,Z.jsx)(`circle`,{cx:e,cy:t,r:`15`,fill:`var(--bg-2)`,stroke:`var(--fg-3)`,strokeOpacity:`.5`}),(0,Z.jsx)(`text`,{x:e,y:t+3.5,textAnchor:`middle`,fontSize:`10`,fontWeight:`600`,fill:`var(--fg)`,children:`ABC`[n]})]},n))]})}function at(){let e=[60,61,60,62,61,63,70,82,95,104,98,76,62,58],t=e.map((e,t)=>`${30+t*18},${165-(e-50)*2.2}`).join(` `);return(0,Z.jsxs)(`svg`,{viewBox:`0 0 300 190`,className:`h-full w-full`,children:[e.map((e,t)=>(0,Z.jsx)(`rect`,{x:24+t*18,y:t>=5&&t<=9?140:t>=10&&t<=12?150:165,width:`10`,height:t>=5&&t<=9?30:t>=10&&t<=12?20:5,rx:`2`,fill:t>=5&&t<=9?`var(--accent)`:`var(--fg-3)`,opacity:t>=5&&t<=9?.35:.25},t)),(0,Z.jsx)(g.polyline,{points:t,fill:`none`,stroke:`var(--fg)`,strokeWidth:`2`,strokeLinejoin:`round`,strokeLinecap:`round`,initial:{pathLength:0},whileInView:{pathLength:1},viewport:{once:!0},transition:{duration:1.6,ease:`easeInOut`}}),(0,Z.jsx)(`line`,{x1:`120`,x2:`120`,y1:`20`,y2:`170`,stroke:`var(--accent)`,strokeDasharray:`2 3`,strokeOpacity:`.6`}),(0,Z.jsx)(`text`,{x:`124`,y:`30`,fontSize:`8`,fill:`var(--accent)`,fontFamily:`Geist Mono Variable`,children:`ring buys in sync`}),(0,Z.jsx)(`line`,{x1:`210`,x2:`210`,y1:`20`,y2:`170`,stroke:`var(--fg-3)`,strokeDasharray:`2 3`,strokeOpacity:`.6`}),(0,Z.jsx)(`text`,{x:`214`,y:`30`,fontSize:`8`,fill:`var(--fg-3)`,fontFamily:`Geist Mono Variable`,children:`dump`})]})}export{Ze as default};