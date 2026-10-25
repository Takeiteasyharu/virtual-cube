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
  startAfter,
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
const profileBtn = document.getElementById("profileBtn");
const profileModal = document.getElementById("profileModal");
const profileBody = document.getElementById("profileBody");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const spectateRoomBtn = document.getElementById("spectateRoomBtn");
const copyRoomIdBtn = document.getElementById("copyRoomIdBtn");
const friendRoomSharePanel = document.getElementById("friendRoomSharePanel");
const friendRoomIdDisplay = document.getElementById("friendRoomIdDisplay");
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
const hostStartBattleBtn = document.getElementById("hostStartBattleBtn");
const realCubeTimerBtn = document.getElementById("realCubeTimerBtn");
const realCubeInstruction = document.getElementById("realCubeInstruction");
const friendRealControls = document.getElementById("friendRealControls");
const friendRealStartBtn = document.getElementById("friendRealStartBtn");
const friendRealAbortBtn = document.getElementById("friendRealAbortBtn");
const multiplayerRoster = document.getElementById("multiplayerRoster");
const multiplayerRosterHint = document.getElementById("multiplayerRosterHint");
const multiplayerRosterList = document.getElementById("multiplayerRosterList");
const multiplayerRosterToggle = document.getElementById("multiplayerRosterToggle");
const multiplayerRosterMount = document.getElementById("multiplayerRosterMount");
const friendRealTimerPanel = document.getElementById("friendRealTimerPanel");
const friendRealTimerDisplay = document.getElementById("friendRealTimerDisplay");
const friendRealEditBtn = document.getElementById("friendRealEditBtn");
const friendRealEditMenu = document.getElementById("friendRealEditMenu");
const friendRealManualTime = document.getElementById("friendRealManualTime");
const friendRealSaveTimeBtn = document.getElementById("friendRealSaveTimeBtn");
const friendRealManualEntry = friendRealManualTime?.closest(".friend-real-manual-entry");
const friendRealManualLabel = document.querySelector('label[for="friendRealManualTime"]');
const friendRealEditActions = document.querySelector(".friend-real-edit-actions");
const friendRealPlusTwoBtn = document.getElementById("friendRealPlusTwoBtn");
const friendRealDnfBtn = document.getElementById("friendRealDnfBtn");
const friendRealRemoveBtn = document.getElementById("friendRealRemoveBtn");
const friendRealOperationText = document.getElementById("friendRealOperationText");
const friendRealHistoryPanel = document.getElementById("friendRealHistoryPanel");
const friendRealSolveHistoryList = document.getElementById("friendRealSolveHistoryList");
const friendRealPb = document.getElementById("friendRealPb");
const friendRealAo5 = document.getElementById("friendRealAo5");
const friendRealAo12 = document.getElementById("friendRealAo12");
const friendBattleSettingsBtn = document.getElementById("friendBattleSettingsBtn");
const friendBattleSettingsModal = document.getElementById("friendBattleSettingsModal");
const closeFriendBattleSettingsBtn = document.getElementById("closeFriendBattleSettingsBtn");
const friendDarkModeToggle = document.getElementById("friendDarkModeToggle");
const friendTimeEntrySection = document.getElementById("friendTimeEntrySection");
const friendTimeEntryType = document.getElementById("friendTimeEntryType");
const friendOpponentSettingsSection = document.getElementById("friendOpponentSettingsSection");
const friendShowOpponentCube = document.getElementById("friendShowOpponentCube");
const battleCubeSizeSection = document.getElementById("battleCubeSizeSection");
const battleCubeSizeInput = document.getElementById("battleCubeSizeInput");
const battleCubeSizeValue = document.getElementById("battleCubeSizeValue");
const friendSettingsLeaveBtn = document.getElementById("friendSettingsLeaveBtn");
const friendSettingsLogoutBtn = document.getElementById("friendSettingsLogoutBtn");
const copyRoomUrlBtn = document.getElementById("copyRoomUrlBtn");
const leaveBattleBtn = document.getElementById("leaveBattleBtn");
const battleRoomMeta = document.getElementById("battleRoomMeta");
const battleScramble = document.getElementById("battleScramble");
const scrambleNetPanel = document.getElementById("scrambleNetPanel");
const scrambleCubeNet = document.getElementById("scrambleCubeNet");
const rankedTimeLimitDisplay = document.getElementById("rankedTimeLimitDisplay");
const battleNotice = document.getElementById("battleNotice");
const battleResult = document.getElementById("battleResult");
const battleResultBadge = document.getElementById("battleResultBadge");
const opponentCubePanel = document.getElementById("opponentCubePanel");
const opponentCubeTitle = document.getElementById("opponentCubeTitle");
const opponentCubeStatus = document.getElementById("opponentCubeStatus");
const friendVirtualBattleStage = document.getElementById("friendVirtualBattleStage");
const friendVirtualCubeRow = document.getElementById("friendVirtualCubeRow");
const friendVirtualMainCubeSlot = document.getElementById("friendVirtualMainCubeSlot");
const friendVirtualOpponentSlot = document.getElementById("friendVirtualOpponentSlot");
const friendVirtualRosterSlot = document.getElementById("friendVirtualRosterSlot");
const normalCubeAreaMount = document.getElementById("normalCubeAreaMount");
const mainCubeArea = document.getElementById("mainCubeArea");
const friendHistoryMount = document.getElementById("friendHistoryMount");
const battleInspectionOverlay = document.getElementById("battleInspectionOverlay");
const battleInspectionMount = document.getElementById("battleInspectionMount");
const opponentCubeMount = document.getElementById("opponentCubeMount");
const battleReadyMount = document.getElementById("battleReadyMount");
const cubeContainer = document.getElementById("cubeContainer");
const battleModeLabel = document.getElementById("battleModeLabel");
const battleRematchPanel = document.getElementById("battleRematchPanel");
const battleRematchYou = document.getElementById("battleRematchYou");
const battleRematchOpponent = document.getElementById("battleRematchOpponent");
const playAgainBtn = document.getElementById("playAgainBtn");
const rematchReturnBtn = document.getElementById("rematchReturnBtn");
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
const BOT_FALLBACK_WAIT_MS = 15000;
const FRIEND_TIME_ENTRY_TYPE_KEY = "friendRealTimeEntryType";
const FRIEND_SHOW_OPPONENT_CUBE_KEY = "friendShowOpponentCube";

let auth = null;
let db = null;
let currentUser = null;
let googleLoginPending = false;
let activePeriod = "today";
let activeRankingType = "single";
let activeRoomId = "";
let activeRoomRole = "";
let activeRoomUnsubscribe = null;
let activePlayerUnsubscribes = [];
let activeMoveUnsubscribes = [];
let activeRoom = null;
let activeRound = 1;
let realFriendInitialRoundPreparing = false;
let selectedBattleMode = "friend";
let battlePlayersByRole = { host: null, guest: null };
let battlePlayersByUid = new Map();
let battleMovesByRole = { host: [], guest: [] };
let isSpectatorMode = false;
let friendOpponentMovesUnsubscribe = null;
let friendOpponentMovesUid = "";
let selectedOpponentUid = "";
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
let botFallbackTimeout = null;
let rankedSearchGeneration = 0;
let rankedOwnQueueRoomId = "";
let rankedSearchToken = "";
let rankedSearchLockRelease = null;
let rankedSearchLocked = false;
let friendLobbyUnsubscribe = null;
let opponentExitTimeout = null;
let friendMembershipReconciling = false;
let battleLeaving = false;
let friendHostExitTimeout = null;
let displayedOpponentRatingUid = "";
const battlePlayerRatings = new Map();
const battlePlayerRatingRequests = new Map();
let readyInspectionStarting = false;
let ratingUpdateInProgress = false;
let friendFinalizing = false;
let realFriendScramblePreparing = false;
let friendRematchStarting = false;
let isSubmittingManualTime = false;
let preparedLocalRealFriendRoundKey = "";
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
    solve.mode !== "real" &&
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

const PENDING_V2_PREFIX = "pendingNormalSolveV2:";
function normalRecordAllowed(stats) {
  return window.ProfileRecords.eligible(stats) && !window.isBattleMode?.()
    && !window.BotBattle?.active && !window.GuidedSolve?.isPractice
    && !window.SolveReplay?.active && !window.DailyChallenge?.active && !window.DailyChallenge?.isPractice;
}
function getPendingSolves() {
  const records=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key?.startsWith(PENDING_V2_PREFIX))continue;
    try{const value=JSON.parse(localStorage.getItem(key));if(window.ProfileRecords.eligible(value))records.push(value);}catch{}
  }
  return records;
}
function queuePendingSolve(time,scramble,ao5,stats={}) {
  if(!normalRecordAllowed(stats)||!isValidSolvePayload(time,scramble))return false;
  const value={...stats,time,scramble,ao5:Number.isFinite(ao5)?ao5:null,ao12:stats.ao12??null,ownerUid:stats.ownerUid??currentUser?.uid??null,solvedAt:stats.solvedAt||new Date().toISOString()};
  try { localStorage.setItem(PENDING_V2_PREFIX+stats.solveId,JSON.stringify(value)); }
  catch(error){setStatus("Online copy could not be queued: browser storage is full. Local solve history is unchanged.");console.warn("Normal solve queue unavailable",error);return false;}
  return value;
}
async function addOnlineSolve(time,scramble,ao5,solvedAt,stats={}) {
  if(!currentUser||!window.ProfileRecords.eligible(stats)||!isValidOnlineSolve(time,scramble))return false;
  if(stats.ownerUid&&stats.ownerUid!==currentUser.uid)throw Error("Pending solve belongs to another account");
  const writer=window.ProfileRecords.create({doc,runTransaction,serverTimestamp},db);
  const saved=await writer.normal(currentUser.uid,getPlayerName(),{...stats,time,scramble,ao5,moves:Array.isArray(stats.moves)?stats.moves.map(m=>typeof m==="string"?m:m?.move).filter(Boolean):[]},getPeriodKeys(new Date(solvedAt)));
  invalidateRankingCache();return saved;
}

