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
  deleteDoc,
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
const howToPlayBtn = document.getElementById("howToPlayBtn");
const profileBtn = document.getElementById("profileBtn");
const howToPlayModal = document.getElementById("howToPlayModal");
const profileModal = document.getElementById("profileModal");
const profileBody = document.getElementById("profileBody");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const randomBattleBtn = document.getElementById("randomBattleBtn");
const cancelMatchBtn = document.getElementById("cancelMatchBtn");
const battleChoiceButtons = document.querySelectorAll(".battle-choice-tab");
const friendBattleControls = document.getElementById("friendBattleControls");
const randomBattleControls = document.getElementById("randomBattleControls");
const randomStatus = document.getElementById("randomStatus");
const roomIdInput = document.getElementById("roomIdInput");
const roomUrlOutput = document.getElementById("roomUrlOutput");
const battleStatus = document.getElementById("battleStatus");
const battleReadyBtn = document.getElementById("battleReadyBtn");
const copyRoomUrlBtn = document.getElementById("copyRoomUrlBtn");
const leaveBattleBtn = document.getElementById("leaveBattleBtn");
const battleRoomMeta = document.getElementById("battleRoomMeta");
const battleScramble = document.getElementById("battleScramble");
const battleNotice = document.getElementById("battleNotice");
const battleResult = document.getElementById("battleResult");
const battleResultBadge = document.getElementById("battleResultBadge");
const opponentCubePanel = document.getElementById("opponentCubePanel");
const opponentCubeStatus = document.getElementById("opponentCubeStatus");
const battleModeLabel = document.getElementById("battleModeLabel");
const battleRematchPanel = document.getElementById("battleRematchPanel");
const battleRematchYou = document.getElementById("battleRematchYou");
const battleRematchOpponent = document.getElementById("battleRematchOpponent");
const playAgainBtn = document.getElementById("playAgainBtn");
const rematchReturnBtn = document.getElementById("rematchReturnBtn");
const PENDING_SOLVES_KEY = "pendingOnlineSolves";
const BATTLE_ROOMS_COLLECTION = "battleRooms";
const MATCHMAKING_COLLECTION = "matchmaking";

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
let activeRound = 1;
let selectedBattleMode = "friend";
let battlePlayersByRole = { host: null, guest: null };
let battleMovesByRole = { host: [], guest: [] };
let battleClockInterval = null;
let battlePresenceInterval = null;
let localBattleTimerSeconds = 0;
let matchmakingUnsubscribe = null;
let randomRoomUnsubscribe = null;
let matchmakingTimeout = null;
let friendLobbyUnsubscribe = null;
const savedBattleResultKeys = new Set();

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
    accountRank.textContent = "Current world rank: -";
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
    const entries = await getRankingEntries(activeRankingType, activePeriod);
    rankingList.innerHTML = "";

    if (entries.length === 0) {
      setRankingMessage("-");
      return;
    }

    entries.slice(0, 50).forEach((solve, index) => {
      const li = document.createElement("li");
      const label = activeRankingType === "ao5" ? "Ao5" : "Single";
      li.textContent = `#${index + 1} ${Number(solve.time).toFixed(2)} ${label} - ${solve.name || "Player"}`;
      rankingList.appendChild(li);
    });
  } catch (error) {
    setRankingMessage("Ranking could not be loaded.");
    console.error(error);
  }
}

async function getRankingEntries(rankingType, period) {
  const solvesRef = collection(db, "solves");
  let rankingQuery;
  let legacyQuery = null;

  if (period === "all") {
    rankingQuery = query(
      solvesRef,
      where("rankingType", "==", rankingType),
      orderBy("time", "asc")
    );

    if (rankingType === "single") {
      legacyQuery = query(solvesRef, orderBy("time", "asc"));
    }
  } else {
    const keys = getPeriodKeys();
    const fieldMap = { today: "dayKey", week: "weekKey", month: "monthKey" };

    rankingQuery = query(
      solvesRef,
      where("rankingType", "==", rankingType),
      where(fieldMap[period], "==", keys[period]),
      orderBy("time", "asc")
    );

    if (rankingType === "single") {
      legacyQuery = query(
        solvesRef,
        where(fieldMap[period], "==", keys[period]),
        orderBy("time", "asc")
      );
    }
  }

  const snapshots = [await getDocs(rankingQuery)];
  if (legacyQuery) snapshots.push(await getDocs(legacyQuery));

  const entries = [];
  const seenIds = new Set();

  snapshots.forEach(snapshot => {
    snapshot.forEach(entryDoc => {
      if (seenIds.has(entryDoc.id)) return;

      const solve = entryDoc.data();
      if (rankingType === "single") {
        if (solve.rankingType && solve.rankingType !== "single") return;
      } else if (solve.rankingType !== rankingType) {
        return;
      }

      if (!isValidRankingEntry(solve)) return;
      seenIds.add(entryDoc.id);
      entries.push(solve);
    });
  });

  return entries.sort((a, b) => Number(a.time) - Number(b.time));
}

