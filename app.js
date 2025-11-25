// ======================
// STATO DI GIOCO
// ======================

let state = {
  playerCount: 5,
  players: [],           // {id, name, alive}
  roles: [],             // "Liberal" | "Fascist" | "Hitler"
  presidentIndex: 0,
  chancellorIndex: null,
  electionTracker: 0,
  liberalPolicies: 0,
  fascistPolicies: 0,
  phase: "election",     // "election" | "legislative" | "executive" | "gameover"
  log: [],
  winner: null,          // "Liberals" | "Fascists" | null

  // votazione segreta
  votingActive: false,
  votingOrder: [],       // array di indici giocatori che votano
  currentVotingIndex: 0, // posizione corrente in votingOrder
  votes: {}              // { playerIndex: "Ja" | "Nein" }
};

const STORAGE_KEY = "sh_companion_advanced_state";

// ======================
// ELEMENTI DOM
// ======================

const setupSection = document.getElementById("setupSection");
const gameSection = document.getElementById("gameSection");
const logSection = document.getElementById("logSection");

const playerCountSelect = document.getElementById("playerCount");
const playerNamesContainer = document.getElementById("playerNamesContainer");
const randomizeNamesBtn = document.getElementById("randomizeNamesBtn");
const startGameBtn = document.getElementById("startGameBtn");

const currentPresidentSpan = document.getElementById("currentPresident");
const currentChancellorSpan = document.getElementById("currentChancellor");
const electionTrackerSpan = document.getElementById("electionTracker");
const phaseLabelSpan = document.getElementById("phaseLabel");
const playersListDiv = document.getElementById("playersList");

const rolePlayerSelect = document.getElementById("rolePlayerSelect");
const showRoleBtn = document.getElementById("showRoleBtn");
const roleDisplayDiv = document.getElementById("roleDisplay");

const presidentSelect = document.getElementById("presidentSelect");
const chancellorSelect = document.getElementById("chancellorSelect");
const setGovernmentBtn = document.getElementById("setGovernmentBtn");

const startSecretVoteBtn = document.getElementById("startSecretVoteBtn");
const secretVotePanel = document.getElementById("secretVotePanel");
const currentVoterNameSpan = document.getElementById("currentVoterName");
const votingProgressP = document.getElementById("votingProgress");
const voteJaBtn = document.getElementById("voteJaBtn");
const voteNeinBtn = document.getElementById("voteNeinBtn");
const revealVoteResultBtn = document.getElementById("revealVoteResultBtn");

const voteResultDiv = document.getElementById("voteResult");

const liberalPoliciesSpan = document.getElementById("liberalPolicies");
const fascistPoliciesSpan = document.getElementById("fascistPolicies");
const specialPowerBox = document.getElementById("specialPowerBox");

const executePlayerSelect = document.getElementById("executePlayerSelect");
const executePlayerBtn = document.getElementById("executePlayerBtn");

const gameStatusDiv = document.getElementById("gameStatus");
const nextPresidentBtn = document.getElementById("nextPresidentBtn");
const resetGameBtn = document.getElementById("resetGameBtn");

const logList = document.getElementById("logList");

// ======================
// UTILITY
// ======================

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Impossibile salvare lo stato:", e);
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const loaded = JSON.parse(raw);
    // merge con i campi nuovi se mancano
    state = {
      ...state,
      ...loaded,
      votes: loaded.votes || {},
      votingOrder: loaded.votingOrder || [],
      currentVotingIndex: loaded.currentVotingIndex || 0,
      votingActive: loaded.votingActive || false
    };
  } catch (e) {
    console.error("Errore parsing state:", e);
  }
}

