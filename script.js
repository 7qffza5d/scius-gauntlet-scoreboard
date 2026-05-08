const STORAGE_KEY = 'games_fair_v1';

let state = {
  players: [],
  stations: [],
  results: {}
};

let activeStation = null;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = JSON.parse(saved);
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
  render();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function addPlayer() {
  const inp = document.getElementById('player-input');
  const name = inp.value.trim();
  if (!name || state.players.includes(name)) return;
  state.players.push(name);
  inp.value = '';
  saveState();
  render();
}

function removePlayer(name) {
  state.players = state.players.filter(p => p !== name);
  for (const st in state.results) {
    delete state.results[st][name];
  }
  saveState();
  render();
}

function addStation() {
  const inp = document.getElementById('station-input');
  const name = inp.value.trim();
  if (!name || state.stations.includes(name)) return;
  state.stations.push(name);
  if (!state.results[name]) state.results[name] = {};
  inp.value = '';
  saveState();
  render();
}

function removeStation(name) {
  state.stations = state.stations.filter(s => s !== name);
  delete state.results[name];
  saveState();
  render();
}

function recordResult(station, player, result) {
  if (!state.results[station]) state.results[station] = {};
  state.results[station][player] = result;
  saveState();
  render();
}

function undoResult(station, player) {
  delete state.results[station][player];
  saveState();
  render();
}

function selectStation(name) {
  activeStation = name;
  render();
}

function resetAll() {
  if (!confirm('Reset all scores and clear everything?')) return;
  state = { players: [], stations: [], results: {} };
  activeStation = null;
  saveState();
  render();
}

function showTab(tab) {
  const tabNames = ['setup', 'staff', 'scoreboard'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', tabNames[i] === tab);
  });
  document.querySelectorAll('.panel').forEach((p, i) => {
    p.classList.toggle('active', 'tab-' + tabNames[i] === 'tab-' + tab);
  });
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function render() {
  renderSetup();
  renderStaff();
  renderScoreboard();
}

function renderSetup() {
  const pl = document.getElementById('player-list');
  pl.innerHTML = state.players.length
    ? state.players.map(p =>
        `<span class="tag">${p}<button onclick="removePlayer('${esc(p)}')" title="Remove">&#10005;</button></span>`
      ).join('')
    : '<span class="empty-msg">No players yet</span>';

  const sl = document.getElementById('station-list');
  sl.innerHTML = state.stations.length
    ? state.stations.map(s =>
        `<span class="tag">${s}<button onclick="removeStation('${esc(s)}')" title="Remove">&#10005;</button></span>`
      ).join('')
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
    `<button class="station-btn${activeStation === s ? ' active' : ''}" onclick="selectStation('${esc(s)}')">${s}</button>`
  ).join('');

  const ma = document.getElementById('match-area');
  if (!activeStation || !state.stations.includes(activeStation)) {
    ma.innerHTML = '<p class="no-station">Select a station above to record results</p>';
    return;
  }

  const stationResults = state.results[activeStation] || {};

  const rows = state.players.length
    ? state.players.map(p => {
        const visited = stationResults[p];
        if (visited) {
          const badge = visited === 'win'
            ? '<span class="win-badge">Win</span>'
            : '<span class="loss-badge">Loss</span>';
          return `<div class="player-row">
            <span class="player-name visited">${p}</span>
            ${badge}
            <button class="undo-btn" onclick="undoResult('${esc(activeStation)}','${esc(p)}')">Undo</button>
          </div>`;
        }
        return `<div class="player-row">
          <span class="player-name">${p}</span>
          <div class="result-btns">
            <button class="win-btn" onclick="recordResult('${esc(activeStation)}','${esc(p)}','win')">&#10003; Win</button>
            <button class="loss-btn" onclick="recordResult('${esc(activeStation)}','${esc(p)}','loss')">&#10005; Loss</button>
          </div>
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
  const allResults = Object.values(state.results).flatMap(r => Object.values(r));
  const totalGames = allResults.length;

  const sr = document.getElementById('stats-row');
  sr.innerHTML = `
    <div class="stat-card"><div class="stat-label">Players</div><div class="stat-val">${state.players.length}</div></div>
    <div class="stat-card"><div class="stat-label">Stations</div><div class="stat-val">${totalStations}</div></div>
    <div class="stat-card"><div class="stat-label">Games played</div><div class="stat-val">${totalGames}</div></div>
  `;

  const scores = state.players.map(p => {
    let wins = 0, visited = 0;
    const stationDots = state.stations.map(s => {
      const r = (state.results[s] || {})[p];
      if (r) { visited++; if (r === 'win') wins++; }
      return r || null;
    });
    return { name: p, wins, visited, stationDots };
  }).sort((a, b) => b.wins - a.wins || b.visited - a.visited);

  const maxWins = scores.reduce((m, s) => Math.max(m, s.wins), 1);

  const tbody = document.getElementById('scoreboard-body');
  if (!scores.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-tertiary);font-size:14px;padding:1rem 12px">No players yet — add them in Setup</td></tr>';
    return;
  }

  tbody.innerHTML = scores.map((s, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankSymbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const dots = s.stationDots.map(d =>
      `<span class="dot ${d === 'win' ? 'win' : d === 'loss' ? 'loss' : ''}" title="${d || 'not visited'}"></span>`
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
          <span class="stations-label">${s.visited}/${totalStations}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

loadState();