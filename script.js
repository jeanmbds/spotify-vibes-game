/* script.js
   Usa o fluxo client-side (implicit) para pegar user-top-read
   Gera automáticamente a colagem 1920x1080 e cria o link para download.
*/

/* ========== CONFIG ========== */
const CLIENT_ID = "0b7d668143fc45f082a02c9837b926fc"; // <-- substitua mais tarde no GitHub
const REDIRECT_URI = "https://jeanmbds.github.io/spotify-vibes-game/;" // exemplo: https://usuario.github.io/repo/
const SCOPES = "user-top-read";

/* ========== UI ========== */
const loginBtn = document.getElementById("btn-login");
const downloadLink = document.getElementById("download");
const canvas = document.getElementById("collage");
const ctx = canvas.getContext("2d");

let accessToken = null;
let tokenExpiresAt = 0;

/* ========== AUTENTICAÇÃO (implicit grant) ========== */
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

/* parse hash retornado pelo Spotify (access_token=...) */
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

/* salva token em memória e limpa URL */
function handleAuthRedirect() {
  const data = parseHash();
  if (!data || !data.access_token) return false;
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (parseInt(data.expires_in || "3600", 10) * 1000);
  // limpa fragment da URL por segurança
  history.replaceState({}, document.title, REDIRECT_URI);
  return true;
}

/* checa se token expirou */
function hasValidToken() {
  return accessToken && Date.now() < tokenExpiresAt;
}

/* ========== FETCH TOP TRACKS ========== */
async function getTopTracks(limit = 9) {
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

/* desenha a imagem cobrindo o retângulo (cover) mantendo aspecto */
function drawImageCover(img, dx, dy, dw, dh) {
  const iw = img.width, ih = img.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ========== GERAR COLAGEM 1920x1080 ==========
   layout: grid 3x3 (9 capas). Texto no topo/centro.
*/
async function generateCollageFromSpotify() {
  try {
    // UI lock
    loginBtn.disabled = true;
    loginBtn.textContent = "Gerando...";
    downloadLink.classList.add("disabled");
    downloadLink.removeAttribute("href");

    // pega top 9
    const tracks = await getTopTracks(9);
    if (!tracks || tracks.length === 0) {
      throw new Error("Não há faixas suficientes no seu histórico para gerar a colagem.");
    }

    // pega URLs (maior imagem)
    const urls = tracks.map(t => (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || null);

    // carrega imagens
    const images = await Promise.all(urls.map(u => u ? loadImage(u) : Promise.reject("Imagem inválida")));

    // desenha fundo
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid 3x3
    const cols = 3, rows = 3;
    const cellW = Math.floor(canvas.width / cols); // 640
    const cellH = Math.floor(canvas.height / rows); // 360

    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (i >= images.length) break;
        const dx = c * cellW;
        const dy = r * cellH;
        drawImageCover(images[i], dx, dy, cellW, cellH);
        i++;
      }
    }

    // sobreposições sutis (opcional)
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, canvas.width, 110); // topo
    ctx.fillRect(0, canvas.height - 140, canvas.width, 140); // base

    // texto topo (parte 1)
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Inter, Arial";
    ctx.fillText("if this is their vibes", canvas.width / 2, 72);

    // texto final (RUN!) maior e vermelho
    ctx.font = "bold 120px Inter, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText("RUN!", canvas.width / 2, canvas.height - 40);

    // gerar link de download
    const dataUrl = canvas.toDataURL("image/png");
    downloadLink.href = dataUrl;
    downloadLink.classList.remove("disabled");

    // UI unlock
    loginBtn.disabled = false;
    loginBtn.textContent = "Re-conectar";
    return true;
  } catch (err) {
    // limpa UI e mostra erro
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
  // se já temos token válido, apenas gera; caso contrário redireciona para login
  if (hasValidToken()) {
    generateCollageFromSpotify();
  } else {
    redirectToSpotifyLogin();
  }
});

window.addEventListener("load", async () => {
  // se o Spotify redirecionou com access_token no hash, pegamos e geramos
  const didAuth = handleAuthRedirect();
  if (didAuth) {
    // gera automaticamente após o redirect
    await generateCollageFromSpotify();
  } else {
    // nada: aguardamos ação do usuário
    // se já tivéssemos token salvo em sessionStorage (opcional), poderíamos reutilizar
  }
});