function logEvent(text) {
  const time = new Date().toLocaleTimeString();
  state.log.unshift(`[${time}] ${text}`);
  renderLog();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distribuzione ruoli standard Secret Hitler
function computeRoles(playerCount) {
  let liberals, fascists;
  switch (playerCount) {
    case 5:
      liberals = 3; fascists = 1; break;
    case 6:
      liberals = 4; fascists = 1; break;
    case 7:
      liberals = 4; fascists = 2; break;
    case 8:
      liberals = 5; fascists = 2; break;
    case 9:
      liberals = 5; fascists = 3; break;
    case 10:
      liberals = 6; fascists = 3; break;
    default:
      liberals = playerCount - 2;
      fascists = 1;
  }

  const roles = [];
  roles.push("Hitler");
  for (let i = 0; i < fascists; i++) roles.push("Fascist");
  for (let i = 0; i < liberals; i++) roles.push("Liberal");

  if (roles.length > playerCount) {
    roles.length = playerCount;
  } else {
    while (roles.length < playerCount) roles.push("Liberal");
  }

  return shuffle(roles);
}

// Poteri fascisti per numero giocatori
function getFascistPower(playerCount, fascistPolicies) {
  const p = fascistPolicies;
  if (playerCount <= 6) {
    if (p === 3) return "policy_peek";
    if (p === 4 || p === 5) return "execution";
  } else if (playerCount <= 8) {
    if (p === 2) return "investigate";
    if (p === 3) return "special_election";
    if (p === 4 || p === 5) return "execution";
  } else {
    if (p === 1 || p === 2) return "investigate";
    if (p === 3) return "special_election";
    if (p === 4 || p === 5) return "execution";
  }
  return "none";
}

function powerLabel(power) {
  switch (power) {
    case "investigate": return "Indagine su un giocatore";
    case "policy_peek": return "Sbirciata 3 carte Politica";
    case "special_election": return "Elezione speciale (nuovo Presidente)";
    case "execution": return "Esecuzione (puoi uccidere un giocatore)";
    default: return "Nessun potere speciale";
  }
}

// ======================
// RENDER
// ======================

function renderPlayers() {
  playersListDiv.innerHTML = "";
  state.players.forEach((p, idx) => {
    const div = document.createElement("div");
    div.className = "player-pill " + (p.alive ? "alive" : "dead");
    div.textContent = `${idx + 1}. ${p.name}`;
    playersListDiv.appendChild(div);
  });

  [rolePlayerSelect, presidentSelect, chancellorSelect, executePlayerSelect].forEach(sel => {
    sel.innerHTML = "";
  });

  state.players.forEach((p, idx) => {
    const o1 = new Option(`${idx + 1}. ${p.name}`, idx);
    const o2 = new Option(`${idx + 1}. ${p.name}`, idx);
    const o3 = new Option(`${idx + 1}. ${p.name}`, idx);
    const o4 = new Option(`${idx + 1}. ${p.name}`, idx);
    rolePlayerSelect.add(o1);
    presidentSelect.add(o2);
    chancellorSelect.add(o3);
    if (p.alive) executePlayerSelect.add(o4);
  });

  currentPresidentSpan.textContent =
    state.players[state.presidentIndex]?.name || "-";
  currentChancellorSpan.textContent =
    state.chancellorIndex != null ? state.players[state.chancellorIndex].name : "-";
}

function renderStatus() {
  electionTrackerSpan.textContent = state.electionTracker;
  liberalPoliciesSpan.textContent = state.liberalPolicies;
  fascistPoliciesSpan.textContent = state.fascistPolicies;

  if (state.phase === "election") phaseLabelSpan.textContent = "Elezione";
  else if (state.phase === "legislative") phaseLabelSpan.textContent = "Legislativa";
  else if (state.phase === "executive") phaseLabelSpan.textContent = "Esecutiva";
  else phaseLabelSpan.textContent = "Partita terminata";

  if (state.winner === "Liberals") {
    gameStatusDiv.textContent = "VITTORIA LIBERALE!";
    gameStatusDiv.className = "status-box win-liberal";
  } else if (state.winner === "Fascists") {
    gameStatusDiv.textContent = "VITTORIA FASCISTA!";
    gameStatusDiv.className = "status-box win-fascist";
  } else {
    gameStatusDiv.textContent = "Partita in corso…";
    gameStatusDiv.className = "status-box";
  }
}

function renderSpecialPower() {
  const power = getFascistPower(state.playerCount, state.fascistPolicies);
  if (power === "none") {
    specialPowerBox.textContent = "Nessun potere speciale attivo.";
    specialPowerBox.classList.add("muted");
  } else {
    specialPowerBox.textContent =
      `POTERE ATTIVO: ${powerLabel(power)} (con ${state.fascistPolicies} politiche fasciste)`;
    specialPowerBox.classList.remove("muted");
  }
}

function renderLog() {
  logList.innerHTML = "";
  state.log.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = entry;
    logList.appendChild(li);
  });
}

