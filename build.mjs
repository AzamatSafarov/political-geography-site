// Build the course site into site/.
// One command, no dependencies: node build.mjs
import fs from "node:fs";
import path from "node:path";
import {
  loadRings, worldLandPath, horizonPath, worldGraticule, regionalPlate,
  normalizeBbox, worldMarkers, formatBounds, WORLD_H, WORLD_W,
} from "./src/map.mjs";

const ROOT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(ROOT, "site");
const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content.json"), "utf8"));
const geo = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "data", "ne_110m_land.geojson"), "utf8"));
const rings = loadRings(geo);
const { meta, hero, aim, principles, seminars, assessment, methodology, artifacts_page, faq } = content;

const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const shortFormat = new Map(methodology.formats.map((f) => [f.name, f.short]));
const readingCount = seminars.reduce((n, s) => n + s.reading.length, 0);

// ---------------------------------------------------------------- maps

const TAG_SIDE = { 1: "right", 2: "up", 3: "left", 4: "right", 5: "down", 6: "down", 7: "right", 8: "left" };

function worldPlate(root) {
  const marks = worldMarkers(seminars);
  const pins = marks.map((m) => {
    const s = seminars[m.n - 1];
    return `<a class="pin pin--${TAG_SIDE[m.n]}" style="--x:${m.x.toFixed(2)}%;--y:${m.y.toFixed(2)}%" href="${root}seminars/${s.slug}.html" data-n="${m.n}" aria-label="Семинар ${pad(m.n)}. ${e(s.place)}. ${e(s.title)}"><span class="pin-dot"></span><span class="pin-tag" aria-hidden="true">${pad(m.n)}</span></a>`;
  }).join("\n      ");

  return `<figure class="plate plate--world">
  <figcaption class="plate-bar"><span>Съёмка 00 · Мир</span><span>Проекция Робинсона · сетка 30°</span></figcaption>
  <div class="world-stage" role="group" aria-label="Карта мира с восемью точками семинаров">
    <svg viewBox="0 0 ${WORLD_W} ${WORLD_H.toFixed(2)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path class="m-horizon" d="${horizonPath()}"/>
      <path class="m-grat" d="${worldGraticule()}"/>
      <path class="m-land" d="${worldLandPath(rings)}"/>
    </svg>
    ${pins}
  </div>
  <div class="plate-bar plate-bar--foot"><span>${e(hero.plate_caption)}</span><span>8 точек · 8 семинаров</span></div>
</figure>`;
}

function regionalPlateHTML(s, root) {
  const { bbox, fixed } = normalizeBbox(s);
  if (fixed) console.warn(`bbox ${s.slug}: source frame adjusted to contain marker -> ${bbox.join(",")}`);
  const p = regionalPlate(rings, bbox, s.marker);
  const ar = p.ratio.toFixed(4);
  const html = `<figure class="plate plate--region" style="--ar:${ar}">
  <figcaption class="plate-bar"><span>Кадр ${pad(s.n)} · ${e(s.place)}</span><span>${e(s.coords)}</span></figcaption>
  <div class="stage" style="--ar:${ar};aspect-ratio:${ar}" role="img" aria-label="Региональная карта. ${e(s.place)}. Координаты ${e(s.coords)}. Рамка ${e(formatBounds(bbox)).replace(/\.$/, "")}.">
    <svg viewBox="${p.viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path class="m-grat" d="${p.grat}"/>
      <path class="m-land" d="${p.land}"/>
      <path class="m-frame" d="${p.frame}"/>
    </svg>
    <span class="pin pin--site" style="--x:${p.marker.x.toFixed(3)}%;--y:${p.marker.y.toFixed(3)}%"><span class="pin-dot"></span></span>
  </div>
  <div class="plate-bar plate-bar--foot"><span>${e(formatBounds(bbox))}</span><span>Робинсон · сетка ${p.lonStep}° / ${p.latStep}°</span></div>
</figure>`;
  return { html, portrait: p.ratio < 1 };
}

// ---------------------------------------------------------------- layout

const NAV = [
  ["", "Главная", "home"],
  ["course.html", "Дисциплина", "discipline"],
  ["seminars/index.html", "Семинары", "seminars"],
  ["method.html", "Методика", "methodology"],
  ["artifacts.html", "Артефакты", "artifacts"],
  ["reading.html", "Литература", "literature"],
];

