/* script.js
   Usa o fluxo Authorization Code com PKCE para pegar user-top-read
   Gera automáticamente a colagem 1920x1080 em formato story e cria o link para download.
*/

/* ========== CONFIG ========== */
const CLIENT_ID = "b37de0410b874e75a2b582b5ace94001"; // substitua pelo seu Client ID do dashboard
const REDIRECT_URI = "https://jeanmbds.github.io/spotify-vibes-game/"; // exato no dashboard
const SCOPES = "user-top-read";

/* ========== UI ========== */
const loginBtn = document.getElementById("btn-login");
const downloadLink = document.getElementById("download");
const canvas = document.getElementById("collage");
const ctx = canvas.getContext("2d");

let accessToken = null;
let tokenExpiresAt = 0;

/* ========== AUTENTICAÇÃO (PKCE / Authorization Code Flow) ========== */
function buildAuthUrl() {
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem("pkce_verifier", codeVerifier);
  const codeChallenge = base64URLEncode(sha256(codeVerifier));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: SCOPES,
    show_dialog: "true"
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function redirectToSpotifyLogin() {
  window.location.href = buildAuthUrl();
}

/* parse query string retornada pelo Spotify (code=...) */
function parseQuery() {
  const query = window.location.search.substring(1);
  if (!query) return null;
  const params = new URLSearchParams(query);
  return {
    code: params.get("code"),
    state: params.get("state")
  };
}

/* troca code por access token usando PKCE */
async function fetchAccessToken(code) {
  const codeVerifier = sessionStorage.getItem("pkce_verifier");
  if (!codeVerifier) throw new Error("Não há code verifier no sessionStorage.");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) throw new Error("Falha ao pegar token: " + res.status);
  return res.json();
}

/* salva token em memória e limpa URL */
async function handleAuthRedirect() {
  const data = parseQuery();
  if (!data || !data.code) return false;

  const tokenData = await fetchAccessToken(data.code);
  accessToken = tokenData.access_token;
  tokenExpiresAt = Date.now() + (parseInt(tokenData.expires_in || "3600", 10) * 1000);

  history.replaceState({}, document.title, REDIRECT_URI);
  return true;
}

/* checa se token expirou */
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

/* ========== UTILS PARA IMAGENS ========== */
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

/* ========== GERAR COLAGEM 1920x1080 STORIES ==========
   layout: grid 4x3 (12 capas). Texto com fundo branco atrás.
*/
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

    // fundo preto
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid 4x3
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

    // sobreposições sutis
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, canvas.width, 110);
    ctx.fillRect(0, canvas.height - 140, canvas.width, 140);

    const padding = 20;

    // Texto topo com fundo branco
    const textTop = "If this is their vibes";
    ctx.font = "bold 48px Inter, Arial";
    ctx.textAlign = "center";
    const textTopMetrics = ctx.measureText(textTop);
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      canvas.width/2 - textTopMetrics.width/2 - padding,
      40,
      textTopMetrics.width + padding*2,
      48 + padding
    );
    ctx.fillStyle = "#000";
    ctx.fillText(textTop, canvas.width/2, 72 + padding/2);

    // Texto RUN com fundo branco
    const textRun = "RUN!";
    ctx.font = "bold 120px Inter, Arial";
    const textRunMetrics = ctx.measureText(textRun);
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      canvas.width/2 - textRunMetrics.width/2 - padding,
      canvas.height - 160,
      textRunMetrics.width + padding*2,
      120 + padding
    );
    ctx.fillStyle = "#ff3b30";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText(textRun, canvas.width/2, canvas.height - 40);

    // gerar link de download
    const dataUrl = canvas.toDataURL("image/png");
    downloadLink.href = dataUrl;
    downloadLink.classList.remove("disabled");

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

/* ========== LOAD / EVENTOS ========== */
loginBtn.addEventListener("click", () => {
  if (hasValidToken()) {
    generateCollageFromSpotify();
  } else {
    redirectToSpotifyLogin();
  }
});

window.addEventListener("load", async () => {
  const didAuth = await handleAuthRedirect();
  if (didAuth) {
    await generateCollageFromSpotify();
  }
});

/* ========== FUNÇÕES AUXILIARES PKCE ========== */
function generateCodeVerifier() {
  const array = new Uint32Array(56/2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ("0" + dec.toString(16)).substr(-2)).join("");
}

function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function base64URLEncode(bufferPromise) {
  return bufferPromise.then(buf => {
    const bytes = new Uint8Array(buf);
    let str = "";
    for (let i=0; i<bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  });
}