function renderAll() {
  renderPlayers();
  renderStatus();
  renderSpecialPower();
  renderLog();
  saveState();
}

// ======================
// LOGICA DI GIOCO
// ======================

function checkWinConditions() {
  if (state.liberalPolicies >= 5) {
    state.winner = "Liberals";
    state.phase = "gameover";
    logEvent("I Liberali vincono per 5 politiche liberali.");
    return;
  }
  if (state.fascistPolicies >= 6) {
    state.winner = "Fascists";
    state.phase = "gameover";
    logEvent("I Fascisti vincono per 6 politiche fasciste.");
    return;
  }
}

function electGovernmentResult(approved) {
  if (approved) {
    state.electionTracker = 0;
    state.phase = "legislative";
    logEvent(
      `Governo approvato: Presidente ${state.players[state.presidentIndex].name}, ` +
      `Cancelliere ${state.players[state.chancellorIndex].name}`
    );

    const chRole = state.roles[state.chancellorIndex];
    if (chRole === "Hitler" && state.fascistPolicies >= 3) {
      state.winner = "Fascists";
      state.phase = "gameover";
      logEvent("Hitler è stato eletto Cancelliere dopo 3+ politiche fasciste → VITTORIA FASCISTA!");
    }
  } else {
    state.electionTracker++;
    logEvent("Governo respinto. Tracker elezioni fallite: " + state.electionTracker);

    if (state.electionTracker >= 3) {
      state.electionTracker = 0;
      state.fascistPolicies++;
      logEvent("3 elezioni fallite → politica fascista automatica dalla cima del mazzo.");
      checkWinConditions();
      renderSpecialPower();
    }

    advancePresident();
  }
}

function advancePresident() {
  state.presidentIndex = (state.presidentIndex + 1) % state.playerCount;
  state.chancellorIndex = null;
  state.phase = "election";
  logEvent("Il Presidente passa a: " + state.players[state.presidentIndex].name);
}

function enactPolicy(type) {
  if (state.winner) return;
  if (type === "liberal") {
    state.liberalPolicies++;
    logEvent("Promulgata una politica LIBERALE.");
  } else {
    state.fascistPolicies++;
    logEvent("Promulgata una politica FASCISTA.");
    const power = getFascistPower(state.playerCount, state.fascistPolicies);
    if (power !== "none") {
      logEvent("Potere fascista sbloccato: " + powerLabel(power));
    }
  }
  checkWinConditions();
  state.phase = "executive";
}

// ======================
// VOTAZIONE SEGRETA
// ======================

function startSecretVoting() {
  if (state.winner) {
    alert("La partita è già finita.");
    return;
  }
  if (state.chancellorIndex == null) {
    alert("Imposta prima Presidente e Cancelliere.");
    return;
  }

  // ordina tutti i giocatori vivi (inclusi Presidente e Cancelliere)
  state.votingOrder = state.players
    .map((p, idx) => (p.alive ? idx : null))
    .filter(idx => idx !== null);

  if (state.votingOrder.length === 0) {
    alert("Non ci sono giocatori vivi da far votare.");
    return;
  }

  state.votes = {};
  state.currentVotingIndex = 0;
  state.votingActive = true;

  revealVoteResultBtn.classList.add("hidden");
  voteResultDiv.textContent = "Votazione in corso… passate il dispositivo di giocatore in giocatore.";
  logEvent("Iniziata votazione segreta sul governo proposto.");

  updateSecretVotePanel();
  saveState();
}