function header(root, active) {
  const links = NAV.map(([href, label, key]) => {
    const cur = key === active ? ' aria-current="page"' : "";
    return `<a href="${root}${href}"${cur}>${label}</a>`;
  }).join("");
  return `<header class="masthead">
  <div class="wrap masthead-in">
    <a class="brand" href="${root}">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name">${e(meta.title)}</span>
      <span class="brand-meta">${e(meta.year)}</span>
    </a>
    <nav class="nav" aria-label="Основная навигация">${links}</nav>
  </div>
</header>`;
}

function footer(root) {
  const links = NAV.map(([href, label]) => `<a href="${root}${href}">${label}</a>`).join("");
  return `<footer class="footer">
  <div class="wrap footer-in">
    <div class="footer-brand">
      <p class="f-title">${e(meta.title)}</p>
      <p class="f-sub">${e(meta.subtitle)}</p>
    </div>
    <nav class="footer-nav" aria-label="Навигация в подвале">${links}</nav>
    <dl class="footer-meta">
      <div><dt>Подразделение</dt><dd>${e(meta.institution)}</dd></div>
      <div><dt>Семестр</dt><dd>${e(meta.semester)}</dd></div>
      <div><dt>Аудитория</dt><dd>${e(meta.audience)}</dd></div>
    </dl>
    <p class="colophon">Карты: Natural Earth 110m, проекция Робинсона. Шрифты: Golos Text, Literata, IBM Plex Mono. Собрано из content.json.</p>
  </div>
</footer>`;
}

