// ===================== Builder file CBT.html hasil generate =====================
// buildCbtHtml(config, soalList) -> string (dokumen HTML lengkap, mandiri/offline)
import type { SoalParsed } from './cbtParser';

export interface CbtConfig {
  judul: string;
  instansi: string;
  durasiMenit: number | string;
  acakSoal: boolean;
  acakOpsi: boolean;
  scriptUrl: string;
}

function esc(s: any) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildCbtHtml(config: CbtConfig, soalList: SoalParsed[]) {
  // Susun data soal final utk engine (index array, bukan huruf, supaya gampang acak)
  const soalData = soalList.filter(s => s.valid).map((s, i) => {
    const base: any = {
      id: i,
      tipe: s.tipe.toLowerCase(), // pg | pgk | isian | essay
      tanya: s.tanya,
      gambar: s.gambar || [],
      pembahasan: s.pembahasan || ''
    };
    if (s.tipe === 'PG' || s.tipe === 'PGK') {
      base.opsi = s.opsi.map(o => ({ teks: o.teks, gambar: o.gambar || [] }));
      base.kunci = s.opsi.map((o, idx) => o.benar ? idx : -1).filter(idx => idx >= 0);
    } else if (s.tipe === 'ISIAN') {
      base.kunci = s.kunciIsian;
    }
    return base;
  });

  const soalJson = JSON.stringify(soalData).replace(/</g, '\\u003c');
  const cfgJson = JSON.stringify({
    judul: config.judul || 'Ujian CBT',
    instansi: config.instansi || '',
    durasiMenit: Number(config.durasiMenit) || 60,
    acakSoal: !!config.acakSoal,
    acakOpsi: !!config.acakOpsi,
    scriptUrl: config.scriptUrl || ''
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(config.judul || 'Ujian CBT')}</title>
<style>
${CBT_CSS}
</style>
</head>
<body>
<div id="app">

  <!-- LOGIN -->
  <section id="screen-login" class="screen">
    <div class="box login-box">
      <div class="login-logo">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="4" width="19" height="13" rx="2" stroke="white" stroke-width="1.6"/><path d="M8.5 20.5H15.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M12 17V20.5" stroke="white" stroke-width="1.6"/><path d="M7 12.2L9.8 9.4L11.8 11.4L17 6" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h1>${esc(config.judul || 'Ujian CBT')}</h1>
      ${config.instansi ? `<p class="sub">${esc(config.instansi)}</p>` : ''}
      <label>Nama Lengkap<input type="text" id="inp-nama" placeholder="Nama kamu"></label>
      <label>Asal Sekolah<input type="text" id="inp-sekolah" placeholder="Nama sekolah"></label>
      <div id="login-err" class="err"></div>
      <button class="btn-primary" id="btn-login">Mulai Ujian</button>
      <p class="meta">${soalData.length} soal &middot; ${Number(config.durasiMenit) || 60} menit</p>
    </div>
  </section>

  <!-- TEST -->
  <section id="screen-test" class="screen hidden">
    <div class="test-top">
      <div class="timer" id="test-timer">00:00</div>
      <div class="test-judul">${esc(config.judul || 'Ujian CBT')}</div>
    </div>
    <div class="nav-grid" id="nav-grid"></div>
    <div class="soal-card" id="soal-card"></div>
    <div class="test-actions">
      <button id="btn-prev">&larr; Sebelumnya</button>
      <button id="btn-next">Selanjutnya &rarr;</button>
      <button id="btn-finish" class="btn-primary hidden">Selesai Ujian</button>
    </div>
  </section>

  <!-- RESULT -->
  <section id="screen-result" class="screen hidden">
    <div class="box">
      <h2>Hasil Ujian</h2>
      <div class="nilai-besar" id="res-nilai-ring"><span id="res-nilai">-</span></div>
      <div class="res-detail">
        <span class="ok">✓ Benar: <b id="res-benar">0</b></span>
        <span class="partial">± Sebagian: <b id="res-parsial">0</b></span>
        <span class="bad">✗ Salah/Kosong: <b id="res-salah">0</b></span>
      </div>
      <p id="res-essay-note" class="warn hidden">Ada soal essay yang dinilai manual oleh guru — nilai belum termasuk skor essay.</p>
      <div id="kirim-status" class="meta"></div>
      <button class="btn-primary" id="btn-review">Lihat Pembahasan</button>
      <button id="btn-download-bukti">Unduh Bukti Hasil (.txt)</button>
    </div>
  </section>

  <!-- REVIEW -->
  <section id="screen-review" class="screen hidden">
    <div class="test-top">
      <button id="btn-review-back">&larr; Kembali</button>
      <div class="test-judul">Pembahasan</div>
    </div>
    <div class="review-list" id="review-list"></div>
  </section>

</div>
<script>
const CONFIG = ${cfgJson};
const SOAL = ${soalJson};
${CBT_ENGINE_JS}
</script>
</body>
</html>`;
}

const CBT_CSS = `
:root{--brand:#4338ca;--brand-2:#6366f1;--brand-d:#312e81;--brand-tint:#eef2ff;--ok:#059669;--ok-tint:#ecfdf5;--bad:#dc2626;--bad-tint:#fef2f2;--warn:#d97706;--warn-tint:#fffbeb;--bg:#eef1f8;--line:#e2e8f0;--ink:#0f172a;--sub:#64748b;--radius-lg:16px;--radius-md:10px;--shadow-md:0 4px 16px -4px rgba(49,46,129,.12),0 2px 6px -2px rgba(15,23,42,.06);}
*{box-sizing:border-box;}
html{-webkit-font-smoothing:antialiased;}
body{margin:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,system-ui,sans-serif;background:var(--bg);color:var(--ink);letter-spacing:-.1px;}
.hidden{display:none !important;}
.screen{min-height:100vh;padding:24px 20px;}
#screen-login{display:flex;align-items:center;background:radial-gradient(circle at 20% 15%,#e0e4fb 0,var(--bg) 55%);}
.box{max-width:440px;margin:40px auto;background:#fff;border:1px solid var(--line);border-radius:var(--radius-lg);padding:32px 30px;text-align:center;box-shadow:var(--shadow-md);}
.login-logo{width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:linear-gradient(135deg,var(--brand-2),var(--brand-d));display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px -4px rgba(67,56,202,.5);}
.login-logo svg{width:28px;height:28px;}
.box h1{font-size:19px;margin:0 0 4px;font-weight:800;letter-spacing:-.2px;}
.box .sub{color:var(--sub);font-size:13px;margin:0 0 20px;}
.box label{display:block;text-align:left;font-size:12.5px;font-weight:700;margin-bottom:12px;color:#334155;}
.box input[type=text]{width:100%;padding:11px 12px;border:1.5px solid var(--line);border-radius:9px;font-size:14px;margin-top:6px;font-family:inherit;transition:.15s;}
.box input[type=text]:focus{outline:none;border-color:var(--brand-2);box-shadow:0 0 0 3px rgba(99,102,241,.14);}
.err{color:var(--bad);font-size:12.5px;min-height:16px;margin-bottom:6px;font-weight:600;}
button{cursor:pointer;border:none;border-radius:9px;font-weight:700;font-size:14px;padding:12px 18px;background:#fff;border:1.5px solid var(--line);font-family:inherit;transition:.15s;color:var(--ink);}
.btn-primary{background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;width:100%;border:none;box-shadow:0 4px 14px -3px rgba(67,56,202,.45);}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 20px -4px rgba(67,56,202,.5);}
.btn-primary:active{transform:translateY(0);}
.meta{color:var(--sub);font-size:12.5px;margin-top:16px;font-weight:600;}
.test-top{max-width:780px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.timer{font-weight:800;font-size:17px;font-variant-numeric:tabular-nums;background:#fff;border:1.5px solid var(--line);border-radius:10px;padding:9px 16px;box-shadow:var(--shadow-md);color:var(--brand-d);}
.timer.low{color:var(--bad);border-color:#fecaca;background:var(--bad-tint);}
.test-judul{font-weight:700;color:var(--sub);font-size:13.5px;}
.nav-grid{max-width:780px;margin:0 auto 16px;display:flex;flex-wrap:wrap;gap:7px;}
.nav-dot{width:34px;height:34px;border-radius:9px;background:#fff;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--sub);transition:.15s;}
.nav-dot:hover{border-color:var(--brand-2);}
.nav-dot.cur{border-color:var(--brand);color:#fff;background:linear-gradient(135deg,var(--brand-2),var(--brand));box-shadow:0 3px 10px -2px rgba(67,56,202,.5);}
.nav-dot.done{background:var(--brand-tint);color:var(--brand-d);border-color:#c7d2fe;}
.soal-card{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:var(--radius-lg);padding:26px 28px;min-height:200px;box-shadow:var(--shadow-md);}
.soal-no{font-size:12px;font-weight:800;letter-spacing:.03em;color:var(--brand-d);margin-bottom:10px;background:var(--brand-tint);display:inline-block;padding:4px 11px;border-radius:999px;}
.hint-tipe{font-size:12.5px;color:var(--sub);margin-bottom:12px;font-style:italic;}
.tanya{font-size:16px;line-height:1.65;margin-bottom:16px;color:var(--ink);}
.tanya img,.opsi img{max-width:100%;border-radius:10px;margin-top:10px;display:block;}
.opsi-list{display:flex;flex-direction:column;gap:9px;}
.opsi{border:1.5px solid var(--line);border-radius:11px;padding:12px 15px;cursor:pointer;font-size:14.5px;display:flex;gap:11px;align-items:flex-start;transition:.15s;}
.opsi:hover{border-color:var(--brand-2);background:#fafbff;}
.opsi.sel{border-color:var(--brand);background:var(--brand-tint);}
.opsi input{margin-top:3px;accent-color:var(--brand);}
.isian-input{width:100%;padding:13px 14px;border:1.5px solid var(--line);border-radius:11px;font-size:15px;font-family:inherit;transition:.15s;}
.isian-input:focus{outline:none;border-color:var(--brand-2);box-shadow:0 0 0 3px rgba(99,102,241,.14);}
textarea.essay-input{width:100%;min-height:140px;padding:13px 14px;border:1.5px solid var(--line);border-radius:11px;font-size:14.5px;font-family:inherit;resize:vertical;transition:.15s;}
textarea.essay-input:focus{outline:none;border-color:var(--brand-2);box-shadow:0 0 0 3px rgba(99,102,241,.14);}
.test-actions{max-width:780px;margin:18px auto 0;display:flex;justify-content:space-between;gap:10px;}
.nilai-besar{width:120px;height:120px;margin:6px auto 16px;border-radius:50%;background:conic-gradient(var(--brand-2) calc(var(--nilai,0)*1%),var(--line) 0);display:flex;align-items:center;justify-content:center;position:relative;}
.nilai-besar::after{content:'';position:absolute;inset:8px;border-radius:50%;background:#fff;z-index:0;}
.nilai-besar span{position:relative;z-index:1;font-size:34px;font-weight:800;color:var(--brand-d);}
.res-detail{display:flex;justify-content:center;gap:16px;font-size:13.5px;flex-wrap:wrap;margin-bottom:12px;font-weight:600;}
.res-detail .ok{color:var(--ok);} .res-detail .partial{color:var(--warn);} .res-detail .bad{color:var(--bad);}
.warn{color:var(--warn);font-size:12.5px;font-weight:600;}
.review-list{max-width:780px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
.rev-item{background:#fff;border:1px solid var(--line);border-radius:var(--radius-md);padding:20px 22px;border-left:5px solid var(--sub);box-shadow:var(--shadow-md);}
.rev-item.ok{border-left-color:var(--ok);}
.rev-item.bad{border-left-color:var(--bad);}
.rev-item.partial{border-left-color:var(--warn);}
.rev-item.manual{border-left-color:var(--brand-2);}
.rev-status{font-size:11.5px;font-weight:800;margin-bottom:8px;letter-spacing:.03em;text-transform:uppercase;}
.rev-jwb{font-size:13.5px;margin-top:10px;background:#f8fafc;padding:10px 12px;border-radius:9px;}
.rev-pemb{font-size:13.5px;margin-top:10px;color:var(--sub);line-height:1.55;}
@media(max-width:600px){.test-actions{flex-wrap:wrap;} .box{margin:20px auto;padding:26px 22px;} }
`;

const CBT_ENGINE_JS = `
const \$ = sel => document.querySelector(sel);
const W = { pg:1, pgk:2, isian:2 };
const SCRIPT_URL_KEY = 'cbt_gen_script_url';

const state = { nama:'', sekolah:'', soal:[], jawaban:[], idx:0, timerId:null, sisaDetik:0, hasil:null };

function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function normJwb(s){ return String(s||'').trim().toLowerCase().replace(/\\s+/g,' ').replace(',', '.').replace(/\\.\$/,''); }
function renderGambar(list){ return (list||[]).map(src => \`<img src="\${src}">\`).join(''); }

function showScreen(name){
  ['login','test','result','review'].forEach(n => \$('#screen-'+n).classList.toggle('hidden', n!==name));
  window.scrollTo(0,0);
}

\$('#btn-login').addEventListener('click', () => {
  const nama = \$('#inp-nama').value.trim();
  const sekolah = \$('#inp-sekolah').value.trim();
  if(!nama || !sekolah){ \$('#login-err').textContent = 'Nama dan asal sekolah wajib diisi.'; return; }
  state.nama = nama; state.sekolah = sekolah;
  startTest();
});

function startTest(){
  let soal = SOAL.map(s => ({...s}));
  if(CONFIG.acakSoal) soal = shuffle(soal);
  if(CONFIG.acakOpsi){
    soal = soal.map(s => {
      if(s.tipe !== 'pg' && s.tipe !== 'pgk') return s;
      const order = shuffle(s.opsi.map((_,i)=>i));
      const opsi = order.map(i => s.opsi[i]);
      const kunci = s.kunci.map(k => order.indexOf(k));
      return {...s, opsi, kunci};
    });
  }
  state.soal = soal;
  state.jawaban = soal.map(s => s.tipe==='pgk' ? [] : null);
  state.idx = 0;
  state.sisaDetik = CONFIG.durasiMenit * 60;
  showScreen('test');
  renderNavGrid();
  renderSoal();
  startTimer();
}

function startTimer(){
  clearInterval(state.timerId);
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    state.sisaDetik--;
    updateTimerDisplay();
    if(state.sisaDetik <= 0){ clearInterval(state.timerId); finishTest(true); }
  }, 1000);
}
function updateTimerDisplay(){
  const mm = Math.floor(state.sisaDetik/60), ss = state.sisaDetik%60;
  const t = \$('#test-timer');
  t.textContent = \`\${String(mm).padStart(2,'0')}:\${String(ss).padStart(2,'0')}\`;
  t.classList.toggle('low', state.sisaDetik <= 300);
}

function renderNavGrid(){
  const nav = \$('#nav-grid');
  nav.innerHTML = '';
  state.soal.forEach((s,i) => {
    const dot = document.createElement('div');
    dot.className = 'nav-dot' + (i===state.idx?' cur':'') + (isAnswered(i)?' done':'');
    dot.textContent = i+1;
    dot.addEventListener('click', () => { state.idx=i; renderNavGrid(); renderSoal(); });
    nav.appendChild(dot);
  });
}
function isAnswered(i){
  const s = state.soal[i], j = state.jawaban[i];
  if(s.tipe==='pg') return j!=null;
  if(s.tipe==='pgk') return Array.isArray(j) && j.length>0;
  if(s.tipe==='isian') return !!(j && String(j).trim());
  if(s.tipe==='essay') return !!(j && String(j).trim());
  return false;
}

function renderSoal(){
  const s = state.soal[state.idx];
  const card = \$('#soal-card');
  let html = \`<div class="soal-no">Soal \${state.idx+1} / \${state.soal.length}</div>\`;
  html += \`<div class="tanya">\${s.tanya}\${renderGambar(s.gambar)}</div>\`;

  if(s.tipe==='pg'){
    html += '<div class="hint-tipe">Pilih satu jawaban yang paling tepat.</div><div class="opsi-list">';
    s.opsi.forEach((o,i) => {
      const sel = state.jawaban[state.idx]===i ? 'sel' : '';
      html += \`<label class="opsi \${sel}"><input type="radio" name="jw" \${state.jawaban[state.idx]===i?'checked':''}><span>\${String.fromCharCode(65+i)}. \${o.teks}\${renderGambar(o.gambar)}</span></label>\`;
    });
    html += '</div>';
  } else if(s.tipe==='pgk'){
    html += '<div class="hint-tipe">Bisa lebih dari satu jawaban benar. Centang semua yang menurutmu tepat.</div><div class="opsi-list">';
    s.opsi.forEach((o,i) => {
      const checked = (state.jawaban[state.idx]||[]).includes(i);
      html += \`<label class="opsi \${checked?'sel':''}"><input type="checkbox" data-i="\${i}" \${checked?'checked':''}><span>\${o.teks}\${renderGambar(o.gambar)}</span></label>\`;
    });
    html += '</div>';
  } else if(s.tipe==='isian'){
    html += '<div class="hint-tipe">Tulis jawaban singkat pada kolom di bawah ini.</div>';
    html += \`<input type="text" class="isian-input" id="isian-inp" value="\${state.jawaban[state.idx]?escapeHtml(state.jawaban[state.idx]):''}" placeholder="Jawabanmu...">\`;
  } else if(s.tipe==='essay'){
    html += '<div class="hint-tipe">Jawaban akan dinilai manual oleh guru.</div>';
    html += \`<textarea class="essay-input" id="essay-inp" placeholder="Tulis jawabanmu di sini...">\${state.jawaban[state.idx]?escapeHtml(state.jawaban[state.idx]):''}</textarea>\`;
  }

  card.innerHTML = html;
  attachSoalEvents(s);
  updateNavButtons();
}

function attachSoalEvents(s){
  if(s.tipe==='pg'){
    const opsiEls = \$('#soal-card').querySelectorAll('.opsi');
    opsiEls.forEach((lbl,i) => lbl.addEventListener('click', () => {
      state.jawaban[state.idx] = i;
      opsiEls.forEach((el2,j) => { el2.classList.toggle('sel', j===i); const r=el2.querySelector('input'); if(r) r.checked=(j===i); });
      renderNavGrid();
    }));
  } else if(s.tipe==='pgk'){
    \$('#soal-card').querySelectorAll('.opsi input').forEach(inp => inp.addEventListener('change', () => {
      const i = +inp.dataset.i;
      let arr = state.jawaban[state.idx] || [];
      arr = inp.checked ? [...new Set([...arr,i])] : arr.filter(v=>v!==i);
      state.jawaban[state.idx] = arr;
      inp.closest('.opsi').classList.toggle('sel', inp.checked);
      renderNavGrid();
    }));
  } else if(s.tipe==='isian'){
    const inp = \$('#isian-inp');
    inp.addEventListener('input', () => { state.jawaban[state.idx]=inp.value; renderNavGrid(); });
  } else if(s.tipe==='essay'){
    const inp = \$('#essay-inp');
    inp.addEventListener('input', () => { state.jawaban[state.idx]=inp.value; renderNavGrid(); });
  }
}

function updateNavButtons(){
  \$('#btn-prev').disabled = state.idx===0;
  \$('#btn-prev').style.opacity = state.idx===0 ? .5 : 1;
  const last = state.idx === state.soal.length-1;
  \$('#btn-next').classList.toggle('hidden', last);
  \$('#btn-finish').classList.toggle('hidden', !last);
}
\$('#btn-prev').addEventListener('click', () => { if(state.idx>0){ state.idx--; renderNavGrid(); renderSoal(); } });
\$('#btn-next').addEventListener('click', () => { if(state.idx<state.soal.length-1){ state.idx++; renderNavGrid(); renderSoal(); } });
\$('#btn-finish').addEventListener('click', () => {
  const kosong = state.soal.filter((_,i)=>!isAnswered(i)).length;
  const ok = kosong===0 || confirm(\`Masih ada \${kosong} soal belum dijawab. Yakin selesai?\`);
  if(ok) finishTest(false);
});

function scoreSoal(s,j){
  if(s.tipe==='pg') return { skor: j===s.kunci[0] ? W.pg : 0, max:W.pg, status: j===s.kunci[0]?'ok':(j==null?'kosong':'bad') };
  if(s.tipe==='pgk'){
    const kunci=[...s.kunci].sort((a,b)=>a-b), jwb=[...(j||[])].sort((a,b)=>a-b);
    const match = kunci.length===jwb.length && kunci.every((v,i)=>v===jwb[i]);
    return { skor: match?W.pgk:0, max:W.pgk, status: match?'ok':((j||[]).length===0?'kosong':'bad') };
  }
  if(s.tipe==='isian'){
    const accepted = s.kunci.map(normJwb);
    const match = j && accepted.includes(normJwb(j));
    return { skor: match?W.isian:0, max:W.isian, status: match?'ok':(j?'bad':'kosong') };
  }
  if(s.tipe==='essay') return { skor:0, max:0, status: j?'manual':'kosong' };
  return { skor:0, max:0, status:'kosong' };
}

function finishTest(timeUp){
  clearInterval(state.timerId);
  let totalSkor=0, totalMax=0, benarPenuh=0, parsial=0, salahKosong=0, adaEssay=false;
  const detail = state.soal.map((s,i) => {
    const r = scoreSoal(s, state.jawaban[i]);
    totalSkor += r.skor; totalMax += r.max;
    if(s.tipe==='essay') adaEssay = true;
    if(r.status==='ok') benarPenuh++;
    else if(r.status==='partial') parsial++;
    else if(r.status!=='manual') salahKosong++;
    return { soal:s, jawaban: state.jawaban[i], ...r };
  });
  const nilai = totalMax>0 ? Math.round((totalSkor/totalMax)*100) : 0;
  state.hasil = { detail, nilai, benarPenuh, parsial, salahKosong, timeUp, adaEssay };
  renderResult();
  showScreen('result');
  kirimHasilKeServer(nilai);
}

function renderResult(){
  const h = state.hasil;
  \$('#res-nilai').textContent = h.nilai;
  \$('#res-nilai-ring').style.setProperty('--nilai', h.nilai);
  \$('#res-benar').textContent = h.benarPenuh;
  \$('#res-parsial').textContent = h.parsial;
  \$('#res-salah').textContent = h.salahKosong;
  \$('#res-essay-note').classList.toggle('hidden', !h.adaEssay);
}

function kirimHasilKeServer(nilai){
  const url = CONFIG.scriptUrl;
  const statusEl = \$('#kirim-status');
  if(!url){ statusEl.textContent = ''; return; }
  statusEl.textContent = 'Mengirim hasil ke guru...';
  const essayJawaban = state.hasil.detail.filter(d => d.soal.tipe==='essay').map((d,i) => ({ soal:d.soal.tanya, jawaban:d.jawaban||'' }));
  fetch(url, {
    method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'},
    body: JSON.stringify({ nama: state.nama, sekolah: state.sekolah, judul: CONFIG.judul, nilai, waktuHabis: state.hasil.timeUp, essay: essayJawaban, waktu: new Date().toISOString() })
  }).then(() => { statusEl.textContent = '✓ Hasil terkirim ke guru.'; })
    .catch(() => { statusEl.textContent = 'Gagal mengirim hasil (periksa koneksi/URL).'; });
}

\$('#btn-download-bukti').addEventListener('click', () => {
  const h = state.hasil;
  const lines = [
    'BUKTI HASIL UJIAN',
    CONFIG.judul,
    'Nama: ' + state.nama, 'Sekolah: ' + state.sekolah,
    'Nilai: ' + h.nilai, 'Waktu: ' + new Date().toLocaleString('id-ID')
  ];
  const blob = new Blob([lines.join('\\n')], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = \`bukti-\${state.nama.replace(/\\s+/g,'_')}.txt\`;
  a.click();
});

\$('#btn-review').addEventListener('click', () => { renderReview(); showScreen('review'); });
\$('#btn-review-back').addEventListener('click', () => showScreen('result'));

function renderReview(){
  const list = \$('#review-list');
  list.innerHTML = '';
  state.hasil.detail.forEach((d,i) => {
    const s = d.soal;
    const cls = d.status==='ok'?'ok':d.status==='partial'?'partial':d.status==='manual'?'manual':'bad';
    const box = document.createElement('div');
    box.className = 'rev-item ' + cls;
    let statusLbl = d.status==='ok'?'✓ Benar':d.status==='partial'?'± Sebagian Benar':d.status==='manual'?'✎ Menunggu Penilaian Guru':(d.status==='kosong'?'– Tidak Dijawab':'✗ Salah');
    let html = \`<div class="rev-status">\${statusLbl}</div><div class="soal-no">Soal \${i+1}</div><div class="tanya">\${s.tanya}\${renderGambar(s.gambar)}</div>\`;

    if(s.tipe==='pg'){
      html += '<div class="opsi-list">' + s.opsi.map((o,idx) => {
        let style = '';
        if(s.kunci.includes(idx)) style=' style="border-color:var(--ok);background:#f0fdf4;"';
        else if(idx===d.jawaban) style=' style="border-color:var(--bad);background:#fef2f2;"';
        return \`<div class="opsi"\${style}>\${String.fromCharCode(65+idx)}. \${o.teks}</div>\`;
      }).join('') + '</div>';
    } else if(s.tipe==='pgk'){
      const jwb = d.jawaban||[];
      html += '<div class="opsi-list">' + s.opsi.map((o,idx) => {
        const isKunci = s.kunci.includes(idx), isJwb = jwb.includes(idx);
        let style = isKunci ? ' style="border-color:var(--ok);background:#f0fdf4;"' : (isJwb ? ' style="border-color:var(--bad);background:#fef2f2;"' : '');
        return \`<div class="opsi"\${style}>\${isJwb?'☑':'☐'} \${o.teks}</div>\`;
      }).join('') + '</div>';
    } else if(s.tipe==='isian'){
      html += \`<div class="rev-jwb"><b>Jawabanmu:</b> \${d.jawaban?escapeHtml(d.jawaban):'(kosong)'} &nbsp;|&nbsp; <b>Kunci:</b> \${s.kunci.join(' / ')}</div>\`;
    } else if(s.tipe==='essay'){
      html += \`<div class="rev-jwb"><b>Jawabanmu:</b><br>\${d.jawaban?escapeHtml(d.jawaban):'(kosong)'}</div>\`;
    }
    if(s.pembahasan) html += \`<div class="rev-pemb"><b>Pembahasan:</b> \${s.pembahasan}</div>\`;
    box.innerHTML = html;
    list.appendChild(box);
  });
}
`;
