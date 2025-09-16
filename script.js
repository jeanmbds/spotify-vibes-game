/* ========== CONFIG ========== */
const CLIENT_ID = "SEU_CLIENT_ID_AQUI"; // substitua pelo seu client ID
const REDIRECT_URI = "https://jeanmbds.github.io/spotify-vibes-game/"; // link exato do GitHub Pages
const SCOPES = "user-top-read";

/* ========== UI ========== */
const loginBtn = document.getElementById("btn-login");
const downloadLink = document.getElementById("download");
const canvas = document.getElementById("collage");
const ctx = canvas.getContext("2d");

let accessToken = null;
let tokenExpiresAt = 0;

/* ========== AUTENTICAÇÃO ========== */
function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "token",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    show_dialog: "true"
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function redirectToSpotifyLogin() {
  window.location.href = buildAuthUrl();
}

function parseHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token"),
    token_type: params.get("token_type"),
    expires_in: params.get("expires_in")
  };
}

function handleAuthRedirect() {
  const data = parseHash();
  if (!data || !data.access_token) return false;
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (parseInt(data.expires_in || "3600", 10) * 1000);
  return true;
}

function hasValidToken() {
  return accessToken && Date.now() < tokenExpiresAt;
}

/* ========== FETCH TOP TRACKS ========== */
async function getTopTracks(limit = 12) {
  if (!hasValidToken()) throw new Error("Token inválido — faça login novamente.");
  const url = `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=short_term`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken }});
  if (res.status === 401) throw new Error("Token expirado ou inválido (401). Faça login novamente.");
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Erro na API Spotify: " + res.status + " " + txt);
  }
  const json = await res.json();
  return json.items || [];
}

/* ========== UTILS DE IMAGEM ========== */
function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function drawImageCover(img, dx, dy, dw, dh) {
  const iw = img.width, ih = img.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ========== GERAR COLAGEM 4x3 / STORY 1920x1080 ========== */
async function generateCollageFromSpotify() {
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = "Gerando...";
    downloadLink.classList.add("disabled");
    downloadLink.removeAttribute("href");

    const tracks = await getTopTracks(12);
    if (!tracks || tracks.length === 0) throw new Error("Não há faixas suficientes.");

    const urls = tracks.map(t => (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || null);
    const images = await Promise.all(urls.map(u => u ? loadImage(u) : Promise.reject("Imagem inválida")));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid 4x3
    const cols = 4, rows = 3;
    const cellW = Math.floor(canvas.width / cols);
    const cellH = Math.floor(canvas.height / rows);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (i >= images.length) break;
        drawImageCover(images[i], c*cellW, r*cellH, cellW, cellH);
        i++;
      }
    }

    // sobreposição para textos
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, canvas.width, 110);
    ctx.fillRect(0, canvas.height - 140, canvas.width, 140);

    const padding = 20;

    // Texto topo
    const textTop = "If this is their vibes";
    ctx.font = "bold 48px Inter, Arial";
    ctx.textAlign = "center";
    let metrics = ctx.measureText(textTop);
    ctx.fillStyle = "#fff";
    ctx.fillRect(canvas.width/2 - metrics.width/2 - padding, 40, metrics.width + padding*2, 48 + padding);
    ctx.fillStyle = "#000";
    ctx.fillText(textTop, canvas.width/2, 72 + padding/2);

    // Texto RUN!
    const textRun = "RUN!";
    ctx.font = "bold 120px Inter, Arial";
    metrics = ctx.measureText(textRun);
    ctx.fillStyle = "#fff";
    ctx.fillRect(canvas.width/2 - metrics.width/2 - padding, canvas.height - 160, metrics.width + padding*2, 120 + padding);
    ctx.fillStyle = "#ff3b30";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText(textRun, canvas.width/2, canvas.height - 40);

    // gerar link de download
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.classList.remove("disabled");

    // limpa hash depois que gerou a colagem
    history.replaceState({}, document.title, REDIRECT_URI);

    loginBtn.disabled = false;
    loginBtn.textContent = "Re-conectar";
    return true;
  } catch (err) {
    loginBtn.disabled = false;
    loginBtn.textContent = "Conectar com Spotify";
    downloadLink.classList.add("disabled");
    console.error(err);
    alert("Erro ao gerar colagem: " + (err.message || err));
    return false;
  }
}

/* ========== EVENTOS ========== */
loginBtn.addEventListener("click", () => {
  if (hasValidToken()) {
    generateCollageFromSpotify();
  } else {
    redirectToSpotifyLogin();
  }
});

window.addEventListener("load", async () => {
  if (handleAuthRedirect()) {
    await generateCollageFromSpotify();
  }
});