function layout({ root = "/", active = "", title, description, body, pageClass = "" }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${e(meta.title)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}assets/fonts.css">
<link rel="stylesheet" href="${root}assets/styles.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body${pageClass ? ` class="${pageClass}"` : ""}>
<a class="skip" href="#main">Перейти к содержанию</a>
${header(root, active)}
<main id="main">
${body}
</main>
${footer(root)}
<script src="${root}assets/app.js" defer></script>
</body>
</html>`;
}

function pageHead({ plate, label, title, lead, alt = false }) {
  return `<header class="page-head wrap${alt ? " page-head--alt" : ""}">
  <p class="kicker mono"><span class="tick" aria-hidden="true"></span>${plate}${label ? ` · ${label}` : ""}</p>
  <h1>${title}</h1>
  ${lead ? `<p class="lead measure">${lead}</p>` : ""}
</header>`;
}

function secHead(num, label, title, opts = {}) {
  return `<div class="sec-head${opts.wide ? " sec-head--wide" : ""}">
  <p class="mono sec-label"><span class="tick" aria-hidden="true"></span>${num} / ${label}</p>
  <h2>${title}</h2>
  ${opts.intro ? `<p class="sec-intro measure">${opts.intro}</p>` : ""}
</div>`;
}

// ---------------------------------------------------------------- shared pieces

function seminarCard(s, root) {
  return `<a class="card" href="${root}seminars/${s.slug}.html" data-format="${e(s.format_key)}">
  <span class="card-top"><span class="mono">${pad(s.n)}</span><span class="mono">${e(s.week)}</span></span>
  <h3>${e(s.title)}</h3>
  <p class="card-short">${e(s.short)}</p>
  <span class="card-foot"><span class="tag">${e(shortFormat.get(s.format) || s.format)}</span><span class="mono">${e(s.place)}</span></span>
</a>`;
}

function assessmentTable() {
  const rows = assessment.rows.map((r) => `<tr>
      <td data-label="Компонент"><span class="score-name">${e(r.component)}</span></td>
      <td data-label="Вес" class="score-weight"><span>${e(r.weight)}</span><i aria-hidden="true" style="--w:${Number(r.weight)}%"></i></td>
      <td data-label="Что оценивается" class="score-detail">${e(r.detail)}</td>
    </tr>`).join("\n    ");
  return `<table class="score">
  <caption class="sr-only">Оценивание на 100 баллов</caption>
  <thead><tr><th scope="col">Компонент</th><th scope="col">Вес</th><th scope="col">Что оценивается</th></tr></thead>
  <tbody>
    ${rows}
  </tbody>
  <tfoot><tr><td>Итого</td><td class="score-weight">100</td><td></td></tr></tfoot>
</table>`;
}

function scoreBar() {
  return `<div class="score-bar" aria-hidden="true">${assessment.rows.map((r) => `<span style="--w:${Number(r.weight)}%" title="${e(r.component)}: ${e(r.weight)}"></span>`).join("")}</div>`;
}

function qaList(items) {
  return items.map((item, i) => `<details class="qa"${i === 0 ? " open" : ""}>
  <summary><span class="qa-q">${e(item.q)}</span><span class="qa-mark" aria-hidden="true"></span></summary>
  <div class="qa-a"><p>${e(item.a)}</p></div>
</details>`).join("\n");
}

function sourceItem(r, i) {
  const link = r.link
    ? `<a class="src-open" href="${e(r.link)}" target="_blank" rel="noopener">Открыть источник <span aria-hidden="true">↗</span></a>`
    : `<span class="src-lib">в библиотеке</span>`;
  return `<li class="source">
  <span class="src-n mono" aria-hidden="true">${pad(i + 1)}</span>
  <div class="src-body">
    <h4>${e(r.author)}. ${e(r.title)}</h4>
    <p class="src-meta mono">${e(r.year)} · ${e(r.note)}</p>
    <p class="src-ann">${e(r.annotation)}</p>
    <p class="src-link">${link}</p>
  </div>
</li>`;
}

function readingBlock(s) {
  return `<ol class="sources">${s.reading.map(sourceItem).join("")}</ol>`;
}

function pager(s, root) {
  const prev = s.n > 1 ? seminars[s.n - 2] : null;
  const next = s.n < seminars.length ? seminars[s.n] : null;
  const prevHref = prev ? `${root}seminars/${prev.slug}.html` : `${root}seminars/index.html`;
  const nextHref = next ? `${root}seminars/${next.slug}.html` : `${root}seminars/index.html`;
  return `<nav class="pager" aria-label="Соседние семинары">
  <a class="pager-link pager-prev" href="${prevHref}">
    <span class="mono">${prev ? "Предыдущий" : "К списку"}</span>
    <b>${prev ? `${pad(prev.n)} · ${e(prev.title)}` : "Все семинары"}</b>
  </a>
  <a class="pager-link pager-next" href="${nextHref}">
    <span class="mono">${next ? "Следующий" : "К списку"}</span>
    <b>${next ? `${pad(next.n)} · ${e(next.title)}` : "Все семинары"}</b>
  </a>
</nav>`;
}

// ---------------------------------------------------------------- home

function homePage() {
  const stats = hero.stats.map((s) => `<div class="stat"><dt class="stat-value">${e(s.value)}</dt><dd class="stat-label">${e(s.label)}</dd></div>`).join("");
  const nots = aim.nots.map((n) => `<li>${e(n)}</li>`).join("");
  const principlesHTML = principles.map((p) => `<li class="principle">
      <span class="p-n mono" aria-hidden="true">${e(p.n)}</span>
      <h3>${e(p.title)}</h3>
      <p>${e(p.text)}</p>
    </li>`).join("");
  const cards = seminars.map((s) => seminarCard(s, "/")).join("\n    ");
  const atlasIndex = seminars.map((s) => `<li><a href="/seminars/${s.slug}.html" data-pin="${s.n}">
      <span class="ai-n mono">${pad(s.n)}</span>
      <span class="ai-place">${e(s.place)}</span>
      <span class="ai-title">${e(s.title)}</span>
      <span class="ai-arrow" aria-hidden="true">↗</span>
    </a></li>`).join("");
  const tacts = methodology.tacts.map((t) => `<li><span class="tact-time mono">${e(t.time)}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></li>`).join("");
  const scoreLegend = assessment.rows.map((r) => `<li><span class="mono">${e(r.weight)}</span>${e(r.component)}</li>`).join("");
  const tiles = [
    ["course.html", "Дисциплина", "Паспорт, ритм 90 минут, таблица оценивания, правила и вопросы."],
    ["seminars/index.html", "Семинары", "Восемь страниц: карта, вопрос, таймлайн, артефакт, источники."],
    ["method.html", "Методика", "Три такта, шкала ICAP, восемь форматов и точки отказа."],
    ["artifacts.html", "Артефакты", "Правила, анатомия репозитория и восемь слотов витрины."],
    ["reading.html", "Литература", `${readingCount} источника с аннотациями, по три на семинар.`],
  ].map(([href, title, text], i) => `<a class="tile" href="/${href}"><span class="tile-n mono">${pad(i + 1)}</span><h3>${title}</h3><p>${text}</p><span class="tile-arrow" aria-hidden="true">↗</span></a>`).join("");

  const body = `<section class="hero wrap">
  <div class="hero-head">
    <p class="kicker mono"><span class="tick" aria-hidden="true"></span>${e(meta.kicker)}</p>
    <h1>${e(meta.title)}</h1>
    <p class="hero-sub">${e(meta.subtitle)}</p>
  </div>
  <div class="hero-body">
    <div class="hero-copy measure">
      <p class="lead">${e(hero.lead)}</p>
      <p>${e(hero.thesis)}</p>
      <div class="actions">
        <a class="btn" href="/seminars/index.html">Восемь семинаров</a>
        <a class="btn btn--ghost" href="/course.html">Паспорт дисциплины</a>
      </div>
    </div>
    <dl class="stats">${stats}</dl>
  </div>
</section>

<section class="atlas wrap" aria-labelledby="atlas-title">
  <h2 class="sr-only" id="atlas-title">Карта восьми семинаров</h2>
  ${worldPlate("/")}
  <ol class="atlas-index">${atlasIndex}</ol>
</section>

<section class="section wrap" id="aim">
  ${secHead("01", "Зачем", e(aim.title))}
  <div class="aim-grid">
    <div class="aim-copy measure">${aim.body.map((p) => `<p>${e(p)}</p>`).join("")}</div>
    <ul class="nots">${nots}</ul>
  </div>
</section>

<section class="section wrap" id="principles">
  ${secHead("02", "Принципы", "Три принципа")}
  <ol class="principles">${principlesHTML}</ol>
</section>

<section class="section wrap" id="program">
  ${secHead("03", "Программа", "Восемь семинаров")}
  <div class="seminar-grid" id="seminar-grid">${cards}</div>
  <p class="more"><a class="text-link" href="/seminars/index.html">Все семинары с фильтром по формату <span aria-hidden="true">→</span></a></p>
</section>

<section class="section wrap" id="method">
  ${secHead("04", "Методика и оценивание", "Как устроены 90 минут")}
  <ol class="tacts">${tacts}</ol>
  <div class="score-teaser">
    <div class="score-teaser-copy">
      <p class="mono">${assessment.rows.reduce((n, r) => n + Number(r.weight), 0)} баллов</p>
      <p>${e(assessment.intro)}</p>
      <a class="text-link" href="/course.html#assessment">Таблица оценивания и правила <span aria-hidden="true">→</span></a>
    </div>
    <div class="score-teaser-viz">
      ${scoreBar()}
      <ul class="score-legend">${scoreLegend}</ul>
    </div>
  </div>
</section>

<section class="section wrap" id="explore">
  ${secHead("05", "Разделы", "Что ещё на сайте")}
  <div class="tiles">${tiles}</div>
</section>`;

  return layout({
    title: `${meta.title} · сайт дисциплины`,
    description: meta.description,
    active: "home",
    body,
    pageClass: "page-home",
  });
}

// ---------------------------------------------------------------- discipline

function disciplinePage() {
  const pass = [
    ["Название", meta.title],
    ["Подзаголовок", meta.subtitle],
    ["Объём", meta.hours_note],
    ["Длительность", meta.semester],
    ["Аудитория", meta.audience],
    ["Контактная работа", meta.contact],
    ["Подразделение", meta.institution],
    ["Язык", meta.lang],
    ["Год", meta.year],
  ].map(([k, v], i) => `<div class="pass-row${i === 0 ? " pass-row--lead" : ""}"><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("");

  const tacts = methodology.tacts.map((t, i) => `<li class="tact">
      <span class="tact-n mono" aria-hidden="true">${pad(i + 1)}</span>
      <div><span class="tact-time mono">${e(t.time)}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></div>
    </li>`).join("");

  const policy = assessment.policy.map((p) => `<li>${e(p)}</li>`).join("");

  const body = `${pageHead({ plate: "Плата 01", title: "Дисциплина", lead: e(meta.subtitle) })}

<section class="section wrap" id="passport">
  ${secHead("01", "Паспорт", "Паспорт дисциплины")}
  <dl class="passport">${pass}</dl>
</section>

<section class="section wrap" id="does">
  ${secHead("02", "Границы", "Что курс делает и чего не делает")}
  <div class="does-grid">
    <div class="measure">${aim.body.map((p) => `<p>${e(p)}</p>`).join("")}</div>
    <ul class="nots">${aim.nots.map((n) => `<li>${e(n)}</li>`).join("")}</ul>
  </div>
</section>

<section class="section wrap" id="rhythm">
  ${secHead("03", "Ритм", "90 минут, три такта")}
  <ol class="tact-list">${tacts}</ol>
</section>

<section class="section wrap" id="assessment">
  ${secHead("04", "Оценивание", "100 баллов")}
  <p class="sec-intro measure">${e(assessment.intro)}</p>
  ${assessmentTable()}
</section>

<section class="section wrap" id="rules">
  ${secHead("05", "Правила", "Три правила оценивания")}
  <ol class="rules">${policy}</ol>
</section>

<section class="section wrap" id="faq">
  ${secHead("06", "Вопросы", "Частые вопросы")}
  <div class="qa-list">${qaList(faq)}</div>
</section>`;

  return layout({
    title: `Дисциплина · ${meta.title}`,
    description: `${meta.title}: паспорт дисциплины, ритм 90 минут, оценивание на 100 баллов, правила и ответы на вопросы.`,
    active: "discipline",
    body,
  });
}