function getLocalSolveSummary() {
  let solves = [];
  try {
    solves = (JSON.parse(localStorage.getItem("cubeSolves")) || [])
      .filter(solve => Number.isFinite(Number(solve.time)) && solve.mode !== "real");
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

async function submitPendingSolves() {
  if(!currentUser)return;
  const send=async()=>{
    for(const value of getPendingSolves()){
      if(value.ownerUid&&value.ownerUid!==currentUser?.uid)continue;
      if(!currentUser)break;
      value.ownerUid=currentUser.uid;
      localStorage.setItem(PENDING_V2_PREFIX+value.solveId,JSON.stringify(value));
      try{
        await addOnlineSolve(value.time,value.scramble,value.ao5,value.solvedAt,value);
        localStorage.removeItem(PENDING_V2_PREFIX+value.solveId);
      }catch(error){console.warn("Normal solve remains pending",error);}
    }
  };
  if(navigator.locks)await navigator.locks.request("stcube-normal-records",send);else await send();
}
window.addEventListener("online",()=>{
  if(currentUser)ensureUserProfile().then(()=>submitPendingSolves()).catch(error=>console.warn("Pending normal solves will retry later",error));
});

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

let battleRatingCursor = null;
let battleRatingHasMore = false;
let battleRatingLoading = false;
async function refreshBattleRatingRanking(force = false, more = false) {
  if (!battleRatingList || !isConfigured()) return;

  battleRatingList.innerHTML = "";
  const newPlayersList = document.getElementById('newPlayerRatingList');
  newPlayersList.replaceChildren();
  if (!currentUser) {
    const item = document.createElement("li");
    item.textContent = "Log in to view battle ratings.";
    battleRatingList.appendChild(item);
    return;
  }

  try {
    const entries = await getBattleRatingEntries(force, more);
    for (const [list, rows, empty] of [
      [battleRatingList, entries.filter(entry => Number(entry.data.rankedBattles || 0) > 0), 'No ranked players loaded yet.'],
      [newPlayersList, entries.filter(entry => Number(entry.data.rankedBattles || 0) === 0), 'No new players loaded yet.']
    ]) {
      rows.forEach((entry,index)=>{
        const item=document.createElement('li');
        item.textContent=`${index + 1}. ${entry.data.name || 'Player'} - ${Math.round(Number(entry.data.rating) || INITIAL_RATING)}`;
        list.appendChild(item);
      });
      if(!rows.length){const item=document.createElement('li');item.textContent=empty;list.appendChild(item);}
    }
    document.getElementById('battleRatingMoreBtn').hidden = !battleRatingHasMore;
  } catch (error) {
    const item = document.createElement("li");
    item.textContent = "Battle rating ranking could not be loaded.";
    battleRatingList.appendChild(item);
    console.error(error);
  }
}

async function getBattleRatingEntries(force = false, more = false) {
  if (force) battleRatingCache.timestamp = 0;
  if (!more && !force && Date.now() - battleRatingCache.timestamp < RANKING_CACHE_TTL_MS) {
    return battleRatingCache.entries;
  }
  if (battleRatingFetchPromise) return battleRatingFetchPromise;

  battleRatingFetchPromise = getDocs(query(
    collection(db, USERS_COLLECTION),
    orderBy("rating", "desc"),
    ...(more && battleRatingCursor ? [startAfter(battleRatingCursor)] : []),
    limit(RANKING_LIMIT)
  )).then(snapshot => {
    battleRatingCursor = snapshot.docs.at(-1) || null;
    battleRatingHasMore = snapshot.size === RANKING_LIMIT;
    const entries = snapshot.docs
      .map(entryDoc => ({ id: entryDoc.id, data: entryDoc.data() }))
      .filter(entry => entry.data.loginType === 'google');
    const combined = more ? [...battleRatingCache.entries, ...entries] : entries;
    battleRatingCache = { entries: combined, timestamp: Date.now() };
    return combined;
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
    const experienced = rankedUsers.filter(entry => Number(entry.data.rankedBattles || 0) > 0);
    const rankIndex = experienced.findIndex(entry => entry.id === currentUser.uid);
    accountRating.textContent = "Rating: " + Math.round(Number(profile.rating) || INITIAL_RATING);
    accountBattleRank.textContent = rankIndex >= 0
      ? "World Rank: #" + (rankIndex + 1)
      : (Number(profile.rankedBattles || 0) === 0 ? 'World Rank: Not ranked yet' : battleRatingHasMore ? `World Rank: #${experienced.length + 1}+` : "World Rank: -");
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

async function submitOnlineSolve(time,scramble,ao5=null,stats={}) {
  if(!normalRecordAllowed(stats))return;
  const summary=getLocalSolveSummary();
  const value=queuePendingSolve(time,scramble,ao5,{...stats,ao12:summary.ao12,solvedAt:stats.solvedAt||new Date().toISOString()});
  if(!value)return;
  if(!currentUser){setStatus("Normal solve saved on this device. Log in to submit.");return;}
  if(!isConfigured())return;
  await submitPendingSolves();
}

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRoomUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  url.searchParams.delete("spectate");
  url.searchParams.set("battleRoom", roomId);
  return url.toString();
}

function renderFriendRoomShare(roomId) {
  const show = Boolean(roomId && activeRoom?.mode === "friend");
  if (friendRoomSharePanel) friendRoomSharePanel.hidden = !show;
  if (friendRoomIdDisplay) friendRoomIdDisplay.textContent = show ? roomId : "-";
}

async function copyRoomUrl(roomId, onCopied) {
  const roomUrl = getRoomUrl(roomId);

  try {
    await navigator.clipboard.writeText(roomUrl);
  } catch (error) {
    if (!roomUrlOutput) throw error;
    roomUrlOutput.hidden = false;
    roomUrlOutput.value = roomUrl;
    roomUrlOutput.select();
    document.execCommand("copy");
    roomUrlOutput.hidden = true;
  }

  onCopied("Invite link copied.");
}

async function copyRoomId(roomId, onCopied) {
  if (!roomId) return;
  try {
    await navigator.clipboard.writeText(roomId);
  } catch (error) {
    if (!roomIdInput) throw error;
    const previousValue = roomIdInput.value;
    roomIdInput.value = roomId;
    roomIdInput.select();
    document.execCommand("copy");
    roomIdInput.value = previousValue;
  }
  onCopied("Room ID copied.");
}

function createPlayer(role) {
  return {
    uid: currentUser.uid,
    name: getPlayerName(),
    role,
    status: "joined",
    ready: false,
    active: false,
    inspectionStartTime: null,
    inspectionStartTimeMs: 0,
    startTime: null,
    startTimeMs: 0,
    endTime: null,
    finishedAt: null,
    finalTime: null,
    previousRoundNumber: 0,
    previousRoundStatus: "",
    previousRoundFinalTime: null,
    previousRoundPenalty: "",
    previousRoundManual: false,
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

async function getBattleScramble() {
  if (typeof window.generateScrambleText === "function") {
    return window.generateScrambleText(20);
  }

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
  if (cancelMatchBtn) cancelMatchBtn.hidden = true;
  if (randomBattleBtn) randomBattleBtn.disabled = false;
}

function startRankedSearchTimer() {
  stopRankedSearchTimer();
  rankedSearchStartedAt = Date.now();
  if (cancelMatchBtn) cancelMatchBtn.hidden = false;
  if (randomBattleBtn) randomBattleBtn.disabled = true;

  const render = () => {
    setRandomStatus(`Searching for a player... ${formatRankedSearchElapsed(Date.now() - rankedSearchStartedAt)} · Unrated BOT fallback after ${BOT_FALLBACK_WAIT_MS/1000}s`);
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
  if (!activeRoomId) {
    setBattleStatus(!currentUser ? "Log in to start a battle."
      : choice === "ranked" && currentUser.isAnonymous ? "Ranked Battle requires Google Login." : "");
  }
}

function clearFriendLobby() {
  if (friendLobbyUnsubscribe) friendLobbyUnsubscribe();
  friendLobbyUnsubscribe = null;
}

function clearMatchmakingListeners() {
  if (botFallbackTimeout) clearTimeout(botFallbackTimeout);
  botFallbackTimeout=null;
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
  if (!currentUser || !rankedOwnQueueRoomId) return;
  const uid=currentUser.uid,roomId=rankedOwnQueueRoomId,token=rankedSearchToken;
  await runTransaction(db,async tx=>{const ref=doc(db,MATCHMAKING_COLLECTION,uid),snap=await tx.get(ref);if(snap.exists()&&snap.data().roomId===roomId&&snap.data().searchToken===token)tx.delete(ref);}).catch(()=>{});
}

function enterMatchedRankedRoom(roomId) {
  if (!roomId || document.body.classList.contains('battle-mode') || window.BotBattle?.active) return;
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
  ++rankedSearchGeneration;
  releaseRankedSearchLock();
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
  if (friendOpponentMovesUnsubscribe) friendOpponentMovesUnsubscribe();
  friendOpponentMovesUnsubscribe = null;
  friendOpponentMovesUid = "";
  if (completionScoreWriteTimeout) window.clearTimeout(completionScoreWriteTimeout);
  completionScoreWriteTimeout = null;
  pendingCompletionScore = null;
}

function setBattleMode(enabled) {
  document.body.classList.toggle("battle-mode", enabled);
  if (enabled) document.body.classList.remove("normal-real-cube");
  if (!enabled) {
    document.body.classList.remove("real-cube-battle", "friend-real-battle", "friend-virtual-battle", "ranked-battle-mode", "spectator-mode");
    restoreMainCubeArea();
  }
  if (enabled) {
    const battleModal = document.getElementById("battleModal");
    if (battleModal) battleModal.hidden = true;
  }

  if (enabled && !battleClockInterval) {
    battleClockInterval = window.setInterval(renderBattleUi, 100);
  }

  if (enabled && !activeRoom?.isBot && !battlePresenceInterval) {
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
  window.renderSoloActions?.();
}

function sendBattleHeartbeat() {
  if (activeRoom?.isBot) return;
  if (!currentUser || !activeRoomId || isSpectatorMode || !document.body.classList.contains("battle-mode")) return;

  updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    updatedAt: serverTimestamp()
  }).catch(() => {});
}

function formatBattleTime(seconds) {
  return Number.isFinite(seconds) ? seconds.toFixed(2) : "-";
}

function restoreMainCubeArea() {
  if (battleInspectionOverlay && battleInspectionMount?.parentNode && battleInspectionOverlay.previousElementSibling !== battleInspectionMount) {
    battleInspectionMount.insertAdjacentElement("afterend", battleInspectionOverlay);
  }
  if (opponentCubePanel && opponentCubeMount?.parentNode && opponentCubePanel.nextElementSibling !== opponentCubeMount) {
    opponentCubeMount.insertAdjacentElement("beforebegin", opponentCubePanel);
  }
  if (battleReadyBtn && battleReadyMount?.parentNode && battleReadyBtn.previousElementSibling !== battleReadyMount) {
    battleReadyMount.insertAdjacentElement("afterend", battleReadyBtn);
  }
  if (!document.body.classList.contains("battle-mode") && multiplayerRoster && multiplayerRosterMount?.parentNode && multiplayerRoster.previousElementSibling !== multiplayerRosterMount) {
    multiplayerRosterMount.insertAdjacentElement("afterend", multiplayerRoster);
  }
  if (mainCubeArea && normalCubeAreaMount?.parentNode && mainCubeArea.previousElementSibling !== normalCubeAreaMount) {
    normalCubeAreaMount.insertAdjacentElement("afterend", mainCubeArea);
  }
  if (friendRealHistoryPanel && friendHistoryMount?.parentNode && friendRealHistoryPanel.previousElementSibling !== friendHistoryMount) {
    friendHistoryMount.insertAdjacentElement("afterend", friendRealHistoryPanel);
  }
  if (friendVirtualBattleStage) friendVirtualBattleStage.hidden = true;
}

function resetBattleLayoutState() {
  document.body.classList.remove(
    "battle-mode",
    "battle-locked",
    "real-cube-battle",
    "friend-real-battle",
    "friend-virtual-battle",
    "ranked-battle-mode",
    "spectator-mode",
    "touch-device"
  );
  cubeContainer?.classList.remove("ready-waiting");
  opponentCubePanel?.classList.remove("ready-waiting", "opponent-unavailable");
  restoreMainCubeArea();

  const resizeNormalCube = () => {
    window.resizeMainCube?.();
    window.applyCubeSizeScale?.(window.getCubeSizeScale?.() || 1);
  };

  // The first frame restores the normal grid; the second measures its final size.
  window.requestAnimationFrame(() => {
    resizeNormalCube();
    window.requestAnimationFrame(resizeNormalCube);
  });
}

function syncFriendVirtualBattleLayout() {
  const rosterSlot = document.getElementById("battleRosterSlot");
  if (document.body.classList.contains("battle-mode") && rosterSlot && multiplayerRoster && multiplayerRoster.parentNode !== rosterSlot) {
    rosterSlot.appendChild(multiplayerRoster);
  }
  const virtualBattle = document.body.classList.contains("battle-mode") && activeRoom?.cubeMode === "virtual";
  const friendEnabled = virtualBattle && activeRoom?.mode === "friend";
  const rankedEnabled = virtualBattle && activeRoom?.mode === "ranked";
  document.body.classList.toggle("friend-virtual-battle", friendEnabled);
  document.body.classList.toggle("ranked-battle-mode", rankedEnabled);
  const enabled = friendEnabled || rankedEnabled;
  if (!enabled) {
    restoreMainCubeArea();
    return;
  }
  let cubeAreaMoved = false;
  const cubeAreaParent = friendEnabled ? friendVirtualMainCubeSlot : friendVirtualBattleStage;
  if (cubeAreaParent && mainCubeArea && mainCubeArea.parentNode !== cubeAreaParent) {
    cubeAreaParent.appendChild(mainCubeArea);
    cubeAreaMoved = true;
  }
  const inspectionParent = rankedEnabled ? document.getElementById("rankedInspectionSlot") : mainCubeArea;
  if (inspectionParent && battleInspectionOverlay && battleInspectionOverlay.parentNode !== inspectionParent) {
    inspectionParent.insertBefore(battleInspectionOverlay, inspectionParent.firstChild);
  }
  const opponentParent = friendEnabled ? friendVirtualOpponentSlot : friendVirtualBattleStage;
  if (opponentParent && opponentCubePanel && opponentCubePanel.parentNode !== opponentParent) {
    opponentParent.appendChild(opponentCubePanel);
  }
  if (enabled && cubeContainer && battleReadyBtn && battleReadyBtn.parentNode !== cubeContainer) {
    cubeContainer.appendChild(battleReadyBtn);
  } else if (!enabled && battleReadyMount?.parentNode && battleReadyBtn?.previousElementSibling !== battleReadyMount) {
    battleReadyMount.insertAdjacentElement("afterend", battleReadyBtn);
  }
  if (friendEnabled && friendVirtualBattleStage && friendRealHistoryPanel && friendRealHistoryPanel.parentNode !== friendVirtualBattleStage) {
    friendVirtualBattleStage.insertBefore(friendRealHistoryPanel, friendVirtualCubeRow);
  } else if (!friendEnabled && friendRealHistoryPanel && friendHistoryMount?.parentNode) {
    friendHistoryMount.insertAdjacentElement("afterend", friendRealHistoryPanel);
  }
  if (friendVirtualBattleStage) friendVirtualBattleStage.hidden = false;
  if (cubeAreaMoved) {
    window.requestAnimationFrame(() => {
      window.resizeMainCube?.();
      window.applyCubeSizeScale?.(window.getCubeSizeScale?.() || 1);
    });
  }
}

function getMinimumAcceptedBattleTime() {
  return activeRoom?.mode === "friend" && activeRoom?.cubeMode === "real" ? 0.01 : 3;
}

function hasFinalBattleTime(player) {
  if (!player || player.finalTime === null || player.finalTime === undefined) return false;
  const finalTime = Number(player.finalTime);
  return Number.isFinite(finalTime) && finalTime >= getMinimumAcceptedBattleTime() && finalTime < 3600;
}

function hasPreviousBattleTime(player) {
  if (!player || player.previousRoundFinalTime === null || player.previousRoundFinalTime === undefined) return false;
  const finalTime = Number(player.previousRoundFinalTime);
  return Number.isFinite(finalTime) && finalTime >= getMinimumAcceptedBattleTime() && finalTime < 3600;
}

function getPreviousBattleResultFields(player) {
  if (!player) return {};
  const round = Number(player.round || activeRound) || activeRound;
  if (hasFinalBattleTime(player)) {
    return {
      previousRoundNumber: round,
      previousRoundStatus: "finished",
      previousRoundFinalTime: Number(Number(player.finalTime).toFixed(2)),
      previousRoundPenalty: player.penalty || "",
      previousRoundManual: Boolean(player.manual)
    };
  }
  if (player.status === "dnf") {
    return {
      previousRoundNumber: round,
      previousRoundStatus: "dnf",
      previousRoundFinalTime: null,
      previousRoundPenalty: player.penalty || "dnf",
      previousRoundManual: Boolean(player.manual)
    };
  }
  return {};
}

function getRosterTimeText(player) {
  if (player?.status === "dnf") return "DNF";
  if (hasFinalBattleTime(player)) return formatBattleTime(Number(player.finalTime));
  if (player?.status === "solving") {
    const elapsed = player.uid === currentUser?.uid
      ? localBattleTimerSeconds
      : getPlayerElapsedSeconds(player);
    return formatBattleTime(elapsed);
  }
  if (player?.previousRoundStatus === "dnf") return "DNF";
  if (hasPreviousBattleTime(player)) return formatBattleTime(Number(player.previousRoundFinalTime));
  return formatBattleTime(null);
}

function getPlayerElapsedSeconds(player) {
  if (hasFinalBattleTime(player)) {
    return Number(player.finalTime);
  }
  if (!player || player.status !== "solving") return 0;
  const startMs = player.startTime?.toMillis?.() || player.startTimeMs || 0;
  return startMs ? Math.max(0, (Date.now() - startMs) / 1000) : 0;
}

function isPlayerFinished(player) {
  return Boolean(
    player &&
    (player.status === "finished" || player.finishedAt) &&
    hasFinalBattleTime(player)
  );
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

function isFriendRoomParticipant(player) {
  return Boolean(player) && !isPlayerDisconnected(player);
}

function calculateBattleMoveCount(moves) {
  if (typeof window.calculateNormalizedMoveCount === "function") {
    return window.calculateNormalizedMoveCount(moves);
  }

  return (Array.isArray(moves) ? moves : []).filter(isCountedBattleMove).length;
}

function getBattlePlayerSeconds(player, role) {
  if (hasFinalBattleTime(player)) {
    return Number(player.finalTime);
  }
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
  if (activeRoom.isBot || window.BotBattle?.active) return;
  if (isMultiplayerFriendRoom() && !(activeRoom.activePlayerUids || []).includes(currentUser.uid)) return;

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

    const writer = window.ProfileRecords.create({doc,runTransaction,serverTimestamp},db);
    await writer.battle(currentUser.uid,resultId,activeRoomId,activeRound,{
      uid: currentUser.uid,
      name: getPlayerName(),
      roomId: activeRoomId,
      round: activeRound,
      mode: activeRoom.mode === "ranked" ? "ranked" : "friend",
      cubeMode: activeRoom.cubeMode === "real" ? "real" : "virtual",
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
  } catch (error) {
    savedBattleResultKeys.delete(resultId);
    throw error;
  }
}



function getOpponentRole() {
  if (activeRoom?.mode === "friend" && activeRoom?.maxPlayers > 2) return "opponent";
  return activeRoomRole === "host" ? "guest" : "host";
}

function getDisplayPlayer(role) {
  if (activeRoom?.mode === "friend" && activeRoom?.maxPlayers > 2) {
    if (isSpectatorMode && role === activeRoomRole) return null;
    if (role === activeRoomRole || role === "you") return battlePlayersByUid.get(currentUser?.uid) || null;
    if (role === "host") return battlePlayersByUid.get(activeRoom.hostUid) || null;
    if (role === "opponent") return getSelectedOpponent();
    return [...battlePlayersByUid.values()].find(player => player.uid !== currentUser?.uid && isFriendRoomParticipant(player)) || null;
  }
  return battlePlayersByRole[role] || null;
}

function isMultiplayerFriendRoom() {
  return activeRoom?.mode === "friend" && Number(activeRoom.maxPlayers || 2) > 2;
}

function isRealFriendRoom() {
  return isMultiplayerFriendRoom() && activeRoom?.cubeMode === "real";
}

function isTouchBattleDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
}

function getFriendTimeEntryType() {
  return localStorage.getItem(FRIEND_TIME_ENTRY_TYPE_KEY) === "manual" ? "manual" : "screen";
}

function shouldShowFriendOpponentCube() {
  return localStorage.getItem(FRIEND_SHOW_OPPONENT_CUBE_KEY) !== "false";
}

function isManualRealFriendEntry() {
  return isRealFriendRoom() && getFriendTimeEntryType() === "manual";
}

function parseFriendRealManualTimeInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let seconds;
  if (raw.includes(".")) {
    if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
    seconds = Number(raw);
  } else {
    if (!/^\d+$/.test(raw)) return null;
    seconds = Number(raw) / 100;
  }

  if (!Number.isFinite(seconds) || seconds < 0.01 || seconds >= 3600) return null;
  return Number(seconds.toFixed(2));
}

function renderFriendRealEntryUi() {
  if (!friendRealEditMenu) return;
  const realFriendRoom = isRealFriendRoom();
  const manualEntry = isManualRealFriendEntry();
  const player = battlePlayersByUid.get(currentUser?.uid);
  const editingBlocked = ["inspecting", "solving"].includes(player?.status);
  const showManualInput = realFriendRoom && manualEntry && !isSpectatorMode;
  const showScreenActions = realFriendRoom && !manualEntry && !isSpectatorMode && !editingBlocked;

  if (friendRealManualLabel) friendRealManualLabel.hidden = true;
  if (friendRealManualEntry) friendRealManualEntry.hidden = !showManualInput;
  if (friendRealSaveTimeBtn) friendRealSaveTimeBtn.hidden = true;
  if (friendRealEditActions) friendRealEditActions.hidden = !showScreenActions;
  if (showManualInput) friendRealEditMenu.hidden = false;
  if (!realFriendRoom || isSpectatorMode || (!manualEntry && !showScreenActions)) friendRealEditMenu.hidden = true;
}

async function syncOwnFriendPreferences() {
  if (!currentUser || !activeRoomId || activeRoom?.mode !== "friend" || isSpectatorMode) return;
  const player = battlePlayersByUid.get(currentUser.uid);
  const timeEntryType = getFriendTimeEntryType();
  if (player?.timeEntryType === timeEntryType) return;
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    timeEntryType,
    updatedAt: serverTimestamp()
  });
}

function getBattlePlayersForSelection() {
  const players = isMultiplayerFriendRoom()
    ? [...battlePlayersByUid.values()]
    : [battlePlayersByRole.host, battlePlayersByRole.guest];
  const seen = new Set();
  return players.filter(player => {
    if (!player?.uid || seen.has(player.uid) || player.uid === currentUser?.uid || isPlayerDisconnected(player)) return false;
    seen.add(player.uid);
    return true;
  });
}

function ensureSelectedOpponent() {
  if (activeRoom?.cubeMode === "real") {
    selectedOpponentUid = "";
    return null;
  }
  const candidates = getBattlePlayersForSelection();
  const selected = candidates.find(player => player.uid === selectedOpponentUid);
  if (selected) return selected;
  selectedOpponentUid = candidates[0]?.uid || "";
  return candidates[0] || null;
}

function getSelectedOpponent() {
  return ensureSelectedOpponent();
}

async function ensureBattlePlayerRating(player) {
  if (activeRoom?.mode !== "ranked" || !player?.uid) return null;
  const confirmed = activeRoom.ratingChanges?.[player.uid];
  if (confirmed && Number.isFinite(Number(confirmed.after))) {
    const rating = Math.round(Number(confirmed.after));
    battlePlayerRatings.set(player.uid, rating);
    return rating;
  }
  if (battlePlayerRatings.has(player.uid)) return battlePlayerRatings.get(player.uid);
  if (battlePlayerRatingRequests.has(player.uid)) return battlePlayerRatingRequests.get(player.uid);

  const request = getDoc(userRef(player.uid))
    .then(snapshot => {
      const profile = snapshot.data();
      const rating = !profile || profile.loginType === "guest"
        ? null
        : Math.round(getRating(profile));
      battlePlayerRatings.set(player.uid, rating);
      return rating;
    })
    .catch(error => {
      battlePlayerRatings.set(player.uid, null);
      console.error(error);
      return null;
    })
    .finally(() => battlePlayerRatingRequests.delete(player.uid));
  battlePlayerRatingRequests.set(player.uid, request);
  const rating = await request;
  if (activeRoom?.mode === "ranked") {
    renderMultiplayerRoster();
    renderRankedVersus();
  }
  return rating;
}

function getRosterRatingText(player) {
  if (activeRoom?.mode !== "ranked") return "";
  const change = activeRoom.ratingChanges?.[player.uid];
  if (activeRoom.ratingApplied && change) {
    const before = Math.round(Number(change.before) || INITIAL_RATING);
    const after = Math.round(Number(change.after) || before);
    const delta = Number.isFinite(Number(change.change)) ? Math.round(Number(change.change)) : after - before;
    const signedDelta = delta > 0 ? `+${delta}` : (delta < 0 ? String(delta) : "±0");
    return `Rating: ${before} → ${after} (${signedDelta})`;
  }
  const rating = battlePlayerRatings.get(player.uid);
  return `Rating: ${Number.isFinite(rating) ? rating : "-"}`;
}

function selectOpponent(uid) {
  if (activeRoom?.cubeMode === "real" || !uid || uid === currentUser?.uid) return;
  const opponent = getBattlePlayersForSelection().find(player => player.uid === uid);
  if (!opponent) return;
  localStorage.setItem(FRIEND_SHOW_OPPONENT_CUBE_KEY, "true");
  if (selectedOpponentUid === uid) {
    renderBattleUi();
    return;
  }
  selectedOpponentUid = uid;
  if (friendOpponentMovesUnsubscribe) friendOpponentMovesUnsubscribe();
  friendOpponentMovesUnsubscribe = null;
  friendOpponentMovesUid = "";
  battleMovesByRole.opponent = [];
  syncFriendOpponentMovesListener();
  renderBattleUi();
}

function renderMultiplayerRoster() {
  if (!multiplayerRoster || !multiplayerRosterList) return;
  multiplayerRoster.hidden = false;
  multiplayerRosterToggle.disabled = false;
  updateMultiplayerRosterToggle();
  if (multiplayerRosterHint) multiplayerRosterHint.hidden = activeRoom.cubeMode === "real";
  const activeUids = new Set(activeRoom.activePlayerUids || []);
  const players = (isMultiplayerFriendRoom()
    ? [...battlePlayersByUid.values()].filter(isFriendRoomParticipant)
    : [getDisplayPlayer("host"), getDisplayPlayer("guest")].filter(Boolean)
  ).sort((a, b) => {
    const aTime = hasFinalBattleTime(a) ? Number(a.finalTime) : Infinity;
    const bTime = hasFinalBattleTime(b) ? Number(b.finalTime) : Infinity;
    return aTime - bTime || String(a.name).localeCompare(String(b.name));
  });
  const existingRows = new Map([...multiplayerRosterList.children].map(row => [row.dataset.uid, row]));
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  players.forEach((player, index) => {
    if (activeRoom.mode === "ranked") ensureBattlePlayerRating(player);
    const row = existingRows.get(player.uid) || document.createElement("div");
    existingRows.delete(player.uid);
    const isNew = !row.dataset.uid;
    row.dataset.uid = player.uid;
    row.className = "multiplayer-roster-row";
    const selectable = activeRoom.cubeMode === "virtual" && player.uid !== currentUser?.uid && !isPlayerDisconnected(player);
    row.classList.toggle("opponent-selectable", selectable);
    row.classList.toggle("selected-opponent", selectable && player.uid === selectedOpponentUid);
    if (selectable) {
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-pressed", player.uid === selectedOpponentUid ? "true" : "false");
      row.setAttribute("aria-label", `Watch ${player.name || "player"}'s cube`);
    } else {
      row.removeAttribute("tabindex");
      row.removeAttribute("role");
      row.removeAttribute("aria-pressed");
      row.removeAttribute("aria-label");
    }
    if (isNew) {
      row.addEventListener("click", () => selectOpponent(row.dataset.uid));
      row.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        event.stopPropagation();
        selectOpponent(row.dataset.uid);
      });
      row.innerHTML = `<div class="multiplayer-roster-identity"><strong></strong><small></small></div><span></span><time></time>`;
    }
    const isActive = activeUids.size > 0
      ? activeUids.has(player.uid)
      : ["inspecting", "solving", "finished", "dnf", "time_limit"].includes(player.status);
    const state = player.status || (player.ready ? "ready" : "waiting");
    const place = activeRoom.status === "finished" && isActive && hasFinalBattleTime(player) ? `#${index + 1} ` : "";
    setText(row.querySelector("strong"), `${place}${player.name || "Player"}${player.uid === activeRoom.hostUid ? " (Host)" : ""}`);
    const ratingLabel = row.querySelector("small");
    setText(ratingLabel, getRosterRatingText(player));
    ratingLabel.hidden = activeRoom.mode !== "ranked";
    const entryLabel = player.timeEntryType === "manual" ? " | MANUAL" : "";
    setText(row.querySelector("span"), `${state.toUpperCase()}${entryLabel}`);
    setText(row.querySelector("time"), getRosterTimeText(player));
    if (multiplayerRosterList.children[index] !== row) multiplayerRosterList.insertBefore(row, multiplayerRosterList.children[index] || null);
  });
  existingRows.forEach(row => row.remove());
  if (multiplayerRosterHint && activeRoom.cubeMode === "virtual") {
    const selected = getSelectedOpponent();
    multiplayerRosterHint.textContent = selected
      ? `Watching ${selected.name || "Player"}. Select another player to switch.`
      : "Waiting for opponent...";
  }
}

function updateMultiplayerRosterToggle() {
  if (!multiplayerRoster || !multiplayerRosterToggle) return;
  const expanded = multiplayerRoster.classList.contains("expanded");
  multiplayerRosterToggle.textContent = `Room Players ${expanded ? "−" : "+"}`;
  multiplayerRosterToggle.setAttribute("aria-expanded", String(expanded));
}

function getFriendRealRoomHistoryKey() {
  const mode = activeRoom?.cubeMode === "virtual" ? "virtual" : "real";
  return activeRoomId && currentUser?.uid
    ? (mode === "real"
      ? `friendRealRoomHistory:${activeRoomId}:${currentUser.uid}`
      : `friendVirtualRoomHistory:${activeRoomId}:${currentUser.uid}`)
    : "";
}

function readFriendRealRoomHistory() {
  const key = getFriendRealRoomHistoryKey();
  if (!key) return [];
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.warn("Friend Real Cube room history could not be read.", error);
    return [];
  }
}

function writeFriendRealRoomHistory(history) {
  const key = getFriendRealRoomHistoryKey();
  if (!key) return;
  sessionStorage.setItem(key, JSON.stringify(history.slice(0, 100)));
}

function syncCurrentFriendRealResult() {
  if (!isMultiplayerFriendRoom() || isSpectatorMode || !currentUser) return;
  const player = battlePlayersByUid.get(currentUser.uid);
  if (!player) return;
  const round = Number(player.round || activeRound) || 1;
  const history = readFriendRealRoomHistory();
  const existingIndex = history.findIndex(result => Number(result.round) === round);
  const terminal = player.status === "finished" || player.status === "dnf";

  if (terminal) {
    const result = {
      round,
      status: player.status,
      time: player.status === "finished" && Number.isFinite(Number(player.finalTime))
        ? Number(Number(player.finalTime).toFixed(2))
        : null,
      manual: Boolean(player.manual),
      penalty: player.penalty || "",
      scramble: activeRoom.scramble || ""
    };
    if (existingIndex >= 0) history.splice(existingIndex, 1);
    history.unshift(result);
    writeFriendRealRoomHistory(history);
    return;
  }

  if (existingIndex >= 0 && player.penalty === "removed") {
    history.splice(existingIndex, 1);
    writeFriendRealRoomHistory(history);
  }
}

function calculateFriendRealAverage(history, count) {
  if (history.length < count) return "-";
  const values = history.slice(0, count).map(result =>
    result.status === "finished" && Number.isFinite(Number(result.time)) ? Number(result.time) : Infinity
  );
  const sorted = [...values].sort((a, b) => a - b);
  sorted.shift();
  sorted.pop();
  if (sorted.some(value => !Number.isFinite(value))) return "DNF";
  return (sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(2);
}

function renderFriendRealHistory() {
  if (!friendRealHistoryPanel || !friendRealSolveHistoryList) return;
  friendRealHistoryPanel.hidden = !isMultiplayerFriendRoom() || isSpectatorMode;
  if (friendRealHistoryPanel.hidden) return;

  const solves = readFriendRealRoomHistory();
  const validTimes = solves
    .filter(result => result.status === "finished" && Number.isFinite(Number(result.time)))
    .map(result => Number(result.time));
  if (friendRealPb) friendRealPb.textContent = validTimes.length ? Math.min(...validTimes).toFixed(2) : "-";
  if (friendRealAo5) friendRealAo5.textContent = calculateFriendRealAverage(solves, 5);
  if (friendRealAo12) friendRealAo12.textContent = calculateFriendRealAverage(solves, 12);
  const emptyItem = text => {
    const item = document.createElement("li");
    item.className = "history-empty";
    item.textContent = text;
    return item;
  };
  friendRealSolveHistoryList.replaceChildren(...(solves.length ? solves.map(solve => {
    const item = document.createElement("li");
    const time = solve.status === "dnf" ? "DNF" : Number(solve.time).toFixed(2);
    const manual = solve.manual ? " (Manual)" : "";
    const penalty = solve.penalty === "+2" ? " (+2)" : "";
    item.textContent = `Round ${solve.round}: ${time}${penalty}${manual}`;
    return item;
  }) : [emptyItem("No solves in this room yet.")]));
}

function syncFriendOpponentMovesListener() {
  if (!isMultiplayerFriendRoom() || activeRoom.cubeMode === "real") return;
  const opponent = getSelectedOpponent();
  const uid = opponent?.uid || "";
  const canShowRound = Boolean(activeRoom.scramble) &&
    (isSpectatorMode || ["inspection", "solving", "finished"].includes(activeRoom.status));
  if (uid === friendOpponentMovesUid) {
    if (uid && canShowRound) {
      window.opponentCube?.setScramble(activeRoom.scramble, activeRound);
      window.opponentCube?.applyMoves(battleMovesByRole.opponent);
    }
    return;
  }
  const previousUid = friendOpponentMovesUid;
  if (friendOpponentMovesUnsubscribe) friendOpponentMovesUnsubscribe();
  friendOpponentMovesUnsubscribe = null;
  friendOpponentMovesUid = uid;
  battleMovesByRole.opponent = [];
  if (previousUid !== uid) window.opponentCube?.clear();
  if (!uid) {
    return;
  }
  if (canShowRound) {
    window.opponentCube?.setScramble(activeRoom.scramble, activeRound);
  }
  const watchedRoomId = activeRoomId;
  const watchedRound = activeRound;
  const movesQuery = query(
    collection(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", uid, "moves"),
    where("round", "==", activeRound),
    orderBy("moveIndex", "asc")
  );
  friendOpponentMovesUnsubscribe = onSnapshot(movesQuery, snapshot => {
    if (friendOpponentMovesUid !== uid || activeRoomId !== watchedRoomId || activeRound !== watchedRound) return;
    battleMovesByRole.opponent = snapshot.docs.map(entry => entry.data());
    window.opponentCube?.applyMoves(battleMovesByRole.opponent);
    renderBattleUi();
  });
}

function watchFriendPlayers(roomId) {
  activePlayerUnsubscribes.push(onSnapshot(
    collection(db, BATTLE_ROOMS_COLLECTION, roomId, "players"),
    snapshot => {
      battlePlayersByUid = new Map(snapshot.docs.map(entry => [entry.id, entry.data()]));
      syncCurrentFriendRealResult();
      ensureSelectedOpponent();
      reconcileFriendRoomMembership().catch(console.error);
      handleDisconnectedFriendHost();
      syncFriendOpponentMovesListener();
      const localPlayer = battlePlayersByUid.get(currentUser?.uid);
      if (localPlayer && activeRoom?.mode === "friend" && !isSpectatorMode) {
        syncOwnFriendPreferences().catch(console.error);
      }
      if (localPlayer && ["joined", "ready"].includes(localPlayer.status) && activeRoom?.status === "waiting") {
        window.prepareBattleCube?.("", activeRound);
      }
      syncFriendInspectionState(localPlayer);
      if (localPlayer?.status === "ready" && activeRoom?.status === "inspection") {
        startInspectionForReadyPlayer().catch(console.error);
      }
      ensureRealFriendScrambleForReadyPlayers().catch(console.error);
      autoPrepareInitialRealFriendRound().catch(console.error);
      autoStartFriendRematchWhenReady().catch(console.error);
      finalizeFriendMultiplayerIfDone().catch(console.error);
      refreshFinishedRealFriendWinner().catch(console.error);
      renderBattleUi();
    }
  ));
}

async function refreshFinishedRealFriendWinner() {
  if (!isRealFriendRoom() || activeRoom.status !== "finished" || currentUser?.uid !== activeRoom.hostUid || friendFinalizing) return;
  const activePlayers = (activeRoom.activePlayerUids || [])
    .map(uid => battlePlayersByUid.get(uid))
    .filter(Boolean);
  const winner = activePlayers.filter(isPlayerFinished)
    .sort((a, b) => Number(a.finalTime) - Number(b.finalTime))[0] || null;
  if ((activeRoom.winnerUid || "") === (winner?.uid || "")) return;
  friendFinalizing = true;
  try {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      winnerUid: winner?.uid || "",
      winnerName: winner?.name || "No winner",
      updatedAt: serverTimestamp()
    });
  } finally {
    friendFinalizing = false;
  }
}

async function autoPrepareInitialRealFriendRound() {
  if (
    realFriendInitialRoundPreparing ||
    !currentUser ||
    !isRealFriendRoom() ||
    currentUser.uid !== activeRoom.hostUid ||
    activeRoom.status !== "waiting"
  ) return;
  const players = [...battlePlayersByUid.values()]
    .filter(isFriendRoomParticipant)
    .slice(0, Number(activeRoom.maxPlayers || 20));
  if (players.length < 2) return;
  const scramble = activeRoom.scramble || await getBattleScramble();
  if (!scramble) return;
  realFriendInitialRoundPreparing = true;
  try {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      status: "ready",
      scramble,
      activePlayerUids: players.map(player => player.uid),
      winnerUid: "",
      winnerName: "",
      finishedAt: null,
      updatedAt: serverTimestamp()
    });
  } finally {
    realFriendInitialRoundPreparing = false;
  }
}

