// ─────────────────────────────────────────────
// FIREBASE CONFIG
// Replace these values with your own Firebase project config.
// Get them from: Firebase Console → Project Settings → Your apps → SDK setup
// ─────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, doc, collection,
  onSnapshot, setDoc, deleteDoc, updateDoc, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmBZGFNsHK1PiOzxQZ1yCDy4vQ4vMoBVM",
  authDomain: "scius-gauntlet-scoreboard.firebaseapp.com",
  projectId: "scius-gauntlet-scoreboard",
  storageBucket: "scius-gauntlet-scoreboard.firebasestorage.app",
  messagingSenderId: "649976133799",
  appId: "1:649976133799:web:243ef1f4534a49a7b7c382"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─────────────────────────────────────────────
// LOCAL STATE  (kept in sync by Firestore listeners)
// ─────────────────────────────────────────────
let state = {
  players: [],  // sorted list of player names
  stations: [],  // sorted list of station names
  results: {}   // { stationName: { playerName: 'win' } }
};

let activeStation = null;

// ─────────────────────────────────────────────
// FIRESTORE REAL-TIME LISTENERS
// All devices receive live updates automatically.
// ─────────────────────────────────────────────
function startListeners() {
  onSnapshot(collection(db, 'players'), snap => {
    state.players = snap.docs.map(d => d.id).sort();
    render();
  });

  onSnapshot(collection(db, 'stations'), snap => {
    state.stations = snap.docs.map(d => d.id).sort();
    render();
  });

  // Each result doc id = station name; fields = { playerName: 'win' }
  onSnapshot(collection(db, 'results'), snap => {
    state.results = {};
    snap.docs.forEach(d => { state.results[d.id] = d.data(); });
    render();
  });
}

// ─────────────────────────────────────────────
// SETUP ACTIONS
// ─────────────────────────────────────────────
async function addPlayer() {
  const inp = document.getElementById('player-input');
  const name = inp.value.trim();
  if (!name) return;
  inp.value = '';
  await setDoc(doc(db, 'players', name), {});
}

async function removePlayer(name) {
  await deleteDoc(doc(db, 'players', name));
  for (const station of state.stations) {
    const updated = { ...(state.results[station] || {}) };
    delete updated[name];
    await setDoc(doc(db, 'results', station), updated);
  }
}

async function addStation() {
  const inp = document.getElementById('station-input');
  const name = inp.value.trim();
  if (!name) return;
  inp.value = '';
  await setDoc(doc(db, 'stations', name), {});
  await setDoc(doc(db, 'results', name), {});
}

async function removeStation(name) {
  await deleteDoc(doc(db, 'stations', name));
  await deleteDoc(doc(db, 'results', name));
}

// ─────────────────────────────────────────────
// RESULT ACTIONS
// ─────────────────────────────────────────────
async function recordWin(station, player) {
  const current = (state.results[station] || {})[player];
  if (current === 'win') return;
  await updateDoc(doc(db, 'results', station), { [player]: 'win' });
}

async function undoResult(station, player) {
  const updated = { ...(state.results[station] || {}) };
  delete updated[player];
  await setDoc(doc(db, 'results', station), updated);
}