// ---------------------------------------------------------------- seminars index

function seminarsPage() {
  const seen = new Set();
  const chips = seminars.filter((s) => {
    if (seen.has(s.format_key)) return false;
    seen.add(s.format_key);
    return true;
  }).map((s) => {
    const label = shortFormat.get(s.format) || s.format;
    const count = seminars.filter((x) => x.format_key === s.format_key).length;
    return `<button class="chip" type="button" data-filter="${e(s.format_key)}" aria-pressed="false">${e(label)} <span class="chip-count">${count}</span></button>`;
  }).join("");
  const cards = seminars.map((s) => seminarCard(s, "/")).join("\n    ");

  const body = `${pageHead({ plate: "Плата 02", title: "Семинары", lead: e(hero.thesis) })}

<section class="section wrap" id="list">
  ${secHead("01", "Список", "Восемь семинаров")}
  <div class="filter js-only" role="group" aria-label="Фильтр по формату работы">
    <button class="chip chip--all is-on" type="button" data-filter="all" aria-pressed="true">Все <span class="chip-count">8</span></button>
    ${chips}
  </div>
  <p class="filter-status js-only mono" aria-live="polite">Показаны все 8 семинаров</p>
  <div class="seminar-grid" id="seminar-grid">${cards}</div>
  <p class="filter-empty js-only" hidden>В этом формате пока нет семинаров.</p>
</section>

<section class="section wrap" id="how">
  ${secHead("02", "Как читать", "Что на странице семинара")}
  <ol class="plain-list">
    <li><b>Кадр.</b> Региональная карта в той же проекции, что и карта мира: рамка, координаты, точка съёмки.</li>
    <li><b>Вопрос.</b> Один вопрос, на который семинар отвечает, и три пункта, которые закрепляются.</li>
    <li><b>90 минут.</b> Таймлайн по минутам, роли в комнате и объяснение, почему формат выбран именно такой.</li>
    <li><b>Артефакт.</b> Репозиторий, дерево файлов, критерии и дедлайн. Плюс что сделать до и после.</li>
    <li><b>Проверка.</b> Вопросы с раскрывающимися ответами и три источника с аннотациями.</li>
  </ol>
</section>`;

  return layout({
    title: `Семинары · ${meta.title}`,
    description: `Восемь семинаров дисциплины «${meta.title}»: форматы, карты, артефакты и литература.`,
    active: "seminars",
    body,
    root: "/",
  });
}

