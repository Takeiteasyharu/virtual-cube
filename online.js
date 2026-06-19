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
const rankingList = document.getElementById("onlineRankingList");
const authStatus = document.getElementById("authStatus");
const nameInput = document.getElementById("playerNameInput");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const guestLoginBtn = document.getElementById("guestLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const PENDING_SOLVES_KEY = "pendingOnlineSolves";

let auth = null;
let db = null;
let currentUser = null;
let activePeriod = "today";

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

function queuePendingSolve(time, scramble) {
  const pending = getPendingSolves();

  pending.push({
    time,
    scramble,
    solvedAt: new Date().toISOString()
  });

  savePendingSolves(pending);
  setStatus(`${pending.length} pending time(s). Login to submit.`);
}

async function addOnlineSolve(time, scramble, solvedAt = new Date().toISOString()) {
  const solvedDate = new Date(solvedAt);
  const keys = getPeriodKeys(Number.isNaN(solvedDate.getTime()) ? new Date() : solvedDate);

  await addDoc(collection(db, "solves"), {
    time,
    scramble,
    name: getPlayerName(),
    uid: currentUser.uid,
    dayKey: keys.today,
    weekKey: keys.week,
    monthKey: keys.month,
    createdAt: serverTimestamp()
  });
}

async function submitPendingSolves() {
  if (!currentUser) return;

  const pending = getPendingSolves();
  if (pending.length === 0) return;

  while (pending.length > 0) {
    const solve = pending[0];
    await addOnlineSolve(solve.time, solve.scramble, solve.solvedAt);
    pending.shift();
    savePendingSolves(pending);
  }

  localStorage.removeItem(PENDING_SOLVES_KEY);
  setStatus(`Logged in as ${currentUser.displayName || "Guest"}. Pending times submitted.`);
  refreshRanking();
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

    if (activePeriod === "all") {
      rankingQuery = query(solvesRef, orderBy("time", "asc"), limit(50));
    } else {
      const keys = getPeriodKeys();
      const fieldMap = {
        today: "dayKey",
        week: "weekKey",
        month: "monthKey"
      };

      rankingQuery = query(
        solvesRef,
        where(fieldMap[activePeriod], "==", keys[activePeriod]),
        orderBy("time", "asc"),
        limit(50)
      );
    }

    const snapshot = await getDocs(rankingQuery);
    rankingList.innerHTML = "";

    if (snapshot.empty) {
      setRankingMessage("-");
      return;
    }

    snapshot.forEach(doc => {
      const solve = doc.data();
      const li = document.createElement("li");
      li.textContent = `${Number(solve.time).toFixed(2)} - ${solve.name || "Player"}`;
      rankingList.appendChild(li);
    });
  } catch (error) {
    setRankingMessage("Ranking could not be loaded.");
    console.error(error);
  }
}

async function submitOnlineSolve(time, scramble) {
  if (!isConfigured()) return;

  if (!currentUser) {
    queuePendingSolve(time, scramble);
    return;
  }

  try {
    await addOnlineSolve(time, scramble);
    refreshRanking();
  } catch (error) {
    queuePendingSolve(time, scramble);
    setStatus("Online submit failed. Saved locally for the next login.");
    console.error(error);
  }
}

async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function loginAsGuest() {
  const credential = await signInAnonymously(auth);
  const name = getPlayerName();

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

if (isConfigured()) {
  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);

  setupAuthUi();

  onAuthStateChanged(auth, user => {
    currentUser = user;

    if (user) {
      setStatus(`Logged in as ${user.displayName || "Guest"}`);
      submitPendingSolves().catch(error => {
        setStatus("Pending times could not be submitted.");
        console.error(error);
      });
    } else {
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
