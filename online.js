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
const PENDING_SOLVES_KEY = "pendingOnlineSolves";

let auth = null;
let db = null;
let currentUser = null;
let activePeriod = "today";
let activeRankingType = "single";
let activeRoomId = "";
let activeRoomRole = "";
let activeRoomUnsubscribe = null;

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

function emptyParticipant() {
  return {
    uid: "",
    name: "",
    state: "waiting",
    time: null,
    tps: null,
    moveCount: 0,
    moves: []
  };
}

function currentParticipant(state = "waiting") {
  return {
    uid: currentUser.uid,
    name: getPlayerName(),
    state,
    time: null,
    tps: null,
    moveCount: 0,
    moves: []
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

function renderBattleRoom(room) {
  if (!room) return;

  const host = room.participants?.host || emptyParticipant();
  const guest = room.participants?.guest || emptyParticipant();

  roomIdInput.value = room.roomId || activeRoomId;
  roomUrlOutput.value = getRoomUrl(room.roomId || activeRoomId);
  battlePlayers.innerHTML = [
    `Host: ${host.name || "-"} / ${host.state || "waiting"} / ${Number.isFinite(host.time) ? host.time.toFixed(2) : "-"}`,
    `Guest: ${guest.name || "-"} / ${guest.state || "waiting"} / ${Number.isFinite(guest.time) ? guest.time.toFixed(2) : "-"}`
  ].join("<br>");
  battleWinner.textContent = room.winnerName ? `Winner: ${room.winnerName}` : "";
}

function watchRoom(roomId) {
  if (activeRoomUnsubscribe) {
    activeRoomUnsubscribe();
  }

  activeRoomUnsubscribe = onSnapshot(doc(db, "rooms", roomId), snapshot => {
    if (!snapshot.exists()) {
      setBattleStatus("Room not found.");
      return;
    }

    const room = snapshot.data();
    renderBattleRoom(room);
    setBattleStatus(`Room ${roomId}: ${activeRoomRole || "watching"}`);
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
    winnerUid: "",
    winnerName: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    participants: {
      host: currentParticipant("waiting"),
      guest: emptyParticipant()
    }
  };

  await setDoc(doc(db, "rooms", roomId), room);
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
  const host = room.participants?.host;
  const guest = room.participants?.guest;

  if (host?.uid === currentUser.uid) {
    activeRoomRole = "host";
  } else if (!guest?.uid || guest.uid === currentUser.uid) {
    activeRoomRole = "guest";
    await updateDoc(roomRef, {
      "participants.guest": currentParticipant("waiting"),
      updatedAt: serverTimestamp()
    });
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
  await updateDoc(roomRef, {
    [`participants.${activeRoomRole}.state`]: "ready",
    updatedAt: serverTimestamp()
  });

  if (typeof window.loadBattleScramble === "function") {
    window.loadBattleScramble(room.scramble);
  }
}

async function notifyBattleSolveStarted() {
  if (!currentUser || !activeRoomId || !activeRoomRole) return;

  await updateDoc(doc(db, "rooms", activeRoomId), {
    [`participants.${activeRoomRole}.state`]: "solving",
    updatedAt: serverTimestamp()
  }).catch(console.error);
}

async function submitBattleSolve(time, scramble, solveStats = {}) {
  if (!currentUser || !activeRoomId || !activeRoomRole) return;

  const roomRef = doc(db, "rooms", activeRoomId);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.data();
  if (room.scramble !== scramble) return;

  const updates = {
    [`participants.${activeRoomRole}.state`]: "finished",
    [`participants.${activeRoomRole}.time`]: time,
    [`participants.${activeRoomRole}.tps`]: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
    [`participants.${activeRoomRole}.moveCount`]: Number.isFinite(solveStats.moveCount) ? solveStats.moveCount : 0,
    [`participants.${activeRoomRole}.moves`]: Array.isArray(solveStats.moves) ? solveStats.moves.slice(0, 500) : [],
    updatedAt: serverTimestamp()
  };

  const otherRole = activeRoomRole === "host" ? "guest" : "host";
  const other = room.participants?.[otherRole];

  if (other?.state === "finished" && Number.isFinite(other.time)) {
    const winnerRole = time <= other.time ? activeRoomRole : otherRole;
    const winner = winnerRole === activeRoomRole ? currentParticipant("finished") : other;
    updates.status = "finished";
    updates.winnerUid = winner.uid;
    updates.winnerName = winner.name;
  }

  await updateDoc(roomRef, updates);
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