// ---------------------------------------------------------------- seminar page

function seminarPage(s) {
  const outcomes = s.outcomes.map((o, i) => `<li><span class="mono o-n" aria-hidden="true">${pad(i + 1)}</span><p>${e(o)}</p></li>`).join("");
  const timeline = s.timeline.map((t) => `<li>
      <span class="t-time mono">${e(t.t)}</span>
      <div class="t-body"><h4>${e(t.label)}</h4><p>${e(t.text)}</p></div>
    </li>`).join("");
  const segs = s.timeline.map((t) => {
    const m = t.t.match(/(\d+)\D+(\d+)/);
    const a = m ? Number(m[1]) : 0;
    const b = m ? Number(m[2]) : 0;
    const w = Math.max(0, b - a);
    return `<span style="--w:${(w / 90) * 100}%;--o:${(a / 90) * 100}%" title="${e(t.t)} · ${e(t.label)}"></span>`;
  }).join("");

  const tree = s.artifact.tree.map((line) => {
    const m = line.match(/^([^—]+)—\s*(.*)$/);
    const file = m ? m[1].trim() : line;
    const desc = m ? m[2] : "";
    return `<li><span class="file">${e(file)}</span>${desc ? `<span class="desc">${e(desc)}</span>` : ""}</li>`;
  }).join("");
  const criteria = s.artifact.criteria.map((c) => `<li>${e(c)}</li>`).join("");
  const before = s.before.map((b) => `<li>${e(b)}</li>`).join("");
  const checks = qaList(s.check);

  const plate = regionalPlateHTML(s, "/");

  const body = `<header class="page-head page-head--seminar wrap">
  <p class="kicker mono"><span class="tick" aria-hidden="true"></span>Кадр ${pad(s.n)} / 08 · ${e(s.week)} · ${e(s.format)}</p>
  <h1>${e(s.title)}</h1>
  <p class="lead measure">${e(s.short)}</p>
</header>

<section class="wrap seminar-atlas${plate.portrait ? " is-portrait" : ""}">
  ${plate.html}
  <dl class="data-strip">
    <div><dt>Место</dt><dd>${e(s.place)}</dd></div>
    <div><dt>Координаты</dt><dd>${e(s.coords)}</dd></div>
    <div><dt>Формат</dt><dd>${e(s.format)}</dd></div>
    <div><dt>Механизм</dt><dd>${e(s.mechanism)}</dd></div>
  </dl>
</section>

<section class="section wrap" id="question">
  ${secHead("01", "Вопрос", "Вопрос семинара")}
  <blockquote class="big-question"><p>${e(s.question)}</p></blockquote>
</section>

<section class="section wrap" id="outcomes">
  ${secHead("02", "Закрепляем", "Что закрепляем")}
  <ol class="outcomes">${outcomes}</ol>
  <div class="why">
    <p class="mono">Почему такой формат</p>
    <p class="measure">${e(s.why)}</p>
    <p class="mono why-note">${e(s.format_note)}</p>
  </div>
</section>

<section class="section wrap" id="timeline">
  ${secHead("03", "90 минут", "Таймлайн")}
  <div class="ruler" aria-hidden="true">${segs}</div>
  <p class="ruler-scale mono" aria-hidden="true"><span>0</span><span>30</span><span>60</span><span>90</span></p>
  <ol class="timeline">${timeline}</ol>
</section>

<section class="section wrap" id="roles">
  ${secHead("04", "Комната", "Роли в комнате")}
  <div class="roles">
    <p class="mono">30 студентов</p>
    <p>${e(s.roles)}</p>
  </div>
</section>

<section class="section wrap" id="artifact">
  ${secHead("05", "Артефакт", e(s.artifact.name))}
  <div class="artifact">
    <div class="artifact-head">
      <div>
        <p class="mono">Репозиторий</p>
        <p class="repo">${e(s.artifact.repo)}</p>
      </div>
      <div class="artifact-deadline">
        <p class="mono">Дедлайн</p>
        <p>${e(s.artifact.deadline)}</p>
      </div>
    </div>
    <p class="artifact-brief">${e(s.artifact.brief)}</p>
    <div class="artifact-cols">
      <div>
        <p class="mono">Дерево файлов</p>
        <ul class="tree">${tree}</ul>
      </div>
      <div>
        <p class="mono">Критерии</p>
        <ul class="criteria">${criteria}</ul>
      </div>
    </div>
  </div>
</section>

<section class="section wrap" id="around">
  ${secHead("06", "До и после", "До семинара и после")}
  <div class="around">
    <div class="around-col">
      <p class="mono">До семинара</p>
      <ol class="numbered">${before}</ol>
    </div>
    <div class="around-col">
      <p class="mono">После семинара</p>
      <p class="after-text">${e(s.after)}</p>
    </div>
  </div>
</section>

<section class="section wrap" id="check">
  ${secHead("07", "Проверь себя", "Вопросы к семинару")}
  <div class="qa-list">${checks}</div>
</section>

<section class="section wrap" id="reading">
  ${secHead("08", "Источники", "Три источника")}
  ${readingBlock(s)}
</section>

<div class="wrap">${pager(s, "/")}</div>`;

  return layout({
    root: "/",
    title: `${pad(s.n)}. ${s.title} · ${meta.title}`,
    description: `${s.title}. ${s.short} Семинар ${s.n} из 8, ${s.place}.`,
    active: "seminars",
    body,
    pageClass: "page-seminar",
    root: "/",
  });
}

