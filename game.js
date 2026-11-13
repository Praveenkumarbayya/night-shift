/* NIGHT SHIFT - game engine. No dependencies. */
(() => {
"use strict";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => n.toLocaleString("en-US");

const TECH_IDS = Object.keys(TECH);
const NIGHT_TITLES = ["First night on the desk", "Something in the mail", "Borrowed credentials", "Eyes on the domain controller", "The long night"];
const DECK_SIZE = [6, 7, 8, 9, 10], CARD_TIME = [40, 35, 30, 26, 22], TICK_MS = [1500, 1400, 1300, 1150, 1000];
const RANKS = [[0, "Intern"], [5, "Tier-1 Analyst"], [12, "Tier-2 Analyst"], [20, "Tier-3 Analyst"], [30, "Incident Lead"], [40, "Threat Hunter"]];

// ───────────── save ─────────────
const SAVE_KEY = "nightshift.v1";
const fresh = () => ({ night: 1, cards: {}, seen: {}, best: {}, sound: true });
let save = fresh();
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")); } catch (e) { /* storage unavailable */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
const cardCount = () => TECH_IDS.filter(id => save.cards[id]).length;
const rank = () => { const c = cardCount(); let r = RANKS[0][1]; for (const [n, name] of RANKS) if (c >= n) r = name; return r; };

// ───────────── audio ─────────────
let ac = null;
function tone(freq, dur, type = "sine", vol = 0.06, when = 0) {
  if (!save.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* audio unavailable */ }
}
const sfx = {
  card: () => tone(880, 0.07, "square", 0.03),
  tap: () => tone(1200, 0.04, "square", 0.025),
  good: () => { tone(660, 0.1, "triangle", 0.07); tone(990, 0.16, "triangle", 0.07, 0.08); },
  bad: () => { tone(160, 0.3, "sawtooth", 0.07); tone(110, 0.35, "sawtooth", 0.07, 0.08); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(740, 0.16, "square", 0.05, i * 0.36); tone(520, 0.16, "square", 0.05, i * 0.36 + 0.18); } },
  infect: () => tone(200, 0.2, "sawtooth", 0.06),
  shield: () => { tone(520, 0.08, "sine", 0.07); tone(780, 0.12, "sine", 0.07, 0.06); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, i * 0.11)),
  unlock: () => { tone(1320, 0.1, "sine", 0.05); tone(1760, 0.2, "sine", 0.05, 0.09); }
};

// ───────────── rain ─────────────
const rainCv = $("rain"), rainCx = rainCv.getContext("2d");
let drops = [];
function sizeRain() {
  rainCv.width = innerWidth; rainCv.height = innerHeight;
  const n = Math.round(innerWidth / 9);
  drops = Array.from({ length: n }, (_, i) => ({ x: Math.random() * (innerWidth + 120), s: 0.5 + Math.random(), o: Math.random() * innerHeight }));
}
addEventListener("resize", sizeRain); sizeRain();
function drawRain(t) {
  const W = rainCv.width, H = rainCv.height;
  rainCx.clearRect(0, 0, W, H);
  rainCx.strokeStyle = "rgba(160,190,255,.35)"; rainCx.lineWidth = 1; rainCx.beginPath();
  for (const d of drops) {
    const y = (d.o + t * 0.55 * d.s) % (H + 40) - 40, x = d.x - y * 0.12;
    rainCx.moveTo(x, y); rainCx.lineTo(x - 2.4 * d.s, y + 16 * d.s);
  }
  rainCx.stroke();
}

// ───────────── helpers ─────────────
let screen = "title";
function show(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === "s-" + name));
  screen = name;
}
let typeTimer = 0;
function typeInto(el, msg) {
  clearInterval(typeTimer); el.textContent = ""; let i = 0;
  typeTimer = setInterval(() => { el.textContent = msg.slice(0, ++i); if (i >= msg.length) clearInterval(typeTimer); }, 22);
}
let toastTimer = 0;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800); }
function shake() { const a = $("app"); a.classList.remove("shake"); void a.offsetWidth; a.classList.add("shake"); }
const techCardHTML = (id, locked) => {
  const t = TECH[id];
  return `<div class="tcard${locked ? " locked" : ""}" data-tech="${id}"><div class="id">${id}</div><div class="ic">${locked ? "❔" : t.icon}</div>` +
    `<div class="nm">${locked ? "Not yet caught" : esc(t.name)}</div><div class="tac">${esc(t.tactic)}</div></div>`;
};