async function calculateMyRankingRank() {
  if (!currentUser) return null;
  const entries = await getRankingEntries(activeRankingType, activePeriod);

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
    const rank = await calculateMyRankingRank();
    updateAccountSummary(currentUser, rank);
  } catch (error) {
    updateAccountSummary(currentUser, null);
    console.error(error);
  }
}

function timestampToMillis(value) {
  return value?.toMillis?.() || 0;
}

function profileAverage(solves, count) {
  if (solves.length < count) return null;
  const times = solves
    .slice(0, count)
    .map(solve => Number(solve.time));
  const sorted = [...times].sort((a, b) => a - b);
  sorted.shift();
  sorted.pop();
  return sorted.reduce((sum, time) => sum + time, 0) / sorted.length;
}

function createProfileGrid(items) {
  const grid = document.createElement("dl");
  grid.className = "profile-grid";
  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    grid.appendChild(item);
  });
  return grid;
}

async function showProfile() {
  profileModal.hidden = false;
  profileBody.textContent = "Loading profile...";

  if (!currentUser) {
    profileBody.textContent = "Please log in to view your profile.";
    return;
  }

  try {
    const solvesSnapshot = await getDocs(query(collection(db, "solves"), where("uid", "==", currentUser.uid)));
    const allSingleSolves = solvesSnapshot.docs
      .map(entryDoc => entryDoc.data())
      .filter(solve => !solve.rankingType || solve.rankingType === "single");
    const validSolves = allSingleSolves
      .filter(isValidRankingEntry)
      .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
    const battleSnapshot = await getDocs(query(collection(db, "battleResults"), where("uid", "==", currentUser.uid)));
    const battleResults = battleSnapshot.docs.map(entryDoc => entryDoc.data());
    const rank = await calculateMyRankingRank();

    const times = validSolves.map(solve => Number(solve.time));
    const tpsValues = validSolves.map(solve => Number(solve.tps)).filter(Number.isFinite);
    const battleTimes = battleResults.map(result => Number(result.finalTime)).filter(Number.isFinite);
    const wins = battleResults.filter(result => result.result === "win").length;
    const losses = battleResults.filter(result => result.result === "loss").length;
    const dnfs = battleResults.filter(result => result.result === "dnf").length;
    const orderedBattles = [...battleResults].sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
    let streak = 0;
    for (const result of orderedBattles) {
      if (result.result !== "win") break;
      streak++;
    }
    const latest = validSolves[0]?.createdAt?.toDate?.();

    profileBody.innerHTML = "";
    profileBody.appendChild(createProfileGrid([
      ["Display name", getPlayerName()],
      ["Login type", currentUser.isAnonymous ? "Guest" : "Google"],
      ["PB", times.length ? Math.min(...times).toFixed(2) : "-"],
      ["AO5", profileAverage(validSolves, 5)?.toFixed(2) || "-"],
      ["AO12", profileAverage(validSolves, 12)?.toFixed(2) || "-"],
      ["Current world rank", rank ? `#${rank}` : "-"],
      ["Total solves", String(allSingleSolves.length)],
      ["Valid solves", String(validSolves.length)],
      ["Best TPS", tpsValues.length ? Math.max(...tpsValues).toFixed(2) : "-"],
      ["Average TPS", tpsValues.length ? (tpsValues.reduce((sum, value) => sum + value, 0) / tpsValues.length).toFixed(2) : "-"],
      ["Last solve date", latest ? latest.toLocaleString() : "-"]
    ]));

    const title = document.createElement("h3");
    title.className = "profile-section-title";
    title.textContent = "Battle Stats";
    profileBody.appendChild(title);
    profileBody.appendChild(createProfileGrid([
      ["Total battles", String(battleResults.length)],
      ["Wins", String(wins)],
      ["Losses", String(losses)],
      ["DNFs", String(dnfs)],
      ["Win rate", battleResults.length ? `${((wins / battleResults.length) * 100).toFixed(1)}%` : "-"],
      ["Best battle time", battleTimes.length ? Math.min(...battleTimes).toFixed(2) : "-"],
      ["Average battle time", battleTimes.length ? (battleTimes.reduce((sum, value) => sum + value, 0) / battleTimes.length).toFixed(2) : "-"],
      ["Current battle streak", String(streak)],
      ["Random battle wins", String(battleResults.filter(result => result.mode === "random" && result.result === "win").length)],
      ["Friend battle wins", String(battleResults.filter(result => result.mode === "friend" && result.result === "win").length)]
    ]));
  } catch (error) {
    profileBody.textContent = "Profile could not be loaded.";
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
  url.searchParams.delete("room");
  url.searchParams.set("battleRoom", roomId);
  return url.toString();
}

async function copyRoomUrl(roomId, onCopied) {
  const roomUrl = getRoomUrl(roomId);

  try {
    await navigator.clipboard.writeText(roomUrl);
  } catch (error) {
    roomUrlOutput.value = roomUrl;
    roomUrlOutput.select();
    document.execCommand("copy");
  }

  onCopied("Invite link copied.");
}

function createPlayer(role) {
  return {
    uid: currentUser.uid,
    name: getPlayerName(),
    role,
    status: "joined",
    inspectionStartTime: null,
    inspectionStartTimeMs: 0,
    startTime: null,
    startTimeMs: 0,
    endTime: null,
    finalTime: null,
    tps: null,
    moveCount: 0,
    lastMove: "",
    round: 1,
    rematchReady: false,
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

function setRandomStatus(message) {
  if (randomStatus) randomStatus.textContent = message;
}

function setBattleChoice(choice) {
  selectedBattleMode = choice;
  battleChoiceButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.battleChoice === choice);
  });
  friendBattleControls.hidden = choice !== "friend";
  randomBattleControls.hidden = choice !== "random";
}

