import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const config = window.CUBE_FIREBASE_CONFIG || {};
const periodButtons = document.querySelectorAll(".ranking-tab");
const rankingTypeButtons = document.querySelectorAll(".ranking-type-tab");
const rankingList = document.getElementById("onlineRankingList");
const authStatus = document.getElementById("authStatus");
const accountGreeting = document.getElementById("accountGreeting");
const accountRank = document.getElementById("accountRank");
const nameInput = document.getElementById("playerNameInput");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const guestLoginBtn = document.getElementById("guestLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const readyRoomBtn = document.getElementById("readyRoomBtn");
const roomIdInput = document.getElementById("roomIdInput");
const roomUrlOutput = document.getElementById("roomUrlOutput");
const battleStatus = document.getElementById("battleStatus");
const battlePlayers = document.getElementById("battlePlayers");
const battleWinner = document.getElementById("battleWinner");
const battleReadyBtn = document.getElementById("battleReadyBtn");
const copyRoomUrlBtn = document.getElementById("copyRoomUrlBtn");
const leaveBattleBtn = document.getElementById("leaveBattleBtn");
const battleRoomMeta = document.getElementById("battleRoomMeta");
const battleScramble = document.getElementById("battleScramble");
const battleNotice = document.getElementById("battleNotice");
const battleResult = document.getElementById("battleResult");
const PENDING_SOLVES_KEY = "pendingOnlineSolves";

let auth = null;
let db = null;
let currentUser = null;
let activePeriod = "today";
let activeRankingType = "single";
let activeRoomId = "";
let activeRoomRole = "";
let activeRoomUnsubscribe = null;
let activePlayerUnsubscribes = [];
let activeMoveUnsubscribes = [];
let activeRoom = null;
let battlePlayersByRole = { host: null, guest: null };
let battleMovesByRole = { host: [], guest: [] };
let battleClockInterval = null;
let battlePresenceInterval = null;
let localBattleTimerSeconds = 0;

function isConfigured() {
  return Boolean(config.apiKey && !config.apiKey.startsWith("YOUR_"));
}

function setStatus(message) {
  authStatus.textContent = message;
}

function setRankingMessage(message) {
  rankingList.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = message;
  rankingList.appendChild(li);
}

function toUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function toUtcMonthKey(date) {
  return date.toISOString().slice(0, 7);
}

function toUtcWeekKey(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getPeriodKeys(date = new Date()) {
  return {
    today: toUtcDayKey(date),
    week: toUtcWeekKey(date),
    month: toUtcMonthKey(date)
  };
}

function getPlayerName() {
  const typedName = nameInput.value.trim();
  const fallbackName = currentUser?.displayName || "Guest";
  return typedName || fallbackName;
}

function updateAccountSummary(user, rank = null) {
  if (!user) {
    accountGreeting.textContent = "Log in to join the rankings.";
    accountRank.textContent = "";
    return;
  }

  accountGreeting.textContent = `Hello, ${getPlayerName()}`;
  accountRank.textContent = rank ? `Current world rank: #${rank}` : "Current world rank: -";
}

function isValidSolvePayload(time, scramble) {
  return Boolean(
    Number.isFinite(time) &&
    time > 2 &&
    time < 3600 &&
    typeof scramble === "string" &&
    scramble.trim().length > 0
  );
}

function isValidOnlineSolve(time, scramble) {
  return Boolean(currentUser && isValidSolvePayload(time, scramble));
}

function isValidRankingEntry(solve) {
  return Boolean(
    isValidSolvePayload(Number(solve.time), solve.scramble)
  );
}

function getPendingSolves() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_SOLVES_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function savePendingSolves(solves) {
  localStorage.setItem(PENDING_SOLVES_KEY, JSON.stringify(solves.slice(-20)));
}

function queuePendingSolve(time, scramble, ao5, solveStats = {}) {
  if (!isValidSolvePayload(time, scramble)) {
    setStatus("This solve was saved locally but not submitted online.");
    return false;
  }

  const pending = getPendingSolves();

  pending.push({
    time,
    ao5: Number.isFinite(ao5) ? ao5 : null,
    tps: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
    moveCount: Number.isFinite(solveStats.moveCount) ? solveStats.moveCount : 0,
    scramble,
    solvedAt: new Date().toISOString()
  });

  savePendingSolves(pending);
  setStatus(`${pending.length} pending time(s). Login to submit.`);
  return true;
}

async function addRankingEntry(rankingType, time, scramble, solvedAt = new Date().toISOString(), solveStats = {}) {
  if (!isValidOnlineSolve(time, scramble)) {
    return false;
  }

  const solvedDate = new Date(solvedAt);
  const keys = getPeriodKeys(Number.isNaN(solvedDate.getTime()) ? new Date() : solvedDate);

  await addDoc(collection(db, "solves"), {
    rankingType,
    time,
    scramble,
    tps: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
    moveCount: Number.isFinite(solveStats.moveCount) ? solveStats.moveCount : 0,
    name: getPlayerName(),
    uid: currentUser.uid,
    dayKey: keys.today,
    weekKey: keys.week,
    monthKey: keys.month,
    createdAt: serverTimestamp()
  });

  return true;
}

async function addOnlineSolve(time, scramble, ao5, solvedAt = new Date().toISOString(), solveStats = {}) {
  const submittedSingle = await addRankingEntry("single", time, scramble, solvedAt, solveStats);

  if (Number.isFinite(ao5)) {
    await addRankingEntry("ao5", ao5, scramble, solvedAt, solveStats);
  }

  return submittedSingle;
}

async function submitPendingSolves() {
  if (!currentUser) return;

  const pending = getPendingSolves();
  if (pending.length === 0) return;

  while (pending.length > 0) {
    const solve = pending[0];

    await addOnlineSolve(solve.time, solve.scramble, solve.ao5, solve.solvedAt, {
      tps: solve.tps,
      moveCount: solve.moveCount
    });
    pending.shift();
    savePendingSolves(pending);
  }

  localStorage.removeItem(PENDING_SOLVES_KEY);
  setStatus(`Logged in as ${currentUser.displayName || "Guest"}. Pending times submitted.`);
  refreshRanking();
  refreshAccountRank();
}

async function refreshRanking() {
  if (!isConfigured()) {
    setRankingMessage("Firebase config is required.");
    return;
  }

  setRankingMessage("Loading...");

  try {
    const solvesRef = collection(db, "solves");
    let rankingQuery;
    let legacyQuery = null;

    if (activePeriod === "all") {
      rankingQuery = query(
        solvesRef,
        where("rankingType", "==", activeRankingType),
        orderBy("time", "asc"),
        limit(50)
      );

      if (activeRankingType === "single") {
        legacyQuery = query(solvesRef, orderBy("time", "asc"), limit(50));
      }
    } else {
      const keys = getPeriodKeys();
      const fieldMap = {
        today: "dayKey",
        week: "weekKey",
        month: "monthKey"
      };

      rankingQuery = query(
        solvesRef,
        where("rankingType", "==", activeRankingType),
        where(fieldMap[activePeriod], "==", keys[activePeriod]),
        orderBy("time", "asc"),
        limit(50)
      );

      if (activeRankingType === "single") {
        legacyQuery = query(
          solvesRef,
          where(fieldMap[activePeriod], "==", keys[activePeriod]),
          orderBy("time", "asc"),
          limit(50)
        );
      }
    }

    const snapshots = [await getDocs(rankingQuery)];
    if (legacyQuery) {
      snapshots.push(await getDocs(legacyQuery));
    }

    const entries = [];
    const seenIds = new Set();

    snapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        if (seenIds.has(doc.id)) return;

        const solve = doc.data();

        if (activeRankingType === "single") {
          if (solve.rankingType && solve.rankingType !== "single") return;
        } else if (solve.rankingType !== activeRankingType) {
          return;
        }

        if (!isValidRankingEntry(solve)) return;

        seenIds.add(doc.id);
        entries.push(solve);
      });
    });

    entries.sort((a, b) => Number(a.time) - Number(b.time));
    rankingList.innerHTML = "";

    if (entries.length === 0) {
      setRankingMessage("-");
      return;
    }

    entries.slice(0, 50).forEach(solve => {
      const li = document.createElement("li");
      const label = activeRankingType === "ao5" ? "Ao5" : "Single";
      li.textContent = `${Number(solve.time).toFixed(2)} ${label} - ${solve.name || "Player"}`;
      rankingList.appendChild(li);
    });
  } catch (error) {
    setRankingMessage("Ranking could not be loaded.");
    console.error(error);
  }
}