// ---------------------------------------------------------------- methodology

function methodologyPage() {
  const tacts = methodology.tacts.map((t, i) => `<li class="tact">
      <span class="tact-n mono" aria-hidden="true">${pad(i + 1)}</span>
      <div><span class="tact-time mono">${e(t.time)}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></div>
    </li>`).join("");
  const levels = methodology.icap.levels.map((l) => `<li class="icap-level">
      <span class="icap-key" aria-hidden="true">${e(l.key)}</span>
      <h3>${e(l.name)}</h3>
      <p>${e(l.text)}</p>
      <span class="icap-share mono">${e(l.share)}</span>
    </li>`).join("");
  const formats = methodology.formats.map((f, i) => `<li class="format">
      <span class="format-n mono" aria-hidden="true">${pad(i + 1)}</span>
      <div class="format-body">
        <div class="format-head"><h3>${e(f.name)}</h3><span class="tag">${e(f.short)}</span></div>
        <p>${e(f.text)}</p>
        <p class="format-where mono">${e(f.where)}</p>
      </div>
    </li>`).join("");
  const neighbors = methodology.neighbors.items.map((n) => {
    const name = n.link
      ? `<a href="${e(n.link)}" target="_blank" rel="noopener">${e(n.name)} <span aria-hidden="true">↗</span></a>`
      : `<span>${e(n.name)}</span>`;
    return `<li class="neighbor">
      <div class="neighbor-head"><h3>${name}</h3><span class="mono">${e(n.org)}</span></div>
      <p><span class="mono">Берём.</span> ${e(n.take)}</p>
      <p><span class="mono">Чего нет.</span> ${e(n.gap)}</p>
    </li>`;
  }).join("");

  const body = `${pageHead({ plate: "Плата 03", title: "Методика", lead: e(methodology.lead) })}

<section class="section wrap" id="tacts">
  ${secHead("01", "Такты", "Вход, работа, фиксация")}
  <ol class="tact-list">${tacts}</ol>
</section>

<section class="section wrap" id="icap">
  ${secHead("02", "Шкала", e(methodology.icap.title))}
  <p class="sec-intro measure">${e(methodology.icap.text)}</p>
  <div class="icap-band" aria-hidden="true"><span>P</span><span>A</span><span>C</span><span>I</span></div>
  <ol class="icap-grid">${levels}</ol>
</section>

<section class="section wrap" id="formats">
  ${secHead("03", "Форматы", "Восемь форматов и где они ломаются")}
  <ol class="formats">${formats}</ol>
</section>

<section class="section wrap" id="thirty">
  ${secHead("04", "30 человек", "Правила для тридцати")}
  <div class="group-note"><p class="mono">Одна комната, один преподаватель</p><p>${e(methodology.group_note)}</p></div>
</section>

<section class="section wrap" id="neighbors">
  ${secHead("05", "Контекст", e(methodology.neighbors.title), { intro: e(methodology.neighbors.intro) })}
  <ol class="neighbors">${neighbors}</ol>
</section>`;

  return layout({
    title: `Методика · ${meta.title}`,
    description: "Три такта семинара, шкала ICAP, восемь форматов с точками отказа, правила для тридцати человек и соседи по жанру.",
    active: "methodology",
    body,
  });
}