function clearFriendLobby() {
  if (friendLobbyUnsubscribe) friendLobbyUnsubscribe();
  friendLobbyUnsubscribe = null;
}

function clearMatchmakingListeners() {
  if (matchmakingUnsubscribe) matchmakingUnsubscribe();
  if (randomRoomUnsubscribe) randomRoomUnsubscribe();
  if (matchmakingTimeout) window.clearTimeout(matchmakingTimeout);
  matchmakingUnsubscribe = null;
  randomRoomUnsubscribe = null;
  matchmakingTimeout = null;
}

async function clearMyMatchmakingEntry() {
  if (!currentUser) return;
  await deleteDoc(doc(db, MATCHMAKING_COLLECTION, currentUser.uid)).catch(() => {});
}

function enterMatchedRandomRoom(roomId) {
  if (!roomId || activeRoomId) return;
  clearMatchmakingListeners();
  clearMyMatchmakingEntry();
  setRandomStatus("Matched!");
  joinBattleRoom(roomId).catch(error => {
    setRandomStatus("Match could not be opened.");
    console.error(error);
  });
}

function watchForRandomRoom() {
  if (!currentUser || randomRoomUnsubscribe) return;

  const roomQuery = query(
    collection(db, BATTLE_ROOMS_COLLECTION),
    where("guestUid", "==", currentUser.uid)
  );

  randomRoomUnsubscribe = onSnapshot(roomQuery, snapshot => {
    const room = snapshot.docs
      .map(roomDoc => ({ id: roomDoc.id, ...roomDoc.data() }))
      .find(room => room.mode === "random" && ["waiting", "ready", "solving"].includes(room.status));

    if (room) enterMatchedRandomRoom(room.id);
  });
}

async function cancelRandomMatch(message = "Matchmaking cancelled.") {
  clearMatchmakingListeners();
  clearFriendLobby();
  if (currentUser && activeRoomId && !document.body.classList.contains("battle-mode")) {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      status: "cancelled",
      updatedAt: serverTimestamp()
    }).catch(() => {});
    activeRoomId = "";
    activeRoomRole = "";
  }
  await clearMyMatchmakingEntry();
  setRandomStatus(message);
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

  updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
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
  return Boolean(player && Number.isFinite(player.finalTime));
}

function isPlayerDisconnected(player) {
  if (!player) return false;
  if (["disconnected", "left", "returned", "normal"].includes(player.status)) return true;
  if (isPlayerFinished(player)) return false;
  const updatedAt = player.updatedAt?.toMillis?.() || 0;
  return updatedAt > 0 && Date.now() - updatedAt > 45000;
}

function isCountedBattleMove(move) {
  return !["x", "x'", "y", "y'", "z", "z'"].includes(move?.move);
}

