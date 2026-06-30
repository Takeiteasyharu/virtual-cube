let timerRunning = false;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

let currentScramble = "";
let expandedSolveIndex = null;

function startTimer() {
  if (timerRunning) return;

  timerRunning = true;
  startTime = Date.now() - elapsedTime;
  updateMovesDisplay(null);

  timerInterval = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateTimerDisplay();
  }, 10);
}

function stopTimer() {
  if (!timerRunning) return;

  timerRunning = false;
  clearInterval(timerInterval);

  const finalTime = Number(formatTime(elapsedTime));
  const solveStats = typeof window.getCurrentSolveStats === "function"
    ? window.getCurrentSolveStats(finalTime)
    : { moveCount: 0, moves: [], tps: null };

  saveSolve(finalTime, currentScramble, solveStats);
  updateTpsDisplay(solveStats.tps);
  updateMovesDisplay(solveStats.moveCount);
  window.trackCubeEvent?.("solve_complete", {
    time: finalTime,
    tps: Number.isFinite(solveStats.tps) ? solveStats.tps : 0,
    moves: Number.isFinite(solveStats.moveCount) ? solveStats.moveCount : 0
  });

  if (solveStats.mode === "virtual" && solveStats.rankingEligible === true && typeof window.submitOnlineSolve === "function") {
    window.submitOnlineSolve(finalTime, currentScramble, getCurrentOnlineAo5(), solveStats);
  }

  if (typeof window.submitBattleSolve === "function") {
    window.submitBattleSolve(finalTime, currentScramble, solveStats);
  }

  renderStats();
}

function stopTimerAtLimit(seconds = 120) {
  if (!timerRunning) return;
  timerRunning = false;
  clearInterval(timerInterval);
  elapsedTime = Math.max(0, Number(seconds) || 0) * 1000;
  updateTimerDisplay();
}

function resetTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  elapsedTime = 0;
  updateTimerDisplay();
  updateTpsDisplay(null);
  updateMovesDisplay(null);
}

function toggleTimer() {
  if (timerRunning) stopTimer();
  else startTimer();
}

function updateTimerDisplay() {
  document.getElementById("timerDisplay").textContent = formatTime(elapsedTime);

  if (typeof window.renderBattleLocalTimer === "function") {
    window.renderBattleLocalTimer(elapsedTime / 1000);
  }
}

function updateTpsDisplay(tps) {
  const display = document.getElementById("tpsDisplay");
  if (!display) return;

  display.textContent = Number.isFinite(tps) ? `TPS: ${tps.toFixed(2)}` : "TPS: -";
}

function updateMovesDisplay(moveCount) {
  const display = document.getElementById("movesDisplay");
  if (!display) return;

  display.textContent = Number.isFinite(moveCount) ? `Moves: ${moveCount}` : "Moves: -";
}

function formatTime(ms) {
  return (ms / 1000).toFixed(2);
}

function isTimerRunning() {
  return timerRunning;
}

function setCurrentScramble(scrambleText) {
  currentScramble = scrambleText;
}

function getSolves() {
  try {
    const solves = JSON.parse(localStorage.getItem("cubeSolves")) || [];
    return solves.filter(solve => Number.isFinite(solve.time));
  } catch (error) {
    return [];
  }
}

function saveSolve(time, scramble, solveStats = {}) {
  const solves = getSolves();

  solves.unshift({
    time,
    tps: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
    moveCount: Number.isFinite(solveStats.moveCount) ? solveStats.moveCount : 0,
    moves: Array.isArray(solveStats.moves)
      ? solveStats.moves.map(move => typeof move === "string" ? move : move?.move).filter(Boolean)
      : [],
    scramble,
    mode: solveStats.mode === "real" ? "real" : "virtual",
    date: new Date().toLocaleString()
  });

  localStorage.setItem("cubeSolves", JSON.stringify(solves.slice(0, 100)));
}

function clearTimes() {
  localStorage.removeItem("cubeSolves");
  expandedSolveIndex = null;
  renderStats();
}

function renderStats() {
  renderTimes();
  renderScrambleHistory();
  renderPB();
  renderAO();
}