async function reconcileFriendRoomMembership() {
  if (
    friendMembershipReconciling ||
    !currentUser ||
    !activeRoomId ||
    !isMultiplayerFriendRoom() ||
    currentUser.uid !== activeRoom.hostUid ||
    activeRoom.status === "cancelled"
  ) return;

  const participantUids = [...battlePlayersByUid.values()]
    .filter(isFriendRoomParticipant)
    .map(player => player.uid);
  const participantSet = new Set(participantUids);
  const canJoinCurrentRealRound = isRealFriendRoom() &&
    Boolean(activeRoom.scramble) &&
    ["ready", "inspection", "solving"].includes(activeRoom.status);
  const activePlayerUids = canJoinCurrentRealRound
    ? participantUids.slice(0, Number(activeRoom.maxPlayers || 20))
    : (activeRoom.activePlayerUids || []).filter(uid => participantSet.has(uid));
  if (
    Number(activeRoom.playerCount || 0) === participantUids.length &&
    JSON.stringify(activePlayerUids) === JSON.stringify(activeRoom.activePlayerUids || [])
  ) return;

  friendMembershipReconciling = true;
  try {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      playerCount: participantUids.length,
      activePlayerUids,
      updatedAt: serverTimestamp()
    });
  } finally {
    friendMembershipReconciling = false;
  }
}