async function saveBattleResultForCurrentUser() {
  if (!currentUser || !activeRoom || activeRoom.status !== "finished") return;

  const you = getDisplayPlayer(activeRoomRole);
  const opponent = getDisplayPlayer(getOpponentRole());
  if (!you) return;

  const resultId = `${activeRoomId}_${currentUser.uid}_${activeRound}`;
  if (savedBattleResultKeys.has(resultId)) return;

  const resultRef = doc(db, "battleResults", resultId);
  // Reserve this key before awaiting Firestore. Room snapshots may otherwise
  // trigger two create attempts before the first write has finished.
  savedBattleResultKeys.add(resultId);

  try {
    const existing = await getDoc(resultRef);
    if (existing.exists()) return;

    const finished = isPlayerFinished(you);
    const result = finished
      ? (activeRoom.winnerUid === currentUser.uid ? "win" : "loss")
      : "dnf";

    await setDoc(resultRef, {
      uid: currentUser.uid,
      name: getPlayerName(),
      roomId: activeRoomId,
      round: activeRound,
      mode: activeRoom.mode === "random" ? "random" : "friend",
      result,
      finalTime: finished ? Number(you.finalTime) : null,
      tps: finished && Number.isFinite(you.tps) ? Number(you.tps) : null,
      moveCount: finished && Number.isFinite(you.moveCount) ? Number(you.moveCount) : 0,
      opponentUid: opponent?.uid || "",
      opponentName: opponent?.name || "Player",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    savedBattleResultKeys.delete(resultId);
    throw error;
  }
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
  const visibleMoveCount = isFinished
    ? player.moveCount
    : moves.filter(isCountedBattleMove).length;

  setBattleText(`${prefix}State`, isDisconnected ? "DISCONNECTED" : (isDnf ? "DNF" : (player?.status || "waiting").toUpperCase()));
  setBattleText(`${prefix}Timer`, isFinished ? formatBattleTime(player.finalTime) : formatBattleTime(currentTimer));
  setBattleText(`${prefix}Final`, isDnf ? "DNF" : formatBattleTime(player?.finalTime));
  setBattleText(`${prefix}Tps`, isDnf ? "-" : (Number.isFinite(player?.tps) ? player.tps.toFixed(2) : "-"));
  setBattleText(`${prefix}MoveCount`, isDnf || !player ? "-" : String(visibleMoveCount || 0));
  setBattleText(`${prefix}LastMove`, player?.lastMove || moves.at(-1)?.move || "-");
  setBattleText(`${prefix}MoveLog`, moves.length ? moves.slice(-20).map(move => move.move).join(" ") : "-");
}

function renderBattleNotice() {
  if (!activeRoom) return;

  if (activeRoom.status === "finishing") {
    const remaining = Math.max(0, Math.ceil((Number(activeRoom.finishDeadlineMs) - Date.now()) / 1000));
    battleNotice.textContent = `Your opponent has finished. Battle ends in ${remaining} second${remaining === 1 ? "" : "s"}.`;
    return;
  }

  const host = getDisplayPlayer("host");
  const guest = getDisplayPlayer("guest");
  if (isPlayerDisconnected(host) || isPlayerDisconnected(guest)) {
    battleNotice.textContent = "Your opponent returned to Normal Mode.";
    return;
  }

  if (activeRoom.status === "finished") {
    battleNotice.textContent = "Battle finished.";
    return;
  }
  const activeStates = ["inspecting", "solving"];
  battleNotice.textContent = activeStates.includes(host?.status) && activeStates.includes(guest?.status)
    ? "Both players are ready."
    : "Press Ready to begin inspection.";
}

function renderBattleResult() {
  if (!activeRoom || activeRoom.status !== "finished") {
    battleResult.textContent = "";
    battleResultBadge.textContent = "";
    battleResultBadge.className = "battle-result-badge";
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

  const iWon = activeRoom.winnerUid === currentUser?.uid;
  battleResultBadge.textContent = iWon ? "WINNER" : "LOSER";
  battleResultBadge.className = `battle-result-badge ${iWon ? "winner" : "loser"}`;
}

function renderBattleReadyButton(you, opponent) {
  const battleEnded = activeRoom?.status === "finished" || activeRoom?.status === "finishing";
  battleReadyBtn.hidden = battleEnded || !you || ["inspecting", "solving"].includes(you.status);
  if (battleReadyBtn.hidden) return;

  battleReadyBtn.disabled = false;
  battleReadyBtn.textContent = "Ready";
}

function renderRematchPanel(you, opponent) {
  const battleFinished = activeRoom?.status === "finished";
  battleRematchPanel.hidden = !battleFinished;
  if (!battleFinished) return;

  const youReady = Boolean(you?.rematchReady);
  const opponentReady = Boolean(opponent?.rematchReady);
  battleRematchYou.textContent = `You: ${youReady ? "Ready for rematch" : "Waiting"}`;
  const opponentLeft = isPlayerDisconnected(opponent);
  battleRematchOpponent.textContent = opponentLeft
    ? "Opponent: Left the room"
    : `Opponent: ${opponentReady ? "Ready for rematch" : "Waiting"}`;
  playAgainBtn.disabled = youReady || opponentLeft;
  playAgainBtn.textContent = opponentLeft ? "Opponent left" : (youReady ? "Ready" : "Play Again");
}

function renderBattleUi() {
  if (!activeRoomId || !activeRoom) return;

  const you = getDisplayPlayer(activeRoomRole);
  const opponent = getDisplayPlayer(getOpponentRole());
  const count = [getDisplayPlayer("host"), getDisplayPlayer("guest")].filter(Boolean).length;

  roomIdInput.value = activeRoomId;
  roomUrlOutput.value = getRoomUrl(activeRoomId);
  battleRoomMeta.textContent = `Room: ${activeRoomId} | Players: ${count}/2`;
  battleModeLabel.textContent = activeRoom.mode === "random" ? "Random Battle" : "Friend Battle";
  battleScramble.textContent = activeRoom.scramble || "";
  renderBattlePlayer("battleYou", you, activeRoomRole);
  renderBattlePlayer("battleOpponent", opponent, getOpponentRole());
  renderOpponentCube(opponent);
  renderBattleNotice();
  renderBattleResult();
  renderBattleReadyButton(you, opponent);
  renderRematchPanel(you, opponent);

  if (activeRoom.status === "finished") {
    saveBattleResultForCurrentUser().catch(console.error);
  }

  if (activeRoom.status === "finishing" && Date.now() >= Number(activeRoom.finishDeadlineMs)) {
    finalizeBattle().catch(console.error);
  }
}

function getInspectionStartMs(player) {
  return player?.inspectionStartTime?.toMillis?.() || player?.inspectionStartTimeMs || Date.now();
}

function syncLocalBattleState(player) {
  if (!activeRoom || !player || !document.body.classList.contains("battle-mode")) return;

  if (player.status === "joined" || player.status === "ready") {
    window.prepareBattleCube?.(activeRoom.scramble, activeRound);
  }

  if (player.status === "inspecting") {
    window.startBattleInspection?.(
      activeRoom.scramble,
      getInspectionStartMs(player),
      activeRound
    );
  }
}

function watchPlayer(roomId, role, uid) {
  if (!uid) return;

  activePlayerUnsubscribes.push(onSnapshot(doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", uid), snapshot => {
    battlePlayersByRole[role] = snapshot.exists() ? snapshot.data() : null;
    renderBattleUi();

    if (role === activeRoomRole && snapshot.exists()) {
      syncLocalBattleState(snapshot.data());
    }

    const host = getDisplayPlayer("host");
    const guest = getDisplayPlayer("guest");
    if (activeRoom?.status === "finished" && host?.rematchReady && guest?.rematchReady) {
      startRematchIfBothReady().catch(console.error);
    }
  }));

  const movesQuery = query(
    collection(db, BATTLE_ROOMS_COLLECTION, roomId, "players", uid, "moves"),
    orderBy("moveIndex", "asc")
  );

  activeMoveUnsubscribes.push(onSnapshot(movesQuery, snapshot => {
    battleMovesByRole[role] = snapshot.docs
      .map(move => move.data())
      .filter(move => !move.round || move.round === activeRound);
    if (role !== activeRoomRole) {
      window.opponentCube?.applyMoves(battleMovesByRole[role]);
    }
    renderBattleUi();
  }));
}

function watchRoom(roomId) {
  clearBattleListeners();
  activeRoom = null;
  activeRound = 0;
  battlePlayersByRole = { host: null, guest: null };
  battleMovesByRole = { host: [], guest: [] };
  setBattleMode(true);
  window.history.replaceState({}, "", getRoomUrl(roomId));

  activeRoomUnsubscribe = onSnapshot(doc(db, BATTLE_ROOMS_COLLECTION, roomId), snapshot => {
    if (!snapshot.exists()) {
      setBattleStatus("Room not found.");
      return;
    }

    const room = snapshot.data();
    const previousHostUid = activeRoom?.hostUid;
    const previousGuestUid = activeRoom?.guestUid;
    const previousRound = activeRound;
    activeRoom = room;
    activeRound = Number(room.round) || 1;
    window.opponentCube?.setScramble(room.scramble || "", activeRound);

    if (room.hostUid !== previousHostUid || room.guestUid !== previousGuestUid) {
      activePlayerUnsubscribes.forEach(unsubscribe => unsubscribe());
      activeMoveUnsubscribes.forEach(unsubscribe => unsubscribe());
      activePlayerUnsubscribes = [];
      activeMoveUnsubscribes = [];
      watchPlayer(roomId, "host", room.hostUid);
      watchPlayer(roomId, "guest", room.guestUid);
    }

    if (previousRound && activeRound > previousRound) {
      beginNextBattleRound(room).catch(console.error);
    }

    renderBattleUi();
    setBattleStatus(`Room ${roomId}: ${activeRoomRole}`);
  });
}

async function beginNextBattleRound(room) {
  if (!currentUser || !activeRoomId || room.round !== activeRound) return;

  localBattleTimerSeconds = 0;
  battleMovesByRole = { host: [], guest: [] };
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "joined",
    inspectionStartTime: null,
    inspectionStartTimeMs: 0,
    startTime: null,
    startTimeMs: 0,
    endTime: null,
    finalTime: null,
    tps: null,
    moveCount: 0,
    lastMove: "",
    rematchReady: false,
    round: activeRound,
    updatedAt: serverTimestamp()
  });

  window.prepareBattleCube?.(room.scramble, activeRound);
}