async function calculateMySingleRank() {
  if (!currentUser) return null;

  const solvesRef = collection(db, "solves");
  const rankingQuery = query(
    solvesRef,
    where("rankingType", "==", "single"),
    orderBy("time", "asc"),
    limit(500)
  );
  const legacyQuery = query(solvesRef, orderBy("time", "asc"), limit(500));
  const snapshots = [await getDocs(rankingQuery), await getDocs(legacyQuery)];
  const entries = [];
  const seenIds = new Set();

  snapshots.forEach(snapshot => {
    snapshot.forEach(doc => {
      if (seenIds.has(doc.id)) return;

      const solve = doc.data();
      if (solve.rankingType && solve.rankingType !== "single") return;
      if (!isValidRankingEntry(solve)) return;

      seenIds.add(doc.id);
      entries.push(solve);
    });
  });

  entries.sort((a, b) => Number(a.time) - Number(b.time));

  const myBest = entries.find(solve => solve.uid === currentUser.uid);
  if (!myBest) return null;

  return entries.findIndex(solve => solve === myBest) + 1;
}

async function refreshAccountRank() {
  if (!currentUser) {
    updateAccountSummary(null);
    return;
  }

  try {
    const rank = await calculateMySingleRank();
    updateAccountSummary(currentUser, rank);
  } catch (error) {
    updateAccountSummary(currentUser, null);
    console.error(error);
  }
}