function handleDisconnectedFriendHost() {
  if (
    friendHostExitTimeout ||
    !isMultiplayerFriendRoom() ||
    currentUser?.uid === activeRoom.hostUid ||
    !isPlayerDisconnected(battlePlayersByUid.get(activeRoom.hostUid))
  ) return;

  battleNotice.textContent = "The host left the room. Returning to Normal Mode.";
  friendHostExitTimeout = window.setTimeout(() => {
    friendHostExitTimeout = null;
    leaveBattleMode({ roomAlreadyCancelled: true }).catch(console.error);
  }, 1000);
}

async function autoStartFriendRematchWhenReady() {
  if (
    friendRematchStarting ||
    !currentUser ||
    !activeRoomId ||
    currentUser.uid !== activeRoom?.hostUid ||
    !isMultiplayerFriendRoom() ||
    activeRoom.cubeMode !== "virtual" ||
    !["waiting", "finished"].includes(activeRoom.status)
  ) return;

  const playersInRoom = [...battlePlayersByUid.values()].filter(isFriendRoomParticipant);
  if (playersInRoom.length < 2 || playersInRoom.some(player => !player.ready)) return;
  if (activeRoom.cubeMode === "real" && !activeRoom.scramble) return;

  friendRematchStarting = true;
  try {
    await startFriendMultiplayerGame();
  } finally {
    friendRematchStarting = false;
  }
}

async function ensureRealFriendScrambleForReadyPlayers() {
  if (
    realFriendScramblePreparing ||
    !currentUser ||
    !activeRoomId ||
    currentUser.uid !== activeRoom?.hostUid ||
    !isMultiplayerFriendRoom() ||
    activeRoom.cubeMode !== "real" ||
    activeRoom.scramble ||
    activeRoom.status !== "waiting"
  ) return;

  const readyPlayers = [...battlePlayersByUid.values()]
    .filter(player => player.ready && isFriendRoomParticipant(player));
  if (readyPlayers.length < 2) return;

  const scramble = await getBattleScramble();
  if (!scramble) return;
  realFriendScramblePreparing = true;
  try {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      scramble,
      updatedAt: serverTimestamp()
    });
  } finally {
    realFriendScramblePreparing = false;
  }
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
  setBattleText(`${prefix}Timer`, isFinished ? formatBattleTime(Number(player.finalTime)) : formatBattleTime(currentTimer));
  const finalTimeText = hasFinalBattleTime(player)
    ? formatBattleTime(Number(player.finalTime))
    : "-";
  setBattleText(`${prefix}Final`, isDnf ? "DNF" : finalTimeText);
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
  if (displayedOpponentRatingUid === opponent.uid) {
    const confirmed = activeRoom?.ratingChanges?.[opponent.uid];
    if (activeRoom?.ratingApplied && confirmed) {
      display.textContent = String(Math.round(Number(confirmed.after) || INITIAL_RATING));
    }
    return;
  }

  displayedOpponentRatingUid = opponent.uid;
  display.textContent = "Loading...";
  try {
    const rating = await ensureBattlePlayerRating(opponent);
    if (displayedOpponentRatingUid !== opponent.uid) return;
    display.textContent = Number.isFinite(rating) ? String(rating) : "-";
  } catch (error) {
    if (displayedOpponentRatingUid === opponent.uid) display.textContent = "-";
    console.error(error);
  }
}