async function startRematchIfBothReady() {
  if (!activeRoomId || !activeRoom || activeRoom.status !== "finished") return;

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const hostRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", activeRoom.hostUid);
  const guestRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", activeRoom.guestUid);

  await runTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) return;
    const room = roomSnapshot.data();
    if (room.status !== "finished") return;

    const host = (await transaction.get(hostRef)).data();
    const guest = (await transaction.get(guestRef)).data();
    if (isPlayerDisconnected(host) || isPlayerDisconnected(guest)) return;
    if (!host?.rematchReady || !guest?.rematchReady) return;

    const scramble = getBattleScramble();
    if (!scramble) return;

    transaction.update(roomRef, {
      status: "waiting",
      scramble,
      round: (Number(room.round) || 1) + 1,
      winnerUid: "",
      winnerName: "",
      firstFinisherUid: "",
      finishDeadlineMs: 0,
      finishedAt: null,
      updatedAt: serverTimestamp()
    });
  });
}

async function requestRematch() {
  if (!currentUser || !activeRoomId || activeRoom?.status !== "finished") return;
  if (isPlayerDisconnected(getDisplayPlayer(getOpponentRole()))) return;

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    rematchReady: true,
    updatedAt: serverTimestamp()
  });
  await startRematchIfBothReady();
}

