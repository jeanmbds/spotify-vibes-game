/* ========== CONFIG ========== */
const CLIENT_ID = "0b7d668143fc45f082a02c9837b926fc"; // seu Client ID
const REDIRECT_URI = "https://jeanmbds.github.io/spotify-vibes-game/";
const SCOPES = "user-top-read";

/* ========== UI ========== */
const loginBtn = document.getElementById("btn-login");
const downloadLink = document.getElementById("download");
const canvas = document.getElementById("collage");
const ctx = canvas.getContext("2d");

let accessToken = null;
let tokenExpiresAt = 0;

/* ========== FUNÇÕES PKCE ========== */
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

function base64UrlEncode(buffer) {
  let str = btoa(String.fromCharCode.apply(null, buffer));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}

/* ========== AUTENTICAÇÃO COM PKCE ========== */
async function redirectToSpotifyLogin() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  localStorage.setItem("pkce_code_verifier", codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function fetchAccessToken(code) {
  const codeVerifier = localStorage.getItem("pkce_code_verifier");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body
  });

  const data = await res.json();
  if (data.access_token) {
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    history.replaceState({}, document.title, REDIRECT_URI); // limpa URL
  } else {
    console.error(data);
    alert("Erro ao obter token: " + (data.error || "unknown"));
  }
}

/* ========== CHECAR CÓDIGO NO URL ========== */
async function handleAuthRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  if (code) {
    await fetchAccessToken(code);
    return true;
  }
  return false;
}

function hasValidToken() {
  return accessToken && Date.now() < tokenExpiresAt;
}

/* ========== FETCH TOP TRACKS ========== */
async function getTopTracks(limit = 9) {
  if (!hasValidToken()) throw new Error("Token inválido — faça login novamente.");
  const url = `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=short_term`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken }});
  if (!res.ok) throw new Error("Erro na API Spotify: " + res.status);
  const json = await res.json();
  return json.items || [];
}

/* ========== UTILIDADES PARA IMAGENS ========== */
function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = e => reject(e);
    img.src = url;
  });
}

function drawImageCover(img, dx, dy, dw, dh) {
  const iw = img.width, ih = img.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale, sh = dh / scale;
  const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ========== GERAR COLAGEM ========== */
async function generateCollageFromSpotify() {
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = "Gerando...";
    downloadLink.classList.add("disabled");
    downloadLink.removeAttribute("href");

    const tracks = await getTopTracks(9);
    const urls = tracks.map(t => t.album.images[0].url);
    const images = await Promise.all(urls.map(u => loadImage(u)));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cols = 3, rows = 3;
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

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0,0,canvas.width,110);
    ctx.fillRect(0,canvas.height-140,canvas.width,140);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Inter, Arial";
    ctx.fillText("if this is their vibes", canvas.width/2, 72);

    ctx.font = "bold 120px Inter, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText("RUN!", canvas.width/2, canvas.height-40);

    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.classList.remove("disabled");

    loginBtn.disabled = false;
    loginBtn.textContent = "Re-conectar";
  } catch (err) {
    loginBtn.disabled = false;
    loginBtn.textContent = "Conectar com Spotify";
    downloadLink.classList.add("disabled");
    console.error(err);
    alert("Erro ao gerar colagem: " + (err.message || err));
  }
}

/* ========== EVENTOS ========== */
loginBtn.addEventListener("click", () => {
  if (hasValidToken()) generateCollageFromSpotify();
  else redirectToSpotifyLogin();
});

window.addEventListener("load", async () => {
  const didAuth = await handleAuthRedirect();
  if (didAuth) generateCollageFromSpotify();
});