async function submitOnlineSolve(time, scramble, ao5 = null, solveStats = {}) {
  if (!isConfigured()) return;

  if (!currentUser) {
    queuePendingSolve(time, scramble, ao5, solveStats);
    return;
  }

  if (!isValidOnlineSolve(time, scramble)) {
    setStatus("This solve was saved locally but not submitted online.");
    return;
  }

  try {
    const submitted = await addOnlineSolve(time, scramble, ao5, new Date().toISOString(), solveStats);
    if (!submitted) return;

    refreshRanking();
    refreshAccountRank();
  } catch (error) {
    queuePendingSolve(time, scramble, ao5, solveStats);
    setStatus("Online submit failed. Saved locally for the next login.");
    console.error(error);
  }
}

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRoomUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

function createPlayer(role) {
  return {
    uid: currentUser.uid,
    name: getPlayerName(),
    role,
    status: "joined",
    startTime: null,
    startTimeMs: 0,
    endTime: null,
    finalTime: null,
    tps: null,
    moveCount: 0,
    lastMove: "",
    updatedAt: serverTimestamp()
  };
}

function getBattleScramble() {
  if (typeof window.generateScramble !== "function") {
    return "";
  }

  const scramble = window.generateScramble(20);
  return scramble.join(" ");
}

function setBattleStatus(message) {
  if (battleStatus) battleStatus.textContent = message;
}

function clearBattleListeners() {
  if (activeRoomUnsubscribe) activeRoomUnsubscribe();
  activeRoomUnsubscribe = null;
  activePlayerUnsubscribes.forEach(unsubscribe => unsubscribe());
  activeMoveUnsubscribes.forEach(unsubscribe => unsubscribe());
  activePlayerUnsubscribes = [];
  activeMoveUnsubscribes = [];
}

function setBattleMode(enabled) {
  document.body.classList.toggle("battle-mode", enabled);

  if (enabled && !battleClockInterval) {
    battleClockInterval = window.setInterval(renderBattleUi, 100);
  }

  if (enabled && !battlePresenceInterval) {
    battlePresenceInterval = window.setInterval(sendBattleHeartbeat, 15000);
    sendBattleHeartbeat();
  }

  if (!enabled && battleClockInterval) {
    window.clearInterval(battleClockInterval);
    battleClockInterval = null;
  }

  if (!enabled && battlePresenceInterval) {
    window.clearInterval(battlePresenceInterval);
    battlePresenceInterval = null;
  }
}

function sendBattleHeartbeat() {
  if (!currentUser || !activeRoomId || !document.body.classList.contains("battle-mode")) return;

  updateDoc(doc(db, "rooms", activeRoomId, "players", currentUser.uid), {
    updatedAt: serverTimestamp()
  }).catch(() => {});
}

function formatBattleTime(seconds) {
  return Number.isFinite(seconds) ? seconds.toFixed(2) : "-";
}

function getPlayerElapsedSeconds(player) {
  if (!player || player.status !== "solving") return 0;
  const startMs = player.startTime?.toMillis?.() || player.startTimeMs || 0;
  return startMs ? Math.max(0, (Date.now() - startMs) / 1000) : 0;
}