async function createBattleRoom(mode = "friend") {
  if (!currentUser) {
    setBattleStatus("Log in or use Guest Login to create a room.");
    return;
  }

  if (mode === "friend" && matchmakingUnsubscribe) {
    await cancelRandomMatch();
  }

  const roomId = createRoomId();
  const scrambleText = getBattleScramble();
  if (!scrambleText) {
    setBattleStatus("Scramble generator is not ready.");
    return;
  }

  const room = {
    roomId,
    mode,
    scramble: scrambleText,
    status: "waiting",
    hostUid: currentUser.uid,
    guestUid: "",
    winnerUid: "",
    winnerName: "",
    finishDeadlineMs: 0,
    round: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId), room);
  await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", currentUser.uid), createPlayer("host"));
  activeRoomId = roomId;
  activeRoomRole = "host";
  roomIdInput.value = roomId;
  roomUrlOutput.value = getRoomUrl(roomId);
  if (mode === "friend") {
    clearFriendLobby();
    setBattleStatus("Friend room created. Share the invite link.");
    friendLobbyUnsubscribe = onSnapshot(doc(db, BATTLE_ROOMS_COLLECTION, roomId), snapshot => {
      const waitingRoom = snapshot.data();
      if (waitingRoom?.guestUid) {
        clearFriendLobby();
        watchRoom(roomId);
      }
    });
  } else {
    watchRoom(roomId);
  }
}

