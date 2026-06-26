function showSecret() {
  var existing = document.getElementById("secret-page");
  if (existing) {
    existing.classList.add("visible");
    return;
  }

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/css/secret.css";
  document.head.appendChild(css);

  var overlay = document.createElement("div");
  overlay.id = "secret-page";
  overlay.innerHTML =
    '<button id="secret-close">&times;</button>' +
    '<h1>You found me!</h1>' +
    '<p>Congratulations, you unlocked the secret game.</p>' +
    '<iframe id="secret-game" src="/game/" title="Rocket Racer"></iframe>';
  document.body.appendChild(overlay);

  document.getElementById("secret-close").addEventListener("click", function () {
    overlay.classList.remove("visible");
  });

  requestAnimationFrame(function () {
    overlay.classList.add("visible");
  });
}