function renderBattleNotice() {
  if (!activeRoom) return;
  if (isMultiplayerFriendRoom()) {
    if (isSpectatorMode) {
      battleNotice.textContent = activeRoom.status === "waiting" ? "Spectator mode: waiting for all players to be ready." : "Spectator mode: game in progress.";
      return;
    }
    if (activeRoom.status === "waiting") {
      if (isRealFriendRoom()) {
        battleNotice.textContent = "Waiting for another player.";
        return;
      }
      const opponents = getBattlePlayersForSelection();
      const you = battlePlayersByUid.get(currentUser?.uid);
      battleNotice.textContent = !opponents.length
        ? "Waiting for opponent. Share the room ID to invite a player."
        : you?.ready ? "Waiting for other players to be ready..."
          : "Press Ready. The round starts when everyone is ready.";
      return;
    }
    if (activeRoom.status === "inspection") {
      battleNotice.textContent = (activeRoom.activePlayerUids || []).includes(currentUser?.uid)
        ? "Inspection in progress."
        : "You are watching this round.";
      return;
    }
    if (activeRoom.status === "ready" && activeRoom.cubeMode === "real") {
      battleNotice.textContent = (activeRoom.activePlayerUids || []).includes(currentUser?.uid)
        ? (isTouchBattleDevice() ? "Touch & hold. Release to start." : "Hold Space. Release to start.")
        : "You are watching this round.";
      return;
    }
    if (activeRoom.status === "finished") {
      battleNotice.textContent = "Battle finished.";
      return;
    }
    if (activeRoom.status === "solving") {
      battleNotice.textContent = (activeRoom.activePlayerUids || []).includes(currentUser?.uid)
        ? "Battle in progress."
        : "You are watching this round.";
      return;
    }
  }
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
  const you = getDisplayPlayer(activeRoomRole);
  const opponent = getDisplayPlayer(getOpponentRole());
  if (!opponent) {
    battleNotice.textContent = "Waiting for opponent...";
    return;
  }
  if (you?.status === "ready") {
    battleNotice.textContent = "Waiting for opponent to be ready...";
    return;
  }
  if (you?.status === "inspecting") {
    battleNotice.textContent = "Inspection: make your first move to start.";
    return;
  }
  if (you?.status === "solving") {
    battleNotice.textContent = "Solve in progress.";
    return;
  }
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
  if (isMultiplayerFriendRoom()) {
    battleResult.textContent = `Winner: ${winner} | Friend Battle: no rating change`;
    battleResultBadge.textContent = activeRoom.winnerUid === currentUser?.uid ? "WINNER" : "FINISHED";
    battleResultBadge.className = `battle-result-badge ${activeRoom.winnerUid === currentUser?.uid ? "winner" : ""}`;
    return;
  }
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

// Presentation only: outcomes/deadlines remain owned by the existing room state.
function renderRankedExperience(you, opponent) {
  const setText = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  const region = document.getElementById("rankedExperience");
  if (!region) return;
  region.hidden = activeRoom?.mode !== "ranked" || activeRoom.cubeMode !== "virtual";
  if (region.hidden) return;
  const moment = document.getElementById("rankedMoment");
  const inspecting = you?.status === "inspecting" && !['finished','finishing'].includes(activeRoom.status);
  moment.hidden = inspecting;
  let phase = "ready", title = "READY TO ROLL?", detail = "Get ready. Your next challenge is here!";
  if (activeRoom.status === "finished") {
    const draw = activeRoom.isDraw || !activeRoom.winnerUid;
    phase = draw ? "draw" : activeRoom.winnerUid === currentUser?.uid ? "win" : "lose";
    title = draw ? "IT’S A DRAW!" : phase === "win" ? "YOU WIN!" : "YOU LOSE!";
    detail = draw ? "Evenly matched. Ready for another round?" : phase === "win" ? "Brilliant solve. Enjoy the victory!" : "You lost this round. Take a breath and come back stronger!";
  } else if (activeRoom.status === 'finishing') {
    phase = 'finishing';
    const remaining = Math.max(0, Math.ceil((Number(activeRoom.finishDeadlineMs) - Date.now()) / 1000));
    title = String(remaining);
    detail = remaining > 0 ? (hasFinalBattleTime(you) ? 'Waiting for opponent · Result in…' : 'Your opponent finished. Keep solving! Result in…') : 'Confirming the result…';
  } else if (you?.status === 'time_limit' || you?.timeLimitReached) {
    phase = 'finalizing'; title = "TIME’S UP!";
    detail = 'Comparing completion scores…';
  } else if (hasFinalBattleTime(you)) {
    phase = "waiting"; title = "YOU DID IT!";
    const deadline = Number(activeRoom.finishDeadlineMs);
    const remaining = activeRoom.status === "finishing" && deadline > 0
      ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      : Math.max(0, Math.ceil(120 - getPlayerElapsedSeconds(opponent)));
    detail = isPlayerFinished(opponent) || remaining === 0 ? "Confirming the result…" : `Waiting for your opponent · Battle ends in up to ${remaining}s`;
  } else if (you?.status === "solving") {
    phase = "solving"; title = "LET’S GO!";
    detail = activeRoom.status === "finishing" ? "Your opponent finished. Keep going — you can still finish!" : "Your turn to shine. Every move counts!";
  } else if (inspecting) {
    phase = "inspection";
  } else if (you?.status === "ready") {
    detail = "Waiting for your opponent. The scramble is on its way!";
  }
  setText(document.getElementById("rankedMomentTitle"), title);
  // Do not announce a ticking countdown to screen readers every second.
  const detailNode = document.getElementById("rankedMomentDetail");
  detailNode.setAttribute("aria-live", ['waiting','finishing'].includes(phase) ? "off" : "polite");
  setText(detailNode, detail);
  const key = `${activeRoomId}:${activeRound}:${phase}`;
  if (moment.dataset.eventKey === key) return;
  moment.dataset.eventKey = key;
  moment.dataset.phase = phase;
  const immediateResult = activeRoom.status === 'finished' && activeRoom.timeLimitReached;
  if (immediateResult) moment.getAnimations().forEach(animation => animation.cancel());
  if (!immediateResult && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !inspecting) {
    moment.getAnimations().forEach(animation => animation.cancel());
    moment.animate([
      { opacity:0, transform:"translateY(12px) scale(.82) rotate(-3deg)" },
      { opacity:1, transform:"translateY(-3px) scale(1.06) rotate(1deg)", offset:.65 },
      { opacity:1, transform:"none" }
    ], { duration:650, easing:"cubic-bezier(.2,.8,.2,1)" });
  }
}

function renderRankedVersus() {
  const panel = document.getElementById("rankedVersus");
  if (!panel) return;
  panel.hidden = activeRoom?.mode !== "ranked" || activeRoom.cubeMode !== "virtual";
  if (panel.hidden) return;
  for (const [prefix, player] of [["rankedYou", getDisplayPlayer(activeRoomRole)], ["rankedOpponent", getDisplayPlayer(getOpponentRole())]]) {
    const change = activeRoom.ratingApplied && activeRoom.ratingChanges?.[player?.uid];
    const cached = battlePlayerRatings.get(player?.uid);
    const rating = change && Number.isFinite(Number(change.after)) ? Math.round(Number(change.after)) : cached;
    const values = {
      Name: player?.name || "Waiting for opponent…",
      Rating: Number.isFinite(rating) ? String(rating) : "—",
      RatingChange: change && Number.isFinite(Number(change.change))
        ? `${Number(change.change) >= 0 ? "+" : ""}${Number(change.change)} this match` : ""
    };
    for (const [suffix, value] of Object.entries(values)) {
      const node = document.getElementById(prefix + suffix);
      if (node.textContent !== value) node.textContent = value;
      if (suffix === "Name") node.title = value;
    }
  }
}

function renderBattleReadyButton(you, opponent) {
  if (isRealFriendRoom()) {
    battleReadyBtn.hidden = true;
    return;
  }
  if (isMultiplayerFriendRoom()) {
    const activeRoundRunning = ["inspection", "solving", "finishing"].includes(activeRoom?.status) ||
      (activeRoom?.status === "ready" && (activeRoom.activePlayerUids || []).length > 0);
    battleReadyBtn.hidden = isSpectatorMode || !you || Boolean(you.ready) || activeRoundRunning;
    if (battleReadyBtn.hidden) return;
    battleReadyBtn.disabled = false;
    battleReadyBtn.textContent = "Ready";
    return;
  }
  const battleEnded = activeRoom?.status === "finished" || activeRoom?.status === "finishing";
  const rankedReady = activeRoom?.mode === "ranked" && you?.status === "ready";
  battleReadyBtn.hidden = battleEnded || !you || rankedReady || ["inspecting", "solving"].includes(you.status);
  if (battleReadyBtn.hidden) return;

  const isReady = you.status === "ready";
  battleReadyBtn.disabled = isReady;
  battleReadyBtn.textContent = isReady ? "Waiting for scramble..." : "Ready";
}

function renderRematchPanel(you, opponent) {
  if (isMultiplayerFriendRoom()) {
    battleRematchPanel.hidden = true;
    return;
  }
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
  if (activeRoom?.isBot) {window.BotBattle?.render();return;}
  if (!activeRoomId || !activeRoom) {
    renderFriendRoomShare("");
    return;
  }

  const you = getDisplayPlayer(activeRoomRole);
  const opponent = activeRoom.cubeMode === "virtual"
    ? getSelectedOpponent()
    : getDisplayPlayer(getOpponentRole());
  const count = isMultiplayerFriendRoom()
    ? [...battlePlayersByUid.values()].filter(isFriendRoomParticipant).length
    : [getDisplayPlayer("host"), getDisplayPlayer("guest")].filter(Boolean).length;

  roomIdInput.value = activeRoomId;
  if (roomUrlOutput) roomUrlOutput.value = getRoomUrl(activeRoomId);
  renderFriendRoomShare(activeRoomId);
  const friendRoom = activeRoom.mode === "friend";
  const realFriendRoom = friendRoom && activeRoom.cubeMode === "real";
  syncFriendVirtualBattleLayout();
  document.body.classList.toggle("touch-device", isTouchBattleDevice());
  battleRoomMeta.classList.toggle("real-room-meta", friendRoom);
  if (friendRoom) {
    const label = document.createElement("span");
    label.textContent = "Room ID";
    const roomId = document.createElement("strong");
    roomId.textContent = activeRoomId;
    const players = document.createElement("small");
    players.textContent = `Players: ${count}/${activeRoom.maxPlayers || 2}${isSpectatorMode ? " · Spectating" : ""}`;
    battleRoomMeta.replaceChildren(label, roomId, players);
  } else {
    battleRoomMeta.textContent = activeRoom.mode === "ranked"
      ? `Ranked match | Players: ${count}/2`
      : `Room: ${activeRoomId} | Players: ${count}/${activeRoom.maxPlayers || 2}${isSpectatorMode ? " | Spectating" : ""}`;
  }
  battleModeLabel.textContent = activeRoom.mode === "ranked"
    ? "Ranked Battle"
    : "Friend Battle";
  copyRoomUrlBtn.hidden = activeRoom.mode === "ranked";
  copyRoomUrlBtn.textContent = activeRoom.mode === "friend" ? "Copy Room ID" : "Copy Room URL";
  if (friendBattleSettingsBtn) friendBattleSettingsBtn.hidden = !(friendRoom || activeRoom.mode === "ranked");
  leaveBattleBtn.hidden = friendRoom || activeRoom.mode === "ranked";
  const realFriendScramblePreview = activeRoom.mode === "friend" &&
    activeRoom.cubeMode === "real" &&
    Boolean(activeRoom.scramble);
  const virtualFriendScrambleVisible = friendRoom && activeRoom.cubeMode === "virtual" &&
    ["inspection", "solving", "finished"].includes(activeRoom.status);
  const canSeeScramble = realFriendScramblePreview || virtualFriendScrambleVisible || (isSpectatorMode
    ? ["inspection", "solving", "finished"].includes(activeRoom.status)
    : ["inspecting", "solving", "finished", "dnf"].includes(you?.status));
  battleScramble.textContent = canSeeScramble ? (activeRoom.scramble || "") : "";
  scrambleNetPanel.hidden = !realFriendScramblePreview;
  if (realFriendScramblePreview) {
    window.renderScrambleNet?.(activeRoom.scramble, scrambleCubeNet);
  }
  renderBattlePlayer("battleYou", you, activeRoomRole);
  renderBattlePlayer("battleOpponent", opponent, getOpponentRole());
  loadOpponentRating(opponent);
  renderOpponentCube(opponent);
  renderRankedTimeLimit(you);
  renderBattleNotice();
  returnToNormalAfterOpponentExit(opponent);
  handleDisconnectedFriendHost();
  renderBattleResult();
  renderRankedExperience(you, opponent);
  renderBattleReadyButton(you, opponent);
  renderRematchPanel(you, opponent);
  renderBattleResultsUI({finished:activeRoom.status === 'finished',ranked:activeRoom.mode === 'ranked' && activeRoom.cubeMode === 'virtual',you,opponent});
  renderMultiplayerRoster();
  renderRankedVersus();
  renderFriendRealHistory();
  document.body.classList.toggle("real-cube-battle", activeRoom.cubeMode === "real");
  document.body.classList.toggle("friend-real-battle", realFriendRoom);
  window.setVirtualCubeVisible?.(activeRoom.cubeMode !== "real");
  document.body.classList.toggle("spectator-mode", isSpectatorMode);
  const virtualFriendAutoStart = friendRoom && activeRoom.cubeMode === "virtual";
  const hostCanStart = isMultiplayerFriendRoom() && !realFriendRoom && !virtualFriendAutoStart && currentUser?.uid === activeRoom.hostUid && !isSpectatorMode && activeRoom.status === "waiting";
  hostStartBattleBtn.hidden = !hostCanStart;
  if (hostCanStart) {
    const readyCount = [...battlePlayersByUid.values()].filter(player => player.ready && isFriendRoomParticipant(player)).length;
    const hostIsReady = Boolean(battlePlayersByUid.get(activeRoom.hostUid)?.ready);
    const minimumReadyPlayers = activeRoom.cubeMode === "real" ? 2 : 1;
    hostStartBattleBtn.disabled = !hostIsReady || readyCount < minimumReadyPlayers || (activeRoom.cubeMode === "real" && !activeRoom.scramble);
    hostStartBattleBtn.textContent = !hostIsReady
      ? "Host must be Ready"
      : (readyCount < minimumReadyPlayers
        ? `Waiting for players (${readyCount}/${minimumReadyPlayers})`
        : `Start Game (${readyCount} ready)`);
  }
  const localIsActive = (activeRoom.activePlayerUids || []).includes(currentUser?.uid);
  const realCubeActive = activeRoom.cubeMode === "real" && !isSpectatorMode && localIsActive && ["ready", "inspection", "solving"].includes(activeRoom.status);
  const waitingForInspection = realCubeActive && you?.status === "ready";
  const inspectionEnabled = window.isRealCubeInspectionEnabled?.() === true;
  realCubeInstruction.hidden = realFriendRoom || !realCubeActive || !["ready", "inspecting"].includes(you?.status);
  if (!realCubeInstruction.hidden) {
    realCubeInstruction.textContent = waitingForInspection
      ? (inspectionEnabled ? "Press Space to start inspection" : "Press Start Solve to prepare the timer")
      : "Hold and release Space to start solve";
  }
  if (realCubeTimerBtn) realCubeTimerBtn.hidden = true;
  friendRealControls.hidden = true;
  if (friendRealTimerPanel) friendRealTimerPanel.hidden = !realFriendRoom || isSpectatorMode;
  if (friendRealOperationText) {
    const manualEntry = isManualRealFriendEntry();
    friendRealOperationText.hidden = !realFriendRoom || isSpectatorMode || manualEntry || activeRoom.status === "finished";
    const touch = isTouchBattleDevice();
    friendRealOperationText.textContent = you?.status === "solving"
      ? (touch ? "Touch again to stop." : "Press Space again to stop.")
      : (touch ? "Touch & hold. Release to start. Touch again to stop." : "Hold Space. Release to start. Press Space again to stop.");
  }
  if (friendRealTimerDisplay && realFriendRoom) {
    friendRealTimerDisplay.textContent = you?.status === "dnf"
      ? "DNF"
      : (hasFinalBattleTime(you) ? formatBattleTime(Number(you.finalTime)) : formatBattleTime(localBattleTimerSeconds));
  }
  if (friendRealEditBtn) {
    const manualEntry = isManualRealFriendEntry();
    friendRealEditBtn.hidden = manualEntry || !realFriendRoom || isSpectatorMode || ["inspecting", "solving"].includes(you?.status);
  }
  renderFriendRealEntryUi();

  if (activeRoom.status === "finished") {
    if (activeRoom.mode === "ranked" && !activeRoom.ratingUpdated) {
      applyRankedBattleResultAsHost().catch(console.error);
    }
    if (activeRoom.mode !== "ranked" || activeRoom.ratingUpdated) {
      saveBattleResultForCurrentUser().catch(console.error);
      refreshRatingAfterBattle();
    }
  }
  if (isRealFriendRoom()) {
    battleNotice.textContent = isTouchBattleDevice()
      ? "Touch & hold. Release to start."
      : "Hold Space. Release to start.";
    return;
  }

  if (activeRoom.status === "finishing" && Date.now() >= Number(activeRoom.finishDeadlineMs)) {
    if (!isMultiplayerFriendRoom()) finalizeBattle().catch(console.error);
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
  if (isMultiplayerFriendRoom() && activeRoom.cubeMode === "virtual" && activeRoom.inspectionStartTimeMs) {
    return Number(activeRoom.inspectionStartTimeMs);
  }
  return player?.inspectionStartTime?.toMillis?.() || player?.inspectionStartTimeMs || Date.now();
}

// Room and player snapshots may arrive in either order. Restore the local
// countdown after round preparation, without restarting a solve or old round.
function syncFriendInspectionState(player) {
  if (!isMultiplayerFriendRoom() || activeRoom.cubeMode !== "virtual" || isSpectatorMode ||
      activeRoom.status !== "inspection" || !activeRoom.scramble ||
      !(activeRoom.activePlayerUids || []).includes(currentUser?.uid) ||
      player?.status !== "inspecting" || Number(player.round) !== activeRound) return;
  syncLocalBattleState(player);
}

function startLocalBattleInspection(scramble, inspectionStartTimeMs, round) {
  if (isRealFriendRoom() || (activeRoom?.cubeMode === "real" && window.isRealCubeInspectionEnabled?.() !== true)) {
    window.startBattleRealPreparation?.(scramble, round);
    return;
  }
  window.startBattleInspection?.(scramble, inspectionStartTimeMs, round);
}

function syncLocalBattleState(player) {
  if (!activeRoom || !player || !document.body.classList.contains("battle-mode")) return;

  if (player.status === "joined" || player.status === "ready") {
    window.prepareBattleCube?.(activeRoom.scramble, activeRound, isRealFriendRoom());
  }

  if (player.status === "inspecting") {
    if (activeRoom.scramble) window.opponentCube?.setScramble(activeRoom.scramble, activeRound);
    startLocalBattleInspection(
      activeRoom.scramble,
      getInspectionStartMs(player),
      activeRound
    );
  }
}

async function startInspectionForReadyPlayer() {
  if (readyInspectionStarting || !currentUser || !activeRoomId || !activeRoom?.scramble) return;
  if (isMultiplayerFriendRoom() && !(activeRoom.activePlayerUids || []).includes(currentUser.uid)) return;
  readyInspectionStarting = true;

  try {
    const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid);
    const snapshot = await getDoc(playerRef);
    if (!snapshot.exists() || snapshot.data().status !== "ready") return;
    const player = snapshot.data();

    const inspectionStartTimeMs = isMultiplayerFriendRoom()
      ? Number(activeRoom.inspectionStartTimeMs || Date.now())
      : Date.now();
    await updateDoc(playerRef, {
      status: "inspecting",
      ready: false,
      active: true,
      round: activeRound,
      inspectionStartTime: serverTimestamp(),
	      inspectionStartTimeMs,
	      startTime: null,
	      startTimeMs: 0,
	      endTime: null,
	      finishedAt: null,
	      finalTime: null,
	      ...getPreviousBattleResultFields(player),
	      tps: null,
      moveCount: 0,
      currentCompletionScore: 0,
      maxCompletionScore: 0,
      lastMove: "",
      updatedAt: serverTimestamp()
    });
    startLocalBattleInspection(activeRoom.scramble, inspectionStartTimeMs, activeRound);
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
  battlePlayerRatings.clear();
  battlePlayerRatingRequests.clear();
  activeRoom = null;
  activeRound = 0;
  battlePlayersByRole = { host: null, guest: null };
  battlePlayersByUid = new Map();
  battleMovesByRole = { host: [], guest: [] };
  selectedOpponentUid = "";
  preparedLocalRealFriendRoundKey = "";
  multiplayerRoster?.classList.remove("expanded");
  multiplayerRosterToggle?.setAttribute("aria-expanded", "false");
  setBattleMode(true);
  window.history.replaceState({}, "", getRoomUrl(roomId));

  activeRoomUnsubscribe = onSnapshot(doc(db, BATTLE_ROOMS_COLLECTION, roomId), snapshot => {
    if (!snapshot.exists()) {
      setBattleStatus("Room not found.");
      return;
    }

    const room = {
      cubeMode: "virtual",
      ...snapshot.data()
    };
    const previousHostUid = activeRoom?.hostUid;
    const previousGuestUid = activeRoom?.guestUid;
    const previousRound = activeRound;
    activeRoom = room;
    activeRound = Number(room.round) || 1;
    if (room.mode === "friend" && room.status === "cancelled" && !battleLeaving) {
      battleNotice.textContent = "The host closed the room. Returning to Normal Mode.";
      if (!friendHostExitTimeout) {
        friendHostExitTimeout = window.setTimeout(() => {
          friendHostExitTimeout = null;
          leaveBattleMode({ roomAlreadyCancelled: true }).catch(console.error);
        }, 1000);
      }
      return;
    }
    const localPlayer = getDisplayPlayer(activeRoomRole);
    const localCanSeeScramble = ["inspecting", "solving", "finished", "dnf"].includes(localPlayer?.status);
    const virtualFriendRoundVisible = room.mode === "friend" && room.cubeMode === "virtual" &&
      ["inspection", "solving", "finished"].includes(room.status);
    if ((localCanSeeScramble || virtualFriendRoundVisible || isSpectatorMode) && room.scramble) {
      window.opponentCube?.setScramble(room.scramble, activeRound);
      window.opponentCube?.applyMoves((battleMovesByRole.opponent || [])
        .filter(move => !move.round || Number(move.round) === activeRound));
    } else {
      window.opponentCube?.clear();
    }

    if (room.mode === "friend" && Number(room.maxPlayers || 2) > 2) {
      if (activePlayerUnsubscribes.length === 0) watchFriendPlayers(roomId);
    } else if (
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

    if (previousRound && activeRound > previousRound && !isSpectatorMode && !isMultiplayerFriendRoom()) {
      beginNextBattleRound(room).catch(console.error);
    }
    if (previousRound && activeRound > previousRound && !isSpectatorMode && isMultiplayerFriendRoom()) {
      resetFriendRoundDisplay(room);
      if (friendOpponentMovesUnsubscribe) friendOpponentMovesUnsubscribe();
      friendOpponentMovesUnsubscribe = null;
      friendOpponentMovesUid = "";
      battleMovesByRole.opponent = [];
      syncFriendOpponentMovesListener();
    }

    prepareLocalRealFriendRound(room).catch(error => {
      preparedLocalRealFriendRoundKey = "";
      battleNotice.textContent = "The next round could not be prepared.";
      console.error("Friend Real Cube round preparation failed", error);
    });

    if (room.mode === "friend" && room.cubeMode === "virtual") {
      syncFriendOpponentMovesListener();
    }

    renderBattleUi();
    syncFriendInspectionState(localPlayer);
    if (isMultiplayerFriendRoom()) finalizeFriendMultiplayerIfDone().catch(console.error);
    if (
      localPlayer?.status === "ready" &&
      room.scramble &&
      (!isMultiplayerFriendRoom() || room.status === "inspection")
    ) {
      startInspectionForReadyPlayer().catch(console.error);
    }
    setBattleStatus(`Room ${roomId}: ${activeRoomRole}`);
  });
}

function resetFriendRoundDisplay(room) {
  battleMovesByRole = { host: [], guest: [], opponent: [] };
  window.prepareBattleCube?.(room.scramble || "", activeRound, room.cubeMode === "real");
}

async function prepareLocalRealFriendRound(room) {
  if (
    !currentUser ||
    isSpectatorMode ||
    room.mode !== "friend" ||
    room.cubeMode !== "real" ||
    !["ready", "inspection", "solving"].includes(room.status) ||
    !(room.activePlayerUids || []).includes(currentUser.uid)
  ) return;

  const round = Number(room.round) || 1;
  const roundKey = `${activeRoomId}:${round}`;
  if (preparedLocalRealFriendRoundKey === roundKey) return;

  const player = battlePlayersByUid.get(currentUser.uid);
  const staleState = !player ||
    Number(player.round || 0) !== round ||
    ["finished", "dnf", "aborted", "returned", "left", "disconnected"].includes(player.status);

  preparedLocalRealFriendRoundKey = roundKey;
  window.prepareBattleCube?.(room.scramble || "", round, true);
  if (!staleState) return;

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "ready",
    ready: false,
    active: true,
    round,
    inspectionStartTime: null,
    inspectionStartTimeMs: 0,
    startTime: null,
    startTimeMs: 0,
    endTime: null,
    finishedAt: null,
    finalTime: null,
    ...getPreviousBattleResultFields(player),
    tps: null,
    moveCount: 0,
    lastMove: "",
    updatedAt: serverTimestamp()
  });
}

async function beginNextBattleRound(room) {
  if (!currentUser || !activeRoomId || room.round !== activeRound) return;

  const player = battlePlayersByUid.get(currentUser.uid) || getDisplayPlayer(activeRoomRole);
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
    ...getPreviousBattleResultFields(player),
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
  if (activeRoom?.isBot) {await leaveBattleMode();await startRankedBattle();return;}
  if (!currentUser || !activeRoomId || activeRoom?.status !== "finished") return;
  if (isPlayerDisconnected(getDisplayPlayer(getOpponentRole()))) return;

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    rematchReady: true,
    updatedAt: serverTimestamp()
  });
  await startRematchIfBothReady();
}