function isPlayerFinished(player) {
  return Boolean(player && player.status === "finished" && Number.isFinite(player.finalTime));
}

function isPlayerDisconnected(player) {
  if (!player || isPlayerFinished(player)) return false;
  const updatedAt = player.updatedAt?.toMillis?.() || 0;
  return updatedAt > 0 && Date.now() - updatedAt > 45000;
}

function getOpponentRole() {
  return activeRoomRole === "host" ? "guest" : "host";
}

function getDisplayPlayer(role) {
  return battlePlayersByRole[role] || null;
}

function setBattleText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderBattlePlayer(prefix, player, role) {
  const isFinished = isPlayerFinished(player);
  const isDnf = activeRoom?.status === "finished" && player && !isFinished;
  const isDisconnected = isPlayerDisconnected(player);
  const moves = battleMovesByRole[role] || [];
  const currentTimer = role === activeRoomRole
    ? localBattleTimerSeconds
    : getPlayerElapsedSeconds(player);

  setBattleText(`${prefix}Name`, player?.name || (prefix === "battleOpponent" ? "Waiting for player..." : "-"));
  setBattleText(`${prefix}State`, isDnf ? "DNF" : (isDisconnected ? "DISCONNECTED" : (player?.status || "waiting").toUpperCase()));
  setBattleText(`${prefix}Timer`, isFinished ? formatBattleTime(player.finalTime) : formatBattleTime(currentTimer));
  setBattleText(`${prefix}Final`, isDnf ? "DNF" : formatBattleTime(player?.finalTime));
  setBattleText(`${prefix}Tps`, isDnf ? "-" : (Number.isFinite(player?.tps) ? player.tps.toFixed(2) : "-"));
  setBattleText(`${prefix}MoveCount`, isDnf ? "-" : (Number.isFinite(player?.moveCount) ? String(player.moveCount) : "-"));
  setBattleText(`${prefix}LastMove`, player?.lastMove || moves.at(-1)?.move || "-");
  setBattleText(`${prefix}MoveLog`, moves.length ? moves.map(move => move.move).join(" ") : "-");
}

function renderBattleNotice() {
  if (!activeRoom) return;

  if (activeRoom.status === "finishing") {
    const remaining = Math.max(0, Math.ceil((Number(activeRoom.finishDeadlineMs) - Date.now()) / 1000));
    battleNotice.textContent = `Opponent's cube is solved. Battle ends in ${remaining}...`;
    return;
  }

  if (activeRoom.status === "finished") {
    battleNotice.textContent = "Battle finished.";
    return;
  }

  const host = getDisplayPlayer("host");
  const guest = getDisplayPlayer("guest");
  battleNotice.textContent = host?.status === "ready" && guest?.status === "ready"
    ? "Both players are ready. Make your first move to start."
    : "Waiting for both players to get ready.";
}

function renderBattleResult() {
  if (!activeRoom || activeRoom.status !== "finished") {
    battleResult.textContent = "";
    return;
  }

  const winner = activeRoom.winnerName || "No winner";
  const host = getDisplayPlayer("host");
  const guest = getDisplayPlayer("guest");
  const formatResultPlayer = player => {
    if (!isPlayerFinished(player)) return `${player?.name || "Player"}: DNF`;
    const place = player.uid === activeRoom.winnerUid ? "Winner" : "Loser";
    const tps = Number.isFinite(player.tps) ? player.tps.toFixed(2) : "-";
    return `${place} ${player.name}: ${formatBattleTime(player.finalTime)} / TPS ${tps} / ${player.moveCount || 0} moves`;
  };
  const hostResult = formatResultPlayer(host);
  const guestResult = formatResultPlayer(guest);
  battleResult.textContent = `Winner: ${winner} | ${hostResult} | ${guestResult}`;
}

function renderBattleUi() {
  if (!activeRoomId || !activeRoom) return;

  const you = getDisplayPlayer(activeRoomRole);
  const opponent = getDisplayPlayer(getOpponentRole());
  const count = [getDisplayPlayer("host"), getDisplayPlayer("guest")].filter(Boolean).length;

  roomIdInput.value = activeRoomId;
  roomUrlOutput.value = getRoomUrl(activeRoomId);
  battleRoomMeta.textContent = `Room: ${activeRoomId} | Players: ${count}/2`;
  battleScramble.textContent = activeRoom.scramble || "";
  renderBattlePlayer("battleYou", you, activeRoomRole);
  renderBattlePlayer("battleOpponent", opponent, getOpponentRole());
  renderBattleNotice();
  renderBattleResult();

  if (activeRoom.status === "finishing" && Date.now() >= Number(activeRoom.finishDeadlineMs)) {
    finalizeBattle().catch(console.error);
  }
}

