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
const battleRatingList = document.getElementById("battleRatingList");
const authStatus = document.getElementById("authStatus");
const totalUsersDisplay = document.getElementById("totalUsersDisplay");
const accountGreeting = document.getElementById("accountGreeting");
const accountRank = document.getElementById("accountRank");
const accountRating = document.getElementById("accountRating");
const accountBattleRank = document.getElementById("accountBattleRank");
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
const rankedTimeLimitDisplay = document.getElementById("rankedTimeLimitDisplay");
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
const USERS_COLLECTION = "users";
const STATS_COLLECTION = "stats";
const GLOBAL_STATS_DOCUMENT = "global";
const INITIAL_RATING = 1200;
const ELO_K_FACTOR = 32;
const RANKING_CACHE_TTL_MS = 5 * 60 * 1000;
const RANKING_LIMIT = 50;
const MATCHMAKING_LIMIT = 10;

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
let rankedMatchExpansionTimeouts = [];
let rankedMatchAttempting = false;
let rankedSearchInterval = null;
let rankedSearchStartedAt = 0;
let friendLobbyUnsubscribe = null;
let opponentExitTimeout = null;
let displayedOpponentRatingUid = "";
let readyInspectionStarting = false;
let ratingUpdateInProgress = false;
let completionScoreWriteTimeout = null;
let pendingCompletionScore = null;
const savedBattleResultKeys = new Set();
const refreshedBattleRatingKeys = new Set();
const rankingCache = new Map();
let battleRatingCache = { entries: [], timestamp: 0 };
let battleRatingFetchPromise = null;

function getRankingCacheKey(rankingType = activeRankingType, period = activePeriod) {
  return `${rankingType}_${period}`;
}

function getCachedRankingEntries(rankingType = activeRankingType, period = activePeriod) {
  const cached = rankingCache.get(getRankingCacheKey(rankingType, period));
  return cached && Date.now() - cached.timestamp < RANKING_CACHE_TTL_MS
    ? cached.entries
    : null;
}

function invalidateRankingCache() {
  rankingCache.clear();
}

function isConfigured() {
  return Boolean(config.apiKey && !config.apiKey.startsWith("YOUR_"));
}

function setStatus(message) {
  authStatus.textContent = message;
}

function userRef(uid = currentUser?.uid) {
  return uid ? doc(db, USERS_COLLECTION, uid) : null;
}

function globalStatsRef() {
  return doc(db, STATS_COLLECTION, GLOBAL_STATS_DOCUMENT);
}

function defaultUserStats() {
  return {
    rating: INITIAL_RATING,
    rankedBattles: 0,
    friendBattles: 0,
    wins: 0,
    losses: 0,
    rankedWins: 0,
    rankedLosses: 0,
    rankedDraws: 0,
    friendWins: 0,
    friendLosses: 0
  };
}

function getRating(profile) {
  const rating = Number(profile?.rating);
  return Number.isFinite(rating) ? rating : INITIAL_RATING;
}

function calculateEloChanges(hostProfile, guestProfile, winnerUid, hostUid, guestUid, isDraw = false) {
  const hostBefore = getRating(hostProfile);
  const guestBefore = getRating(guestProfile);
  const hostExpected = 1 / (1 + Math.pow(10, (guestBefore - hostBefore) / 400));
  const hostScore = isDraw ? 0.5 : (winnerUid === hostUid ? 1 : 0);
  const hostChange = Math.round(ELO_K_FACTOR * (hostScore - hostExpected));
  const guestChange = -hostChange;

  return {
    [hostUid]: { before: hostBefore, after: hostBefore + hostChange, change: hostChange },
    [guestUid]: { before: guestBefore, after: guestBefore + guestChange, change: guestChange }
  };
}

function createRankedPairId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

function getRepeatedOpponentMultiplier(battleNumber) {
  if (battleNumber <= 5) return 1;
  if (battleNumber <= 10) return 0.5;
  return 0;
}

function applyRatingMultiplier(ratingChanges, hostUid, guestUid, multiplier) {
  const host = ratingChanges[hostUid];
  const guest = ratingChanges[guestUid];
  const hostChange = Math.round(host.change * multiplier);
  const guestChange = -hostChange;
  return {
    [hostUid]: { before: host.before, after: host.before + hostChange, change: hostChange },
    [guestUid]: { before: guest.before, after: guest.before + guestChange, change: guestChange }
  };
}