async function createBattleRoom(mode = "friend") {
  if (mode === 'friend' && rankedSearchLocked) await cancelRandomMatch();
  if (!currentUser) {
    setBattleStatus("Log in or use Guest Login to create a room.");
    return;
  }

  if (mode === "friend" && matchmakingUnsubscribe) {
    await cancelRandomMatch();
  }

  const roomId = createRoomId();
  const cubeMode = "virtual";
  const initialScramble = "";
  const room = {
    roomId,
    mode,
    cubeMode,
    maxPlayers: mode === "friend" ? 20 : 2,
    playerCount: 1,
    activePlayerUids: [],
    scramble: initialScramble,
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
  isSpectatorMode = false;
  roomIdInput.value = roomId;
  if (roomUrlOutput) roomUrlOutput.value = getRoomUrl(roomId);
  renderFriendRoomShare(roomId);
  if (mode === "friend") {
    clearFriendLobby();
    setBattleStatus("Friend room created. Share the Room ID.");
    watchRoom(roomId);
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
    .filter(queueDoc => queueDoc.id !== currentUser?.uid && queueDoc.data().roomId && queueDoc.data().mode === "ranked" && now - Number(queueDoc.data().startedAtMs || now) < 90000)
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

async function attemptRankedMatch(wide = false) {
  if (rankedMatchAttempting || !currentUser || !rankedOwnQueueRoomId || document.body.classList.contains("battle-mode")) return;
  rankedMatchAttempting = true;
  const uid=currentUser.uid,ownId=rankedOwnQueueRoomId,token=rankedSearchToken,ticket=rankedSearchGeneration;
  try {
    const ownQueue = await getDoc(doc(db, MATCHMAKING_COLLECTION, uid));
    if (!ownQueue.exists() || ownQueue.data().status !== "waiting" || ownQueue.data().searchToken!==token) return;
    const entry=ownQueue.data(),started=wide?Date.now()-31000:Number(entry.startedAtMs)||Date.now();
    const candidates=await getRankedCandidateDocs(getRating(entry),started);
    const candidate=selectRankedCandidate(candidates,getRating(entry),started);
    if(!candidate||ticket!==rankedSearchGeneration)return;
    const targetId=candidate.data().roomId;
    const matched=await runTransaction(db,async tx=>{
      const ownRef=doc(db,BATTLE_ROOMS_COLLECTION,ownId),targetRef=doc(db,BATTLE_ROOMS_COLLECTION,targetId);
      const mineRef=doc(db,MATCHMAKING_COLLECTION,uid),theirsRef=doc(db,MATCHMAKING_COLLECTION,candidate.id);
      const [own,target,mine,theirs]=await Promise.all([tx.get(ownRef),tx.get(targetRef),tx.get(mineRef),tx.get(theirsRef)]);
      if(ticket!==rankedSearchGeneration)throw Error("Search cancelled");
      if(own.data()?.guestUid)return {id:ownId,host:true};
      if(own.data()?.status!=="waiting"||mine.data()?.searchToken!==token)return null;
      if(!target.exists()||target.data().status!=="waiting"||target.data().guestUid||target.data().mode!=="ranked"||theirs.data()?.status!=="waiting"||theirs.data()?.roomId!==targetId)return null;
      tx.update(ownRef,{status:"cancelled",updatedAt:serverTimestamp()});tx.delete(mineRef);
      tx.update(targetRef,{guestUid:uid,updatedAt:serverTimestamp()});
      return {id:targetId,host:false};
    });
    if(!matched||ticket!==rankedSearchGeneration)return;
    clearMatchmakingListeners();clearFriendLobby();setRandomStatus("Matched with a player!");
    if(matched.host)watchRoom(matched.id);else await joinBattleRoom(matched.id,true);
  } finally { rankedMatchAttempting=false; }
}
function scheduleRankedMatchExpansion() {
  rankedMatchExpansionTimeouts = [10000, 20000, 30000].map(delay => window.setTimeout(() => {
    attemptRankedMatch().catch(console.error);
  }, delay));
}

function releaseRankedSearchLock() {
  rankedSearchLocked=false;
  if(rankedSearchLockRelease){rankedSearchLockRelease();rankedSearchLockRelease=null;}
}
async function acquireRankedSearchLock() {
  if(rankedSearchLocked)return false;
  if(!navigator.locks){rankedSearchLocked=true;return true;}
  return new Promise(resolve=>{
    navigator.locks.request("stcube-random-"+currentUser?.uid,{ifAvailable:true},async lock=>{
      if(!lock){resolve(false);return;}
      rankedSearchLocked=true;
      const held=new Promise(done=>{rankedSearchLockRelease=done;});
      resolve(true);await held;
    }).catch(()=>resolve(false));
  });
}
async function startRankedBattle() {
  if(document.body.classList.contains("battle-mode")||matchmakingUnsubscribe||randomRoomUnsubscribe)return;
  if(!await acquireRankedSearchLock()){setRandomStatus("Random Battle is already active in another tab.");return;}
  const ticket=++rankedSearchGeneration;
  try {
    const eligibility=await getRankedBattleEligibility();
    if(ticket!==rankedSearchGeneration)return;
    if(!eligibility.eligible){setRandomStatus(eligibility.message);releaseRankedSearchLock();return;}
    startRankedSearchTimer();
    const profileSnapshot=await getDoc(userRef()),profile=profileSnapshot.data()||{},myRating=getRating(profile);
    if(ticket!==rankedSearchGeneration)return;
    const startedAtMs=Date.now(),roomId=createRoomId(),uid=currentUser.uid;
    rankedOwnQueueRoomId=roomId;rankedSearchToken=crypto.randomUUID();
  const room = {
    roomId,
    mode: "ranked",
    cubeMode: "virtual",
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

    await runTransaction(db,async tx=>{
      const queueRef=doc(db,MATCHMAKING_COLLECTION,uid),previous=await tx.get(queueRef);
      let oldRoom=null,oldRef=null;
      if(previous.exists()){
        oldRef=doc(db,BATTLE_ROOMS_COLLECTION,previous.data().roomId);oldRoom=await tx.get(oldRef);
        if(oldRoom.data()?.guestUid||Date.now()-Number(previous.data().startedAtMs||0)<90000)throw Error("Another tab or device is already searching.");
      }
      if(ticket!==rankedSearchGeneration)throw Error("Search cancelled");
      if(oldRoom?.data()?.status==="waiting"&&!oldRoom.data().guestUid&&oldRoom.data().hostUid===uid)tx.update(oldRef,{status:"cancelled",updatedAt:serverTimestamp()});
      tx.set(doc(db,BATTLE_ROOMS_COLLECTION,roomId),room);
      tx.set(doc(db,BATTLE_ROOMS_COLLECTION,roomId,"players",uid),createPlayer("host"));
      tx.set(queueRef,{uid,name:getPlayerName(),mode:"ranked",status:"waiting",roomId,rating:myRating,startedAtMs,searchToken:rankedSearchToken,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    });
    activeRoomId=roomId;activeRoomRole="host";
    if(ticket!==rankedSearchGeneration){await cancelRandomMatch();return;}
    clearFriendLobby();
    friendLobbyUnsubscribe=onSnapshot(doc(db,BATTLE_ROOMS_COLLECTION,roomId),snapshot=>{
      if(ticket!==rankedSearchGeneration||window.BotBattle?.active)return;
      if(snapshot.data()?.guestUid){clearFriendLobby();clearMatchmakingListeners();clearMyMatchmakingEntry();setRandomStatus("Matched with a player!");watchRoom(roomId);}
    });
    matchmakingUnsubscribe=onSnapshot(doc(db,MATCHMAKING_COLLECTION,uid),snapshot=>{
      if(ticket!==rankedSearchGeneration||window.BotBattle?.active)return;
      const entry=snapshot.data();if(entry?.status==="matched"&&entry.roomId)enterMatchedRankedRoom(entry.roomId);
    });
    scheduleRankedMatchExpansion();
    botFallbackTimeout=setTimeout(()=>fallbackToBot(ticket,roomId,profile),BOT_FALLBACK_WAIT_MS);
    matchmakingTimeout=setTimeout(()=>cancelRandomMatch("Search timed out. Please try again."),60000);
    await attemptRankedMatch();
  } catch(error) {
    if(ticket===rankedSearchGeneration){await cancelRandomMatch(error.message||"Could not start matchmaking.");}
    throw error;
  }
}
async function fallbackToBot(ticket,roomId,profile) {
  let withdrawn=false;
  if(ticket!==rankedSearchGeneration||document.body.classList.contains("battle-mode"))return;
  if(rankedMatchAttempting){botFallbackTimeout=setTimeout(()=>fallbackToBot(ticket,roomId,profile),50);return;}
  try {
    // One final widened human search before withdrawing. The room transaction
    // below serializes against the guest's join transaction.
    await attemptRankedMatch(true);
    if(ticket!==rankedSearchGeneration||document.body.classList.contains("battle-mode"))return;
    const uid=currentUser?.uid,token=rankedSearchToken;
    const outcome=await runTransaction(db,async tx=>{
      const roomRef=doc(db,BATTLE_ROOMS_COLLECTION,roomId),queueRef=doc(db,MATCHMAKING_COLLECTION,uid);
      const [room,queue]=await Promise.all([tx.get(roomRef),tx.get(queueRef)]);
      if(ticket!==rankedSearchGeneration)throw Error("Search cancelled");
      if(room.data()?.guestUid)return "human";
      if(room.data()?.status!=="waiting"||queue.data()?.roomId!==roomId||queue.data()?.searchToken!==token)return "stale";
      tx.update(roomRef,{status:"cancelled",updatedAt:serverTimestamp()});tx.delete(queueRef);return "bot";
    });
    if(ticket!==rankedSearchGeneration)return;
    if(outcome==="human"){clearFriendLobby();clearMatchmakingListeners();watchRoom(roomId);return;}
    if(outcome!=="bot")return;
    withdrawn=true;
    clearFriendLobby();clearMatchmakingListeners();activeRoomId="";activeRoomRole="";
    cancelMatchBtn.hidden=false;randomBattleBtn.disabled=true;
    setRandomStatus("No player found. Preparing an unrated BOT battle…");
    const scramble=await getBattleScramble();
    const prepared=await window.BotBattle.prepare(scramble,Number.isFinite(profile.rating)?profile.rating:null);
    if(ticket!==rankedSearchGeneration||!currentUser||document.body.classList.contains("battle-mode"))return;
    window.BotBattle.start(prepared,getPlayerName(),profile.rating);
  }catch(error){
    if(ticket===rankedSearchGeneration){if(withdrawn){stopRankedSearchTimer();releaseRankedSearchLock();setRandomStatus("BOT could not start. Please search again.");}else{setRandomStatus("Could not safely switch to BOT. Check your connection or cancel.");botFallbackTimeout=setTimeout(()=>fallbackToBot(ticket,roomId,profile),5000);}}
    console.warn("BOT fallback not started",error.code||error.message);
  }
}
async function joinBattleRoom(roomId, allowRankedMatch = false, asSpectator = false) {
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

  let room = {
    cubeMode: "virtual",
    ...snapshot.data()
  };
  if (room.status === "cancelled" || (room.status === "finished" && room.mode !== "friend")) {
    setBattleStatus("This room is no longer available.");
    return;
  }
  if (room.mode === "ranked" && !allowRankedMatch) {
    setBattleStatus("Ranked Battle is available through matchmaking only.");
    return;
  }
  if (room.mode === "friend" && room.cubeMode === "real") {
    setBattleStatus("This battle mode is no longer supported. Please create a new Friend Battle room.");
    return;
  }

  const isMultiplayerFriend = room.mode === "friend" && Number(room.maxPlayers || 2) > 2;
  if (room.mode === 'friend' && rankedSearchLocked) await cancelRandomMatch();
  if (asSpectator && room.mode !== "friend") {
    setBattleStatus("Spectator mode is available for Friend Battle rooms.");
    return;
  }

  if (asSpectator) {
    activeRoomRole = "spectator";
    isSpectatorMode = true;
  } else if (isMultiplayerFriend && room.hostUid !== currentUser.uid) {
    const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, normalizedRoomId, "players", currentUser.uid);
    try {
      await runTransaction(db, async transaction => {
        const [currentRoomSnapshot, playerSnapshot] = await Promise.all([
          transaction.get(roomRef),
          transaction.get(playerRef)
        ]);
        if (!currentRoomSnapshot.exists()) throw new Error("Room not found.");
        const currentRoom = currentRoomSnapshot.data();
        if (!playerSnapshot.exists() && Number(currentRoom.playerCount || 1) >= Number(currentRoom.maxPlayers || 20)) {
          throw new Error("This room is full.");
        }
        if (!playerSnapshot.exists()) {
          transaction.set(playerRef, createPlayer("player"));
          transaction.update(roomRef, {
            playerCount: Number(currentRoom.playerCount || 1) + 1,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.update(playerRef, { status: "joined", ready: false, updatedAt: serverTimestamp() });
          if (playerSnapshot.data()?.status === "returned") {
            transaction.update(roomRef, {
              playerCount: Math.min(Number(currentRoom.maxPlayers || 20), Number(currentRoom.playerCount || 0) + 1),
              updatedAt: serverTimestamp()
            });
          }
        }
      });
    } catch (error) {
      setBattleStatus(error.message || "This room could not be joined.");
      return;
    }
    activeRoomRole = "player";
    isSpectatorMode = false;
  } else if (isMultiplayerFriend) {
    activeRoomRole = "host";
    isSpectatorMode = false;
  } else if (room.hostUid === currentUser.uid) {
    activeRoomRole = "host";
    isSpectatorMode = false;
  } else {
    try {
      await runTransaction(db, async transaction => {
        const currentRoomSnapshot = await transaction.get(roomRef);
        if (!currentRoomSnapshot.exists()) throw new Error("Room not found.");
        room = currentRoomSnapshot.data();

        if (room.mode === 'ranked' && (['cancelled','finished'].includes(room.status) || (!room.guestUid && room.status !== 'waiting'))) throw new Error('This match is no longer waiting.');

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
    isSpectatorMode = false;
    await setDoc(doc(db, BATTLE_ROOMS_COLLECTION, normalizedRoomId, "players", currentUser.uid), createPlayer("guest"));
  }

  activeRoomId = normalizedRoomId;
  roomIdInput.value = normalizedRoomId;
  if (roomUrlOutput) roomUrlOutput.value = getRoomUrl(normalizedRoomId);
  renderFriendRoomShare(normalizedRoomId);
  setBattleStatus(asSpectator ? "Joined as spectator." : "Joined room.");
  watchRoom(normalizedRoomId);
}

async function readyBattleRoom() {
  if (activeRoom?.isBot) {window.BotBattle?.ready();return;}
  if (!currentUser || !activeRoomId || !activeRoomRole) {
    setBattleStatus("Create or join a room first.");
    return;
  }

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.data();
  if (room.mode === "friend" && Number(room.maxPlayers || 2) > 2) {
    if (isSpectatorMode) return;
    if (["inspection", "solving", "finishing"].includes(room.status)) {
      setBattleStatus("This round is already in progress.");
      return;
    }
    const player = battlePlayersByUid.get(currentUser.uid);
    const ready = !Boolean(player?.ready);
    const readyReset = ready ? {
      round: room.status === "finished" ? activeRound + 1 : activeRound,
      inspectionStartTime: null,
      inspectionStartTimeMs: 0,
      startTime: null,
      startTimeMs: 0,
      endTime: null,
      finishedAt: null,
      finalTime: null,
      ...getPreviousBattleResultFields(player),
      tps: null,
      moveCount: 0,
      currentCompletionScore: 0,
      maxCompletionScore: 0,
      timeLimitReached: false,
      lastMove: ""
    } : {};
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
      ready,
      active: false,
      status: ready ? "ready" : "joined",
      ...readyReset,
      updatedAt: serverTimestamp()
    });
    setBattleStatus(ready ? "Ready. Waiting for all players." : "Ready cancelled.");
    return;
  }
  if (room.status === "finishing" || room.status === "finished") {
    setBattleStatus("This battle has already ended.");
    return;
  }

  let scramble = room.scramble;
  if (!scramble && activeRoomRole === "host") {
    scramble = await getBattleScramble();
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

  startLocalBattleInspection(scramble, inspectionStartTimeMs, activeRound);
}

async function notifyBattleSolveStarted() {
  if (activeRoom?.isBot) {window.BotBattle?.playerStarted();return;}
  if (!currentUser || !activeRoomId || !activeRoomRole || !document.body.classList.contains("battle-mode")) return;
  const player = battlePlayersByUid.get(currentUser.uid) || getDisplayPlayer(activeRoomRole);

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "solving",
    startTime: serverTimestamp(),
    startTimeMs: Date.now(),
    finishedAt: null,
    finalTime: null,
    ...getPreviousBattleResultFields(player),
    updatedAt: serverTimestamp()
  }).catch(console.error);
  if (!isMultiplayerFriendRoom() || currentUser.uid === activeRoom.hostUid) {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      status: "solving",
      updatedAt: serverTimestamp()
    }).catch(console.error);
  }

  window.trackCubeEvent?.("battle_start");
  if (activeRoom?.mode === "ranked") {
    window.trackCubeEvent?.("ranked_battle_start");
  } else if (activeRoom?.mode === "friend") {
    window.trackCubeEvent?.("friend_battle_start");
  }
}

function handleBattleSpaceStart() {
  if (!document.body.classList.contains("battle-mode") || isSpectatorMode || activeRoom?.cubeMode === "real") return;

  const player = isMultiplayerFriendRoom()
    ? battlePlayersByUid.get(currentUser?.uid)
    : getDisplayPlayer(activeRoomRole);
  if (battleReadyBtn.hidden || battleReadyBtn.disabled || player?.ready || player?.status === "ready") return;
  readyBattleRoom().catch(error => {
    battleNotice.textContent = "Could not set ready.";
    console.error(error);
  });
}

async function startFriendMultiplayerGame() {
  if (!currentUser || !isMultiplayerFriendRoom() || currentUser.uid !== activeRoom.hostUid || isSpectatorMode) return;
  const hostPlayer = battlePlayersByUid.get(activeRoom.hostUid);
  if (!hostPlayer?.ready) {
    setBattleStatus("The host must be Ready before starting.");
    return;
  }
  const readyPlayers = [...battlePlayersByUid.values()]
    .filter(player => player.ready && isFriendRoomParticipant(player))
    .slice(0, Number(activeRoom.maxPlayers || 20));
  if (readyPlayers.length === 0) {
    setBattleStatus("At least one player must be Ready.");
    return;
  }
  const isRealCube = activeRoom.cubeMode === "real";
  if (isRealCube && readyPlayers.length < 2) {
    setBattleStatus("At least two players must be Ready for Real Cube Mode.");
    return;
  }
  if (isRealCube && !activeRoom.scramble) {
    setBattleStatus("Waiting for the synchronized scramble.");
    return;
  }
  const scramble = isRealCube ? activeRoom.scramble : await getBattleScramble();
  if (!scramble) {
    setBattleStatus("Scramble generator is not ready.");
    return;
  }
  const nextRound = activeRoom.status === "finished" ? activeRound + 1 : activeRound;
  const inspectionStartTimeMs = isRealCube ? 0 : Date.now();
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
    status: isRealCube ? "ready" : "inspection",
    scramble,
    round: nextRound,
    activePlayerUids: readyPlayers.map(player => player.uid),
    inspectionStartTime: isRealCube ? null : serverTimestamp(),
    inspectionStartTimeMs,
    winnerUid: "",
    winnerName: "",
    finishedAt: null,
    updatedAt: serverTimestamp()
  });
}

async function beginRealCubeInspection() {
  if (
    !currentUser ||
    !isMultiplayerFriendRoom() ||
    activeRoom.cubeMode !== "real" ||
    isSpectatorMode ||
    !(activeRoom.activePlayerUids || []).includes(currentUser.uid)
  ) return false;
  if (isManualRealFriendEntry()) return false;
  const player = battlePlayersByUid.get(currentUser.uid);
  if (!["ready", "inspection", "solving"].includes(activeRoom.status) || !["joined", "ready"].includes(player?.status)) return false;
  const inspectionStartTimeMs = Date.now();
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "inspecting",
    ready: false,
    active: true,
    round: activeRound,
    inspectionStartTime: serverTimestamp(),
    inspectionStartTimeMs,
    startTime: null,
    startTimeMs: 0,
    endTime: null,
    finishedAt: null,
    finalTime: null,
    ...getPreviousBattleResultFields(player),
    tps: null,
    moveCount: 0,
    updatedAt: serverTimestamp()
  });
  startLocalBattleInspection(activeRoom.scramble, inspectionStartTimeMs, activeRound);
  return true;
}

async function updateRealFriendManualResult(action, enteredTime = null) {
  if (!currentUser || !isRealFriendRoom() || isSpectatorMode) return false;
  const timeEntryType = getFriendTimeEntryType();
  if (timeEntryType === "manual" && action !== "enter") return false;
  if (timeEntryType !== "manual" && action === "enter") return false;

  const player = battlePlayersByUid.get(currentUser.uid);
  if (["inspecting", "solving"].includes(player?.status)) return false;
  let finalTime = Number(player?.finalTime);
  let status = "finished";
  let penalty = "manual";
  if (action === "enter") {
    finalTime = parseFriendRealManualTimeInput(enteredTime);
    if (!Number.isFinite(finalTime)) {
      setBattleStatus("Enter a valid time between 0.01 and 3599.99 seconds.");
      return false;
    }
  } else if (action === "plus2") {
    if (!Number.isFinite(finalTime) || finalTime < 0.01) return false;
    finalTime += 2;
    penalty = "+2";
  } else if (action === "dnf") {
    finalTime = null;
    status = "dnf";
    penalty = "dnf";
  } else if (action === "remove") {
    finalTime = null;
    status = "ready";
    penalty = "removed";
    localBattleTimerSeconds = 0;
  } else return false;
  if (Number.isFinite(finalTime)) localBattleTimerSeconds = Number(finalTime.toFixed(2));

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status,
    ready: false,
    active: status !== "ready",
    finalTime: Number.isFinite(finalTime) ? Number(finalTime.toFixed(2)) : null,
    previousRoundNumber: activeRound,
    previousRoundStatus: status === "dnf" ? "dnf" : (status === "finished" ? "finished" : "removed"),
    previousRoundFinalTime: Number.isFinite(finalTime) ? Number(finalTime.toFixed(2)) : null,
    previousRoundPenalty: penalty,
    previousRoundManual: action === "enter",
    manual: action === "enter",
    timeEntryType,
    penalty,
    endTime: status === "ready" ? null : serverTimestamp(),
    finishedAt: status === "ready" ? null : serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  friendRealEditMenu.hidden = timeEntryType !== "manual";
  finalizeFriendMultiplayerIfDone().catch(console.error);
  return true;
}

async function submitFriendRealManualTime() {
  if (!friendRealManualTime || isSubmittingManualTime) return;
  const rawValue = friendRealManualTime.value;
  isSubmittingManualTime = true;
  if (friendRealSaveTimeBtn) friendRealSaveTimeBtn.disabled = true;
  try {
    const saved = await updateRealFriendManualResult("enter", rawValue);
    if (!saved) return;
    friendRealManualTime.value = "";
    if (!friendRealEditMenu?.hidden && isManualRealFriendEntry()) friendRealManualTime.focus();
  } finally {
    isSubmittingManualTime = false;
    if (friendRealSaveTimeBtn) friendRealSaveTimeBtn.disabled = false;
  }
}

async function abortRealCubeBattle() {
  if (
    !currentUser ||
    !activeRoomId ||
    activeRoom?.cubeMode !== "real" ||
    !["inspecting", "solving"].includes(battlePlayersByUid.get(currentUser.uid)?.status)
  ) return;

  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "dnf",
    ready: false,
    finalTime: null,
    previousRoundNumber: activeRound,
    previousRoundStatus: "dnf",
    previousRoundFinalTime: null,
    previousRoundPenalty: "dnf",
    previousRoundManual: false,
    endTime: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  window.cancelCurrentSolve?.();
  finalizeFriendMultiplayerIfDone().catch(console.error);
}

async function cancelRealCubePreparation() {
  if (!currentUser || !activeRoomId || activeRoom?.cubeMode !== "real") return;
  const player = battlePlayersByUid.get(currentUser.uid);
  if (player?.status !== "inspecting") return;
  await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
    status: "ready",
    ready: false,
    startTime: null,
    startTimeMs: 0,
    inspectionStartTime: null,
    inspectionStartTimeMs: 0,
    updatedAt: serverTimestamp()
  }).catch(console.error);
  window.cancelCurrentSolve?.({ preserveTimer: true });
}