function watchPlayer(roomId, role, uid) {
  if (!uid) return;

  activePlayerUnsubscribes.push(onSnapshot(doc(db, "rooms", roomId, "players", uid), snapshot => {
    battlePlayersByRole[role] = snapshot.exists() ? snapshot.data() : null;
    renderBattleUi();
  }));

  const movesQuery = query(
    collection(db, "rooms", roomId, "players", uid, "moves"),
    orderBy("moveIndex", "desc"),
    limit(20)
  );

  activeMoveUnsubscribes.push(onSnapshot(movesQuery, snapshot => {
    battleMovesByRole[role] = snapshot.docs.map(move => move.data()).reverse();
    renderBattleUi();
  }));
}

function watchRoom(roomId) {
  clearBattleListeners();
  activeRoom = null;
  battlePlayersByRole = { host: null, guest: null };
  battleMovesByRole = { host: [], guest: [] };
  setBattleMode(true);
  window.history.replaceState({}, "", getRoomUrl(roomId));

  activeRoomUnsubscribe = onSnapshot(doc(db, "rooms", roomId), snapshot => {
    if (!snapshot.exists()) {
      setBattleStatus("Room not found.");
      return;
    }

    const room = snapshot.data();
    const previousHostUid = activeRoom?.hostUid;
    const previousGuestUid = activeRoom?.guestUid;
    activeRoom = room;

    if (room.hostUid !== previousHostUid || room.guestUid !== previousGuestUid) {
      activePlayerUnsubscribes.forEach(unsubscribe => unsubscribe());
      activeMoveUnsubscribes.forEach(unsubscribe => unsubscribe());
      activePlayerUnsubscribes = [];
      activeMoveUnsubscribes = [];
      watchPlayer(roomId, "host", room.hostUid);
      watchPlayer(roomId, "guest", room.guestUid);
    }

    renderBattleUi();
    setBattleStatus(`Room ${roomId}: ${activeRoomRole}`);
  });
}

async function createBattleRoom() {
  if (!currentUser) {
    setBattleStatus("Log in or use Guest Login to create a room.");
    return;
  }

  const roomId = createRoomId();
  const scrambleText = getBattleScramble();
  if (!scrambleText) {
    setBattleStatus("Scramble generator is not ready.");
    return;
  }

  const room = {
    roomId,
    scramble: scrambleText,
    status: "waiting",
    hostUid: currentUser.uid,
    guestUid: "",
    winnerUid: "",
    winnerName: "",
    finishDeadlineMs: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "rooms", roomId), room);
  await setDoc(doc(db, "rooms", roomId, "players", currentUser.uid), createPlayer("host"));
  activeRoomId = roomId;
  activeRoomRole = "host";
  roomIdInput.value = roomId;
  roomUrlOutput.value = getRoomUrl(roomId);
  setBattleStatus("Room created. Share the URL or room ID.");
  watchRoom(roomId);
}

async function joinBattleRoom(roomId) {
  if (!currentUser) {
    setBattleStatus("Log in or use Guest Login to join a room.");
    return;
  }

  const normalizedRoomId = roomId.trim().toUpperCase();
  if (!normalizedRoomId) return;

  const roomRef = doc(db, "rooms", normalizedRoomId);
  const snapshot = await getDoc(roomRef);

  if (!snapshot.exists()) {
    setBattleStatus("Room not found.");
    return;
  }

  const room = snapshot.data();
  if (room.hostUid === currentUser.uid) {
    activeRoomRole = "host";
  } else if (!room.guestUid || room.guestUid === currentUser.uid) {
    activeRoomRole = "guest";
    await updateDoc(roomRef, {
      guestUid: currentUser.uid,
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "rooms", normalizedRoomId, "players", currentUser.uid), createPlayer("guest"));
  } else {
    setBattleStatus("This room already has two players.");
    return;
  }

  activeRoomId = normalizedRoomId;
  roomIdInput.value = normalizedRoomId;
  roomUrlOutput.value = getRoomUrl(normalizedRoomId);
  setBattleStatus("Joined room.");
  watchRoom(normalizedRoomId);
}