function updateSecretVotePanel() {
  if (!state.votingActive) {
    secretVotePanel.classList.add("hidden");
    return;
  }

  if (state.currentVotingIndex >= state.votingOrder.length) {
    // tutti hanno votato
    state.votingActive = false;
    secretVotePanel.classList.add("hidden");
    voteResultDiv.textContent = "Tutti hanno votato. Tocca 'Mostra risultato votazione'.";
    revealVoteResultBtn.classList.remove("hidden");
    saveState();
    return;
  }

  const idx = state.votingOrder[state.currentVotingIndex];
  const player = state.players[idx];
  secretVotePanel.classList.remove("hidden");
  currentVoterNameSpan.textContent = player.name;
  votingProgressP.textContent =
    `Voto ${state.currentVotingIndex + 1} di ${state.votingOrder.length}`;
}

function handleSecretVote(choice) {
  if (!state.votingActive) return;
  const idx = state.votingOrder[state.currentVotingIndex];
  state.votes[idx] = choice; // "Ja" o "Nein"
  state.currentVotingIndex++;
  updateSecretVotePanel();
  saveState();
}

function revealSecretVoteResult() {
  // calcola i risultati a partire da state.votes
  let yes = 0;
  let no = 0;
  let abstain = 0;

  const aliveCount = state.players.filter(p => p.alive).length;

  state.votingOrder.forEach(idx => {
    const v = state.votes[idx];
    if (v === "Ja") yes++;
    else if (v === "Nein") no++;
    else abstain++;
  });

  const majority = Math.floor(aliveCount / 2) + 1;
  const approved = yes >= majority;

  voteResultDiv.textContent =
    `Risultato votazione: Ja = ${yes}, Nein = ${no}, Astenuti = ${abstain} ` +
    `(maggioranza: ${majority}) → ` +
    (approved ? "GOVERNO APPROVATO" : "GOVERNO RESPINTO");

  logEvent(
    `Votazione segreta: Ja=${yes}, Nein=${no}, Astenuti=${abstain} → ` +
    (approved ? "APPROVATO" : "RESPINTO")
  );

  revealVoteResultBtn.classList.add("hidden");
  electGovernmentResult(approved);
  renderAll();
}

// ======================
// EVENTI UI
// ======================

function renderNameInputs() {
  playerNamesContainer.innerHTML = "";
  const count = parseInt(playerCountSelect.value, 10);
  for (let i = 0; i < count; i++) {
    const label = document.createElement("label");
    label.textContent = `Giocatore ${i + 1} (nome):`;
    const input = document.createElement("input");
    input.type = "text";
    input.id = `playerName_${i}`;
    input.placeholder = `Giocatore ${i + 1}`;
    label.appendChild(input);
    playerNamesContainer.appendChild(label);
  }
}

playerCountSelect.addEventListener("change", renderNameInputs);

randomizeNamesBtn.addEventListener("click", () => {
  const count = parseInt(playerCountSelect.value, 10);
  for (let i = 0; i < count; i++) {
    const input = document.getElementById(`playerName_${i}`);
    if (input && !input.value.trim()) {
      input.value = `Giocatore ${i + 1}`;
    }
  }
});

startGameBtn.addEventListener("click", () => {
  const count = parseInt(playerCountSelect.value, 10);
  state.playerCount = count;
  state.players = [];
  for (let i = 0; i < count; i++) {
    const input = document.getElementById(`playerName_${i}`);
    const name = (input && input.value.trim()) || `Giocatore ${i + 1}`;
    state.players.push({ id: i, name, alive: true });
  }

  state.roles = computeRoles(count);
  state.presidentIndex = 0;
  state.chancellorIndex = null;
  state.electionTracker = 0;
  state.liberalPolicies = 0;
  state.fascistPolicies = 0;
  state.phase = "election";
  state.log = [];
  state.winner = null;
  state.votingActive = false;
  state.votingOrder = [];
  state.currentVotingIndex = 0;
  state.votes = {};

  logEvent("Nuova partita iniziata con " + count + " giocatori.");
  logEvent("Ruoli distribuiti casualmente.");

  setupSection.classList.add("hidden");
  gameSection.classList.remove("hidden");
  logSection.classList.remove("hidden");

  renderAll();
});