async function startRandomBattle() {
  if (!currentUser) {
    setRandomStatus("Log in or use Guest Login to find an opponent.");
    return;
  }

  if (matchmakingUnsubscribe || randomRoomUnsubscribe) {
    setRandomStatus("Searching for an opponent...");
    return;
  }

  if (activeRoomId && !document.body.classList.contains("battle-mode")) {
    clearFriendLobby();
    activeRoomId = "";
    activeRoomRole = "";
  }

  await clearMyMatchmakingEntry();
  const waitingQuery = query(
    collection(db, MATCHMAKING_COLLECTION),
    where("status", "==", "waiting"),
    orderBy("createdAt", "asc"),
    limit(10)
  );
  const waitingSnapshot = await getDocs(waitingQuery);
  const candidate = waitingSnapshot.docs.find(queueDoc =>
    queueDoc.id !== currentUser.uid && queueDoc.data().roomId
  );

  if (candidate) {
    setRandomStatus("Matched!");
    await joinBattleRoom(candidate.data().roomId);
    return;
  }

  const roomId = createRoomId();
  const scramble = getBattleScramble();
  if (!scramble) {
    setRandomStatus("Scramble generator is not ready.");
    return;
  }

  const room = {
    roomId,
    mode: "random",
    scramble,
    status: "waiting",
    hostUid: currentUser.uid,
    guestUid: "",
    winnerUid: "",
    winnerName: "",
    finishDeadlineMs: 0,
    round: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId), room);
  await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", currentUser.uid), createPlayer("host"));
  await setDoc(doc(db, MATCHMAKING_COLLECTION, currentUser.uid), {
    uid: currentUser.uid,
    name: getPlayerName(),
    status: "waiting",
    roomId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  setRandomStatus("Searching for an opponent...");
  activeRoomId = roomId;
  activeRoomRole = "host";
  clearFriendLobby();
  friendLobbyUnsubscribe = onSnapshot(doc(db, BATTLE_ROOMS_COLLECTION, roomId), snapshot => {
    const waitingRoom = snapshot.data();
    if (waitingRoom?.guestUid) {
      clearFriendLobby();
      clearMatchmakingListeners();
      clearMyMatchmakingEntry();
      setRandomStatus("Matched!");
      watchRoom(roomId);
    }
  });
  matchmakingUnsubscribe = onSnapshot(doc(db, MATCHMAKING_COLLECTION, currentUser.uid), snapshot => {
    const entry = snapshot.data();
    if (entry?.status === "matched" && entry.roomId) enterMatchedRandomRoom(entry.roomId);
  });
  watchForRandomRoom();
  matchmakingTimeout = window.setTimeout(() => {
    cancelRandomMatch("No opponent found. Matchmaking cancelled.");
  }, 60000);
}

async function joinBattleRoom(roomId) {
  if (!currentUser) {
    setBattleStatus("Log in or use Guest Login to join a room.");
    return;
  }

  const normalizedRoomId = roomId.trim().toUpperCase();
  if (!normalizedRoomId) return;

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, normalizedRoomId);
  const snapshot = await getDoc(roomRef);

  if (!snapshot.exists()) {
    setBattleStatus("Room not found.");
    return;
  }

  let room = snapshot.data();
  if (room.status === "cancelled" || room.status === "finished") {
    setBattleStatus("This room is no longer available.");
    return;
  }

  if (room.hostUid === currentUser.uid) {
    activeRoomRole = "host";
  } else {
    try {
      await runTransaction(db, async transaction => {
        const currentRoomSnapshot = await transaction.get(roomRef);
        if (!currentRoomSnapshot.exists()) throw new Error("Room not found.");
        room = currentRoomSnapshot.data();

        if (room.guestUid && room.guestUid !== currentUser.uid) {
          throw new Error("This room already has two players.");
        }

        if (!room.guestUid) {
          transaction.update(roomRef, {
            guestUid: currentUser.uid,
            updatedAt: serverTimestamp()
          });
        }
      });
    } catch (error) {
      setBattleStatus(error.message || "This room already has two players.");
      return;
    }

    activeRoomRole = "guest";
    await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, normalizedRoomId, "players", currentUser.uid), createPlayer("guest"));
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

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.data();
  if (room.status === "finishing" || room.status === "finished") {
    setBattleStatus("This battle has already ended.");
    return;
  }

  let scramble = room.scramble;
  if (!scramble && activeRoomRole === "host") {
    scramble = getBattleScramble();
    if (!scramble) {
      setBattleStatus("Scramble generator is not ready.");
      return;
    }
    await updateDoc(roomRef, { scramble, updatedAt: serverTimestamp() });
  }

  if (!scramble) {
    setBattleStatus("Waiting for the room scramble.");
    return;
  }

  const inspectionStartTimeMs = Date.now();

  await updateDoc(roomRef, {
    status: "ready",
    updatedAt: serverTimestamp()
  });
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "inspecting",
    round: activeRound,
    inspectionStartTime: serverTimestamp(),
    inspectionStartTimeMs,
    updatedAt: serverTimestamp()
  });

  window.startBattleInspection?.(scramble, inspectionStartTimeMs, activeRound);
}

async function notifyBattleSolveStarted() {
  if (!currentUser || !activeRoomId || !activeRoomRole || !document.body.classList.contains("battle-mode")) return;

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "solving",
    startTime: serverTimestamp(),
    startTimeMs: Date.now(),
    updatedAt: serverTimestamp()
  }).catch(console.error);
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
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
    round: activeRound,
    timestamp: serverTimestamp()
  };
  const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid);

  await Promise.all([
    addDoc(collection(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid, "moves"), moveData),
    updateDoc(playerRef, { lastMove: moveData.move, updatedAt: serverTimestamp() })
  ]).catch(console.error);
}