async function readyBattleRoom() {
  if (!currentUser || !activeRoomId || !activeRoomRole) {
    setBattleStatus("Create or join a room first.");
    return;
  }

  const roomRef = doc(db, "rooms", activeRoomId);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.data();
  if (room.status === "finishing" || room.status === "finished") {
    setBattleStatus("This battle has already ended.");
    return;
  }

  await updateDoc(roomRef, {
    status: "ready",
    updatedAt: serverTimestamp()
  });
  await updateDoc(doc(db, "rooms", activeRoomId, "players", currentUser.uid), {
    status: "ready",
    updatedAt: serverTimestamp()
  });

  if (typeof window.loadBattleScramble === "function") {
    window.loadBattleScramble(room.scramble);
  }
}

async function notifyBattleSolveStarted() {
  if (!currentUser || !activeRoomId || !activeRoomRole || !document.body.classList.contains("battle-mode")) return;

  await updateDoc(doc(db, "rooms", activeRoomId, "players", currentUser.uid), {
    status: "solving",
    startTime: serverTimestamp(),
    startTimeMs: Date.now(),
    updatedAt: serverTimestamp()
  }).catch(console.error);
  await updateDoc(doc(db, "rooms", activeRoomId), {
    status: "solving",
    updatedAt: serverTimestamp()
  }).catch(console.error);
}

async function notifyBattleMove(move) {
  if (!currentUser || !activeRoomId || !document.body.classList.contains("battle-mode")) return;

  const moveData = {
    move: String(move.move || ""),
    moveIndex: Number(move.index) || 0,
    elapsedMs: Math.max(0, Number(move.elapsedMs) || 0),
    timestamp: serverTimestamp()
  };
  const playerRef = doc(db, "rooms", activeRoomId, "players", currentUser.uid);

  await Promise.all([
    addDoc(collection(db, "rooms", activeRoomId, "players", currentUser.uid, "moves"), moveData),
    updateDoc(playerRef, { lastMove: moveData.move, updatedAt: serverTimestamp() })
  ]).catch(console.error);
}

async function submitBattleSolve(time, scramble, solveStats = {}) {
  if (!currentUser || !activeRoomId || !document.body.classList.contains("battle-mode")) return;
  if (!Number.isFinite(time) || time < 3 || time >= 3600) return;

  const roomRef = doc(db, "rooms", activeRoomId);
  const playerRef = doc(db, "rooms", activeRoomId, "players", currentUser.uid);

  await runTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) return;
    const room = roomSnapshot.data();
    if (room.scramble !== scramble || room.status === "finished") return;

    transaction.update(playerRef, {
      status: "finished",
      endTime: serverTimestamp(),
      finalTime: time,
      tps: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
      moveCount: Math.max(0, Number(solveStats.moveCount) || 0),
      updatedAt: serverTimestamp()
    });

    if (!Number(room.finishDeadlineMs) || room.status !== "finishing") {
      transaction.update(roomRef, {
        status: "finishing",
        firstFinisherUid: currentUser.uid,
        finishDeadlineMs: Date.now() + 3000,
        updatedAt: serverTimestamp()
      });
    }
  });
}

async function finalizeBattle() {
  if (!activeRoomId || !activeRoom || activeRoom.status !== "finishing") return;
  if (Date.now() < Number(activeRoom.finishDeadlineMs)) return;

  const roomRef = doc(db, "rooms", activeRoomId);
  const hostRef = activeRoom.hostUid ? doc(db, "rooms", activeRoomId, "players", activeRoom.hostUid) : null;
  const guestRef = activeRoom.guestUid ? doc(db, "rooms", activeRoomId, "players", activeRoom.guestUid) : null;

  await runTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) return;
    const room = roomSnapshot.data();
    if (room.status !== "finishing" || Date.now() < Number(room.finishDeadlineMs)) return;

    const host = hostRef ? (await transaction.get(hostRef)).data() : null;
    const guest = guestRef ? (await transaction.get(guestRef)).data() : null;
    const completed = [host, guest].filter(isPlayerFinished).sort((a, b) => a.finalTime - b.finalTime);
    const winner = completed[0] || null;

    transaction.update(roomRef, {
      status: "finished",
      finishedAt: serverTimestamp(),
      winnerUid: winner?.uid || "",
      winnerName: winner?.name || "",
      updatedAt: serverTimestamp()
    });
  });
}

