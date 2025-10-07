
const $ = s => document.querySelector(s);
const $$= s => Array.from(document.querySelectorAll(s));
function toast(msg, type="success"){const w=$("#toast");const d=document.createElement("div");d.className=`toast ${type}`;d.textContent=msg;w.appendChild(d);setTimeout(()=>d.remove(),3500);}

async function postJson(url, body={}, {auth=false}={}) {
  const h={"Content-Type":"application/json"};
  if(auth){const t=localStorage.getItem("rp_token"); if(t) h.Authorization=`Bearer ${t}`;}
  const r = await fetch(url,{method:"POST",headers:h,body:JSON.stringify(body)});
  const text = await r.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  return {ok:r.ok,status:r.status,data};
}
async function getJson(url,{auth=false}={}) {
  const h={}; if(auth){const t=localStorage.getItem("rp_token"); if(t) h.Authorization=`Bearer ${t}`;}
  const r=await fetch(url,{headers:h}); const t=await r.text(); let d={}; try{d=t?JSON.parse(t):{}}catch{d={raw:t}}; return {ok:r.ok,status:r.status,data:d};
}

function setSignedIn(email){
  $("#authStatus").textContent = email ? `Signed in as ${email}` : "Not signed in";
  $("#signOutBtn").classList.toggle("hidden", !email);
  $("#authSection").classList.toggle("hidden", !!email);
  $("#dash").classList.toggle("hidden", !email);
  if(email){ refreshQuota(); refreshJobs(); }
}

const planRadios = $$('.plans input[name="plan"]');
const currentPlan = () => (planRadios.find(r=>r.checked)?.value || "Basic");

$("#signUpBtn").addEventListener("click", async ()=>{
  const email=$("#email").value.trim().toLowerCase();
  const password=$("#password").value;
  if(!email||!password){toast("Enter email + password","info"); return;}
  const res=await postJson("/api/auth/signup",{email,password,fullName:"",phone:"",plan:currentPlan()});
  if(res.ok){ localStorage.setItem("rp_email",email); localStorage.setItem("rp_token",res.data.token||""); setSignedIn(email); toast("Account created.","success"); }
  else toast(res.data?.error||"Signup failed","error");
});
$("#signInBtn").addEventListener("click", async ()=>{
  const email=$("#email").value.trim().toLowerCase();
  const password=$("#password").value;
  const res=await postJson("/api/auth/login",{email,password});
  if(res.ok){ localStorage.setItem("rp_email",email); localStorage.setItem("rp_token",res.data.token||""); setSignedIn(email); toast("Signed in","success"); }
  else toast(res.data?.error||"Login failed","error");
});
$("#signOutBtn").addEventListener("click", ()=>{ localStorage.clear(); setSignedIn(null); toast("Signed out","success"); });

$("#subscribeBtn").addEventListener("click", async ()=>{
  const planName=currentPlan();
  const res=await postJson("/api/subscribe",{planName},{auth:true});
  if(res.ok){ toast("Subscription updated","success"); refreshQuota(); }
  else toast(res.data?.error||"Subscribe failed","error");
});

async function refreshQuota(){
  const res=await getJson("/api/me",{auth:true});
  const sub=res.data?.subscription||null;
  $("#planName").textContent=sub?.plan||"—";
  const remain=Number(sub?.pages_remaining||0), total=Number(sub?.quota_pages||0);
  $("#remaining").textContent=String(remain);
  const pct = total? Math.round((remain/total)*100):0; $("#quotaFill").style.width=`${pct}%`;
}

async function refreshJobs(){
  const res=await getJson("/api/jobs",{auth:true});
  const list = Array.isArray(res.data)? res.data : (res.data.jobs||[]);
  const body=$("#jobsTable tbody"); body.innerHTML="";
  for(const j of list){
    const created=j.created_at || j.createdAt;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${created?new Date(created).toLocaleString():"—"}</td>
      <td>${j.file_name||j.filename||"—"}</td>
      <td>${j.pages||"—"}</td>
      <td>${(j.color? "Color":"B/W")} • ${(j.duplex?"Duplex":"Simplex")}</td>
      <td>${j.status||"Queued"}</td>
      <td>${j.pickup_code||""}</td>`;
    body.appendChild(tr);
  }
}

$("#priceBtn").addEventListener("click", ()=>{
  const pages=parseInt($("#pages").value||"0",10);
  const perSide = ($("#color").value==="color") ? 70 : 25;
  $("#priceOut").textContent = pages? `₦ ${(perSide*pages).toLocaleString()}` : "—";
});

$("#sendBtn").addEventListener("click", async ()=>{
  const file=$("#fileInput").files[0];
  const pages=parseInt($("#pages").value||"0",10);
  if(!file||!pages){ toast("Choose a file and pages","info"); return; }

  const r1 = await postJson("/api/blob/sas",{fileName:file.name, contentType:file.type||"application/octet-stream"});
  if(!r1.ok){ toast("SAS failed","error"); return; }

  const put = await fetch(r1.data.uploadUrl, { method:"PUT", headers:{ "x-ms-blob-type":"BlockBlob", "content-type":file.type||"application/octet-stream" }, body:file });
  if(!put.ok){ toast("Blob upload failed","error"); return; }

  const color=$("#color").value; const duplex=$("#duplex").value==="true"?"Yes":"No";
  const r2 = await postJson("/api/jobs",{ fileName:file.name, blobUrl:r1.data.blobUrl, pages, color, duplex },{auth:true});
  if(!r2.ok){ toast(r2.data?.error||"Queue failed","error"); return; }

  toast("Uploaded and queued","success");
  refreshJobs(); refreshQuota();
});

(function(){
  const email=localStorage.getItem("rp_email"); const token=localStorage.getItem("rp_token");
  setSignedIn(email && token ? email : null);
})();