async function ensureUserProfile() {
  if (!currentUser || !db) return;

  const reference = userRef();
  const profile = {
    uid: currentUser.uid,
    name: getPlayerName(),
    loginType: currentUser.isAnonymous ? "guest" : "google",
    updatedAt: serverTimestamp()
  };
  const statsReference = globalStatsRef();
  let profileAlreadyExists = false;

  try {
    await runTransaction(db, async transaction => {
      const profileSnapshot = await transaction.get(reference);
      profileAlreadyExists = profileSnapshot.exists();

      if (profileAlreadyExists) {
        transaction.set(reference, profile, { merge: true });
        return;
      }

      const statsSnapshot = await transaction.get(statsReference);
      const totalUsers = Number(statsSnapshot.data()?.totalUsers || 0);
      transaction.set(reference, { ...profile, ...defaultUserStats() }, { merge: true });
      transaction.set(statsReference, {
        totalUsers: totalUsers + 1,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  } catch (error) {
    // Keep authentication usable while the optional counter rule is being deployed.
    await setDoc(
      reference,
      profileAlreadyExists ? profile : { ...profile, ...defaultUserStats() },
      { merge: true }
    );
    console.warn("The total user counter could not be updated.", error);
  }
}

async function refreshTotalUsers() {
  if (!totalUsersDisplay || !db) return;

  try {
    const snapshot = await getDoc(globalStatsRef());
    const totalUsers = Number(snapshot.data()?.totalUsers);
    totalUsersDisplay.textContent = `Users: ${Number.isFinite(totalUsers) ? totalUsers : 0}`;
  } catch (error) {
    totalUsersDisplay.textContent = "Users: -";
    console.warn("The total user count could not be loaded.", error);
  }
}

async function getRankedBattleEligibility() {
  if (!currentUser || currentUser.isAnonymous) {
    return { eligible: false, message: "Ranked Battle requires Google Login." };
  }

  const solvesSnapshot = await getDocs(query(
    collection(db, "solves"),
    where("uid", "==", currentUser.uid),
    where("rankingType", "==", "single"),
    where("valid", "==", true),
    limit(1)
  ));
  const hasValidSolve = !solvesSnapshot.empty;

  return hasValidSolve
    ? { eligible: true, message: "" }
    : { eligible: false, message: "Complete one valid solve to unlock Ranked Battle." };
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
  return (typedName || fallbackName).slice(0, 24);
}

function updateAccountSummary(user, rank = null) {
  if (!user) {
    accountGreeting.textContent = "Log in to join the rankings.";
    accountRank.textContent = "Current world rank: -";
    accountRating.textContent = "Rating: -";
    accountBattleRank.textContent = "World Rank: -";
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

function isValidRankingTypeEntry(solve, rankingType) {
  if (!isValidRankingEntry(solve) || solve.valid === false) return false;

  if (rankingType === "tps") {
    const tps = Number(solve.tps);
    return Number.isFinite(tps) && tps > 0;
  }

  if (rankingType === "moves") {
    const moveCount = Number(solve.moveCount);
    return Number.isFinite(moveCount) && moveCount > 0;
  }

  return true;
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
    moves: Array.isArray(solveStats.moves)
      ? solveStats.moves.map(move => typeof move === "string" ? move : move?.move).filter(Boolean)
      : [],
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
    valid: true,
    time,
    scramble,
    tps: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
    moveCount: Number.isFinite(solveStats.moveCount) ? solveStats.moveCount : 0,
    moves: Array.isArray(solveStats.moves)
      ? solveStats.moves.map(move => typeof move === "string" ? move : move?.move).filter(Boolean)
      : [],
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

  if (submittedSingle) {
    await updateUserSolveAggregates(time, ao5, solveStats).catch(error => {
      console.warn("Profile solve aggregates could not be updated.", error);
    });
    invalidateRankingCache();
  }

  return submittedSingle;
}

function getLocalSolveSummary() {
  let solves = [];
  try {
    solves = (JSON.parse(localStorage.getItem("cubeSolves")) || [])
      .filter(solve => Number.isFinite(Number(solve.time)));
  } catch (error) {
    solves = [];
  }
  const average = count => {
    if (solves.length < count) return null;
    const values = solves.slice(0, count).map(solve => Number(solve.time)).sort((a, b) => a - b);
    values.shift();
    values.pop();
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  return { ao5: average(5), ao12: average(12) };
}

async function updateUserSolveAggregates(time, ao5, solveStats) {
  if (!currentUser) return;
  const reference = userRef();
  const localSummary = getLocalSolveSummary();
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference);
    const profile = { ...defaultUserStats(), ...(snapshot.data() || {}) };
    const previousValidSolves = Number(profile.validSolves || 0);
    const tps = Number(solveStats.tps);
    const previousAverageTps = Number(profile.averageTps || 0);
    transaction.set(reference, {
      pb: Math.min(Number(profile.pb) || Infinity, Number(time)),
      ao5: Number.isFinite(localSummary.ao5) ? Number(localSummary.ao5.toFixed(2)) : (Number.isFinite(ao5) ? ao5 : null),
      ao12: Number.isFinite(localSummary.ao12) ? Number(localSummary.ao12.toFixed(2)) : null,
      totalSolves: Number(profile.totalSolves || 0) + 1,
      validSolves: previousValidSolves + 1,
      bestTps: Number.isFinite(tps) ? Math.max(Number(profile.bestTps || 0), tps) : Number(profile.bestTps || 0),
      averageTps: Number.isFinite(tps)
        ? ((previousAverageTps * previousValidSolves) + tps) / (previousValidSolves + 1)
        : previousAverageTps,
      lastSolveAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
}

async function submitPendingSolves() {
  if (!currentUser) return;

  const pending = getPendingSolves();
  if (pending.length === 0) return;

  while (pending.length > 0) {
    const solve = pending[0];

    await addOnlineSolve(solve.time, solve.scramble, solve.ao5, solve.solvedAt, {
      tps: solve.tps,
      moveCount: solve.moveCount,
      moves: solve.moves
    });
    pending.shift();
    savePendingSolves(pending);
  }

  localStorage.removeItem(PENDING_SOLVES_KEY);
  setStatus(`Logged in as ${currentUser.displayName || "Guest"}. Pending times submitted.`);
  invalidateRankingCache();
}

async function refreshRanking(force = false) {
  if (!isConfigured()) {
    setRankingMessage("Firebase config is required.");
    return;
  }

  setRankingMessage("Loading...");

  try {
    const entries = await getRankingEntries(activeRankingType, activePeriod, force);
    rankingList.innerHTML = "";

    if (entries.length === 0) {
      setRankingMessage("-");
      refreshAccountRank(entries);
      return;
    }

    entries.slice(0, 50).forEach((solve, index) => {
      const li = document.createElement("li");
      li.textContent = formatRankingEntry(solve, index, activeRankingType);
      rankingList.appendChild(li);
    });
    refreshAccountRank(entries);
  } catch (error) {
    if (isIndexError(error)) {
      setRankingMessage(`Firestore index required: ${getRankingIndexHint(activeRankingType, activePeriod)}`);
    } else {
      setRankingMessage("Ranking could not be loaded.");
    }
    console.error(error);
  }
}

function isIndexError(error) {
  return error?.code === "failed-precondition" || String(error?.message || "").toLowerCase().includes("index");
}

function getRankingIndexHint(rankingType, period) {
  const periodField = { today: "dayKey", week: "weekKey", month: "monthKey" }[period];

  if (rankingType === "tps") {
    return periodField
      ? `solves: rankingType Asc, valid Asc, ${periodField} Asc, tps Desc`
      : "solves: rankingType Asc, valid Asc, tps Desc";
  }

  if (rankingType === "moves") {
    return periodField
      ? `solves: rankingType Asc, valid Asc, ${periodField} Asc, moveCount Asc`
      : "solves: rankingType Asc, valid Asc, moveCount Asc";
  }

  return periodField
    ? `solves: rankingType Asc, valid Asc, ${periodField} Asc, time Asc`
    : "solves: rankingType Asc, valid Asc, time Asc";
}

async function refreshBattleRatingRanking(force = false) {
  if (!battleRatingList || !isConfigured()) return;

  battleRatingList.innerHTML = "";
  if (!currentUser) {
    const item = document.createElement("li");
    item.textContent = "Log in to view battle ratings.";
    battleRatingList.appendChild(item);
    return;
  }

  try {
    const entries = await getBattleRatingEntries(force);
    entries.forEach((entry, index) => {
      const user = entry.data;
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${user.name || "Player"} - ${Math.round(Number(user.rating) || INITIAL_RATING)}`;
      battleRatingList.appendChild(item);
    });
    if (battleRatingList.children.length === 0) {
      const item = document.createElement("li");
      item.textContent = "-";
      battleRatingList.appendChild(item);
    }
  } catch (error) {
    const item = document.createElement("li");
    item.textContent = "Battle rating ranking could not be loaded.";
    battleRatingList.appendChild(item);
    console.error(error);
  }
}

async function getBattleRatingEntries(force = false) {
  if (force) battleRatingCache.timestamp = 0;
  if (!force && Date.now() - battleRatingCache.timestamp < RANKING_CACHE_TTL_MS) {
    return battleRatingCache.entries;
  }
  if (battleRatingFetchPromise) return battleRatingFetchPromise;

  battleRatingFetchPromise = getDocs(query(
    collection(db, USERS_COLLECTION),
    orderBy("rating", "desc"),
    limit(RANKING_LIMIT)
  )).then(snapshot => {
    const entries = snapshot.docs
      .map(entryDoc => ({ id: entryDoc.id, data: entryDoc.data() }))
      .filter(entry => Number(entry.data.rankedBattles || 0) > 0);
    battleRatingCache = { entries, timestamp: Date.now() };
    return entries;
  }).finally(() => {
    battleRatingFetchPromise = null;
  });
  return battleRatingFetchPromise;
}

function formatRankingEntry(solve, index, rankingType) {
  const name = solve.name || "Player";

  if (rankingType === "tps") {
    return `#${index + 1} ${Number(solve.tps).toFixed(2)} TPS - ${name}`;
  }

  if (rankingType === "moves") {
    return `#${index + 1} ${Math.round(Number(solve.moveCount))} moves - ${name}`;
  }

  const label = rankingType === "ao5" ? "Ao5" : "Single";
  return `#${index + 1} ${Number(solve.time).toFixed(2)} ${label} - ${name}`;
}

async function refreshBattleAccountRating(force = false) {
  if (!currentUser || currentUser.isAnonymous) {
    accountRating.textContent = "Rating: -";
    accountBattleRank.textContent = "World Rank: -";
    return;
  }

  try {
    const [profileSnapshot, rankedUsers] = await Promise.all([
      getDoc(userRef()),
      getBattleRatingEntries(force)
    ]);
    const profile = profileSnapshot.data() || {};
    const rankIndex = rankedUsers.findIndex(entry => entry.id === currentUser.uid);
    accountRating.textContent = "Rating: " + Math.round(Number(profile.rating) || INITIAL_RATING);
    accountBattleRank.textContent = rankIndex >= 0
      ? "World Rank: #" + (rankIndex + 1)
      : (Number(profile.rankedBattles || 0) > 0 ? "World Rank: #50+" : "World Rank: -");
  } catch (error) {
    accountRating.textContent = "Rating: -";
    accountBattleRank.textContent = "World Rank: -";
    console.error(error);
  }
}

async function getRankingEntries(rankingType, period, force = false) {
  const cacheKey = getRankingCacheKey(rankingType, period);
  if (!force) {
    const cached = getCachedRankingEntries(rankingType, period);
    if (cached) return cached;
  }

  const solvesRef = collection(db, "solves");
  let rankingQuery;

  if (rankingType === "tps" || rankingType === "moves") {
    const metricField = rankingType === "tps" ? "tps" : "moveCount";
    const direction = rankingType === "tps" ? "desc" : "asc";

    if (period === "all") {
      rankingQuery = query(
        solvesRef,
        where("rankingType", "==", "single"),
        where("valid", "==", true),
        orderBy(metricField, direction),
        limit(RANKING_LIMIT)
      );
    } else {
      const keys = getPeriodKeys();
      const fieldMap = { today: "dayKey", week: "weekKey", month: "monthKey" };
      rankingQuery = query(
        solvesRef,
        where("rankingType", "==", "single"),
        where("valid", "==", true),
        where(fieldMap[period], "==", keys[period]),
        orderBy(metricField, direction),
        limit(RANKING_LIMIT)
      );
    }

    const snapshot = await getDocs(rankingQuery);
    const entries = [];
    snapshot.forEach(entryDoc => {
      const solve = entryDoc.data();
      if (isValidRankingTypeEntry(solve, rankingType)) entries.push(solve);
    });

    const sortedEntries = entries.sort((a, b) => rankingType === "tps"
      ? Number(b.tps) - Number(a.tps)
      : Number(a.moveCount) - Number(b.moveCount));
    rankingCache.set(cacheKey, { entries: sortedEntries, timestamp: Date.now() });
    return sortedEntries;
  }

  if (period === "all") {
    rankingQuery = query(
      solvesRef,
      where("rankingType", "==", rankingType),
      where("valid", "==", true),
      orderBy("time", "asc"),
      limit(RANKING_LIMIT)
    );
  } else {
    const keys = getPeriodKeys();
    const fieldMap = { today: "dayKey", week: "weekKey", month: "monthKey" };

    rankingQuery = query(
      solvesRef,
      where("rankingType", "==", rankingType),
      where("valid", "==", true),
      where(fieldMap[period], "==", keys[period]),
      orderBy("time", "asc"),
      limit(RANKING_LIMIT)
    );
  }

  const snapshot = await getDocs(rankingQuery);
  const entries = [];
  snapshot.forEach(entryDoc => {
    const solve = entryDoc.data();
    if (isValidRankingTypeEntry(solve, rankingType)) entries.push(solve);
  });

  const sortedEntries = entries.sort((a, b) => Number(a.time) - Number(b.time));
  rankingCache.set(cacheKey, { entries: sortedEntries, timestamp: Date.now() });
  return sortedEntries;
}

async function calculateMyRankingRank() {
  if (!currentUser) return null;
  const entries = getCachedRankingEntries(activeRankingType, activePeriod);
  if (!entries) return null;

  const myBest = entries.find(solve => solve.uid === currentUser.uid);
  if (!myBest) return null;

  return entries.findIndex(solve => solve === myBest) + 1;
}

async function refreshAccountRank(entries = null) {
  if (!currentUser) {
    updateAccountSummary(null);
    return;
  }

  try {
    const rankingEntries = entries || getCachedRankingEntries(activeRankingType, activePeriod);
    if (!rankingEntries) {
      updateAccountSummary(currentUser, null);
      return;
    }
    const rankIndex = rankingEntries.findIndex(solve => solve.uid === currentUser.uid);
    updateAccountSummary(currentUser, rankIndex >= 0 ? rankIndex + 1 : "50+");
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
    const profileSnapshot = await getDoc(userRef());
    const profileStats = { ...defaultUserStats(), ...(profileSnapshot.data() || {}) };
    const cachedRanking = getCachedRankingEntries(activeRankingType, activePeriod);
    const rankIndex = cachedRanking?.findIndex(solve => solve.uid === currentUser.uid) ?? -1;
    const rankedUsers = battleRatingCache.entries;
    const battleRankIndex = rankedUsers.findIndex(entry => entry.id === currentUser.uid);
    const localSummary = getLocalSolveSummary();
    const localSolves = (() => {
      try {
        return (JSON.parse(localStorage.getItem("cubeSolves")) || []).filter(solve => Number.isFinite(Number(solve.time)));
      } catch (error) {
        return [];
      }
    })();
    const localTps = localSolves.map(solve => Number(solve.tps)).filter(Number.isFinite);
    const latestDate = profileStats.lastSolveAt?.toDate?.() || (localSolves[0]?.date ? new Date(localSolves[0].date) : null);
    const battleCount = Number(profileStats.rankedBattles || 0) + Number(profileStats.friendBattles || 0);
    const wins = Number(profileStats.wins || 0);
    const losses = Number(profileStats.losses || 0);

    profileBody.innerHTML = "";
    profileBody.appendChild(createProfileGrid([
      ["Display name", getPlayerName()],
      ["Login type", currentUser.isAnonymous ? "Guest" : "Google"],
      ["PB", Number(profileStats.pb) > 0 ? Number(profileStats.pb).toFixed(2) : (localSolves.length ? Math.min(...localSolves.map(solve => Number(solve.time))).toFixed(2) : "-")],
      ["AO5", Number(profileStats.ao5) > 0 ? Number(profileStats.ao5).toFixed(2) : (localSummary.ao5?.toFixed(2) || "-")],
      ["AO12", Number(profileStats.ao12) > 0 ? Number(profileStats.ao12).toFixed(2) : (localSummary.ao12?.toFixed(2) || "-")],
      ["Current world rank", rankIndex >= 0 ? `#${rankIndex + 1}` : (cachedRanking ? "#50+" : "-")],
      ["Total solves", String(Number(profileStats.totalSolves || 0) || localSolves.length)],
      ["Valid solves", String(Number(profileStats.validSolves || 0) || localSolves.length)],
      ["Best TPS", Number(profileStats.bestTps || 0) > 0 ? Number(profileStats.bestTps).toFixed(2) : (localTps.length ? Math.max(...localTps).toFixed(2) : "-")],
      ["Average TPS", Number(profileStats.averageTps || 0) > 0 ? Number(profileStats.averageTps).toFixed(2) : (localTps.length ? (localTps.reduce((sum, value) => sum + value, 0) / localTps.length).toFixed(2) : "-")],
      ["Last solve date", latestDate && !Number.isNaN(latestDate.getTime()) ? latestDate.toLocaleString() : "-"]
    ]));

    const title = document.createElement("h3");
    title.className = "profile-section-title";
    title.textContent = "Battle Stats";
    profileBody.appendChild(title);
    profileBody.appendChild(createProfileGrid([
      ["Current rating", currentUser.isAnonymous ? "-" : String(Math.round(Number(profileStats.rating) || INITIAL_RATING))],
      ["Current battle rank", currentUser.isAnonymous ? "-" : (battleRankIndex >= 0 ? `#${battleRankIndex + 1}` : (Number(profileStats.rankedBattles || 0) > 0 ? "#50+" : "-"))],
      ["Ranked battles", String(profileStats.rankedBattles || 0)],
      ["Friend battles", String(profileStats.friendBattles || 0)],
      ["Ranked wins", String(profileStats.rankedWins || 0)],
      ["Ranked losses", String(profileStats.rankedLosses || 0)],
      ["Friend wins", String(profileStats.friendWins || 0)],
      ["Friend losses", String(profileStats.friendLosses || 0)],
      ["Total battles", String(battleCount)],
      ["Wins", String(wins)],
      ["Losses", String(losses)],
      ["DNFs", String(Number(profileStats.dnfs || 0))],
      ["Win rate", battleCount ? `${((wins / battleCount) * 100).toFixed(1)}%` : "-"],
      ["Best battle time", Number(profileStats.bestBattleTime) > 0 ? Number(profileStats.bestBattleTime).toFixed(2) : "-"],
      ["Average battle time", Number(profileStats.averageBattleTime) > 0 ? Number(profileStats.averageBattleTime).toFixed(2) : "-"],
      ["Current battle streak", String(Number(profileStats.currentBattleStreak || 0))],
      ["Ranked battle wins", String(profileStats.rankedWins || 0)],
      ["Friend battle wins", String(profileStats.friendWins || 0)]
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

    invalidateRankingCache();
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
    currentCompletionScore: 0,
    maxCompletionScore: 0,
    timeLimitReached: false,
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

function formatRankedSearchElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function stopRankedSearchTimer() {
  if (rankedSearchInterval) window.clearInterval(rankedSearchInterval);
  rankedSearchInterval = null;
  rankedSearchStartedAt = 0;
}

function startRankedSearchTimer() {
  stopRankedSearchTimer();
  rankedSearchStartedAt = Date.now();

  const render = () => {
    setRandomStatus(`Opponent searching... ${formatRankedSearchElapsed(Date.now() - rankedSearchStartedAt)}`);
  };

  render();
  rankedSearchInterval = window.setInterval(render, 1000);
}

function setBattleChoice(choice) {
  selectedBattleMode = choice;
  battleChoiceButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.battleChoice === choice);
  });
  friendBattleControls.hidden = choice !== "friend";
  randomBattleControls.hidden = choice !== "ranked";
}

function clearFriendLobby() {
  if (friendLobbyUnsubscribe) friendLobbyUnsubscribe();
  friendLobbyUnsubscribe = null;
}

function clearMatchmakingListeners() {
  if (matchmakingUnsubscribe) matchmakingUnsubscribe();
  if (randomRoomUnsubscribe) randomRoomUnsubscribe();
  if (matchmakingTimeout) window.clearTimeout(matchmakingTimeout);
  rankedMatchExpansionTimeouts.forEach(timeout => window.clearTimeout(timeout));
  matchmakingUnsubscribe = null;
  randomRoomUnsubscribe = null;
  matchmakingTimeout = null;
  rankedMatchExpansionTimeouts = [];
  rankedMatchAttempting = false;
  stopRankedSearchTimer();
}

async function clearMyMatchmakingEntry() {
  if (!currentUser) return;
  await deleteDoc(doc(db, MATCHMAKING_COLLECTION, currentUser.uid)).catch(() => {});
}

function enterMatchedRankedRoom(roomId) {
  if (!roomId || activeRoomId) return;
  clearMatchmakingListeners();
  clearMyMatchmakingEntry();
  setRandomStatus("Matched!");
  joinBattleRoom(roomId, true).catch(error => {
    setRandomStatus("Match could not be opened.");
    console.error(error);
  });
}

function watchForRankedRoom() {
  if (!currentUser || randomRoomUnsubscribe) return;

  const roomQuery = query(
    collection(db, BATTLE_ROOMS_COLLECTION),
    where("guestUid", "==", currentUser.uid),
    where("mode", "==", "ranked"),
    where("status", "in", ["waiting", "ready", "solving"]),
    limit(1)
  );

  randomRoomUnsubscribe = onSnapshot(roomQuery, snapshot => {
    const room = snapshot.docs
      .map(roomDoc => ({ id: roomDoc.id, ...roomDoc.data() }))
      .find(room => room.mode === "ranked" && ["waiting", "ready", "solving"].includes(room.status));

    if (room) enterMatchedRankedRoom(room.id);
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
  if (completionScoreWriteTimeout) window.clearTimeout(completionScoreWriteTimeout);
  completionScoreWriteTimeout = null;
  pendingCompletionScore = null;
}

function setBattleMode(enabled) {
  document.body.classList.toggle("battle-mode", enabled);
  if (enabled) {
    const battleModal = document.getElementById("battleModal");
    if (battleModal) battleModal.hidden = true;
  }

  if (enabled && !battleClockInterval) {
    battleClockInterval = window.setInterval(renderBattleUi, 100);
  }

  if (enabled && !battlePresenceInterval) {
    battlePresenceInterval = window.setInterval(sendBattleHeartbeat, 30000);
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
  return updatedAt > 0 && Date.now() - updatedAt > 75000;
}

function isCountedBattleMove(move) {
  return !["x", "x'", "y", "y'", "z", "z'"].includes(move?.move);
}

function calculateBattleMoveCount(moves) {
  if (typeof window.calculateNormalizedMoveCount === "function") {
    return window.calculateNormalizedMoveCount(moves);
  }

  return (Array.isArray(moves) ? moves : []).filter(isCountedBattleMove).length;
}

function getBattlePlayerSeconds(player, role) {
  return role === activeRoomRole
    ? localBattleTimerSeconds
    : getPlayerElapsedSeconds(player);
}

function renderRankedTimeLimit(you) {
  if (!rankedTimeLimitDisplay) return;
  const isRanked = activeRoom?.mode === "ranked";
  rankedTimeLimitDisplay.hidden = !isRanked;
  if (!isRanked) return;

  const elapsed = getBattlePlayerSeconds(you, activeRoomRole);
  const remaining = Math.max(0, 120 - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(Math.floor(remaining % 60)).padStart(2, "0");
  rankedTimeLimitDisplay.textContent = you?.timeLimitReached
    ? `Time limit reached | Completion Score: ${you.maxCompletionScore || 0} / 54`
    : `Time limit: 2:00 | Remaining: ${minutes}:${seconds}`;
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
    const timeLimitReached = Boolean(activeRoom.timeLimitReached);
    const result = activeRoom.isDraw
      ? "draw"
      : (timeLimitReached || finished)
        ? (activeRoom.winnerUid === currentUser.uid ? "win" : "loss")
        : "dnf";
    const ratingChange = activeRoom.ratingChanges?.[currentUser.uid]?.change || 0;
    const ratingBefore = activeRoom.ratingChanges?.[currentUser.uid]?.before ?? null;
    const ratingAfter = activeRoom.ratingChanges?.[currentUser.uid]?.after ?? null;

    await setDoc(resultRef, {
      uid: currentUser.uid,
      name: getPlayerName(),
      roomId: activeRoomId,
      round: activeRound,
      mode: activeRoom.mode === "ranked" ? "ranked" : "friend",
      result,
      ratingChange,
      ratingBefore,
      ratingAfter,
      repeatedOpponentBattleCount: Number(activeRoom.repeatedOpponentBattleCount || 0),
      ratingMultiplier: Number(activeRoom.ratingMultiplier ?? 1),
      ratingApplied: Boolean(activeRoom.ratingApplied),
      finalTime: finished ? Number(you.finalTime) : null,
      tps: finished && Number.isFinite(you.tps) ? Number(you.tps) : null,
      moveCount: finished && Number.isFinite(you.moveCount) ? Number(you.moveCount) : 0,
      opponentUid: opponent?.uid || "",
      opponentName: opponent?.name || "Player",
      opponentRatingBefore: activeRoom.ratingChanges?.[opponent?.uid]?.before ?? null,
      opponentRatingAfter: activeRoom.ratingChanges?.[opponent?.uid]?.after ?? null,
      maxCompletionScore: Number(you.maxCompletionScore) || 0,
      opponentMaxCompletionScore: Number(opponent?.maxCompletionScore) || 0,
      timeLimitReached,
      createdAt: serverTimestamp()
    });
    window.trackCubeEvent?.("battle_finish", {
      result: result === "loss" ? "lose" : result
    });
    if (activeRoom.mode !== "ranked" || !activeRoom.ratingApplied) {
      await recordOwnBattleStats(result, activeRoom.mode);
    }
  } catch (error) {
    savedBattleResultKeys.delete(resultId);
    throw error;
  }
}

async function recordOwnBattleStats(result, mode) {
  if (!currentUser) return;

  const reference = userRef();
  const snapshot = await getDoc(reference);
  const profile = { ...defaultUserStats(), ...(snapshot.data() || {}) };
  const prefix = mode === "ranked" ? "ranked" : "friend";
  const won = result === "win";
  const updates = {
    uid: currentUser.uid,
    name: getPlayerName(),
    wins: Number(profile.wins || 0) + (won ? 1 : 0),
    losses: Number(profile.losses || 0) + (won ? 0 : 1),
    [`${prefix}Battles`]: Number(profile[`${prefix}Battles`] || 0) + 1,
    [`${prefix}Wins`]: Number(profile[`${prefix}Wins`] || 0) + (won ? 1 : 0),
    [`${prefix}Losses`]: Number(profile[`${prefix}Losses`] || 0) + (won ? 0 : 1),
    updatedAt: serverTimestamp()
  };
  if (!snapshot.exists()) {
    updates.rating = INITIAL_RATING;
  } else if (Object.prototype.hasOwnProperty.call(snapshot.data() || {}, "rating")) {
    updates.rating = Number(profile.rating) || INITIAL_RATING;
  }
  await setDoc(reference, updates, { merge: true });
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
  const isDnf = activeRoom?.status === "finished" && !activeRoom?.timeLimitReached && player && !isFinished;
  const isDisconnected = isPlayerDisconnected(player);
  const moves = battleMovesByRole[role] || [];
  const currentTimer = getBattlePlayerSeconds(player, role);

  setBattleText(`${prefix}Name`, player?.name || (prefix === "battleOpponent" ? "Waiting for player..." : "-"));
  const visibleMoveCount = isFinished
    ? player.moveCount
    : calculateBattleMoveCount(moves);

  setBattleText(`${prefix}State`, isDisconnected ? "DISCONNECTED" : (isDnf ? "DNF" : (player?.status || "waiting").toUpperCase()));
  setBattleText(`${prefix}Timer`, isFinished ? formatBattleTime(player.finalTime) : formatBattleTime(currentTimer));
  setBattleText(`${prefix}Final`, isDnf ? "DNF" : formatBattleTime(player?.finalTime));
  setBattleText(`${prefix}Tps`, isDnf ? "-" : (Number.isFinite(player?.tps) ? player.tps.toFixed(2) : "-"));
  setBattleText(`${prefix}MoveCount`, isDnf || !player ? "-" : String(visibleMoveCount || 0));
  setBattleText(`${prefix}CompletionScore`, player ? `${player.maxCompletionScore || 0} / 54` : "-");
  setBattleText(`${prefix}LastMove`, player?.lastMove || moves.at(-1)?.move || "-");
  setBattleText(`${prefix}MoveLog`, moves.length ? moves.slice(-20).map(move => move.move).join(" ") : "-");
}

async function loadOpponentRating(opponent) {
  const display = document.getElementById("battleOpponentRating");
  if (!display) return;

  if (!opponent?.uid) {
    displayedOpponentRatingUid = "";
    display.textContent = "-";
    return;
  }
  if (displayedOpponentRatingUid === opponent.uid) return;

  displayedOpponentRatingUid = opponent.uid;
  display.textContent = "Loading...";
  try {
    const snapshot = await getDoc(userRef(opponent.uid));
    if (displayedOpponentRatingUid !== opponent.uid) return;
    const profile = snapshot.data();
    display.textContent = !profile || profile.loginType === "guest"
      ? "-"
      : String(Math.round(getRating(profile)));
  } catch (error) {
    if (displayedOpponentRatingUid === opponent.uid) display.textContent = "-";
    console.error(error);
  }
}

function renderBattleNotice() {
  if (!activeRoom) return;
  if (opponentExitTimeout) {
    battleNotice.textContent = "Opponent left the room.";
    return;
  }

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
  const myRating = activeRoom.ratingChanges?.[currentUser?.uid];
  const ratingMessage = activeRoom.mode === "ranked"
    ? (activeRoom.ratingApplied && myRating
      ? `Rating: ${myRating.before} → ${myRating.after} (${myRating.change >= 0 ? "+" : ""}${myRating.change})`
      : (activeRoom.ratingNotice || "No rating change."))
    : "Friend Battle: no rating change";
  const repeatedOpponentMessage = activeRoom.mode === "ranked" && activeRoom.repeatedOpponent
    ? ` | ${activeRoom.ratingNotice}`
    : "";
  if (activeRoom.timeLimitReached) {
    battleResult.textContent = `Time limit reached | Completion Score: ${host?.name || "Host"} ${host?.maxCompletionScore || 0} / 54, ${guest?.name || "Guest"} ${guest?.maxCompletionScore || 0} / 54 | ${activeRoom.isDraw ? "Draw" : `Winner: ${winner}`} | ${ratingMessage}${repeatedOpponentMessage}`;
  } else {
    battleResult.textContent = `Winner: ${winner} | ${hostResult} | ${guestResult} | ${ratingMessage}${repeatedOpponentMessage}`;
  }

  const iWon = activeRoom.winnerUid === currentUser?.uid;
  battleResultBadge.textContent = activeRoom.isDraw ? "DRAW" : (iWon ? "WINNER" : "LOSER");
  battleResultBadge.className = `battle-result-badge ${activeRoom.isDraw ? "" : (iWon ? "winner" : "loser")}`;
}

function renderBattleReadyButton(you, opponent) {
  const battleEnded = activeRoom?.status === "finished" || activeRoom?.status === "finishing";
  battleReadyBtn.hidden = battleEnded || !you || ["inspecting", "solving"].includes(you.status);
  if (battleReadyBtn.hidden) return;

  const isReady = you.status === "ready";
  battleReadyBtn.disabled = isReady;
  battleReadyBtn.textContent = isReady ? "Waiting for scramble..." : "Ready";
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
  battleRoomMeta.textContent = activeRoom.mode === "ranked"
    ? `Ranked match | Players: ${count}/2`
    : `Room: ${activeRoomId} | Players: ${count}/2`;
  battleModeLabel.textContent = activeRoom.mode === "ranked" ? "Ranked Battle" : "Friend Battle";
  copyRoomUrlBtn.hidden = activeRoom.mode === "ranked";
  const canSeeScramble = ["inspecting", "solving", "finished", "dnf"].includes(you?.status);
  battleScramble.textContent = canSeeScramble ? (activeRoom.scramble || "") : "";
  renderBattlePlayer("battleYou", you, activeRoomRole);
  renderBattlePlayer("battleOpponent", opponent, getOpponentRole());
  loadOpponentRating(opponent);
  renderOpponentCube(opponent);
  renderRankedTimeLimit(you);
  renderBattleNotice();
  returnToNormalAfterOpponentExit(opponent);
  renderBattleResult();
  renderBattleReadyButton(you, opponent);
  renderRematchPanel(you, opponent);

  if (activeRoom.status === "finished") {
    if (activeRoom.mode === "ranked" && !activeRoom.ratingUpdated) {
      applyRankedBattleResultAsHost().catch(console.error);
    }
    if (activeRoom.mode !== "ranked" || activeRoom.ratingUpdated) {
      saveBattleResultForCurrentUser().catch(console.error);
      refreshRatingAfterBattle();
    }
  }

  if (activeRoom.status === "finishing" && Date.now() >= Number(activeRoom.finishDeadlineMs)) {
    finalizeBattle().catch(console.error);
  }

  if (activeRoom.mode === "ranked" && you?.timeLimitReached && opponent?.timeLimitReached) {
    finalizeRankedTimeLimit().catch(console.error);
  }
}

function refreshRatingAfterBattle() {
  const key = activeRoomId + "_" + activeRound;
  if (refreshedBattleRatingKeys.has(key)) return;
  refreshedBattleRatingKeys.add(key);
  Promise.all([
    refreshBattleRatingRanking(true),
    refreshBattleAccountRating(true)
  ]).catch(error => {
    refreshedBattleRatingKeys.delete(key);
    console.error(error);
  });
  if (!profileModal.hidden) showProfile().catch(console.error);
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
    if (activeRoom.scramble) window.opponentCube?.setScramble(activeRoom.scramble, activeRound);
    window.startBattleInspection?.(
      activeRoom.scramble,
      getInspectionStartMs(player),
      activeRound
    );
  }
}

async function startInspectionForReadyPlayer() {
  if (readyInspectionStarting || !currentUser || !activeRoomId || !activeRoom?.scramble) return;
  readyInspectionStarting = true;

  try {
    const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid);
    const snapshot = await getDoc(playerRef);
    if (!snapshot.exists() || snapshot.data().status !== "ready") return;

    const inspectionStartTimeMs = Date.now();
    await updateDoc(playerRef, {
      status: "inspecting",
      round: activeRound,
      inspectionStartTime: serverTimestamp(),
      inspectionStartTimeMs,
      updatedAt: serverTimestamp()
    });
    window.startBattleInspection?.(activeRoom.scramble, inspectionStartTimeMs, activeRound);
  } finally {
    readyInspectionStarting = false;
  }
}

function watchPlayer(roomId, role, uid) {
  if (!uid) return;

  activePlayerUnsubscribes.push(onSnapshot(doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", uid), snapshot => {
    battlePlayersByRole[role] = snapshot.exists() ? snapshot.data() : null;
    renderBattleUi();

    if (role === activeRoomRole && snapshot.exists()) {
      syncLocalBattleState(snapshot.data());
      if (snapshot.data().status === "ready" && activeRoom?.scramble) {
        startInspectionForReadyPlayer().catch(console.error);
      }
    }

    const host = getDisplayPlayer("host");
    const guest = getDisplayPlayer("guest");
    if (activeRoom?.status === "finished" && host?.rematchReady && guest?.rematchReady) {
      startRematchIfBothReady().catch(console.error);
    }
  }));

  if (role !== activeRoomRole) {
    const movesQuery = query(
      collection(db, BATTLE_ROOMS_COLLECTION, roomId, "players", uid, "moves"),
      where("round", "==", activeRound),
      orderBy("moveIndex", "asc")
    );

    activeMoveUnsubscribes.push(onSnapshot(movesQuery, snapshot => {
      battleMovesByRole[role] = snapshot.docs
        .map(move => move.data())
        .filter(move => !move.round || move.round === activeRound);
      window.opponentCube?.applyMoves(battleMovesByRole[role]);
      renderBattleUi();
    }));
  }
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
    const localPlayer = getDisplayPlayer(activeRoomRole);
    const localCanSeeScramble = ["inspecting", "solving", "finished", "dnf"].includes(localPlayer?.status);
    if (localCanSeeScramble && room.scramble) {
      window.opponentCube?.setScramble(room.scramble, activeRound);
    } else {
      window.opponentCube?.clear();
    }

    if (
      room.hostUid !== previousHostUid ||
      room.guestUid !== previousGuestUid ||
      (previousRound && activeRound !== previousRound)
    ) {
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
    if (localPlayer?.status === "ready" && room.scramble) {
      startInspectionForReadyPlayer().catch(console.error);
    }
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
    currentCompletionScore: 0,
    maxCompletionScore: 0,
    timeLimitReached: false,
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

    transaction.update(roomRef, {
      status: "waiting",
      scramble: "",
      round: (Number(room.round) || 1) + 1,
      winnerUid: "",
      winnerName: "",
      firstFinisherUid: "",
      finishDeadlineMs: 0,
      finishedAt: null,
      ratingApplied: false,
      ratingUpdated: false,
      ratingNotice: "",
      ratingChanges: {},
      timeLimitReached: false,
      isDraw: false,
      playerMaxCompletionScores: {},
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
  const room = {
    roomId,
    mode,
    scramble: "",
    status: "waiting",
    hostUid: currentUser.uid,
    guestUid: "",
    winnerUid: "",
    winnerName: "",
    finishDeadlineMs: 0,
    ratingApplied: false,
    ratingUpdated: false,
    ratingChanges: {},
    timeLimitSeconds: 120,
    timeLimitReached: false,
    isDraw: false,
    playerMaxCompletionScores: {},
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

function getRankedMatchRange(waitMs) {
  if (waitMs < 10000) return 50;
  if (waitMs < 20000) return 100;
  if (waitMs < 30000) return 200;
  return Infinity;
}

function selectRankedCandidate(queueDocs, myRating, myStartedAtMs = Date.now()) {
  const now = Date.now();
  const myRange = getRankedMatchRange(now - myStartedAtMs);
  return queueDocs
    .filter(queueDoc => queueDoc.id !== currentUser?.uid && queueDoc.data().roomId && queueDoc.data().mode === "ranked")
    .map(queueDoc => {
      const entry = queueDoc.data();
      const difference = Math.abs(myRating - getRating(entry));
      const candidateStartedAtMs = Number(entry.startedAtMs) || now;
      const allowedRange = Math.max(myRange, getRankedMatchRange(now - candidateStartedAtMs));
      return { queueDoc, difference, allowedRange, startedAtMs: candidateStartedAtMs };
    })
    .filter(candidate => candidate.difference <= candidate.allowedRange)
    .sort((a, b) => a.difference - b.difference || a.startedAtMs - b.startedAtMs)[0]?.queueDoc || null;
}

async function getRankedCandidateDocs(myRating, startedAtMs = Date.now()) {
  const range = getRankedMatchRange(Date.now() - startedAtMs);
  const queueRef = collection(db, MATCHMAKING_COLLECTION);
  const candidateQuery = Number.isFinite(range)
    ? query(
      queueRef,
      where("status", "==", "waiting"),
      where("rating", ">=", myRating - range),
      where("rating", "<=", myRating + range),
      orderBy("rating", "asc"),
      orderBy("createdAt", "asc"),
      limit(MATCHMAKING_LIMIT)
    )
    : query(
      queueRef,
      where("status", "==", "waiting"),
      orderBy("createdAt", "asc"),
      limit(MATCHMAKING_LIMIT)
    );
  return (await getDocs(candidateQuery)).docs;
}

async function attemptRankedMatch() {
  if (rankedMatchAttempting || !currentUser || !activeRoomId || document.body.classList.contains("battle-mode")) return;
  rankedMatchAttempting = true;
  try {
    const ownQueue = await getDoc(doc(db, MATCHMAKING_COLLECTION, currentUser.uid));
    if (!ownQueue.exists() || ownQueue.data().status !== "waiting") return;

    const ownEntry = ownQueue.data();
    const candidateDocs = await getRankedCandidateDocs(
      getRating(ownEntry),
      Number(ownEntry.startedAtMs) || Date.now()
    );
    const candidate = selectRankedCandidate(
      candidateDocs,
      getRating(ownEntry),
      Number(ownEntry.startedAtMs) || Date.now()
    );
    if (!candidate) return;

    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      status: "cancelled",
      updatedAt: serverTimestamp()
    }).catch(() => {});
    clearMatchmakingListeners();
    await clearMyMatchmakingEntry();
    activeRoomId = "";
    activeRoomRole = "";
    setRandomStatus("Matched!");
    await joinBattleRoom(candidate.data().roomId, true);
  } finally {
    rankedMatchAttempting = false;
  }
}

function scheduleRankedMatchExpansion() {
  rankedMatchExpansionTimeouts = [10000, 20000, 30000].map(delay => window.setTimeout(() => {
    attemptRankedMatch().catch(console.error);
  }, delay));
}

async function startRankedBattle() {
  const eligibility = await getRankedBattleEligibility();
  if (!eligibility.eligible) {
    setRandomStatus(eligibility.message);
    return;
  }

  if (matchmakingUnsubscribe || randomRoomUnsubscribe) {
    if (!rankedSearchInterval) startRankedSearchTimer();
    return;
  }

  if (activeRoomId && !document.body.classList.contains("battle-mode")) {
    clearFriendLobby();
    activeRoomId = "";
    activeRoomRole = "";
  }

  startRankedSearchTimer();
  await clearMyMatchmakingEntry();
  const profileSnapshot = await getDoc(userRef());
  const myRating = getRating(profileSnapshot.data());
  const startedAtMs = Date.now();
  const candidateDocs = await getRankedCandidateDocs(myRating, startedAtMs);
  const candidate = selectRankedCandidate(candidateDocs, myRating, startedAtMs);

  if (candidate) {
    stopRankedSearchTimer();
    setRandomStatus("Matched!");
    await joinBattleRoom(candidate.data().roomId, true);
    return;
  }

  const roomId = createRoomId();
  const room = {
    roomId,
    mode: "ranked",
    scramble: "",
    status: "waiting",
    hostUid: currentUser.uid,
    guestUid: "",
    winnerUid: "",
    winnerName: "",
    finishDeadlineMs: 0,
    ratingApplied: false,
    ratingUpdated: false,
    ratingChanges: {},
    timeLimitSeconds: 120,
    timeLimitReached: false,
    isDraw: false,
    playerMaxCompletionScores: {},
    round: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId), room);
  await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", currentUser.uid), createPlayer("host"));
  await setDoc(doc(db, MATCHMAKING_COLLECTION, currentUser.uid), {
    uid: currentUser.uid,
    name: getPlayerName(),
    mode: "ranked",
    status: "waiting",
    roomId,
    rating: myRating,
    startedAtMs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

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
    if (entry?.status === "matched" && entry.roomId) enterMatchedRankedRoom(entry.roomId);
  });
  watchForRankedRoom();
  scheduleRankedMatchExpansion();
  matchmakingTimeout = window.setTimeout(() => {
    cancelRandomMatch("No opponent found. Matchmaking cancelled.");
  }, 60000);
}

async function joinBattleRoom(roomId, allowRankedMatch = false) {
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
  if (room.mode === "ranked" && !allowRankedMatch) {
    setBattleStatus("Ranked Battle is available through matchmaking only.");
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
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
      status: "ready",
      round: activeRound,
      updatedAt: serverTimestamp()
    });
    setBattleStatus("Ready. Waiting for the room scramble.");
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

  window.trackCubeEvent?.("battle_start");
  if (activeRoom?.mode === "ranked") {
    window.trackCubeEvent?.("ranked_battle_start");
  } else if (activeRoom?.mode === "friend") {
    window.trackCubeEvent?.("friend_battle_start");
  }
}

async function notifyBattleMove(move) {
  if (!currentUser || !activeRoomId || !document.body.classList.contains("battle-mode")) return;

  const moveData = {
    move: String(move.move || ""),
    moveIndex: Math.max(1, Math.floor(Number(move.index) || 0)),
    elapsedMs: Math.max(0, Math.floor(Number(move.elapsedMs) || 0)),
    round: activeRound,
    timestamp: serverTimestamp()
  };
  battleMovesByRole[activeRoomRole] = [...(battleMovesByRole[activeRoomRole] || []), moveData];
  const localPlayer = battlePlayersByRole[activeRoomRole];
  if (localPlayer) localPlayer.lastMove = moveData.move;
  renderBattleUi();
  await addDoc(
    collection(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid, "moves"),
    moveData
  ).catch(console.error);
}

function notifyBattleCompletionScore(scores) {
  if (!currentUser || !activeRoomId || !document.body.classList.contains("battle-mode")) return;
  pendingCompletionScore = {
    currentCompletionScore: Math.max(0, Math.min(54, Math.floor(Number(scores.currentCompletionScore) || 0))),
    maxCompletionScore: Math.max(0, Math.min(54, Math.floor(Number(scores.maxCompletionScore) || 0)))
  };
  if (completionScoreWriteTimeout) return;
  completionScoreWriteTimeout = window.setTimeout(() => {
    completionScoreWriteTimeout = null;
    const payload = pendingCompletionScore;
    pendingCompletionScore = null;
    if (!payload || !currentUser || !activeRoomId) return;
    updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
      ...payload,
      updatedAt: serverTimestamp()
    }).catch(console.error);
  }, 500);
}

async function notifyRankedBattleTimeLimit(scores) {
  if (!currentUser || !activeRoomId || activeRoom?.mode !== "ranked") return;
  const maxCompletionScore = Math.max(0, Math.min(54, Math.floor(Number(scores.maxCompletionScore) || 0)));
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "time_limit",
    timeLimitReached: true,
    currentCompletionScore: Math.max(0, Math.min(54, Math.floor(Number(scores.currentCompletionScore) || 0))),
    maxCompletionScore,
    updatedAt: serverTimestamp()
  });
  finalizeRankedTimeLimit().catch(console.error);
}

async function finalizeRankedTimeLimit() {
  if (!activeRoomId || activeRoom?.mode !== "ranked") return;
  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const hostRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", activeRoom.hostUid);
  const guestRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", activeRoom.guestUid);

  await runTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) return;
    const room = roomSnapshot.data();
    if (room.mode !== "ranked" || room.status === "finished" || room.status === "finishing") return;

    const host = (await transaction.get(hostRef)).data();
    const guest = (await transaction.get(guestRef)).data();
    if (!host?.timeLimitReached || !guest?.timeLimitReached) return;

    const hostScore = Number(host.maxCompletionScore) || 0;
    const guestScore = Number(guest.maxCompletionScore) || 0;
    const isDraw = hostScore === guestScore;
    const winnerUid = isDraw ? "" : (hostScore > guestScore ? room.hostUid : room.guestUid);
    const loserUid = isDraw ? "" : (winnerUid === room.hostUid ? room.guestUid : room.hostUid);
    transaction.update(roomRef, {
      status: "finished",
      finishedAt: serverTimestamp(),
      timeLimitReached: true,
      isDraw,
      winnerUid,
      winnerName: winnerUid === room.hostUid ? host.name : (winnerUid === room.guestUid ? guest.name : "Draw"),
      loserUid,
      playerMaxCompletionScores: { [room.hostUid]: hostScore, [room.guestUid]: guestScore },
      ratingApplied: false,
      ratingUpdated: false,
      ratingChanges: {},
      ratingNotice: "Time limit reached.",
      updatedAt: serverTimestamp()
    });
  });
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
      currentCompletionScore: Math.max(0, Math.min(54, Number(solveStats.currentCompletionScore) || 0)),
      maxCompletionScore: Math.max(0, Math.min(54, Number(solveStats.maxCompletionScore) || 0)),
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
    const loserUid = winner?.uid === host?.uid ? guest?.uid || "" : host?.uid || "";
    transaction.update(roomRef, {
      status: "finished",
      finishedAt: serverTimestamp(),
      winnerUid: winner?.uid || "",
      winnerName: winner?.name || "",
      loserUid,
      ratingApplied: false,
      ratingUpdated: false,
      ratingNotice: room.mode === "ranked"
        ? "Waiting for rating update."
        : "Friend Battle: no rating change",
      ratingChanges: {},
      updatedAt: serverTimestamp()
    });
  });
}

async function applyRankedBattleResultAsHost() {
  if (
    !currentUser ||
    !activeRoomId ||
    !activeRoom ||
    activeRoom.mode !== "ranked" ||
    activeRoomRole !== "host" ||
    activeRoom.ratingUpdated ||
    ratingUpdateInProgress
  ) return;

  ratingUpdateInProgress = true;
  const roomId = activeRoomId;
  const round = activeRound;
  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, roomId);
  try {
    await runTransaction(db, async transaction => {
      const roomSnapshot = await transaction.get(roomRef);
      if (!roomSnapshot.exists()) return;
      const room = roomSnapshot.data();
      if (
        room.mode !== "ranked" ||
        room.status !== "finished" ||
        room.ratingUpdated ||
        !room.hostUid ||
        !room.guestUid
      ) return;

      const isDraw = Boolean(room.isDraw);
      if (!isDraw && !room.winnerUid) return;
      const hostUserRef = doc(db, USERS_COLLECTION, room.hostUid);
      const guestUserRef = doc(db, USERS_COLLECTION, room.guestUid);
      const pairId = createRankedPairId(room.hostUid, room.guestUid);
      const pairRef = doc(db, "rankedPairs", pairId);
      const hostSnapshot = await transaction.get(hostUserRef);
      const guestSnapshot = await transaction.get(guestUserRef);
      const pairSnapshot = await transaction.get(pairRef);
      const pair = pairSnapshot.data() || {};
      if (pair.lastRoomId === roomId) return;
      const battleNumber = Number(pair.battleCount || 0) + 1;
      const ratingMultiplier = getRepeatedOpponentMultiplier(battleNumber);
      const normalRatingChanges = calculateEloChanges(
        hostSnapshot.data(),
        guestSnapshot.data(),
        room.winnerUid,
        room.hostUid,
        room.guestUid,
        isDraw
      );
      const ratingChanges = applyRatingMultiplier(
        normalRatingChanges,
        room.hostUid,
        room.guestUid,
        ratingMultiplier
      );
      const hostChange = ratingChanges[room.hostUid];
      const guestChange = ratingChanges[room.guestUid];
      const hostProfile = hostSnapshot.data() || defaultUserStats();
      const guestProfile = guestSnapshot.data() || defaultUserStats();
      const hostWon = room.winnerUid === room.hostUid;
      const guestWon = room.winnerUid === room.guestUid;

      console.log("Ranked rating update", {
        roomId,
        winnerUid: room.winnerUid || "draw",
        loserUid: room.loserUid || "",
        currentUserUid: currentUser.uid,
        hostBefore: hostChange.before,
        hostAfter: hostChange.after,
        guestBefore: guestChange.before,
        guestAfter: guestChange.after,
        pairId,
        battleNumber,
        ratingMultiplier
      });

      transaction.update(hostUserRef, {
        rating: hostChange.after,
        wins: Number(hostProfile.wins || 0) + (hostWon ? 1 : 0),
        losses: Number(hostProfile.losses || 0) + (guestWon ? 1 : 0),
        rankedWins: Number(hostProfile.rankedWins || 0) + (hostWon ? 1 : 0),
        rankedLosses: Number(hostProfile.rankedLosses || 0) + (guestWon ? 1 : 0),
        rankedDraws: Number(hostProfile.rankedDraws || 0) + (isDraw ? 1 : 0),
        rankedBattles: Number(hostProfile.rankedBattles || 0) + 1,
        lastRatedRoomId: roomId,
        lastRatedRound: round,
        updatedAt: serverTimestamp()
      });
      transaction.update(guestUserRef, {
        rating: guestChange.after,
        wins: Number(guestProfile.wins || 0) + (guestWon ? 1 : 0),
        losses: Number(guestProfile.losses || 0) + (hostWon ? 1 : 0),
        rankedWins: Number(guestProfile.rankedWins || 0) + (guestWon ? 1 : 0),
        rankedLosses: Number(guestProfile.rankedLosses || 0) + (hostWon ? 1 : 0),
        rankedDraws: Number(guestProfile.rankedDraws || 0) + (isDraw ? 1 : 0),
        rankedBattles: Number(guestProfile.rankedBattles || 0) + 1,
        lastRatedRoomId: roomId,
        lastRatedRound: round,
        updatedAt: serverTimestamp()
      });
      transaction.update(roomRef, {
        ratingApplied: true,
        ratingUpdated: true,
        ratingUpdatedAt: serverTimestamp(),
        winnerRatingBefore: room.winnerUid ? ratingChanges[room.winnerUid].before : null,
        winnerRatingAfter: room.winnerUid ? ratingChanges[room.winnerUid].after : null,
        loserRatingBefore: room.loserUid ? ratingChanges[room.loserUid].before : null,
        loserRatingAfter: room.loserUid ? ratingChanges[room.loserUid].after : null,
        ratingChanges,
        repeatedOpponent: battleNumber > 5,
        repeatedOpponentBattleCount: battleNumber,
        ratingMultiplier,
        ratingNotice: ratingMultiplier === 0
          ? "Repeated Opponent: Rating change disabled."
          : (ratingMultiplier === 0.5 ? "Repeated Opponent: Rating change reduced to 50%." : ""),
        updatedAt: serverTimestamp()
      });
      transaction.set(pairRef, {
        playerA: [room.hostUid, room.guestUid].sort()[0],
        playerB: [room.hostUid, room.guestUid].sort()[1],
        battleCount: battleNumber,
        lastBattleAt: serverTimestamp(),
        lastRoomId: roomId
      }, { merge: true });
    });
    console.log("Ranked rating transaction succeeded", roomId);
    await Promise.all([refreshBattleRatingRanking(true), refreshBattleAccountRating(true)]);
    if (!profileModal.hidden) await showProfile();
  } catch (error) {
    battleNotice.textContent = "Rating update failed. Check Firestore permissions.";
    console.error("Ranked rating transaction failed", error);
  } finally {
    ratingUpdateInProgress = false;
  }
}

function renderBattleLocalTimer(seconds) {
  localBattleTimerSeconds = Math.max(0, Number(seconds) || 0);
  renderBattleUi();
}

function leaveBattleMode() {
  if (activeRoom?.status === "finishing") {
    battleNotice.textContent = "Finalizing battle result...";
    return;
  }
  if (opponentExitTimeout) {
    window.clearTimeout(opponentExitTimeout);
    opponentExitTimeout = null;
  }
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
  displayedOpponentRatingUid = "";
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
  window.trackCubeEvent?.("login", { method: "google" });
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
  window.trackCubeEvent?.("login", { method: "guest" });
}

function renderOpponentCube(opponent) {
  if (!opponentCubePanel || !opponentCubeStatus) return;

  const disconnected = isPlayerDisconnected(opponent);
  const you = getDisplayPlayer(activeRoomRole);
  const waitingForReady = !["inspecting", "solving", "finished", "dnf"].includes(you?.status);
  opponentCubePanel.classList.toggle("opponent-unavailable", !opponent || disconnected || waitingForReady);
  opponentCubePanel.classList.toggle("ready-waiting", waitingForReady);
  opponentCubeStatus.textContent = waitingForReady
    ? "Opponent cube locked until you are ready."
    : (!opponent
    ? "Waiting for opponent..."
    : (disconnected ? "Opponent left" : `Opponent: ${(opponent.status || "joined").toUpperCase()}`));
}

function returnToNormalAfterOpponentExit(opponent) {
  if (!activeRoom || !document.body.classList.contains("battle-mode")) return;
  if (["finished", "finishing"].includes(activeRoom.status)) return;
  if (!isPlayerDisconnected(opponent) || opponentExitTimeout) return;

  battleNotice.textContent = "Opponent left the room.";
  opponentExitTimeout = window.setTimeout(() => {
    opponentExitTimeout = null;
    leaveBattleMode();
  }, 1000);
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
    startRankedBattle().catch(error => {
      stopRankedSearchTimer();
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

setupModalUi();

document.getElementById("openRankingBtn")?.addEventListener("click", () => {
  Promise.all([
    refreshRanking(),
    refreshBattleRatingRanking()
  ]).catch(console.error);
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
      ensureUserProfile()
        .then(() => refreshTotalUsers())
        .catch(console.error);
      refreshBattleAccountRating();
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

  setRankingMessage("Open Online Ranking to load results.");
  refreshTotalUsers();
} else {
  setStatus("Set firebase-config.js to enable login and online ranking.");
  setRankingMessage("Firebase config is required.");
}

window.submitOnlineSolve = submitOnlineSolve;
window.notifyBattleSolveStarted = notifyBattleSolveStarted;
window.submitBattleSolve = submitBattleSolve;
window.notifyBattleMove = notifyBattleMove;
window.notifyBattleCompletionScore = notifyBattleCompletionScore;
window.notifyRankedBattleTimeLimit = notifyRankedBattleTimeLimit;
window.renderBattleLocalTimer = renderBattleLocalTimer;
window.isBattleMode = () => document.body.classList.contains("battle-mode");
window.isRankedBattle = () => document.body.classList.contains("battle-mode") && activeRoom?.mode === "ranked";