function renderBattleLocalTimer(seconds) {
  localBattleTimerSeconds = Math.max(0, Number(seconds) || 0);
  renderBattleUi();
}

function leaveBattleMode() {
  clearBattleListeners();
  activeRoom = null;
  activeRoomId = "";
  activeRoomRole = "";
  localBattleTimerSeconds = 0;
  setBattleMode(false);
  if (typeof window.cancelCurrentSolve === "function") {
    window.cancelCurrentSolve();
  } else {
    document.body.classList.remove("solving");
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url);
}

async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function loginAsGuest() {
  const credential = await signInAnonymously(auth);
  const name = nameInput.value.trim() || "Guest";

  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }
}

function setupAuthUi() {
  googleLoginBtn.addEventListener("click", () => {
    loginWithGoogle().catch(error => {
      setStatus("Google login failed.");
      console.error(error);
    });
  });

  guestLoginBtn.addEventListener("click", () => {
    loginAsGuest().catch(error => {
      setStatus("Guest login failed.");
      console.error(error);
    });
  });

  logoutBtn.addEventListener("click", () => {
    signOut(auth).catch(error => {
      setStatus("Logout failed.");
      console.error(error);
    });
  });

  createRoomBtn.addEventListener("click", () => {
    createBattleRoom().catch(error => {
      setBattleStatus("Room could not be created.");
      console.error(error);
    });
  });

  joinRoomBtn.addEventListener("click", () => {
    joinBattleRoom(roomIdInput.value).catch(error => {
      setBattleStatus("Room could not be joined.");
      console.error(error);
    });
  });

  readyRoomBtn.addEventListener("click", () => {
    readyBattleRoom().catch(error => {
      setBattleStatus("Could not set ready.");
      console.error(error);
    });
  });

  battleReadyBtn.addEventListener("click", () => {
    readyBattleRoom().catch(error => {
      battleNotice.textContent = "Could not set ready.";
      console.error(error);
    });
  });

  copyRoomUrlBtn.addEventListener("click", async () => {
    if (!activeRoomId) return;

    const roomUrl = getRoomUrl(activeRoomId);
    try {
      await navigator.clipboard.writeText(roomUrl);
      battleNotice.textContent = "Room URL copied.";
    } catch (error) {
      roomUrlOutput.value = roomUrl;
      roomUrlOutput.select();
      document.execCommand("copy");
      battleNotice.textContent = "Room URL copied.";
    }
  });

  leaveBattleBtn.addEventListener("click", leaveBattleMode);
}

periodButtons.forEach(button => {
  button.addEventListener("click", () => {
    periodButtons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activePeriod = button.dataset.period;
    refreshRanking();
  });
});

rankingTypeButtons.forEach(button => {
  button.addEventListener("click", () => {
    rankingTypeButtons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeRankingType = button.dataset.rankingType;
    refreshRanking();
  });
});

if (isConfigured()) {
  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);

  setupAuthUi();

  onAuthStateChanged(auth, user => {
    currentUser = user;

    if (user) {
      setStatus(`Logged in as ${user.displayName || "Guest"}`);
      refreshAccountRank();
      submitPendingSolves().catch(error => {
        setStatus("Pending times could not be submitted.");
        console.error(error);
      });

      const roomFromUrl = new URLSearchParams(window.location.search).get("room");
      if (roomFromUrl && !activeRoomId) {
        joinBattleRoom(roomFromUrl).catch(console.error);
      }
    } else {
      leaveBattleMode();
      updateAccountSummary(null);
      const pendingCount = getPendingSolves().length;
      setStatus(pendingCount > 0
        ? `${pendingCount} pending time(s). Login to submit.`
        : "Login to submit online times.");
    }
  });

  refreshRanking();
} else {
  setStatus("Set firebase-config.js to enable login and online ranking.");
  setRankingMessage("Firebase config is required.");
}

window.submitOnlineSolve = submitOnlineSolve;
window.notifyBattleSolveStarted = notifyBattleSolveStarted;
window.submitBattleSolve = submitBattleSolve;
window.notifyBattleMove = notifyBattleMove;
window.renderBattleLocalTimer = renderBattleLocalTimer;
window.isBattleMode = () => document.body.classList.contains("battle-mode");
