import fs from "node:fs/promises";
import path from "node:path";

const source = JSON.parse(
  await fs.readFile("data/source/Simple_Quiz_Intelligence_base.json", "utf8"),
);
const manifest = JSON.parse(await fs.readFile("telegram_archive/manifest.json", "utf8"));
const telegram = JSON.parse(await fs.readFile("telegram_archive/questions_enriched.json", "utf8"));

function answerNote(question) {
  if (!question.answer) return "OCR из карточки; требуется редакторская проверка";
  if (question.answerSourceType === "user_correction") {
    return `Ответ уточнён пользователем: ${question.answerSourceNote}`;
  }
  return `Ответ подтверждён реакцией канала: ${question.answerSourceUrl}`;
}

const uniqueQuestions = telegram.questions.filter(
  (question) => !question.duplicateOfId,
);
const telegramCatalogRows = uniqueQuestions.map((question, index) => [
  question.catalogId,
  "TG",
  "Telegram-архив",
  index + 1,
  question.question,
  question.answer || "Не опубликован в посте",
  "Не размечено",
  "Спорт / смешанное",
  answerNote(question),
  null,
  "Не оценена",
  question.mediaPath,
  null,
  question.postUrl,
]);
const catalog = {
  headers: source.sheets["Каталог"].headers,
  rows: [...source.sheets["Каталог"].rows, ...telegramCatalogRows],
};
const projectRoot = process.cwd();

const data = {
  generatedAt: new Date().toISOString(),
  stats: {
    catalog: telegram.finalCatalogCount,
    recognized: telegram.questionCount,
    added: telegram.uniqueAddedToCatalog,
    duplicates: telegram.duplicatesSkipped,
    posts: manifest.postCount,
    photos: manifest.photoCount,
    videos: manifest.videoCount,
    downloaded: manifest.media.filter((item) => item.file).length,
    failures: manifest.failures.length,
    answered: telegram.questions.filter((question) => question.answer).length,
    reactionAnswered: telegram.verifiedAnswerCount,
    manualAnswered: telegram.manualAnswerCount || 0,
  },
  repeatability: source.repeatability,
  roundDifficulty: source.roundDifficulty,
  sheets: {
    "Каталог": catalog,
    "Telegram-архив": {
      headers: [
        "Telegram ID",
        "Дата",
        "Post ID",
        "Текст вопроса",
        "Ответ",
        "Источник",
        "Медиа",
        "OCR",
        "Статус",
        "Дубликат ID",
      ],
      rows: telegram.questions.map((question) => [
        `TG-${String(question.postId).padStart(4, "0")}`,
        question.date,
        question.postId,
        question.question,
        question.answer || "Не опубликован в посте",
        question.postUrl,
        question.mediaPath,
        question.ocrConfidence,
        question.duplicateOfId ? "Дубликат каталога" : question.reviewStatus,
        question.duplicateOfId || "",
      ]),
    },
    "Механики": source.sheets["Механики"],
    "Раунды": source.sheets["Раунды"],
    "Новые пакеты": source.sheets["Новые пакеты"],
  },
  mediaRoot: path.join(projectRoot, "telegram_archive", "media"),
};

