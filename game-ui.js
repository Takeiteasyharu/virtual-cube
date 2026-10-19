document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button").forEach(button => {
    button.addEventListener("keydown", event => {
      if (["Space", "Enter"].includes(event.code)) event.stopPropagation();
    });
    button.addEventListener("keyup", event => {
      if (["Space", "Enter"].includes(event.code)) event.stopPropagation();
    });
  });
  const cubeArea = document.getElementById("mainCubeArea");
  const timer = document.getElementById("timerDisplay");
  if (cubeArea && timer) cubeArea.prepend(timer);
  const history = document.getElementById("timeList");
  if (history) {
    const heading = history.previousElementSibling;
    const details = document.createElement("details");
    details.className = "game-history";
    details.open = !matchMedia("(max-width: 700px)").matches;
    const summary = document.createElement("summary");
    summary.textContent = "Solve History";
    history.before(details);
    details.append(summary, history);
    if (heading?.tagName === "H2") heading.remove();
  }
  const pb = document.getElementById("pbDisplay");
  if (!pb) return;
  let previous = Number(pb.textContent);
  new MutationObserver(() => {
    const next = Number(pb.textContent);
    if (next > 0 && (!Number.isFinite(previous) || next < previous)) {
      pb.animate([{ background: "#75612c" }, { background: "transparent" }], { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800 });
    }
    previous = next;
  }).observe(pb, { childList: true, characterData: true, subtree: true });
});