// ---------------------------------------------------------------- artifacts

function artifactsPage() {
  const rules = artifacts_page.rules.map((r, i) => `<li><span class="mono" aria-hidden="true">${pad(i + 1)}</span><p>${e(r)}</p></li>`).join("");
  const anatomy = artifacts_page.anatomy.map((line) => {
    const m = line.match(/^([^—]+)—\s*(.*)$/);
    const file = m ? m[1].trim() : line;
    const desc = m ? m[2] : "";
    return `<li><span class="file">${e(file)}</span>${desc ? `<span class="desc">${e(desc)}</span>` : ""}</li>`;
  }).join("");
  const submit = artifacts_page.submit.map((s, i) => `<li><span class="mono" aria-hidden="true">${pad(i + 1)}</span><p>${e(s)}</p></li>`).join("");
  const slots = seminars.map((s) => `<a class="slot" href="/seminars/${s.slug}.html">
      <span class="slot-top mono"><span>Слот ${pad(s.n)}</span><span>${e(s.artifact.repo)}</span></span>
      <h3>${e(s.artifact.name)}</h3>
      <p>${e(s.title)}</p>
      <span class="slot-state">Слот пуст</span>
    </a>`).join("");

  const body = `${pageHead({ plate: "Плата 04", title: "Артефакты", lead: e(artifacts_page.lead) })}

<section class="section wrap" id="rules">
  ${secHead("01", "Правила", "Пять правил артефакта")}
  <ol class="rule-list">${rules}</ol>
</section>

<section class="section wrap" id="anatomy">
  ${secHead("02", "Анатомия", "Что лежит в репозитории")}
  <div class="anatomy">
    <p class="mono">Стандартное дерево</p>
    <ul class="tree tree--lg">${anatomy}</ul>
  </div>
</section>

<section class="section wrap" id="submit">
  ${secHead("03", "Сдача", "Как сдавать")}
  <ol class="rule-list">${submit}</ol>
</section>

<section class="section wrap" id="showcase">
  ${secHead("04", "Витрина", "Восемь слотов")}
  <div class="showcase-note">
    <p class="mono">Курс ещё не читался</p>
    <p class="measure">Витрина пустая: восемь слотов ниже отведены под первые работы. Заполнять их вымышленными проектами мы не стали. Пока в слоте только имя репозитория и название артефакта из программы.</p>
  </div>
  <div class="slots">${slots}</div>
</section>`;

  return layout({
    title: `Артефакты · ${meta.title}`,
    description: "Правила артефактов, анатомия репозитория и восемь пустых слотов витрины: курс ещё не читался.",
    active: "artifacts",
    body,
  });
}

