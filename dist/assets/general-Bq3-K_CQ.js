import{r as c,j as e}from"./index-BQugvTWS.js";import{c as a,B as i}from"./createLucideIcon-BJswqYho.js";/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],r=a("moon",m);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],l=a("sun",h);function u(){return typeof window>"u"?"light":document.documentElement.classList.contains("dark")?"dark":"light"}function g(){const[s,o]=c.useState(u);c.useEffect(()=>{window.settingsApi.getSettings().then(t=>{o(t.theme),document.documentElement.classList.toggle("dark",t.theme==="dark")})},[]);const d=()=>{o(t=>{const n=t==="light"?"dark":"light";return document.documentElement.classList.toggle("dark",n==="dark"),window.settingsApi.updateSetting("theme",n),n})};return e.jsx("div",{className:"mx-auto flex w-full max-w-3xl flex-col gap-6",children:e.jsx("section",{className:"rounded-xl border bg-card p-5 shadow-sm",children:e.jsxs("div",{className:"flex items-center justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"font-medium",children:"Theme"}),e.jsxs("p",{className:"text-sm text-muted-foreground",children:["Current theme: ",s]})]}),e.jsx(i,{onClick:d,variant:"secondary",children:s==="light"?e.jsxs(e.Fragment,{children:[e.jsx(r,{className:"mr-2 h-4 w-4"}),"Switch to Dark"]}):e.jsxs(e.Fragment,{children:[e.jsx(l,{className:"mr-2 h-4 w-4"}),"Switch to Light"]})})]})})})}export{g as component};
