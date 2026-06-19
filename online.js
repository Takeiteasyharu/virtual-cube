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
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
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

let auth = null;
let db = null;
let currentUser = null;
let activePeriod = "today";
let activeRankingType = "single";

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
    accountGreeting.textContent = "ログインするとランキングに参加できます";
    accountRank.textContent = "";
    return;
  }

  accountGreeting.textContent = `こんにちは、${getPlayerName()}`;
  accountRank.textContent = rank ? `現在世界 ${rank} 位` : "現在世界 - 位";
}

function isValidOnlineSolve(time, scramble) {
  return Boolean(
    currentUser &&
    Number.isFinite(time) &&
    time > 2 &&
    time < 3600 &&
    typeof scramble === "string" &&
    scramble.trim().length > 0
  );
}

function isValidRankingEntry(solve) {
  return Boolean(
    Number.isFinite(Number(solve.time)) &&
    Number(solve.time) > 2 &&
    Number(solve.time) < 3600 &&
    typeof solve.scramble === "string" &&
    solve.scramble.trim().length > 0
  );
}

async function addRankingEntry(rankingType, time, scramble, solvedAt = new Date().toISOString()) {
  if (!isValidOnlineSolve(time, scramble)) {
    return false;
  }

  const solvedDate = new Date(solvedAt);
  const keys = getPeriodKeys(Number.isNaN(solvedDate.getTime()) ? new Date() : solvedDate);

  await addDoc(collection(db, "solves"), {
    rankingType,
    time,
    scramble,
    name: getPlayerName(),
    uid: currentUser.uid,
    dayKey: keys.today,
    weekKey: keys.week,
    monthKey: keys.month,
    createdAt: serverTimestamp()
  });

  return true;
}

async function addOnlineSolve(time, scramble, ao5, solvedAt = new Date().toISOString()) {
  const submittedSingle = await addRankingEntry("single", time, scramble, solvedAt);

  if (Number.isFinite(ao5)) {
    await addRankingEntry("ao5", ao5, scramble, solvedAt);
  }

  return submittedSingle;
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

async function submitOnlineSolve(time, scramble, ao5 = null) {
  if (!isConfigured()) return;

  if (!currentUser) {
    setStatus("Login is required to submit online times.");
    return;
  }

  if (!isValidOnlineSolve(time, scramble)) {
    setStatus("This solve was saved locally but not submitted online.");
    return;
  }

  try {
    const submitted = await addOnlineSolve(time, scramble, ao5);
    if (!submitted) return;

    refreshRanking();
    refreshAccountRank();
  } catch (error) {
    setStatus("Online submit failed.");
    console.error(error);
  }
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
    } else {
      updateAccountSummary(null);
      setStatus("Login to submit online times.");
    }
  });

  refreshRanking();
} else {
  setStatus("Set firebase-config.js to enable login and online ranking.");
  setRankingMessage("Firebase config is required.");
}

window.submitOnlineSolve = submitOnlineSolve;