// ---------------------------------------------------------------- literature

function literaturePage() {
  const groups = seminars.map((s) => `<section class="lit-group" id="s${s.n}">
    <div class="lit-head">
      <p class="mono">Семинар ${pad(s.n)} · ${e(s.week)}</p>
      <h2><a href="/seminars/${s.slug}.html">${e(s.title)} <span aria-hidden="true">↗</span></a></h2>
      <p class="mono lit-place">${e(s.place)}</p>
    </div>
    ${readingBlock(s)}
  </section>`).join("");

  const body = `${pageHead({ plate: "Плата 05", title: "Литература", lead: `${readingCount} источника, по три на каждый семинар. У каждого есть аннотация и пометка о доступе.` })}

<section class="section wrap" id="note">
  <p class="access-note"><span class="mono">Доступ.</span> Ссылка ведёт туда, где источник опубликован. Там, где ссылки нет, стоит «в библиотеке»: открытого доступа к изданию нет.</p>
</section>

<div class="wrap lit-list">${groups}</div>`;

  return layout({
    title: `Литература · ${meta.title}`,
    description: `Все ${readingCount} источника курса «${meta.title}» по семинарам, с аннотациями и пометкой о доступе.`,
    active: "literature",
    body,
  });
}

// ---------------------------------------------------------------- write

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "seminars"), { recursive: true });
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });

const pages = [
  ["index.html", homePage()],
  ["course.html", disciplinePage()],
  ["seminars/index.html", seminarsPage()],
  ["method.html", methodologyPage()],
  ["artifacts.html", artifactsPage()],
  ["reading.html", literaturePage()],
  ...seminars.map((s) => [`seminars/${s.slug}.html`, seminarPage(s)]),
];

for (const [file, html] of pages) {
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(OUT, "assets", "styles.css"));
fs.copyFileSync(path.join(ROOT, "src", "app.js"), path.join(OUT, "assets", "app.js"));
fs.copyFileSync(path.join(ROOT, "assets", "fonts.css"), path.join(OUT, "assets", "fonts.css"));
fs.copyFileSync(path.join(ROOT, "assets", "favicon.svg"), path.join(OUT, "favicon.svg"));
fs.mkdirSync(path.join(OUT, "assets", "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) {
  if (f.endsWith(".woff2")) fs.copyFileSync(path.join(ROOT, "assets", "fonts", f), path.join(OUT, "assets", "fonts", f));
}

const bytes = pages.reduce((n, [f]) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${pages.length} pages, ${(bytes / 1024).toFixed(1)} KB of HTML`);
for (const [file] of pages) console.log(" ", file);