async function submitBattleSolve(time, scramble, solveStats = {}) {
  if (!currentUser || !activeRoomId || !document.body.classList.contains("battle-mode")) return;
  if (!Number.isFinite(time) || time < 3 || time >= 3600) return;

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid);

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

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const hostRef = activeRoom.hostUid ? doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", activeRoom.hostUid) : null;
  const guestRef = activeRoom.guestUid ? doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", activeRoom.guestUid) : null;

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
  if (currentUser && activeRoomId && document.body.classList.contains("battle-mode")) {
    updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
      status: "returned",
      updatedAt: serverTimestamp()
    }).catch(console.error);
  }

  clearBattleListeners();
  window.opponentCube?.clear();
  clearFriendLobby();
  clearMatchmakingListeners();
  activeRoom = null;
  activeRoomId = "";
  activeRoomRole = "";
  activeRound = 1;
  localBattleTimerSeconds = 0;
  battleReadyBtn.hidden = true;
  battleRematchPanel.hidden = true;
  setBattleMode(false);
  if (typeof window.cancelCurrentSolve === "function") {
    window.cancelCurrentSolve();
  } else {
    document.body.classList.remove("solving");
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  url.searchParams.delete("battleRoom");
  window.history.replaceState({}, "", url);
}

async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function loginAsGuest() {
  const name = nameInput.value.trim();
  if (!name) {
    setStatus("Please enter a player name.");
    nameInput.focus();
    return;
  }

  const credential = await signInAnonymously(auth);
  await updateProfile(credential.user, { displayName: name });
}

function renderOpponentCube(opponent) {
  if (!opponentCubePanel || !opponentCubeStatus) return;

  const disconnected = isPlayerDisconnected(opponent);
  opponentCubePanel.classList.toggle("opponent-unavailable", !opponent || disconnected);
  opponentCubeStatus.textContent = !opponent
    ? "Waiting for opponent..."
    : (disconnected ? "Opponent left" : `Opponent: ${(opponent.status || "joined").toUpperCase()}`);
}

function setupModalUi() {
  howToPlayBtn?.addEventListener("click", () => {
    howToPlayModal.hidden = false;
  });

  profileBtn?.addEventListener("click", () => {
    showProfile().catch(error => {
      profileModal.hidden = false;
      profileBody.textContent = "Profile could not be loaded.";
      console.error(error);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => {
      const modal = document.getElementById(button.dataset.closeModal);
      if (modal) modal.hidden = true;
    });
  });

  [howToPlayModal, profileModal].forEach(modal => {
    modal?.addEventListener("click", event => {
      if (event.target === modal) modal.hidden = true;
    });
  });
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
    createBattleRoom("friend").catch(error => {
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

  copyInviteBtn.addEventListener("click", () => {
    if (!activeRoomId) {
      setBattleStatus("Create or join a friend room first.");
      return;
    }

    copyRoomUrl(activeRoomId, setBattleStatus);
  });

  randomBattleBtn.addEventListener("click", () => {
    startRandomBattle().catch(error => {
      setRandomStatus("Matchmaking could not start.");
      console.error(error);
    });
  });

  cancelMatchBtn.addEventListener("click", () => {
    cancelRandomMatch().catch(error => {
      setRandomStatus("Could not cancel matchmaking.");
      console.error(error);
    });
  });

  battleChoiceButtons.forEach(button => {
    button.addEventListener("click", () => setBattleChoice(button.dataset.battleChoice));
  });

  battleReadyBtn.addEventListener("click", () => {
    readyBattleRoom().catch(error => {
      battleNotice.textContent = "Could not set ready.";
      console.error(error);
    });
  });

  playAgainBtn.addEventListener("click", () => {
    requestRematch().catch(error => {
      battleNotice.textContent = "Could not start a rematch.";
      console.error(error);
    });
  });

  copyRoomUrlBtn.addEventListener("click", async () => {
    if (!activeRoomId) return;

    copyRoomUrl(activeRoomId, message => {
      battleNotice.textContent = message;
    });
  });

  leaveBattleBtn.addEventListener("click", leaveBattleMode);
  rematchReturnBtn.addEventListener("click", leaveBattleMode);
}

periodButtons.forEach(button => {
  button.addEventListener("click", () => {
    periodButtons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activePeriod = button.dataset.period;
    refreshRanking();
    refreshAccountRank();
  });
});

rankingTypeButtons.forEach(button => {
  button.addEventListener("click", () => {
    rankingTypeButtons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeRankingType = button.dataset.rankingType;
    refreshRanking();
    refreshAccountRank();
  });
});

setupModalUi();

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

      const roomFromUrl = new URLSearchParams(window.location.search).get("battleRoom");
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
