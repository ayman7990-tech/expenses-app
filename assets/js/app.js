/* ============================================================
   مشروع المصاريف - منطق التطبيق (نسخة مستقلة)
   مفاتيح تخزين منفصلة تماماً عن تطبيق_المصاريف
   ============================================================ */
const KEY     = "mashrou_expenses_v1";
const CFG_KEY = "mashrou_cfg_v1";
const BAK_KEY = "mashrou_backup_meta_v1";
const SAV_KEY = "mashrou_savings_v1";
const PALETTE = ["#d4af37","#58a6ff","#3fb950","#bc8cff","#f85149","#39c5cf","#f0883e","#db61a2"];

let entries = [];
let savings = [];   // [{month:"2026-11", amount:100, note:""}]
let cfg = { arabicDigits:true, currency:"ج.م", budget:0 };
let bakMeta = { last:null, count:0 };

/* ---------- Utilities ---------- */
function arabicToLatin(s){
  return String(s).replace(/[٠-٩]/g,d=>"0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
                  .replace(/[۰-۹]/g,d=>"0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);
}
function latinToArabic(s){
  if(!cfg.arabicDigits) return String(s);
  return String(s).replace(/[0-9]/g,d=>"٠١٢٣٤٥٦٧٨٩"[+d]);
}
function num(n){ return Number(n).toLocaleString("en-US",{maximumFractionDigits:2}); }
function money(n){ return latinToArabic(num(n))+" "+cfg.currency; }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function today(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function thisMonth(){ return today().slice(0,7); }
function monthName(key){
  const [y,m]=key.split("-");
  const names=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return names[+m-1]+" "+y;
}
function load(){
  try{ entries=JSON.parse(localStorage.getItem(KEY))||[]; }catch(e){ entries=[]; }
  try{ savings=JSON.parse(localStorage.getItem(SAV_KEY))||[]; }catch(e){ savings=[]; }
  try{ cfg=Object.assign(cfg,JSON.parse(localStorage.getItem(CFG_KEY))||{}); }catch(e){}
  try{ bakMeta=Object.assign(bakMeta,JSON.parse(localStorage.getItem(BAK_KEY))||{}); }catch(e){}
}
function save(){
  try{
    localStorage.setItem(KEY,JSON.stringify(entries));
    localStorage.setItem(SAV_KEY,JSON.stringify(savings));
    localStorage.setItem(CFG_KEY,JSON.stringify(cfg));
    localStorage.setItem(BAK_KEY,JSON.stringify(bakMeta));
  }catch(e){}
}
function toast(msg,err){
  const box=document.getElementById("toast");
  const t=document.createElement("div");
  t.className="toast"+(err?" err":"");
  t.textContent=msg; box.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

/* ---------- Navigation ---------- */
function go(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  document.getElementById("page-"+page).classList.add("active");
  const nav=document.querySelector('[data-page="'+page+'"]');
  if(nav) nav.classList.add("active");
  if(page==="reports") renderReports();
  if(page==="expenses") renderTable();
  if(page==="dashboard") renderDashboard();
  if(page==="backup") renderBackup();
  if(page==="savings") renderSavings();
}

/* ---------- Add / Remove ---------- */
function addEntry(){
  const cat=document.getElementById("f-cat").value.trim();
  const amt=parseFloat(arabicToLatin(document.getElementById("f-amt").value).replace(/,/g,""));
  const date=document.getElementById("f-date").value||today();
  if(!cat){ toast("اكتب الصنف أولاً",true); return; }
  if(!isFinite(amt)||amt<=0){ toast("المبلغ غير صالح",true); return; }

  // حماية الادخار: منع أي مصروف يلمس الـ 10% المحميين
  const budget=Number(cfg.budget)||0;
  if(budget && date.slice(0,7)===thisMonth()){
    const spendCap=budget*0.90;
    const projected=monthTotal(thisMonth())+amt;
    if(projected>spendCap){
      const over=projected-spendCap;
      const remaining=Math.max(0,spendCap-monthTotal(thisMonth()));
      toast("🚫 هيلمس الادخار! المتبقي للصرف "+money(remaining)+" بس، والمصروف زيادة بـ "+money(over),true);
      return;
    }
    // تحذير استباقي قبل ما توصل للسقف (عند 80%+)
    if(projected>spendCap*0.80){
      toast("⚠️ انتبه: بعد الإضافة هيتبقى "+money(spendCap-projected)+" من سقف المصاريف",true);
    }
  }

  entries.push({cat,amt,date,id:Date.now()+Math.random()});
  save(); refreshAll();
  document.getElementById("f-cat").value="";
  document.getElementById("f-amt").value="";
  document.getElementById("f-cat").focus();
  toast("اتضاف المصروف ✓");
}
function removeEntry(id){
  entries=entries.filter(e=>e.id!==id);
  save(); refreshAll(); toast("اتحذف");
}
function clearAll(){
  if(!entries.length){ toast("مفيش حاجة تتمسح",true); return; }
  if(!confirm("متأكد إنك عايز تمسح كل المصاريف؟\nخد نسخة احتياطية الأول لو محتاجها.")) return;
  entries=[]; save(); refreshAll(); toast("اتمسح الكل");
}
function sampleData(){
  if(entries.length && !confirm("ده هيستبدل البيانات الحالية. متأكد؟")) return;
  entries=[
    {cat:"أكل",     amt:50, date:"2026-11-01", id:1.1},
    {cat:"مواصلات", amt:20, date:"2026-11-02", id:1.2},
    {cat:"أكل",     amt:50, date:"2026-11-02", id:1.3},
    {cat:"كهرباء",  amt:80, date:"2026-11-04", id:1.4},
    {cat:"أكل",     amt:30, date:"2026-11-05", id:1.5},
    {cat:"مواصلات", amt:20, date:"2026-11-05", id:1.6},
    {cat:"إنترنت",  amt:45, date:"2026-11-10", id:1.7},
    {cat:"أكل",     amt:35, date:"2026-10-12", id:1.8},
    {cat:"كهرباء",  amt:70, date:"2026-10-20", id:1.9},
    {cat:"مواصلات", amt:25, date:"2026-09-08", id:2.1}
  ];
  save(); refreshAll(); toast("بيانات تجريبية جاهزة ✓");
}

/* ---------- Aggregation ---------- */
function byCategory(){
  const m={}; entries.forEach(e=>m[e.cat]=(m[e.cat]||0)+e.amt);
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
function byMonth(){
  const m={}; entries.forEach(e=>{ const k=e.date.slice(0,7); m[k]=(m[k]||0)+e.amt; });
  return Object.entries(m).sort((a,b)=>b[0].localeCompare(a[0]));
}
function totals(){
  const total=entries.reduce((s,e)=>s+e.amt,0);
  const cats=byCategory();
  return { total, count:entries.length, top:cats.length?cats[0][0]:"-", cats };
}
function monthTotal(key){
  return entries.filter(e=>e.date.slice(0,7)===key).reduce((s,e)=>s+e.amt,0);
}

/* ---------- Render: Budget ---------- */
function renderBudget(){
  const box=document.getElementById("budget-banner");
  if(!box) return;
  const m=thisMonth();
  const spent=monthTotal(m);
  const budget=Number(cfg.budget)||0;

  if(!budget){
    box.innerHTML=
      '<div class="top"><div class="title">🎯 خطة '+monthName(m)+'</div>'+
      '<span class="status warn">مش محددة</span></div>'+
      '<div class="backup-info">ادخل المرتب (الميزانية) من الإعدادات، والتطبيق هيقسّمه تلقائي: 10% ادخار محمي + 90% مصاريف، وهيحذّرك قبل ما تلمس الادخار.</div>';
    return;
  }

  // خطة 90/10: الادخار 10% محمي، سقف المصاريف 90% من المرتب
  const salary=budget;
  const saving=salary*0.10;
  const spendCap=salary*0.90;
  const left=spendCap-spent;                 // المتبقي من سقف المصاريف
  const pctOfCap=spendCap?spent/spendCap*100:0;
  const pctOfSalary=salary?spent/salary*100:0;
  const barPct=Math.min(pctOfCap,100);

  let cls="ok", color="var(--green)", label="في الحدود";
  if(spent>spendCap){ cls="over"; color="var(--red)"; label="⚠️ لمست الادخار"; }
  else if(pctOfCap>=80){ cls="warn"; color="var(--orange)"; label="قربت من السقف"; }

  box.innerHTML=
    '<div class="top"><div class="title">🎯 خطة '+monthName(m)+' - نظام 90/10</div>'+
    '<span class="status '+cls+'">'+label+'</span></div>'+
    '<div class="budget-bar"><div class="budget-fill" style="width:'+barPct.toFixed(1)+'%;background:'+color+'"></div></div>'+
    '<div class="budget-meta"><span>صرفت '+money(spent)+' ('+latinToArabic(pctOfSalary.toFixed(0))+'% من المرتب)</span>'+
      '<span>'+(left>=0 ? 'متبقي للصرف '+money(left) : 'تجاوزت السقف بـ '+money(-left))+'</span>'+
      '<span>سقف المصاريف '+money(spendCap)+'</span></div>'+
    '<div class="split-row">'+
      '<div class="split-box save"><div class="sp-l">🏦 الادخار (10% - محمي)</div><div class="sp-v">'+money(saving)+'</div></div>'+
      '<div class="split-box spend"><div class="sp-l">💳 متاح للمصاريف (90%)</div><div class="sp-v">'+money(spendCap)+'</div></div>'+
      '<div class="split-box salary"><div class="sp-l">💵 المرتب (100%)</div><div class="sp-v">'+money(salary)+'</div></div>'+
    '</div>';
}

/* ---------- Render: Dashboard ---------- */
function renderDashboard(){
  const t=totals();
  document.getElementById("d-total").textContent=money(t.total);
  document.getElementById("d-count").textContent=latinToArabic(t.count);
  document.getElementById("d-top").textContent=t.top;
  document.getElementById("d-avg").textContent=money(t.count?t.total/t.count:0);
  renderBudget();

  const max=t.cats.length?t.cats[0][1]:1;
  document.getElementById("d-bars").innerHTML=t.cats.length
    ? t.cats.map(([c,v],i)=>barHTML(c,v,max,PALETTE[i%PALETTE.length])).join("")
    : '<div class="empty">لسه مفيش بيانات</div>';
  renderDonut("d-donut","d-legend",t.cats,t.total);
}
function barHTML(c,v,max,color){
  return '<div class="bar-row"><div class="bar-head"><span>'+esc(c)+
    '</span><span class="v">'+money(v)+'</span></div><div class="bar-bg"><div class="bar-fill" style="width:'+
    (v/max*100).toFixed(1)+'%;background:'+color+'"></div></div></div>';
}
function renderDonut(donutId,legendId,cats,total){
  const donut=document.getElementById(donutId);
  const legend=document.getElementById(legendId);
  if(!donut||!legend) return;
  if(!cats.length){
    donut.style.background="var(--line)";
    donut.innerHTML='<div class="center"><span class="n">0</span><span class="l">لا توجد بيانات</span></div>';
    legend.innerHTML=""; return;
  }
  let acc=0; const stops=[];
  cats.forEach(([c,v],i)=>{
    const from=total?acc/total*360:0; acc+=v;
    const to=total?acc/total*360:0;
    stops.push(PALETTE[i%PALETTE.length]+" "+from+"deg "+to+"deg");
  });
  donut.style.background="conic-gradient("+stops.join(",")+")";
  donut.innerHTML='<div class="center"><span class="n">'+latinToArabic(cats.length)+
    '</span><span class="l">أصناف</span></div>';
  legend.innerHTML=cats.map(([c,v],i)=>
    '<div class="li"><span class="dot" style="background:'+PALETTE[i%PALETTE.length]+
    '"></span><span>'+esc(c)+'</span><span class="val">'+money(v)+'</span></div>').join("");
}

/* ---------- Render: Table ---------- */
function renderTable(){
  const body=document.getElementById("tbl-body");
  if(!entries.length){
    body.innerHTML='<tr><td colspan="4" class="empty">لسه مفيش مصاريف. أضف واحد من فوق أو جرّب البيانات التجريبية.</td></tr>';
    return;
  }
  body.innerHTML=entries.slice().reverse().map(e=>
    '<tr><td>'+esc(e.date)+'</td><td><span class="badge">'+esc(e.cat)+
    '</span></td><td class="amt">'+money(e.amt)+'</td><td><button class="del" onclick="removeEntry('+
    e.id+')" title="حذف">✕</button></td></tr>').join("");
}

/* ---------- Render: Reports ---------- */
function renderReports(){
  const months=byMonth();
  document.getElementById("r-months").innerHTML=months.length
    ? months.map(([k,v])=>'<div class="month-card"><div class="m">'+monthName(k)+
        '</div><div class="v">'+money(v)+'</div></div>').join("")
    : '<div class="empty">لسه مفيش بيانات</div>';

  const cats=byCategory();
  const total=cats.reduce((s,c)=>s+c[1],0);
  const max=cats.length?cats[0][1]:1;
  document.getElementById("r-cats").innerHTML=cats.length
    ? cats.map(([c,v],i)=>barHTML(c,v,max,PALETTE[i%PALETTE.length])).join("")
    : '<div class="empty">لسه مفيش بيانات</div>';
  renderDonut("r-donut","r-legend",cats,total);
}

/* ---------- Backup ---------- */
function backupAge(){
  if(!bakMeta.last) return null;
  const days=Math.floor((Date.now()-new Date(bakMeta.last).getTime())/86400000);
  return days;
}
function renderBackup(){
  const el=document.getElementById("bak-status");
  if(!el) return;
  const age=backupAge();
  if(age===null){
    el.innerHTML='<span class="backup-status none">مفيش نسخة احتياطية</span>';
  } else if(age<=7){
    el.innerHTML='<span class="backup-status fresh">آخر نسخة: '+latinToArabic(age)+' يوم - كويسة</span>';
  } else {
    el.innerHTML='<span class="backup-status old">آخر نسخة: '+latinToArabic(age)+' يوم - قديمة</span>';
  }
  document.getElementById("bak-count").textContent=latinToArabic(bakMeta.count||0);
  document.getElementById("bak-last").textContent=bakMeta.last
    ? new Date(bakMeta.last).toLocaleString("ar-EG")
    : "—";
}
function makeBackup(){
  if(!entries.length){ toast("مفيش بيانات تعملها نسخة",true); return; }
  const payload={
    app:"مشروع المصاريف", version:1,
    exportedAt:new Date().toISOString(),
    count:entries.length,
    settings:{currency:cfg.currency, arabicDigits:cfg.arabicDigits, budget:cfg.budget},
    entries, savings
  };
  const stamp=today();
  download(JSON.stringify(payload,null,2),"نسخة-مصاريف-"+stamp+".json","application/json;charset=utf-8;");
  bakMeta.last=new Date().toISOString();
  bakMeta.count=entries.length;
  save(); renderBackup();
  toast("اتعملت النسخة الاحتياطية ✓");
}
function restoreBackup(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(String(reader.result));
      const list=Array.isArray(data)?data:data.entries;
      if(!Array.isArray(list)) throw new Error("صيغة غير معروفة");
      if(entries.length && !confirm("ده هيستبدل البيانات الحالية ("+entries.length+" مصروف). متأكد؟")){ input.value=""; return; }
      entries=list.filter(e=>e&&e.cat&&isFinite(Number(e.amt))&&Number(e.amt)>0)
                  .map(e=>({cat:String(e.cat), amt:Number(e.amt), date:e.date||today(), id:Date.now()+Math.random()}));
      if(data.settings){
        if(data.settings.currency) cfg.currency=data.settings.currency;
        if(typeof data.settings.arabicDigits==="boolean") cfg.arabicDigits=data.settings.arabicDigits;
        if(data.settings.budget!=null) cfg.budget=Number(data.settings.budget)||0;
      }
      if(Array.isArray(data.savings)){
        savings=data.savings.filter(x=>x&&x.month&&isFinite(Number(x.amount)))
                            .map(x=>({month:String(x.month), amount:Number(x.amount), note:x.note||"", id:Date.now()+Math.random()}));
      }
      save(); syncSettingsUI(); refreshAll();
      toast("اترجعت "+entries.length+" مصروف ✓");
    }catch(err){
      toast("الملف غير صالح: "+err.message,true);
    }
    input.value="";
  };
  reader.readAsText(file,"UTF-8");
}

/* ---------- Savings (الادخار المتراكم) ---------- */
function savingFor(month){ return Number(cfg.budget||0)*0.10; }
function savingsTotal(){ return savings.reduce((s,x)=>s+Number(x.amount||0),0); }
function savingsMonths(){ return savings.slice().sort((a,b)=>b.month.localeCompare(a.month)); }
function hasSaving(month){ return savings.some(x=>x.month===month); }

// الشهور اللي فيها مصاريف + الشهر الحالي
function monthsWithData(){
  const set=new Set(entries.map(e=>e.date.slice(0,7)));
  set.add(thisMonth());
  return [...set].sort((a,b)=>b.localeCompare(a));
}
// الشهور المستحقة للادخار: اللي فاتت ومفيش لها قيد ادخار
function pendingSavings(){
  if(!Number(cfg.budget)) return [];
  return monthsWithData().filter(m=>!hasSaving(m));
}
function addSaving(month, amount, note){
  const m=month||thisMonth();
  const amt=Number(amount);
  if(!isFinite(amt)||amt<=0){ toast("المبلغ غير صالح",true); return false; }
  const existing=savings.find(x=>x.month===m);
  if(existing){ existing.amount=amt; if(note!=null) existing.note=note; }
  else savings.push({month:m, amount:amt, note:note||"", id:Date.now()+Math.random()});
  save(); refreshAll();
  toast("اتسجّل ادخار "+monthName(m)+" ✓");
  return true;
}
function removeSaving(month){
  savings=savings.filter(x=>x.month!==month);
  save(); refreshAll(); toast("اتحذف ادخار "+monthName(month));
}
// يسجّل الادخار لكل الشهور المستحقة بضغطة
function autoSaveAll(){
  const pend=pendingSavings();
  if(!pend.length){ toast("مفيش شهور مستحقة للادخار",true); return; }
  if(!Number(cfg.budget)){ toast("حدّد المرتب الأول من الإعدادات",true); return; }
  const amt=savingFor(thisMonth());
  pend.forEach(m=>savings.push({month:m, amount:amt, note:"تلقائي", id:Date.now()+Math.random()+m}));
  save(); refreshAll();
  toast("اتسجّل ادخار "+latinToArabic(pend.length)+" شهر ✓");
}
function saveCurrentMonth(){
  const amt=savingFor(thisMonth());
  if(!amt){ toast("حدّد المرتب الأول من الإعدادات",true); return; }
  if(hasSaving(thisMonth())){ toast("ادخار الشهر ده متسجّل بالفعل",true); return; }
  addSaving(thisMonth(), amt, "يدوي");
}
function renderSavings(){
  if(!document.getElementById("sav-total")) return;
  const total=savingsTotal();
  const months=savingsMonths();
  const pend=pendingSavings();
  const monthly=savingFor(thisMonth());

  document.getElementById("sav-total").textContent=money(total);
  document.getElementById("sav-count").textContent=latinToArabic(months.length);
  document.getElementById("sav-monthly").textContent=money(monthly);
  document.getElementById("sav-pending").textContent=latinToArabic(pend.length);

  // عدّاد: كم شهر يقدر يعيش على مدخراته
  const avgSpend=monthsWithData().length
    ? entries.reduce((s,e)=>s+e.amt,0)/Math.max(1,new Set(entries.map(e=>e.date.slice(0,7))).size)
    : 0;
  const runway=avgSpend>0?total/avgSpend:0;
  document.getElementById("sav-runway").textContent=
    avgSpend>0 ? latinToArabic(runway.toFixed(1))+" شهر" : "—";

  // الشهور المستحقة
  const pendBox=document.getElementById("sav-pending-list");
  if(pendBox){
    pendBox.innerHTML=pend.length
      ? pend.map(m=>'<div class="pend-item"><span>'+monthName(m)+'</span>'+
          '<span class="pend-amt">'+money(monthly)+'</span>'+
          '<button class="btn sm" onclick="addSaving(\''+m+'\','+monthly+',\'يدوي\')">سجّل</button></div>').join("")
      : '<div class="empty" style="padding:20px">كل الشهور متسجّلة ✓</div>';
  }

  // سجل الادخار
  const body=document.getElementById("sav-body");
  if(body){
    body.innerHTML=months.length
      ? months.map(x=>'<tr><td>'+monthName(x.month)+'</td><td class="amt">'+money(x.amount)+
          '</td><td>'+(x.note?esc(x.note):"—")+'</td>'+
          '<td><button class="del" onclick="removeSaving(\''+x.month+'\')" title="حذف">✕</button></td></tr>').join("")
      : '<tr><td colspan="4" class="empty">لسه مفيش ادخار مسجّل</td></tr>';
  }
  renderSavingsChart();
}
function renderSavingsChart(){
  const el=document.getElementById("sav-bars");
  if(!el) return;
  const months=savingsMonths().slice(0,8).reverse();
  if(!months.length){ el.innerHTML='<div class="empty">لسه مفيش بيانات</div>'; return; }
  let acc=0; const cum=months.map(x=>{ acc+=Number(x.amount||0); return {m:x.month, v:acc}; });
  const max=Math.max(...cum.map(c=>c.v))||1;
  el.innerHTML=cum.map(c=>barHTML(monthName(c.m), c.v, max, "var(--green)")).join("");
}

/* ---------- Import / Export CSV ---------- */
function exportCSV(){
  if(!entries.length){ toast("مفيش حاجة تتصدّر",true); return; }
  let csv="\uFEFFالتاريخ,الصنف,المبلغ\n";
  entries.forEach(e=>{ csv+=e.date+","+e.cat+","+e.amt+"\n"; });
  csv+="\n,الإجمالي,"+entries.reduce((s,e)=>s+e.amt,0)+"\n";
  download(csv,"مصاريف.csv","text/csv;charset=utf-8;");
  toast("اتصدّر CSV ✓");
}
function download(content,name,type){
  const blob=new Blob([content],{type});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
  URL.revokeObjectURL(a.href);
}
function importCSV(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const lines=String(reader.result).replace(/^\uFEFF/,"").split(/\r?\n/);
    let added=0;
    lines.slice(1).forEach(line=>{
      if(!line.trim()) return;
      const parts=line.split(",");
      if(parts.length<3) return;
      const date=parts[0].trim(), cat=parts[1].trim();
      const amt=parseFloat(arabicToLatin(parts[2]).replace(/,/g,""));
      if(date&&cat&&isFinite(amt)&&amt>0){
        entries.push({date,cat,amt,id:Date.now()+Math.random()}); added++;
      }
    });
    save(); refreshAll();
    toast("اتستورد "+added+" مصروف ✓");
    input.value="";
  };
  reader.readAsText(file,"UTF-8");
}

/* ---------- Settings ---------- */
function updateSetting(key,val){
  cfg[key]=val; save(); refreshAll();
  toast("اتحدّث الإعداد");
}
function syncSettingsUI(){
  const d=document.getElementById("cfg-digits");
  const c=document.getElementById("cfg-currency");
  const b=document.getElementById("cfg-budget");
  if(d) d.checked=!!cfg.arabicDigits;
  if(c) c.value=cfg.currency;
  if(b) b.value=cfg.budget||"";
}
function setBudget(){
  const raw=arabicToLatin(document.getElementById("cfg-budget").value).replace(/,/g,"");
  const v=parseFloat(raw);
  cfg.budget=isFinite(v)&&v>0?v:0;
  save(); refreshAll();
  toast(cfg.budget?"اتحددت الميزانية ✓":"اتشالت الميزانية");
}

/* ---------- Boot ---------- */
function refreshAll(){ renderDashboard(); renderTable(); renderReports(); renderBackup(); renderSavings(); }
function init(){
  load();
  document.getElementById("f-date").value=today();
  syncSettingsUI();
  refreshAll();
  // تنبيه لو مفيش نسخة احتياطية حديثة
  const age=backupAge();
  if(entries.length && (age===null||age>7)){
    setTimeout(()=>toast("نصيحة: خد نسخة احتياطية من صفحة النسخ الاحتياطي",true),900);
  }
}
document.addEventListener("DOMContentLoaded",init);