// ─────────────────────────────────────────────
// RESET
// ─────────────────────────────────────────────
async function resetAll() {
  if (!confirm('Reset all scores and clear everything?')) return;
  const [pSnap, sSnap, rSnap] = await Promise.all([
    getDocs(collection(db, 'players')),
    getDocs(collection(db, 'stations')),
    getDocs(collection(db, 'results'))
  ]);
  const batch = writeBatch(db);
  pSnap.docs.forEach(d => batch.delete(d.ref));
  sSnap.docs.forEach(d => batch.delete(d.ref));
  rSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  activeStation = null;
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
function selectStation(name) {
  activeStation = name;
  render();
}

function showTab(tab) {
  const names = ['setup', 'staff', 'scoreboard'];
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', names[i] === tab));
  document.querySelectorAll('.panel').forEach((p, i) =>
    p.classList.toggle('active', names[i] === tab));
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function render() {
  renderSetup();
  renderStaff();
  renderScoreboard();
}

function renderSetup() {
  const pl = document.getElementById('player-list');
  pl.innerHTML = state.players.length
    ? state.players.map(p =>
      `<span class="tag">${p}
          <button onclick="removePlayer('${esc(p)}')" title="Remove">&#10005;</button>
        </span>`).join('')
    : '<span class="empty-msg">No players yet</span>';

  const sl = document.getElementById('station-list');
  sl.innerHTML = state.stations.length
    ? state.stations.map(s =>
      `<span class="tag">${s}
          <button onclick="removeStation('${esc(s)}')" title="Remove">&#10005;</button>
        </span>`).join('')
    : '<span class="empty-msg">No stations yet</span>';
}

function renderStaff() {
  const sel = document.getElementById('station-selector');
  if (!state.stations.length) {
    sel.innerHTML = '<span class="no-station">Add stations in Setup first</span>';
    document.getElementById('match-area').innerHTML = '';
    return;
  }

  sel.innerHTML = state.stations.map(s =>
    `<button class="station-btn${activeStation === s ? ' active' : ''}"
             onclick="selectStation('${esc(s)}')">${s}</button>`
  ).join('');

  const ma = document.getElementById('match-area');
  if (!activeStation || !state.stations.includes(activeStation)) {
    ma.innerHTML = '<p class="no-station">Select a station above to record results</p>';
    return;
  }

  const stationResults = state.results[activeStation] || {};

  const rows = state.players.length
    ? state.players.map(p => {
      const won = stationResults[p] === 'win';
      if (won) {
        return `<div class="player-row">
            <span class="player-name won">${p}</span>
            <span class="win-badge">&#10003; Won</span>
            <button class="undo-btn" onclick="undoResult('${esc(activeStation)}','${esc(p)}')">Undo</button>
          </div>`;
      }
      return `<div class="player-row">
          <span class="player-name">${p}</span>
          <button class="tick-btn" onclick="recordWin('${esc(activeStation)}','${esc(p)}')">&#10003; Won</button>
        </div>`;
    }).join('')
    : '<p class="empty-msg">Add players in Setup first</p>';

  ma.innerHTML = `<div class="match-area">
    <h3>${activeStation}</h3>
    ${rows}
  </div>`;
}

function renderScoreboard() {
  const totalStations = state.stations.length;
  const totalWins = Object.values(state.results).flatMap(r => Object.values(r)).length;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">Players</div><div class="stat-val">${state.players.length}</div></div>
    <div class="stat-card"><div class="stat-label">Stations</div><div class="stat-val">${totalStations}</div></div>
    <div class="stat-card"><div class="stat-label">Total wins</div><div class="stat-val">${totalWins}</div></div>
  `;

  const scores = state.players.map(p => {
    let wins = 0;
    const dots = state.stations.map(s => {
      const won = (state.results[s] || {})[p] === 'win';
      if (won) wins++;
      return won;
    });
    return { name: p, wins, dots };
  }).sort((a, b) => b.wins - a.wins);

  const maxWins = scores.reduce((m, s) => Math.max(m, s.wins), 1);
  const tbody = document.getElementById('scoreboard-body');

  if (!scores.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-msg" style="padding:1rem 12px">No players yet — add them in Setup</td></tr>';
    return;
  }

  // Build rank array: same wins = same rank (dense ranking)
  const ranks = [];
  for (let i = 0; i < scores.length; i++) {
    if (i === 0) ranks.push(1);
    else if (scores[i].wins === scores[i - 1].wins) ranks.push(ranks[i - 1]);
    else ranks.push(i + 1);
  }


  tbody.innerHTML = scores.map((s, i) => {
    const rank = ranks[i];
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const rankSymbol = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
    const dots = s.dots.map(won =>
      `<span class="dot${won ? ' win' : ''}" title="${won ? 'won' : 'not won'}"></span>`
    ).join('');
    const barPct = totalStations ? Math.round((s.wins / maxWins) * 100) : 0;
    return `<tr>
      <td class="rank ${rankClass}">${rankSymbol}</td>
      <td style="font-weight:500">${s.name}</td>
      <td>
        <div class="wins-bar-wrap">
          <div class="wins-bar-bg"><div class="wins-bar" style="width:${barPct}%"></div></div>
          <span class="wins-count">${s.wins}</span>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-dots">${dots}</div>
          <span class="stations-label">${s.wins}/${totalStations}</span>
        </div>
      </td>
    </tr>`;
  }).join('');

}

// ─────────────────────────────────────────────
// EXPOSE functions to HTML onclick handlers
// Required because script is loaded as a module (type="module")
// ─────────────────────────────────────────────
window.addPlayer = addPlayer;
window.removePlayer = removePlayer;
window.addStation = addStation;
window.removeStation = removeStation;
window.recordWin = recordWin;
window.undoResult = undoResult;
window.selectStation = selectStation;
window.showTab = showTab;
window.resetAll = resetAll;

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
startListeners();