let timerRunning = false;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

let currentScramble = "";

function startTimer() {
  if (timerRunning) return;

  timerRunning = true;
  startTime = Date.now() - elapsedTime;

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

  if (typeof window.submitOnlineSolve === "function") {
    window.submitOnlineSolve(finalTime, currentScramble, getCurrentAo5(), solveStats);
  }

  if (typeof window.submitBattleSolve === "function") {
    window.submitBattleSolve(finalTime, currentScramble, solveStats);
  }

  renderStats();
}

function resetTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  elapsedTime = 0;
  updateTimerDisplay();
  updateTpsDisplay(null);
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
    scramble,
    date: new Date().toLocaleString()
  });

  localStorage.setItem("cubeSolves", JSON.stringify(solves.slice(0, 100)));
}

function clearTimes() {
  localStorage.removeItem("cubeSolves");
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
    const li = document.createElement("li");
    const tpsText = Number.isFinite(solve.tps) ? ` TPS: ${solve.tps.toFixed(2)}` : "";
    li.textContent = `${index + 1}. ${solve.time.toFixed(2)}${tpsText}`;
    list.appendChild(li);
  });
}

function renderScrambleHistory() {
  const list = document.getElementById("scrambleHistoryList");
  const solves = getSolves();

  list.innerHTML = "";

  solves.forEach((solve, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${solve.scramble}`;
    list.appendChild(li);
  });
}

function renderPB() {
  const solves = getSolves();
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
  const solves = getSolves();

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