const embedded = JSON.stringify(data).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Simple Quiz Intelligence — база + Telegram</title>
  <style>
    :root{--ink:#142033;--muted:#667085;--line:#dce3eb;--paper:#f4f7fa;--white:#fff;--navy:#17365d;--violet:#7030a0;--blue:#5b9bd5;--green:#70ad47;--amber:#f4b942;--shadow:0 14px 36px rgba(20,32,51,.09)}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
    button,input{font:inherit}.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:14px;padding:12px 20px;background:#101d30;color:#fff;box-shadow:0 5px 20px rgba(16,29,48,.2)}
    .brand{font-weight:800;white-space:nowrap}.tabs{display:flex;gap:5px;overflow:auto}.tab{border:0;border-radius:8px;padding:8px 11px;background:transparent;color:#cbd5e1;cursor:pointer;white-space:nowrap}.tab.active,.tab:hover{background:#263a57;color:#fff}
    .actions{display:flex;gap:8px;margin-left:auto}.search,.action{border:1px solid #41536c;border-radius:8px;padding:7px 10px;background:#182942;color:#fff}.search{width:230px}.action{cursor:pointer}
    main{max-width:1600px;margin:auto;padding:24px}.hero{display:flex;justify-content:space-between;gap:28px;padding:30px 34px;border-radius:18px;background:var(--navy);color:#fff;box-shadow:var(--shadow)}
    .eyebrow{margin:0 0 6px;color:#b8c9df;font-size:11px;font-weight:800;letter-spacing:.14em}.hero h1,.sheet-head h1{margin:0;font-size:clamp(27px,4vw,46px);line-height:1.08}.hero p{max-width:780px;color:#dbe7f4}.hero-mark{display:grid;place-items:center;min-width:108px;height:108px;border-radius:24px;background:var(--violet);font-size:28px;font-weight:900}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0}.kpi{display:flex;align-items:flex-end;justify-content:space-between;min-height:105px;padding:19px;border-radius:14px;background:#fff;box-shadow:var(--shadow)}.kpi span{max-width:140px;color:var(--muted);font-size:13px}.kpi strong{color:var(--navy);font-size:34px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{padding:22px;border:1px solid var(--line);border-radius:15px;background:#fff;box-shadow:var(--shadow)}.panel h2{margin:0 0 15px}.summary{display:grid;gap:10px}.summary-row{display:grid;grid-template-columns:150px 1fr 48px;gap:10px;align-items:center}.track{height:10px;border-radius:99px;background:#e9eef4;overflow:hidden}.fill{height:100%;border-radius:99px;background:var(--blue)}
    .note{margin-top:16px;padding:16px 18px;border-left:5px solid var(--amber);border-radius:10px;background:#fff8df}.sheet-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:4px 0 16px}.sheet-head h1{font-size:34px}.sheet-head p{margin:0;color:var(--muted)}
    .table-shell{max-height:calc(100vh - 165px);overflow:auto;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:var(--shadow)}table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}th{position:sticky;top:0;z-index:2;padding:10px 9px;background:var(--navy);color:#fff;text-align:left;white-space:nowrap;cursor:pointer}td{max-width:560px;padding:9px;border-bottom:1px solid #e4e8ee;vertical-align:top;white-space:pre-wrap}tbody tr:nth-child(even){background:#eaf5fb}tbody tr:hover{background:#fff3cd}td a{color:#165a96;text-decoration:none}td a:hover{text-decoration:underline}.status{display:inline-block;padding:3px 7px;border-radius:99px;background:#dcfce7;color:#166534;font-size:11px}.status.warn{background:#fef3c7;color:#92400e}.status.duplicate{background:#e2e8f0;color:#475569}
    [contenteditable="true"]{outline:none;background:#fffdf3}[contenteditable="true"]:focus{box-shadow:inset 0 0 0 2px var(--amber)}
    @media(max-width:900px){.topbar{align-items:flex-start;flex-wrap:wrap}.actions{width:100%;margin:0}.search{flex:1}.hero-mark{display:none}.kpis,.grid{grid-template-columns:1fr 1fr}}@media(max-width:580px){main{padding:14px}.kpis,.grid{grid-template-columns:1fr}.hero{padding:24px}.brand{width:100%}}
    @media print{.topbar,.actions{display:none}main{max-width:none;padding:0}.table-shell{max-height:none;overflow:visible;box-shadow:none}th{position:static}}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">SQ Intelligence</div>
    <nav class="tabs">
      <button class="tab active" data-tab="Дашборд">Дашборд</button>
      <button class="tab" data-tab="Каталог">Каталог</button>
      <button class="tab" data-tab="Telegram-архив">Telegram-архив</button>
      <button class="tab" data-tab="Механики">Механики</button>
      <button class="tab" data-tab="Раунды">Раунды</button>
      <button class="tab" data-tab="Новые пакеты">Новые пакеты</button>
    </nav>
    <div class="actions">
      <input class="search" id="search" placeholder="Поиск по таблице" hidden>
      <button class="action" id="csv" hidden>CSV</button>
      <button class="action" onclick="print()">Печать</button>
    </div>
  </header>
  <main>
    <section id="dashboard">
      <div class="hero">
        <div>
          <p class="eyebrow">БАЗА + ПОЛНЫЙ ПУБЛИЧНЫЙ АРХИВ @SIMPLE_QUIZ</p>
          <h1>Simple Quiz Intelligence</h1>
          <p>Вопросы из исходной презентации и Telegram-карточек объединены в одном офлайн-файле. Поиск, сортировка и выгрузка CSV работают без Excel и без подключения к интернету.</p>
        </div>
        <div class="hero-mark">SQ</div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Вопросов в каталоге</span><strong>${data.stats.catalog}</strong></div>
        <div class="kpi"><span>Распознано карточек</span><strong>${data.stats.recognized}</strong></div>
        <div class="kpi"><span>Новых после дедупликации</span><strong>${data.stats.added}</strong></div>
        <div class="kpi"><span>Скачано медиа</span><strong>${data.stats.downloaded}</strong></div>
      </div>
      <div class="grid">
        <div class="panel"><h2>Средняя сложность исходных раундов</h2><div class="summary" id="round-bars"></div></div>
        <div class="panel"><h2>Импорт Telegram</h2>
          <p><b>${data.stats.posts}</b> публикаций · <b>${data.stats.photos}</b> фото · <b>${data.stats.videos}</b> видео в публичной ленте.</p>
          <p><b>${data.stats.duplicates}</b> карточек совпали с исходными вопросами и не были добавлены повторно.</p>
          <p><b>${data.stats.failures}</b> файл не скачался: CDN Telegram вернул ошибку 500.</p>
          <div class="note"><b>${data.stats.answered}</b> ответов заполнено: <b>${data.stats.reactionAnswered}</b> по реакциям аккаунта «Симпл Квиз | Минута на обсуждение», <b>${data.stats.manualAnswered}</b> по уточнениям пользователя, остальные — из исходной базы. Неоднозначные случаи оставлены как «Не опубликован в посте».</div>
        </div>
      </div>
    </section>
    <section id="sheet" hidden>
      <div class="sheet-head"><div><p class="eyebrow">ОФЛАЙН-БАЗА</p><h1 id="sheet-title"></h1></div><p id="sheet-meta"></p></div>
      <div class="table-shell"><table><thead id="thead"></thead><tbody id="tbody"></tbody></table></div>
    </section>
  </main>
  <script>
    const DATA=${embedded};
    const tabs=[...document.querySelectorAll(".tab")], dashboard=document.querySelector("#dashboard"), sheet=document.querySelector("#sheet");
    const search=document.querySelector("#search"), csv=document.querySelector("#csv"), thead=document.querySelector("#thead"), tbody=document.querySelector("#tbody");
    let active="Дашборд", sortColumn=-1, sortAsc=true, currentRows=[];
    const roundMax=Math.max(...DATA.roundDifficulty.map(row=>Number(row[1])||0),1);
    document.querySelector("#round-bars").innerHTML=DATA.roundDifficulty.map(([name,value])=>'<div class="summary-row"><span>'+escapeHtml(name)+'</span><div class="track"><div class="fill" style="width:'+((Number(value)||0)/roundMax*100)+'%"></div></div><b>'+Number(value).toFixed(1)+'</b></div>').join("");
    function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
    function fileUrl(relative){return "file://"+DATA.mediaRoot+"/"+String(relative).split("/").pop();}
    function cellHtml(value,header){
      if(value==null)return "";
      if(header==="Источник"||header==="Источник/ссылка")return '<a href="'+escapeHtml(value)+'" target="_blank">'+escapeHtml(value)+'</a>';
      if(header==="Медиа"||header==="Слайд вопроса"&&String(value).startsWith("telegram_archive/"))return '<a href="'+escapeHtml(fileUrl(value))+'" target="_blank">'+escapeHtml(value)+'</a>';
      if(header==="OCR"&&typeof value==="number")return (value*100).toFixed(1)+"%";
      if(header==="Статус"){const cls=String(value).includes("Дубликат")?"duplicate":String(value).startsWith("OCR")?"warn":"";return '<span class="status '+cls+'">'+escapeHtml(value)+'</span>';}
      return escapeHtml(value);
    }
    function render(name){
      active=name;tabs.forEach(tab=>tab.classList.toggle("active",tab.dataset.tab===name));
      const isDashboard=name==="Дашборд";dashboard.hidden=!isDashboard;sheet.hidden=isDashboard;search.hidden=isDashboard;csv.hidden=isDashboard;
      if(isDashboard)return;
      const source=DATA.sheets[name], headers=source.headers;currentRows=source.rows.map(row=>[...row]);
      document.querySelector("#sheet-title").textContent=name;document.querySelector("#sheet-meta").textContent=currentRows.length+" строк · "+headers.length+" столбцов";
      thead.innerHTML="<tr>"+headers.map((header,index)=>'<th data-column="'+index+'">'+escapeHtml(header)+'</th>').join("")+"</tr>";
      drawRows();search.value="";
    }
    function drawRows(){
      const source=DATA.sheets[active], query=search.value.trim().toLocaleLowerCase("ru");
      const editable=active==="Новые пакеты";
      tbody.innerHTML=currentRows.filter(row=>!query||row.join(" ").toLocaleLowerCase("ru").includes(query)).map((row,rowIndex)=>"<tr>"+row.map((value,index)=>'<td '+(editable?'contenteditable="true" data-key="'+rowIndex+":"+index+'"':"")+'>'+cellHtml(value,source.headers[index])+"</td>").join("")+"</tr>").join("");
      if(editable)restoreEdits();
    }
    tabs.forEach(tab=>tab.addEventListener("click",()=>render(tab.dataset.tab)));search.addEventListener("input",drawRows);
    thead.addEventListener("click",event=>{const th=event.target.closest("th");if(!th)return;const index=Number(th.dataset.column);sortAsc=sortColumn===index?!sortAsc:true;sortColumn=index;currentRows.sort((a,b)=>{const left=a[index]??"",right=b[index]??"";const value=typeof left==="number"&&typeof right==="number"?left-right:String(left).localeCompare(String(right),"ru",{numeric:true});return sortAsc?value:-value});drawRows();});
    csv.addEventListener("click",()=>{const source=DATA.sheets[active];const esc=value=>{const text=String(value??"");return /[;"\\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text};const text="\\ufeff"+[source.headers,...currentRows].map(row=>row.map(esc).join(";")).join("\\n");const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));link.download=active.replaceAll(" ","_")+".csv";link.click();URL.revokeObjectURL(link.href);});
    const storageKey="simple-quiz-intelligence-telegram-packages";
    function restoreEdits(){let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||"{}")}catch{};tbody.querySelectorAll("[contenteditable]").forEach(cell=>{if(Object.hasOwn(saved,cell.dataset.key))cell.textContent=saved[cell.dataset.key];cell.addEventListener("input",()=>{saved[cell.dataset.key]=cell.textContent;localStorage.setItem(storageKey,JSON.stringify(saved))})});}
  </script>
</body>
</html>`;

await fs.writeFile("outputs/Simple_Quiz_Intelligence_with_Telegram_offline.html", html);
await fs.writeFile("Simple_Quiz_Intelligence_v1_offline.html", html);
console.log("offline HTML written");