showRoleBtn.addEventListener("click", () => {
  const idx = parseInt(rolePlayerSelect.value, 10);
  if (isNaN(idx)) return;

  const role = state.roles[idx];
  const name = state.players[idx].name;

  roleDisplayDiv.textContent = `${name} è: ${role}`;
  roleDisplayDiv.classList.remove("hidden");

  showRoleBtn.classList.add("hidden");
  hideRoleBtn.classList.remove("hidden");
});

hideRoleBtn.addEventListener("click", () => {
  roleDisplayDiv.textContent = "-";
  roleDisplayDiv.classList.add("hidden");

  showRoleBtn.classList.remove("hidden");
  hideRoleBtn.classList.add("hidden");
});


setGovernmentBtn.addEventListener("click", () => {
  const presIdx = parseInt(presidentSelect.value, 10);
  const chanIdx = parseInt(chancellorSelect.value, 10);

  if (isNaN(presIdx) || isNaN(chanIdx)) {
    alert("Seleziona Presidente e Cancelliere.");
    return;
  }
  if (presIdx === chanIdx) {
    alert("Presidente e Cancelliere devono essere giocatori diversi.");
    return;
  }
  if (!state.players[presIdx].alive || !state.players[chanIdx].alive) {
    alert("Non puoi scegliere un giocatore morto.");
    return;
  }

  state.presidentIndex = presIdx;
  state.chancellorIndex = chanIdx;
  state.phase = "election";
  state.votingActive = false;
  state.votingOrder = [];
  state.currentVotingIndex = 0;
  state.votes = {};
  secretVotePanel.classList.add("hidden");
  revealVoteResultBtn.classList.add("hidden");
  voteResultDiv.textContent = "Governo impostato. Ora avvia la votazione segreta.";

  logEvent(
    `Proposto governo: Presidente ${state.players[presIdx].name}, ` +
    `Cancelliere ${state.players[chanIdx].name}.`
  );

  renderAll();
});

startSecretVoteBtn.addEventListener("click", () => {
  startSecretVoting();
});

voteJaBtn.addEventListener("click", () => {
  handleSecretVote("Ja");
});

voteNeinBtn.addEventListener("click", () => {
  handleSecretVote("Nein");
});

revealVoteResultBtn.addEventListener("click", () => {
  revealSecretVoteResult();
});

document.getElementById("enactLiberalBtn").addEventListener("click", () => {
  enactPolicy("liberal");
  renderAll();
});

document.getElementById("enactFascistBtn").addEventListener("click", () => {
  enactPolicy("fascist");
  renderAll();
});

executePlayerBtn.addEventListener("click", () => {
  const idx = parseInt(executePlayerSelect.value, 10);
  if (isNaN(idx)) return;
  const p = state.players[idx];
  if (!p.alive) {
    alert("Questo giocatore è già morto.");
    return;
  }
  if (!confirm(`Sei sicuro di voler eseguire ${p.name}?`)) return;

  p.alive = false;
  logEvent(`Giocatore ${p.name} è stato ESEGUITO.`);

  const role = state.roles[idx];
  if (role === "Hitler") {
    state.winner = "Liberals";
    state.phase = "gameover";
    logEvent("Hitler è stato ucciso → VITTORIA LIBERALE!");
  }

  renderAll();
});

nextPresidentBtn.addEventListener("click", () => {
  if (state.winner) return;
  advancePresident();
  renderAll();
});

resetGameBtn.addEventListener("click", () => {
  if (!confirm("Vuoi davvero resettare completamente la partita?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
});

// ======================
// INIT
// ======================

window.addEventListener("load", () => {
  loadState();

  if (state.players && state.players.length > 0) {
    setupSection.classList.add("hidden");
    gameSection.classList.remove("hidden");
    logSection.classList.remove("hidden");
    renderAll();
  } else {
    renderNameInputs();
  }
});