async function finalizeFriendMultiplayerIfDone() {
  if (
    friendFinalizing ||
    !isMultiplayerFriendRoom() ||
    currentUser?.uid !== activeRoom.hostUid ||
    !["ready", "inspection", "solving", "finishing"].includes(activeRoom.status)
  ) return;
  const activeUids = activeRoom.activePlayerUids || [];
  if (activeUids.length === 0) return;
  const activePlayers = activeUids.map(uid => battlePlayersByUid.get(uid));
  if (activePlayers.some(player => !player || !["finished", "dnf", "time_limit"].includes(player.status))) return;
  const finishedPlayers = activePlayers
    .filter(isPlayerFinished)
    .sort((a, b) => Number(a.finalTime) - Number(b.finalTime));
  const winner = finishedPlayers[0] || null;
  friendFinalizing = true;
  try {
    if (isRealFriendRoom()) {
      const participants = [...battlePlayersByUid.values()]
        .filter(isFriendRoomParticipant)
        .slice(0, Number(activeRoom.maxPlayers || 20));
      const scramble = await getBattleScramble();
      if (participants.length < 2 || !scramble) return;
      await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
        status: "ready",
        scramble,
        round: activeRound + 1,
        activePlayerUids: participants.map(player => player.uid),
        winnerUid: "",
        winnerName: "",
        finishedAt: null,
        updatedAt: serverTimestamp()
      });
      return;
    }
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId), {
      status: "finished",
      winnerUid: winner?.uid || "",
      winnerName: winner?.name || "No winner",
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } finally {
    friendFinalizing = false;
  }
}

async function notifyBattleMove(move) {
  if (activeRoom?.isBot) return;
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
  if (activeRoom?.isBot) return;
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
  if (activeRoom?.isBot) {window.BotBattle?.finish(time,solveStats);return;}
  if (!document.body.classList.contains("battle-mode")) return;
  if (!currentUser || !activeRoomId) {
    throw new Error("Battle finish was requested without an active room.");
  }
  const isRealFriendBattle = isMultiplayerFriendRoom() && activeRoom?.cubeMode === "real";
  const minimumBattleTime = isRealFriendBattle ? 0.01 : 3;
  if (!Number.isFinite(time) || time < minimumBattleTime || time >= 3600) {
    throw new Error("Battle finish time did not pass validation.");
  }

  const roomRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId);
  const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid);
  const finishPayload = {
    status: "finished",
    ready: false,
    active: false,
    round: activeRound,
    endTime: serverTimestamp(),
    finishedAt: serverTimestamp(),
    finalTime: time,
    previousRoundNumber: activeRound,
    previousRoundStatus: "finished",
    previousRoundFinalTime: Number(Number(time).toFixed(2)),
    previousRoundPenalty: "",
    previousRoundManual: false,
    tps: Number.isFinite(solveStats.tps) ? solveStats.tps : null,
    moveCount: Math.max(0, Math.floor(Number(solveStats.moveCount) || 0)),
    currentCompletionScore: Math.max(0, Math.min(54, Math.floor(Number(solveStats.currentCompletionScore) || 0))),
    maxCompletionScore: Math.max(0, Math.min(54, Math.floor(Number(solveStats.maxCompletionScore) || 0))),
    updatedAt: serverTimestamp()
  };

  if (isMultiplayerFriendRoom()) {
    if (!(activeRoom.activePlayerUids || []).includes(currentUser.uid)) {
      throw new Error("The player is not active in this Friend Battle round.");
    }
    localBattleTimerSeconds = Number(time);
    const localPlayer = battlePlayersByUid.get(currentUser.uid);
    if (localPlayer) Object.assign(localPlayer, finishPayload, { finishedAt: new Date(), updatedAt: new Date() });
    syncCurrentFriendRealResult();
    renderBattleUi();
    await updateBattleFinishWithRetry(playerRef, finishPayload);
    console.info("Friend Battle finish synchronized", {
      roomId: activeRoomId,
      round: activeRound,
      uid: currentUser.uid,
      finalTime: time
    });
    return;
  }

  await runTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) return;
    const room = roomSnapshot.data();
    if (room.scramble !== scramble || room.status === "finished") return;

    transaction.update(playerRef, finishPayload);

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

async function updateBattleFinishWithRetry(playerRef, finishPayload) {
  const delays = [0, 250, 750];
  let lastError = null;
  for (const delay of delays) {
    if (delay) await new Promise(resolve => window.setTimeout(resolve, delay));
    try {
      await updateDoc(playerRef, finishPayload);
      return;
    } catch (error) {
      lastError = error;
      if (["permission-denied", "invalid-argument"].includes(error?.code)) break;
    }
  }
  throw lastError || new Error("Battle finish synchronization failed.");
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
      const hostPlayerSnapshot = await transaction.get(doc(db,BATTLE_ROOMS_COLLECTION,roomId,"players",room.hostUid));
      const guestPlayerSnapshot = await transaction.get(doc(db,BATTLE_ROOMS_COLLECTION,roomId,"players",room.guestUid));
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
      const hostOutcome = window.ProfileRecords.outcome(room,hostPlayerSnapshot.data(),room.hostUid);
      const guestOutcome = window.ProfileRecords.outcome(room,guestPlayerSnapshot.data(),room.guestUid);

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
        losses: Number(hostProfile.losses || 0) + (hostOutcome === "loss" ? 1 : 0),
        rankedWins: Number(hostProfile.rankedWins || 0) + (hostWon ? 1 : 0),
        rankedLosses: Number(hostProfile.rankedLosses || 0) + (hostOutcome === "loss" ? 1 : 0),
        rankedDnfs: Number(hostProfile.rankedDnfs || 0) + (hostOutcome === "dnf" ? 1 : 0),
        rankedDraws: Number(hostProfile.rankedDraws || 0) + (isDraw ? 1 : 0),
        rankedBattles: Number(hostProfile.rankedBattles || 0) + 1,
        lastRatedRoomId: roomId,
        lastRatedRound: round,
        updatedAt: serverTimestamp()
      });
      transaction.update(guestUserRef, {
        rating: guestChange.after,
        wins: Number(guestProfile.wins || 0) + (guestWon ? 1 : 0),
        losses: Number(guestProfile.losses || 0) + (guestOutcome === "loss" ? 1 : 0),
        rankedWins: Number(guestProfile.rankedWins || 0) + (guestWon ? 1 : 0),
        rankedLosses: Number(guestProfile.rankedLosses || 0) + (guestOutcome === "loss" ? 1 : 0),
        rankedDnfs: Number(guestProfile.rankedDnfs || 0) + (guestOutcome === "dnf" ? 1 : 0),
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

function handleBattleFinishSyncError(error) {
  battleNotice.textContent = "Finish could not be synchronized. Check your connection and Firestore permissions.";
  console.error("Battle finish sync failed", error);
}

async function persistFriendRoomExit({ roomAlreadyCancelled = false } = {}) {
  if (!currentUser || !activeRoomId || isSpectatorMode || activeRoom?.mode !== "friend") return;
  const roomId = activeRoomId;
  const uid = currentUser.uid;
  const playerRef = doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", uid);

  if (uid === activeRoom.hostUid && !roomAlreadyCancelled) {
    await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId), {
      status: "cancelled",
      activePlayerUids: [],
      cancelledBy: uid,
      updatedAt: serverTimestamp()
    });
  }

  try {
    await deleteDoc(playerRef);
  } catch (error) {
    console.warn("Player document deletion was denied; using returned status until Rules are updated.", error);
    await updateDoc(playerRef, {
      status: "returned",
      ready: false,
      active: false,
      updatedAt: serverTimestamp()
    });
  }
}

function resetBattleUiAfterLeave() {
  renderBattleResultsUI({finished:false});
  if (friendBattleSettingsModal) friendBattleSettingsModal.hidden = true;
  if (friendHostExitTimeout) {
    window.clearTimeout(friendHostExitTimeout);
    friendHostExitTimeout = null;
  }
  if (activeRoom?.status === "finishing") {
    battleNotice.textContent = "Finalizing battle result...";
    return;
  }
  if (opponentExitTimeout) {
    window.clearTimeout(opponentExitTimeout);
    opponentExitTimeout = null;
  }
  clearBattleListeners();
  window.opponentCube?.clear();
  clearFriendLobby();
  clearMatchmakingListeners();
  activeRoom = null;
  activeRoomId = "";
  activeRoomRole = "";
  renderFriendRoomShare("");
  isSpectatorMode = false;
  battlePlayersByUid = new Map();
  activeRound = 1;
  displayedOpponentRatingUid = "";
  selectedOpponentUid = "";
  preparedLocalRealFriendRoundKey = "";
  localBattleTimerSeconds = 0;
  battleReadyBtn.hidden = true;
  hostStartBattleBtn.hidden = true;
  if (realCubeTimerBtn) realCubeTimerBtn.hidden = true;
  friendRealControls.hidden = true;
  realCubeInstruction.hidden = true;
  multiplayerRoster.hidden = true;
  battleRematchPanel.hidden = true;
  setBattleMode(false);
  window.applyNormalTimerMode?.();
  if (typeof window.cancelCurrentSolve === "function") {
    window.cancelCurrentSolve();
  } else {
    document.body.classList.remove("solving");
  }
  resetBattleLayoutState();
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  url.searchParams.delete("battleRoom");
  url.searchParams.delete("spectate");
  window.history.replaceState({}, "", url);
}

async function leaveBattleMode(options = {}) {
  if (activeRoom?.isBot) {window.BotBattle?.dispose();resetBattleUiAfterLeave();releaseRankedSearchLock();return;}
  releaseRankedSearchLock();
  if (battleLeaving) return;
  if (activeRoom?.status === "finishing") {
    battleNotice.textContent = "Finalizing battle result...";
    return;
  }

  battleLeaving = true;
  try {
    if (currentUser && activeRoomId && document.body.classList.contains("battle-mode") && !isSpectatorMode) {
      if (activeRoom?.mode === "friend") {
        await persistFriendRoomExit(options);
      } else {
        await updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, activeRoomId, "players", currentUser.uid), {
          status: "returned",
          ready: false,
          active: false,
          updatedAt: serverTimestamp()
        }).catch(console.error);
      }
    }
  } catch (error) {
    console.error("Battle room exit could not be fully synchronized.", error);
  } finally {
    resetBattleUiAfterLeave();
    battleLeaving = false;
  }
}

async function loginWithGoogle() {
  if (googleLoginPending) return;

  googleLoginPending = true;
  googleLoginBtn.disabled = true;
  setStatus("Opening Google login...");
  const provider = new GoogleAuthProvider();

  try {
    const credential = await signInWithPopup(auth, provider);
    window.trackCubeEvent?.("login", { method: "google" });
    return credential;
  } finally {
    googleLoginPending = false;
    googleLoginBtn.disabled = false;
  }
}