// ───────────── title ─────────────
function renderTitle() {
  const endless = save.night > 5;
  $("btn-start").textContent = endless ? `OVERTIME · NIGHT ${save.night}` : `START NIGHT ${save.night}`;
  $("codex-count").textContent = cardCount();
  $("rank-name").textContent = rank();
  $("btn-sound").textContent = save.sound ? "🔊 SOUND ON" : "🔇 SOUND OFF";
  const chips = $("night-chips"); chips.innerHTML = "";
  for (let n = 1; n < Math.min(save.night, 6); n++) {
    const b = document.createElement("button");
    b.textContent = `REPLAY N${n}` + (save.best[n] ? ` · ${fmt(save.best[n])}` : "");
    b.onclick = () => briefing(n);
    chips.appendChild(b);
  }
  show("title");
}

// ───────────── briefing ─────────────
let pendingNight = 1;
function briefing(n) {
  pendingNight = n;
  $("brief-kicker").textContent = n > 5 ? `OVERTIME · NIGHT ${n}` : `NIGHT ${n} OF 5`;
  $("brief-title").textContent = n > 5 ? "No end in sight" : NIGHT_TITLES[n - 1];
  const rules = n === 1 ? [
    `<b>Read the alert.</b> Real attack? <b class="g">CONTAIN →</b> (swipe right). Normal activity? <b>← FALSE ALARM</b> (swipe left).`,
    `<b class="r">Miss a real attack</b> and the threat meter rises. Fill it and the ransomware spreads.`,
    `<b class="a">Contain something innocent</b> and you disrupt the hospital. Three disruptions and you're off the desk.`,
    `<b>Bonus:</b> tap the one line that gives it away before you decide.`
  ] : n === 5 ? [
    `<b>${DECK_SIZE[4]} alerts, ${CARD_TIME[4]} seconds each.</b> The hardest look-alikes are in tonight's queue.`,
    `<b class="r">VESPER detonates at the end of the shift</b> no matter what. Be ready to isolate hosts.`
  ] : [
    `<b>${n > 5 ? 10 : DECK_SIZE[n - 1]} alerts, ${n > 5 ? 18 : CARD_TIME[n - 1]} seconds each.</b> New techniques tonight, and new false alarms that look just like them.`,
    `Same tool, different story: <b>check the parent process, the source and the flags.</b>`
  ];
  $("brief-rules").innerHTML = rules.map(r => `<li>${r}</li>`).join("");
  show("brief");
  typeInto($("brief-typed"), n > 5 ? VESPER.endless : VESPER.intro[n - 1]);
}

// ───────────── run state ─────────────
let run = null;
function buildDeck(n) {
  const size = n > 5 ? 10 : DECK_SIZE[n - 1], nBad = Math.ceil(size * 0.6), cap = Math.min(n, 5);
  const take = (bad, count) => ALERTS.filter(a => a.bad === bad && a.tier <= cap)
    .map(a => ({ a, w: (n <= 5 && a.tier === n ? 2 : 0) + (save.seen[a.id] ? 0 : 1) + Math.random() }))
    .sort((x, y) => y.w - x.w).slice(0, count).map(x => x.a);
  return shuffle([...take(true, nBad), ...take(false, size - nBad)]);
}
function startNight(n) {
  const idx = Math.min(n, 5) - 1;
  run = { night: n, deck: buildDeck(n), i: -1, score: 0, combo: 0, threat: 0, strikes: 0, results: [], newCards: [],
    total: (n > 5 ? 18 : CARD_TIME[idx]) * 1000, left: 0, phase: "idle", picked: -1, correct: 0, clues: 0, outbreaks: 0, finalDone: false, rtSum: 0 };
  $("hud-night").textContent = `NIGHT ${n}`;
  show("play");
  updateHud();
  nextCard();
}
function updateHud() {
  $("score").textContent = fmt(run.score);
  $("combo").textContent = run.combo >= 2 ? `×${run.combo}` : "";
  document.querySelectorAll("#threat i").forEach((el, i) => { el.className = i < run.threat ? "on" + (run.threat >= 3 ? " hot" : "") : ""; });
  document.querySelectorAll("#strikes i").forEach((el, i) => { el.className = i < run.strikes ? "on" : ""; });
  const done = Math.max(0, run.i), mins = Math.round(60 + (done / run.deck.length) * 300);
  $("clock").textContent = String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
  $("progress").textContent = `${Math.min(run.i + 1, run.deck.length)} / ${run.deck.length}`;
}