function renderTimes() {
  const list = document.getElementById("timeList");
  const solves = getSolves();

  list.innerHTML = "";

  solves.forEach((solve, index) => {
    const tpsText = Number.isFinite(solve.tps) ? ` TPS: ${solve.tps.toFixed(2)}` : "";
    const li = createHistoryItem(solve, index, `${index + 1}. ${solve.time.toFixed(2)}${tpsText}`);
    list.appendChild(li);
  });
}

function renderScrambleHistory() {
  const list = document.getElementById("scrambleHistoryList");
  const solves = getSolves();

  list.innerHTML = "";

  solves.forEach((solve, index) => {
    const li = createHistoryItem(solve, index, `${index + 1}. ${solve.scramble || "-"}`);
    list.appendChild(li);
  });
}

function createHistoryItem(solve, index, summary) {
  const li = document.createElement("li");
  li.className = "history-item";
  const row = document.createElement("div");
  row.className = "history-row";
  const text = document.createElement("span");
  text.textContent = summary;
  const menu = document.createElement("button");
  menu.className = "history-menu-button";
  menu.type = "button";
  menu.textContent = "⋮";
  menu.title = "Show solve details";
  menu.setAttribute("aria-label", "Show solve details");
  menu.addEventListener("click", () => {
    expandedSolveIndex = expandedSolveIndex === index ? null : index;
    renderStats();
  });
  row.append(text, menu);
  li.appendChild(row);

  if (expandedSolveIndex === index) {
    const details = document.createElement("div");
    details.className = "solve-details";
    const moves = Array.isArray(solve.moves) && solve.moves.length ? solve.moves.join(" ") : "No move data";
    details.append(
      createDetailLine("Time", Number(solve.time).toFixed(2)),
      createDetailLine("Scramble", solve.scramble || "-"),
      createDetailLine("Moves", moves),
      createDetailLine("TPS", Number.isFinite(solve.tps) ? solve.tps.toFixed(2) : "-"),
      createDetailLine("Move count", String(Number(solve.moveCount) || 0)),
      createDetailLine("Mode", solve.mode === "real" ? "Real Cube" : "Virtual Cube"),
      createDetailLine("Date", solve.date || "-")
    );
    li.appendChild(details);
  }

  return li;
}

function createDetailLine(label, value) {
  const line = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${label}: `;
  line.append(title, document.createTextNode(value));
  return line;
}

function renderPB() {
  const solves = getSolves().filter(solve => solve.mode !== "real");
  const pbDisplay = document.getElementById("pbDisplay");

  if (solves.length === 0) {
    pbDisplay.textContent = "-";
    return;
  }

  const pb = Math.min(...solves.map(solve => solve.time));
  pbDisplay.textContent = pb.toFixed(2);
}

function renderAO() {
  document.getElementById("ao5Display").textContent = calculateAverage(5);
  document.getElementById("ao12Display").textContent = calculateAverage(12);
}

function calculateAverage(count) {
  const average = calculateAverageValue(count);
  return average === null ? "-" : average.toFixed(2);
}

function calculateAverageValue(count) {
  const solves = getSolves().filter(solve => solve.mode !== "real");

  if (solves.length < count) return null;

  const target = solves.slice(0, count).map(solve => solve.time);

  if (count >= 3) {
    const sorted = [...target].sort((a, b) => a - b);
    sorted.shift();
    sorted.pop();

    const average = sorted.reduce((sum, time) => sum + time, 0) / sorted.length;
    return average;
  }

  const average = target.reduce((sum, time) => sum + time, 0) / target.length;
  return average;
}

function getCurrentAo5() {
  const average = calculateAverageValue(5);
  return average === null ? null : Number(average.toFixed(2));
}

function getCurrentOnlineAo5() {
  const virtualSolves = getSolves().filter(solve => solve.mode !== "real");
  if (virtualSolves.length < 5) return null;
  const sorted = virtualSolves.slice(0, 5).map(solve => solve.time).sort((a, b) => a - b);
  sorted.shift();
  sorted.pop();
  return Number((sorted.reduce((sum, time) => sum + time, 0) / sorted.length).toFixed(2));
}