function getGoogleLoginErrorMessage(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return "Google login was cancelled before it completed.";
    case "auth/unauthorized-domain":
      return `Google login is not enabled for ${window.location.hostname}. Add this domain to Firebase Authentication's authorized domains.`;
    case "auth/cancelled-popup-request":
      return "Another Google login request was already in progress. Please try again.";
    case "auth/popup-blocked":
      return "The Google login popup was blocked. Allow popups for this site and try again.";
    case "auth/network-request-failed":
      return "Google login could not reach Firebase. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Google login is disabled in Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different login method.";
    default:
      return "Google login failed. Please try again.";
  }
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

  const preferenceApplies = activeRoom?.cubeMode === "virtual" && ["friend", "ranked"].includes(activeRoom?.mode);
  const hiddenByPreference = preferenceApplies && !shouldShowFriendOpponentCube();
  opponentCubePanel.hidden = hiddenByPreference;
  if (hiddenByPreference) return;

  const disconnected = isPlayerDisconnected(opponent);
  const you = getDisplayPlayer(activeRoomRole);
  const waitingForReady = !isSpectatorMode && !["inspecting", "solving", "finished", "dnf"].includes(you?.status);
  opponentCubePanel.classList.toggle("opponent-unavailable", !opponent || disconnected || waitingForReady);
  opponentCubePanel.classList.toggle("ready-waiting", waitingForReady);
  if (opponentCubeTitle) {
    opponentCubeTitle.textContent = opponent ? `Watching: ${opponent.name || "Player"}` : "Opponent cube";
  }
  opponentCubePanel.setAttribute("aria-label", opponent ? `Opponent cube for ${opponent.name || "Player"}` : "Opponent cube");
  if (!opponent) {
    opponentCubeStatus.textContent = "Waiting for opponent...";
  } else if (disconnected) {
    opponentCubeStatus.textContent = "Opponent left";
  } else if (waitingForReady) {
    opponentCubeStatus.textContent = "Press Ready to start.";
  } else {
    const opponentTime = hasFinalBattleTime(opponent)
      ? Number(opponent.finalTime)
      : getPlayerElapsedSeconds(opponent);
    opponentCubeStatus.textContent = `${opponent.name || "Opponent"}: ${(opponent.status || "joined").toUpperCase()} | ${formatBattleTime(opponentTime)}`;
  }
}

function returnToNormalAfterOpponentExit(opponent) {
  if (!activeRoom || !document.body.classList.contains("battle-mode")) return;
  if (isMultiplayerFriendRoom()) return;
  if (["finished", "finishing"].includes(activeRoom.status)) return;
  if (!isPlayerDisconnected(opponent) || opponentExitTimeout) return;

  battleNotice.textContent = "Opponent left the room.";
  opponentExitTimeout = window.setTimeout(() => {
    opponentExitTimeout = null;
    leaveBattleMode();
  }, 1000);
}

function setupModalUi() {
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

  [profileModal].forEach(modal => {
    modal?.addEventListener("click", event => {
      if (event.target === modal) modal.hidden = true;
    });
  });
}

function setupAuthUi() {
  document.getElementById("openBattleBtn")?.addEventListener("click", () => setBattleChoice(selectedBattleMode));
  googleLoginBtn.addEventListener("click", () => {
    loginWithGoogle().catch(error => {
      setStatus(getGoogleLoginErrorMessage(error));
      console.error("Google login failed.", {
        code: error?.code || "unknown",
        message: error?.message || String(error)
      });
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

  friendBattleSettingsBtn?.addEventListener("click", () => {
    const player = battlePlayersByUid.get(currentUser?.uid);
    const virtualBattle = activeRoom?.cubeMode === "virtual";
    friendDarkModeToggle.checked = document.body.classList.contains("dark");
    if (friendTimeEntryType) {
      friendTimeEntryType.value = getFriendTimeEntryType();
      friendTimeEntryType.disabled = ["inspecting", "solving"].includes(player?.status);
    }
    if (friendTimeEntrySection) friendTimeEntrySection.hidden = true;
    friendOpponentSettingsSection.hidden = !virtualBattle;
    battleCubeSizeSection.hidden = !virtualBattle;
    friendShowOpponentCube.checked = shouldShowFriendOpponentCube();
    const cubeSize = window.getCubeSizeScale?.() || 1;
    battleCubeSizeInput.value = String(cubeSize);
    battleCubeSizeValue.textContent = `${Number(cubeSize).toFixed(2)}x`;
    friendBattleSettingsModal.hidden = false;
  });

  closeFriendBattleSettingsBtn?.addEventListener("click", () => {
    friendBattleSettingsModal.hidden = true;
  });
  friendBattleSettingsModal?.addEventListener("click", event => {
    if (event.target === friendBattleSettingsModal) friendBattleSettingsModal.hidden = true;
  });

  friendDarkModeToggle?.addEventListener("change", () => {
    const isDark = document.body.classList.contains("dark");
    if (friendDarkModeToggle.checked !== isDark) document.getElementById("themeToggleBtn")?.click();
  });

  friendTimeEntryType?.addEventListener("change", () => {
    const player = battlePlayersByUid.get(currentUser?.uid);
    if (["inspecting", "solving"].includes(player?.status)) {
      friendTimeEntryType.value = getFriendTimeEntryType();
      setBattleStatus("Time Entry Type cannot be changed during a solve.");
      return;
    }
    const value = friendTimeEntryType.value === "manual" ? "manual" : "screen";
    localStorage.setItem(FRIEND_TIME_ENTRY_TYPE_KEY, value);
    renderFriendRealEntryUi();
    syncOwnFriendPreferences().catch(console.error);
    renderBattleUi();
  });

  friendShowOpponentCube?.addEventListener("change", () => {
    localStorage.setItem(FRIEND_SHOW_OPPONENT_CUBE_KEY, friendShowOpponentCube.checked ? "true" : "false");
    renderBattleUi();
  });

  battleCubeSizeInput?.addEventListener("input", () => {
    const cubeSize = window.setCubeSizeScale?.(battleCubeSizeInput.value) || 1;
    battleCubeSizeInput.value = String(cubeSize);
    battleCubeSizeValue.textContent = `${Number(cubeSize).toFixed(2)}x`;
    window.resizeMainCube?.();
  });

  friendSettingsLeaveBtn?.addEventListener("click", () => {
    friendBattleSettingsModal.hidden = true;
    leaveBattleMode().catch(console.error);
  });

  friendSettingsLogoutBtn?.addEventListener("click", async () => {
    friendBattleSettingsModal.hidden = true;
    await leaveBattleMode().catch(console.error);
    await signOut(auth).catch(error => {
      setStatus("Logout failed.");
      console.error(error);
    });
  });

  spectateRoomBtn?.addEventListener("click", () => {
    joinBattleRoom(roomIdInput.value, false, true).catch(error => {
      setBattleStatus("Spectator mode could not be opened.");
      console.error(error);
    });
  });

  copyInviteBtn?.addEventListener("click", () => {
    if (!activeRoomId) {
      setBattleStatus("Create or join a friend room first.");
      return;
    }

    copyRoomUrl(activeRoomId, setBattleStatus);
  });

  copyRoomIdBtn?.addEventListener("click", () => {
    const roomId = activeRoomId || roomIdInput.value.trim().toUpperCase();
    if (!roomId) {
      setBattleStatus("Create or join a friend room first.");
      return;
    }
    copyRoomId(roomId, setBattleStatus).catch(error => {
      setBattleStatus("Room ID could not be copied.");
      console.error(error);
    });
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

  multiplayerRosterToggle?.addEventListener("click", () => {
    multiplayerRoster.classList.toggle("expanded");
    updateMultiplayerRosterToggle();
  });

  friendRealEditBtn?.addEventListener("click", event => {
    event.stopPropagation();
    renderFriendRealEntryUi();
    friendRealEditMenu.hidden = !friendRealEditMenu.hidden;
    if (!friendRealEditMenu.hidden && isManualRealFriendEntry()) friendRealManualTime?.focus();
  });
  friendRealSaveTimeBtn?.addEventListener("click", event => {
    event.stopPropagation();
    submitFriendRealManualTime().catch(console.error);
  });
  friendRealManualTime?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitFriendRealManualTime().catch(console.error);
  });
  friendRealPlusTwoBtn?.addEventListener("click", event => {
    event.stopPropagation();
    updateRealFriendManualResult("plus2").catch(console.error);
  });
  friendRealDnfBtn?.addEventListener("click", event => {
    event.stopPropagation();
    updateRealFriendManualResult("dnf").catch(console.error);
  });
  friendRealRemoveBtn?.addEventListener("click", event => {
    event.stopPropagation();
    updateRealFriendManualResult("remove").catch(console.error);
  });

  hostStartBattleBtn?.addEventListener("click", () => {
    startFriendMultiplayerGame().catch(error => {
      battleNotice.textContent = "Game could not be started.";
      console.error(error);
    });
  });

  friendRealStartBtn?.addEventListener("click", () => {
    window.handleRealCubeTimerAction?.();
  });

  friendRealAbortBtn?.addEventListener("click", () => {
    abortRealCubeBattle().catch(console.error);
  });

  playAgainBtn.addEventListener("click", () => {
    requestRematch().catch(error => {
      battleNotice.textContent = "Could not start a rematch.";
      console.error(error);
    });
  });

  copyRoomUrlBtn.addEventListener("click", async () => {
    if (!activeRoomId) return;

    const copyAction = activeRoom?.mode === "friend" ? copyRoomId : copyRoomUrl;
    copyAction(activeRoomId, message => {
      battleNotice.textContent = message;
      setBattleStatus(message);
    }).catch(error => {
      battleNotice.textContent = "Room info could not be copied.";
      console.error(error);
    });
  });

  leaveBattleBtn.addEventListener("click", () => leaveBattleMode().catch(console.error));
  rematchReturnBtn.addEventListener("click", () => leaveBattleMode().catch(console.error));
}

window.addEventListener("pagehide", () => {
  if (activeRoom?.isBot) return;
  if (
    !currentUser ||
    !activeRoomId ||
    !document.body.classList.contains("battle-mode") ||
    isSpectatorMode
  ) return;

  const roomId = activeRoomId;
  const uid = currentUser.uid;
  updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId, "players", uid), {
    status: "disconnected",
    ready: false,
    active: false,
    updatedAt: serverTimestamp()
  }).catch(() => {});

  if (activeRoom?.mode === "friend" && uid === activeRoom.hostUid) {
    updateDoc(doc(db, BATTLE_ROOMS_COLLECTION, roomId), {
      status: "cancelled",
      activePlayerUids: [],
      cancelledBy: uid,
      updatedAt: serverTimestamp()
    }).catch(() => {});
  }
});

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
document.getElementById('battleRatingMoreBtn')?.addEventListener('click',async()=>{
  if(battleRatingLoading)return;
  battleRatingLoading=true;
  const button=document.getElementById('battleRatingMoreBtn');button.disabled=true;
  try{await refreshBattleRatingRanking(false,true);}finally{battleRatingLoading=false;button.disabled=false;}
});

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
  window.STcubeDailyConnection = { auth, db };
  window.dispatchEvent(new Event('stcube:daily-connection'));

  setupAuthUi();

  onAuthStateChanged(auth, user => {
    if (currentUser?.uid && currentUser.uid !== user?.uid) {
      ++rankedSearchGeneration;clearMatchmakingListeners();clearFriendLobby();releaseRankedSearchLock();
      if(window.BotBattle?.active)leaveBattleMode().catch(console.error);
    }
    currentUser = user;

    if (user) {
      setStatus(`Logged in as ${user.displayName || "Guest"}`);
      updateAccountSummary(user, null);
      ensureUserProfile()
        .then(() => submitPendingSolves())
        .then(() => Promise.all([refreshTotalUsers(),refreshBattleAccountRating(true)]))
        .catch(console.error);

      const roomFromUrl = new URLSearchParams(window.location.search).get("battleRoom");
      if (roomFromUrl && !activeRoomId) {
        const spectate = new URLSearchParams(window.location.search).get("spectate") === "1";
        joinBattleRoom(roomFromUrl, false, spectate).catch(console.error);
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
window.handleBattleFinishSyncError = handleBattleFinishSyncError;
window.isBattleMode = () => document.body.classList.contains("battle-mode");
window.isRankedBattle = () => document.body.classList.contains("battle-mode") && activeRoom?.mode === "ranked" && !activeRoom?.isBot;
window.BotBattleBridge={
  stopClock(){if(battleClockInterval)clearInterval(battleClockInterval);battleClockInterval=null;},
  enter(scramble){
    activeRoomId='LOCAL-BOT-'+crypto.randomUUID();activeRoomRole='host';activeRound=1;isSpectatorMode=false;
    activeRoom={isBot:true,mode:'ranked',cubeMode:'virtual',status:'waiting',scramble,hostUid:currentUser.uid,guestUid:'BOT',round:1,ratingUpdated:true,ratingApplied:false,maxPlayers:2};
    battlePlayersByRole={host:{uid:currentUser.uid,name:getPlayerName(),status:'joined'},guest:{uid:'BOT',name:'BOT',status:'joined'}};
    battlePlayersByUid=new Map([[currentUser.uid,battlePlayersByRole.host],['BOT',battlePlayersByRole.guest]]);
    clearBattleListeners();window.cancelCurrentSolve?.();setBattleMode(true);syncFriendVirtualBattleLayout();
    window.prepareBattleCube(scramble,1);cancelMatchBtn.hidden=true;
  },
  room:()=>activeRoom,
  players:(you,bot)=>{Object.assign(battlePlayersByRole.host,you);Object.assign(battlePlayersByRole.guest,bot);},
  leave:()=>leaveBattleMode(),
  rematch:async()=>{await leaveBattleMode();await startRankedBattle();}
};
// Presentation only. Keep the old grid footprint so the play cube never moves.
function renderBattleResultsUI({finished,ranked,you,opponent,bot=false}) {
  const panel=document.getElementById('battleRematchPanel');
  let spacer=document.getElementById('battleRematchSpacer');
  if(!finished||!ranked){
    if(spacer){spacer.replaceWith(panel);}
    document.body.classList.remove('battle-results-clean');
    document.getElementById('opponentCubeStatus').style.visibility='';
    document.querySelectorAll('.ranked-final-time').forEach(el=>el.remove());
    return;
  }
  if(!spacer){
    spacer=document.createElement('div');spacer.id='battleRematchSpacer';spacer.setAttribute('aria-hidden','true');
    spacer.style.height=(panel.getBoundingClientRect().height+parseFloat(getComputedStyle(panel).marginTop||0))+'px';
    panel.before(spacer);document.querySelector('.battle-screen').append(panel);
  }
  document.body.classList.add('battle-results-clean');
  for(const [prefix,player] of [['rankedYou',you],['rankedOpponent',opponent]]){
    const card=document.getElementById(prefix+'Name').parentElement;
    let line=card.querySelector('.ranked-final-time');
    if(!line){line=document.createElement('span');line.className='ranked-final-time';card.append(line);}
    const score = activeRoom?.playerMaxCompletionScores?.[player?.uid] ?? player?.maxCompletionScore ?? 0;
    line.textContent=activeRoom?.timeLimitReached ? `${Math.max(0,Math.min(54,Math.floor(Number(score)||0)))} / 54 stickers` : Number.isFinite(player?.finalTime)&&player?.status==='finished'?formatBattleTime(player.finalTime)+' s':'DNF';
  }
  if(bot){
    leaveBattleBtn.hidden=true;
    battleRematchYou.textContent='';battleRematchOpponent.textContent='';
    document.getElementById('rankedMomentDetail').textContent='Unrated · Rating unchanged';
    document.getElementById('rankedYouRatingChange').textContent='';
    document.getElementById('rankedOpponentRatingChange').textContent='';
  }else{
    const score = player => Math.max(0,Math.min(54,Math.floor(Number(activeRoom.playerMaxCompletionScores?.[player?.uid] ?? player?.maxCompletionScore)||0)));
    document.getElementById('rankedMomentDetail').textContent=activeRoom.timeLimitReached ? `You ${score(you)} / 54 · Opponent ${score(opponent)} / 54` : '';
    battleRematchYou.textContent=you?.rematchReady?'You are ready':'';
    battleRematchOpponent.textContent=isPlayerDisconnected(opponent)?'Opponent left':opponent?.rematchReady?'Opponent is ready':'';
  }
  document.getElementById('opponentCubeStatus').style.visibility='hidden';
}
window.renderBattleResultsUI=renderBattleResultsUI;
window.addEventListener('pagehide',()=>{if(window.BotBattle?.active)window.BotBattle.dispose();else if(rankedSearchLocked)cancelRandomMatch().catch(()=>{});releaseRankedSearchLock();});
window.isRealCubeBattle = () => document.body.classList.contains("battle-mode") && activeRoom?.cubeMode === "real";
window.isRealFriendBattle = () => document.body.classList.contains("battle-mode") && isRealFriendRoom();
window.isManualRealFriendEntry = () => document.body.classList.contains("battle-mode") && isManualRealFriendEntry();
window.beginRealCubeInspection = beginRealCubeInspection;
window.abortRealCubeBattle = abortRealCubeBattle;
window.cancelRealCubePreparation = cancelRealCubePreparation;
window.handleBattleSpaceStart = handleBattleSpaceStart;