// ───────────── card ─────────────
const card = $("card");
function nextCard() {
  run.i++;
  if (run.i >= run.deck.length) {
    if (run.night === 5 && !run.finalDone) return outbreak(true);
    return endNight();
  }
  const a = run.deck[run.i];
  run.picked = -1; run.left = run.total; run.phase = "card";
  card.className = "sev-" + a.sev + " in";
  card.style.transition = "none"; card.style.transform = ""; card.style.opacity = "1"; card.scrollTop = 0;
  $("sev").textContent = "● " + (a.sev === "CRIT" ? "CRITICAL" : a.sev === "MED" ? "MEDIUM" : a.sev);
  $("src").textContent = a.src;
  $("card-title").textContent = a.title;
  $("card-host").textContent = a.host;
  $("card-lines").innerHTML = a.lines.map(([k, v], i) => `<div class="ln" data-i="${i}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
  $("card-hint").textContent = run.night === 1 && run.i < 2 ? "Tap the line that gives it away for a bonus" : "";
  $("debrief").classList.remove("show");
  updateHud(); sfx.card();
}
function pickClue(i) {
  if (run.phase !== "card") return;
  run.picked = run.picked === i ? -1 : i;
  document.querySelectorAll("#card-lines .ln").forEach((el, j) => el.classList.toggle("picked", j === run.picked));
  sfx.tap();
}
function decide(action) {
  if (!run || run.phase !== "card") return;
  run.phase = "debrief";
  const a = run.deck[run.i];
  const correct = action !== "timeout" && (a.bad === (action === "contain"));
  const clueOK = run.picked === a.clue;
  let pts = 0, stampText, stampColor, vesper = "";

  if (correct) {
    run.combo++; run.correct++;
    if (clueOK) run.clues++;
    run.rtSum += run.total - run.left;
    pts = Math.round((100 + 60 * (run.left / run.total) + (clueOK ? 50 : 0)) * (1 + Math.min(run.combo - 1, 5) * 0.1));
    run.score += pts;
    stampText = a.bad ? "CONTAINED" : "CLEARED"; stampColor = a.bad ? "var(--green)" : "var(--blue)";
    if (a.bad && !save.cards[a.tech]) { save.cards[a.tech] = 1; run.newCards.push(a.tech); }
    sfx.good();
  } else {
    run.combo = 0;
    if (a.bad) {
      run.threat = Math.min(5, run.threat + (a.sev === "CRIT" ? 2 : 1));
      stampText = action === "timeout" ? "TOO SLOW" : "MISSED"; stampColor = "var(--red)";
      vesper = pick(VESPER.miss);
    } else if (action === "contain") {
      run.strikes++; stampText = "DISRUPTION"; stampColor = "var(--amber)";
      vesper = pick(VESPER.disrupt);
    } else { stampText = "TOO SLOW"; stampColor = "var(--dim)"; }
    sfx.bad(); shake();
  }
  run.results.push(correct ? "🟩" : action === "timeout" ? "⬛" : "🟥");
  save.seen[a.id] = 1; persist();

  // card exit + stamp
  card.classList.remove("in", "go-left", "go-right");
  card.style.transition = "transform .45s cubic-bezier(.6,0,.9,.4), opacity .45s";
  if (action === "contain") card.style.transform = "translate(520px,-40px) rotate(24deg)";
  else if (action === "dismiss") card.style.transform = "translate(-520px,-40px) rotate(-24deg)";
  const st = $("stamp"); st.textContent = stampText; st.style.color = stampColor;
  st.classList.remove("show"); void st.offsetWidth; st.classList.add("show");

  // reveal the tell, bring card back for study
  setTimeout(() => {
    card.style.transition = "transform .3s cubic-bezier(.2,.9,.25,1)"; card.style.transform = "translateY(-6%) scale(.96)";
    document.querySelectorAll("#card-lines .ln").forEach((el, j) => {
      if (j === a.clue) el.classList.add("tell");
      else if (j === run.picked) el.classList.add("wrong");
    });
    const db = $("debrief");
    db.classList.toggle("bad", !correct);
    $("db-verdict").textContent = correct ? "✓ Good call" : action === "timeout" ? "✗ Out of time" : "✗ Wrong call";
    $("db-points").textContent = correct ? `+${pts}` + (run.combo >= 2 ? ` · combo ×${run.combo}` : "") : "";
    const tr = $("db-truth");
    tr.className = "db-truth" + (a.bad ? " threat" : "");
    tr.textContent = a.bad ? `REAL THREAT · ${a.tech} ${TECH[a.tech].name.toUpperCase()}` : "FALSE POSITIVE · NORMAL ACTIVITY";
    $("db-why").textContent = a.why;
    $("db-clue").textContent = clueOK ? (correct ? "🔎 You spotted the tell: +50" : "🔎 You found the right line, but drew the wrong conclusion")
      : `🔎 The tell: "${a.lines[a.clue][0]}" (highlighted)`;
    $("db-vesper").textContent = vesper ? `◆ VESPER: ${vesper}` : "";
    const last = run.i === run.deck.length - 1;
    $("btn-next").textContent = run.strikes >= 3 || run.threat >= 5 ? "CONTINUE →" : last ? "END OF SHIFT →" : "NEXT ALERT →";
    db.scrollTop = 0; db.classList.add("show");
    updateHud();
  }, 620);
}
function afterDebrief() {
  if (!run || run.phase !== "debrief" || !$("debrief").classList.contains("show")) return;
  $("debrief").classList.remove("show");
  if (run.strikes >= 3) return fail("disruption");
  if (run.threat >= 5) return outbreak(false);
  nextCard();
}

// swipe + tap
let drag = null;
card.addEventListener("pointerdown", e => {
  if (!run || run.phase !== "card") return;
  drag = { x: e.clientX, dx: 0, moved: false, line: e.target.closest(".ln") };
  try { card.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  card.classList.remove("in"); card.style.transition = "none";
});
card.addEventListener("pointermove", e => {
  if (!drag) return;
  drag.dx = e.clientX - drag.x;
  if (Math.abs(drag.dx) > 8) drag.moved = true;
  if (!drag.moved) return;
  card.style.transform = `translate(${drag.dx}px,${Math.abs(drag.dx) * 0.04}px) rotate(${drag.dx * 0.05}deg)`;
  card.classList.toggle("go-right", drag.dx > 70); card.classList.toggle("go-left", drag.dx < -70);
});
function endDrag(cancelled) {
  if (!drag) return;
  const d = drag; drag = null;
  if (!cancelled && !d.moved && d.line) return pickClue(+d.line.dataset.i);
  if (!cancelled && Math.abs(d.dx) > 90) return decide(d.dx > 0 ? "contain" : "dismiss");
  card.classList.remove("go-left", "go-right");
  card.style.transition = "transform .25s cubic-bezier(.2,.9,.25,1)"; card.style.transform = "";
}
card.addEventListener("pointerup", () => endDrag(false));
card.addEventListener("pointercancel", () => endDrag(true));

// ───────────── outbreak minigame ─────────────
const NODES = [["DC-01", 180, 60], ["EHR-DB", 80, 140], ["PACS", 280, 140], ["WS-114", 170, 190], ["BILLING", 60, 250], ["ICU-MON", 300, 255], ["BACKUP", 180, 290]];
const EDGES = [[0, 1], [0, 2], [1, 4], [1, 3], [2, 3], [2, 5], [3, 6], [4, 6], [5, 6]];
let ob = null;
function outbreak(final) {
  run.phase = "outbreak"; run.outbreaks++;
  if (final) run.finalDone = true;
  const start = rand(NODES.length);
  ob = { st: NODES.map((_, i) => (i === start ? 1 : 0)), shields: 3, final, over: false, timer: 0,
    tick: TICK_MS[Math.min(run.night, 5) - 1] - (final ? 150 : 0) };
  $("net").innerHTML =
    EDGES.map(([a, b], i) => `<line id="e${i}" x1="${NODES[a][1]}" y1="${NODES[a][2]}" x2="${NODES[b][1]}" y2="${NODES[b][2]}"/>`).join("") +
    NODES.map(([name, x, y], i) => `<text x="${x}" y="${i < 3 ? y - 28 : y + 38}">${name}</text><circle class="node" id="n${i}" cx="${x}" cy="${y}" r="19"/>` +
      `<circle class="hit" data-i="${i}" cx="${x}" cy="${y}" r="30"/>`).join("");
  $("ob-label").textContent = final ? "⚠ VESPER'S FINAL MOVE" : "⚠ RANSOMWARE SPREADING";
  $("ob-sub").textContent = "Tap clean hosts to pull them off the network before it reaches them";
  $("ob-result").textContent = ""; $("ob-result").className = "ob-result";
  $("btn-ob-next").classList.remove("show");
  $("s-outbreak").classList.add("alarm");
  show("outbreak"); drawOutbreak(); sfx.alarm(); shake();
  typeInto($("ob-typed"), final ? "saved the best for last. say goodbye to halcyon." : VESPER.outbreak);
  ob.timer = setTimeout(spread, 2400);
}
const frontier = () => { const out = []; for (const [a, b] of EDGES) { if (ob.st[a] === 1 && ob.st[b] === 0) out.push(b); if (ob.st[b] === 1 && ob.st[a] === 0) out.push(a); } return out; };
function drawOutbreak() {
  ob.st.forEach((s, i) => { $("n" + i).setAttribute("class", "node" + (s === 1 ? " inf" : s === 2 ? " iso" : "")); });
  EDGES.forEach(([a, b], i) => { const hot = (ob.st[a] === 1 && ob.st[b] === 0) || (ob.st[b] === 1 && ob.st[a] === 0); $("e" + i).setAttribute("class", hot ? "hot" : ""); });
  $("ob-shields").textContent = "ISOLATIONS LEFT  " + "🛡️".repeat(ob.shields) + "▫️".repeat(3 - ob.shields);
}
function spread() {
  if (ob.over) return;
  const f = frontier();
  if (!f.length) return endOutbreak();
  ob.st[pick(f)] = 1; sfx.infect(); drawOutbreak();
  if (!frontier().length) return endOutbreak();
  ob.timer = setTimeout(spread, ob.tick);
}
$("net").addEventListener("pointerdown", e => {
  const i = e.target.dataset && e.target.dataset.i;
  if (i === undefined || !ob || ob.over || ob.shields <= 0 || ob.st[+i] !== 0) return;
  ob.st[+i] = 2; ob.shields--; sfx.shield(); drawOutbreak();
  if (!frontier().length) endOutbreak();
});
function endOutbreak() {
  if (ob.over) return;
  ob.over = true; clearTimeout(ob.timer);
  $("s-outbreak").classList.remove("alarm");
  const safe = ob.st.filter(s => s !== 1).length;
  ob.win = safe >= 4; ob.safe = safe;
  const r = $("ob-result");
  if (ob.win) {
    run.score += safe * 40; r.className = "ob-result ok"; r.textContent = `✓ SPREAD STOPPED · ${safe}/7 SAFE · +${safe * 40}`; sfx.win();
    typeInto($("ob-typed"), safe >= 6 ? "...how did you cut me off that fast?" : "you saved some. i kept the rest.");
  } else {
    r.className = "ob-result ko"; r.textContent = `✗ ${7 - safe}/7 HOSTS ENCRYPTED`; sfx.bad(); shake();
    typeInto($("ob-typed"), "check your inbox. the ransom note is in there.");
  }
  $("ob-sub").textContent = ob.win ? "Segmenting the network buys time. Speed is everything." : "Once it's moving, every second costs a host.";
  $("btn-ob-next").classList.add("show");
}
function afterOutbreak() {
  if (!ob || !ob.over) return;
  if (!ob.win) return fail("breach");
  if (ob.final) return endNight();
  run.threat = 2; show("play"); nextCard();
}

// ───────────── end states ─────────────
function shareText(survived) {
  const lines = ["NIGHT SHIFT 🌙 " + (survived ? `Night ${run.night} survived` : `Night ${run.night} — breached`),
    run.results.join(""), `Score ${fmt(run.score)} · ${rank()} · ${cardCount()}/40 ATT&CK techniques`];
  if (location.protocol.startsWith("http")) lines.push(location.origin + location.pathname);
  return lines.join("\n");
}
function endNight() {
  run.phase = "done";
  const n = run.night, first = save.night === n;
  save.best[n] = Math.max(save.best[n] || 0, run.score);
  if (first) save.night = n + 1;
  persist();
  const avg = run.correct ? (run.rtSum / run.correct / 1000).toFixed(1) : "–";
  $("sum-kicker").textContent = n > 5 ? `OVERTIME · NIGHT ${n}` : `NIGHT ${n} OF 5`;
  $("sum-title").textContent = n === 5 ? "HALCYON SAVED" : "SHIFT SURVIVED";
  $("sum-grid").textContent = run.results.join("");
  $("sum-stats").innerHTML = `score <b>${fmt(run.score)}</b>${save.best[n] === run.score && run.score ? " · best" : ""}<br>` +
    `<b>${run.correct}/${run.deck.length}</b> correct · <b>${run.clues}</b> tells spotted · avg <b>${avg}s</b><br>rank <b>${rank()}</b> · <b>${cardCount()}/40</b> techniques`;
  $("sum-cards").innerHTML = run.newCards.length
    ? `<div class="newlabel">NEW TECHNIQUE CARDS</div>` + run.newCards.map(id => techCardHTML(id, false)).join("")
    : "";
  $("sum-cards").querySelectorAll(".tcard").forEach((el, i) => { el.style.animationDelay = (0.25 + i * 0.12) + "s"; });
  $("btn-sum-next").textContent = n === 5 ? "OVERTIME: NIGHT 6 →" : `NIGHT ${n + 1} →`;
  show("summary"); sfx.win();
  if (run.newCards.length) setTimeout(sfx.unlock, 500);
  typeInto($("sum-typed"), n === 5 ? VESPER.finale : VESPER.win);
}
function fail(reason) {
  run.phase = "done"; persist();
  $("fail-ic").textContent = reason === "breach" ? "💀" : "📵";
  $("fail-title").textContent = reason === "breach" ? "HALCYON IS DOWN" : "TAKEN OFF THE DESK";
  $("fail-text").textContent = reason === "breach"
    ? "The ransomware outran you. Ambulances are being diverted and the board is on the phone. Real incidents go this way when alerts get dismissed."
    : "Three disruptions in one shift. You isolated healthy systems that staff needed for patient care. In a real SOC, false containments cost trust just like missed attacks do.";
  $("fail-grid").textContent = run.results.join("");
  show("fail");
}

// ───────────── codex ─────────────
let codexBack = "title";
function openCodex(from) {
  codexBack = from;
  $("codex-sub").textContent = `${cardCount()}/40 caught · contain an attack to unlock its card`;
  $("codex-grid").innerHTML = TECH_IDS.map(id => techCardHTML(id, !save.cards[id])).join("");
  show("codex");
}
function openTech(id) {
  if (!save.cards[id]) return toast("Contain this technique in the wild to unlock it");
  const t = TECH[id];
  $("modal-card").innerHTML = `<div class="id">${id}</div><div class="ic">${t.icon}</div><h3>${esc(t.name)}</h3><div class="tac">${esc(t.tactic)}</div>` +
    `<h4>WHAT IT IS</h4><p>${esc(t.what)}</p><h4>HOW TO SPOT IT</h4><p>${esc(t.detect)}</p>` +
    `<a href="https://attack.mitre.org/techniques/${id.replace(".", "/")}/" target="_blank" rel="noopener">Read on attack.mitre.org ↗</a>` +
    `<button class="btn" id="modal-close">CLOSE</button>`;
  $("modal").classList.add("on");
  $("modal-close").onclick = () => $("modal").classList.remove("on");
  sfx.tap();
}
document.addEventListener("click", e => { const c = e.target.closest(".tcard[data-tech]"); if (c) openTech(c.dataset.tech); });
$("modal").addEventListener("click", e => { if (e.target === $("modal")) $("modal").classList.remove("on"); });

// ───────────── wiring ─────────────
$("btn-start").onclick = () => briefing(save.night);
$("btn-begin").onclick = () => startNight(pendingNight);
$("btn-dismiss").onclick = () => decide("dismiss");
$("btn-contain").onclick = () => decide("contain");
$("btn-next").onclick = afterDebrief;
$("btn-ob-next").onclick = afterOutbreak;
$("btn-sum-next").onclick = () => briefing(run.night + 1);
$("btn-sum-menu").onclick = renderTitle;
$("btn-sum-codex").onclick = () => openCodex("summary");
$("btn-retry").onclick = () => briefing(run.night);
$("btn-fail-menu").onclick = renderTitle;
$("btn-codex").onclick = () => openCodex("title");
$("btn-codex-back").onclick = () => (codexBack === "summary" ? show("summary") : renderTitle());
$("btn-sound").onclick = () => { save.sound = !save.sound; persist(); renderTitle(); sfx.tap(); };
$("btn-reset").onclick = () => { if (confirm("Erase all progress and collected technique cards?")) { save = fresh(); persist(); renderTitle(); } };
$("btn-share").onclick = async () => {
  const text = shareText(true);
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast("Result copied — paste it anywhere"); }
  } catch (e) { toast("Couldn't share from this browser"); }
};

addEventListener("keydown", e => {
  if ($("modal").classList.contains("on")) { if (e.key === "Escape" || e.key === "Enter") $("modal").classList.remove("on"); return; }
  const k = e.key.toLowerCase(), go = k === "enter" || k === " ";
  if (screen === "play" && run) {
    if (run.phase === "card") {
      if (k === "arrowleft" || k === "a") decide("dismiss");
      else if (k === "arrowright" || k === "d") decide("contain");
      else if (k >= "1" && k <= "9" && +k <= run.deck[run.i].lines.length) pickClue(+k - 1);
    } else if (go) afterDebrief();
  } else if (go) {
    e.preventDefault();
    if (screen === "title") $("btn-start").click();
    else if (screen === "brief") $("btn-begin").click();
    else if (screen === "outbreak") afterOutbreak();
    else if (screen === "summary") $("btn-sum-next").click();
    else if (screen === "fail") $("btn-retry").click();
  }
});

// ───────────── main loop ─────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(100, now - lastT); lastT = now;
  drawRain(now);
  if (run && run.phase === "card" && screen === "play" && !document.hidden) {
    run.left -= dt;
    const k = Math.max(0, run.left / run.total), bar = $("timer-bar");
    bar.style.transform = `scaleX(${k})`; bar.classList.toggle("low", k < 0.25);
    if (run.left <= 0) decide("timeout");
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__ns = { get run() { return run; }, get save() { return save; }, decide, afterDebrief, startNight, outbreak, ALERTS, TECH };
renderTitle();
})();
