// ── Helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(url, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function showStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.className = "status " + (isError ? "error" : "ok");
  setTimeout(() => { el.textContent = ""; el.className = "status"; }, 3500);
}

// ════════════════════════════════════════════════════════════
//  ARTISTES
// ════════════════════════════════════════════════════════════
const artistForm      = document.getElementById("artist-form");
const artistNameInput = document.getElementById("artist-name");
const artistStatus    = document.getElementById("artist-status");
const artistTableBody = document.getElementById("artist-tbody");
const editModal       = document.getElementById("edit-modal");
const editInput       = document.getElementById("edit-artist-name");
const editSaveBtn     = document.getElementById("edit-save-btn");
const editCancelBtn   = document.getElementById("edit-cancel-btn");

let editingArtistId = null;

async function loadArtists() {
  try {
    const artists = await apiFetch("/api/artists");
    renderArtists(artists);
    // Actualitzem també els dropdowns d'àlbums i cançons
    populateArtistDropdowns(artists);
  } catch (e) {
    showStatus(artistStatus, e.message, true);
  }
}

function renderArtists(artists) {
  artistTableBody.innerHTML = "";
  if (artists.length === 0) {
    artistTableBody.innerHTML = `<tr><td colspan="3" class="empty">Cap artista registrat</td></tr>`;
    return;
  }
  artists.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${escHtml(a.name)}</td>
      <td class="actions">
        <button class="btn-edit" data-id="${a.id}" data-name="${escHtml(a.name)}">✏️ Edita</button>
        <button class="btn-delete" data-id="${a.id}">🗑 Elimina</button>
      </td>`;
    artistTableBody.appendChild(tr);
  });
}

function populateArtistDropdowns(artists) {
  // Dropdown per afegir àlbum
  const albumArtistSel = document.getElementById("album-artist");
  albumArtistSel.innerHTML = `<option value="">— Selecciona artista —</option>`;
  artists.forEach(a => {
    albumArtistSel.innerHTML += `<option value="${a.id}">${escHtml(a.name)}</option>`;
  });
}

// Afegir artista
artistForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = artistNameInput.value.trim();
  if (!name) return;
  try {
    await apiFetch("/api/artists", "POST", { name });
    showStatus(artistStatus, `✅ Artista "${name}" afegit correctament.`);
    artistForm.reset();
    loadArtists();
  } catch (err) {
    showStatus(artistStatus, err.message, true);
  }
});

// Editar / Eliminar (delegació d'events)
artistTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.classList.contains("btn-edit")) {
    editingArtistId = btn.dataset.id;
    editInput.value = btn.dataset.name;
    editModal.classList.add("open");
    editInput.focus();
  }

  if (btn.classList.contains("btn-delete")) {
    const id = btn.dataset.id;
    if (!confirm("Segur que vols eliminar aquest artista? S'eliminaran també els seus àlbums i cançons.")) return;
    apiFetch(`/api/artists/${id}`, "DELETE")
      .then(() => { showStatus(artistStatus, "✅ Artista eliminat."); loadArtists(); loadAlbums(); loadSongs(); })
      .catch(err => showStatus(artistStatus, err.message, true));
  }
});

// Modal editar
editSaveBtn.addEventListener("click", async () => {
  const name = editInput.value.trim();
  if (!name) return;
  try {
    await apiFetch(`/api/artists/${editingArtistId}`, "PUT", { name });
    showStatus(artistStatus, `✅ Artista actualitzat a "${name}".`);
    editModal.classList.remove("open");
    loadArtists(); loadAlbums(); loadSongs();
  } catch (err) {
    showStatus(artistStatus, err.message, true);
  }
});

editCancelBtn.addEventListener("click", () => editModal.classList.remove("open"));
editModal.addEventListener("click", (e) => { if (e.target === editModal) editModal.classList.remove("open"); });

// ════════════════════════════════════════════════════════════
//  ÀLBUMS
// ════════════════════════════════════════════════════════════
const albumForm      = document.getElementById("album-form");
const albumTitleInp  = document.getElementById("album-title");
const albumArtistSel = document.getElementById("album-artist");
const albumStatus    = document.getElementById("album-status");
const albumTableBody = document.getElementById("album-tbody");

async function loadAlbums() {
  try {
    const albums = await apiFetch("/api/albums");
    renderAlbums(albums);
    populateAlbumDropdowns(albums);
  } catch (e) {
    showStatus(albumStatus, e.message, true);
  }
}

function renderAlbums(albums) {
  albumTableBody.innerHTML = "";
  if (albums.length === 0) {
    albumTableBody.innerHTML = `<tr><td colspan="4" class="empty">Cap àlbum registrat</td></tr>`;
    return;
  }
  albums.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${escHtml(a.title)}</td>
      <td>${escHtml(a.artist_name)}</td>
      <td class="actions">
        <button class="btn-delete" data-id="${a.id}">🗑 Elimina</button>
      </td>`;
    albumTableBody.appendChild(tr);
  });
}

function populateAlbumDropdowns(albums) {
  const songAlbumSel = document.getElementById("song-album");
  songAlbumSel.innerHTML = `<option value="">— Selecciona àlbum —</option>`;
  albums.forEach(a => {
    songAlbumSel.innerHTML += `<option value="${a.id}">${escHtml(a.title)} (${escHtml(a.artist_name)})</option>`;
  });
}

// Quan es canvia l'artista del formulari d'àlbum → res (info only)
albumArtistSel.addEventListener("change", () => {});

// Afegir àlbum
albumForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title     = albumTitleInp.value.trim();
  const artist_id = albumArtistSel.value;
  if (!title || !artist_id) {
    showStatus(albumStatus, "Emplena el títol i selecciona un artista.", true);
    return;
  }
  try {
    await apiFetch("/api/albums", "POST", { title, artist_id: Number(artist_id) });
    showStatus(albumStatus, `✅ Àlbum "${title}" afegit correctament.`);
    albumForm.reset();
    loadAlbums();
  } catch (err) {
    showStatus(albumStatus, err.message, true);
  }
});

// Eliminar àlbum
albumTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button.btn-delete");
  if (!btn) return;
  if (!confirm("Segur que vols eliminar aquest àlbum? S'eliminaran també les seves cançons.")) return;
  apiFetch(`/api/albums/${btn.dataset.id}`, "DELETE")
    .then(() => { showStatus(albumStatus, "✅ Àlbum eliminat."); loadAlbums(); loadSongs(); })
    .catch(err => showStatus(albumStatus, err.message, true));
});

// ════════════════════════════════════════════════════════════
//  CANÇONS
// ════════════════════════════════════════════════════════════
const songForm      = document.getElementById("song-form");
const songTitleInp  = document.getElementById("song-title");
const songAlbumSel  = document.getElementById("song-album");
const songStatus    = document.getElementById("song-status");
const songTableBody = document.getElementById("song-tbody");

async function loadSongs() {
  try {
    const songs = await apiFetch("/api/songs");
    renderSongs(songs);
  } catch (e) {
    showStatus(songStatus, e.message, true);
  }
}

function renderSongs(songs) {
  songTableBody.innerHTML = "";
  if (songs.length === 0) {
    songTableBody.innerHTML = `<tr><td colspan="5" class="empty">Cap cançó registrada</td></tr>`;
    return;
  }
  songs.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.id}</td>
      <td>${escHtml(s.title)}</td>
      <td>${escHtml(s.album_title)}</td>
      <td>${escHtml(s.artist_name)}</td>
      <td class="actions">
        <button class="btn-delete" data-id="${s.id}">🗑 Elimina</button>
      </td>`;
    songTableBody.appendChild(tr);
  });
}

// Afegir cançó
songForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title    = songTitleInp.value.trim();
  const album_id = songAlbumSel.value;
  if (!title || !album_id) {
    showStatus(songStatus, "Emplena el títol i selecciona un àlbum.", true);
    return;
  }
  try {
    await apiFetch("/api/songs", "POST", { title, album_id: Number(album_id) });
    showStatus(songStatus, `✅ Cançó "${title}" afegida correctament.`);
    songForm.reset();
    loadSongs();
  } catch (err) {
    showStatus(songStatus, err.message, true);
  }
});

// Eliminar cançó
songTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button.btn-delete");
  if (!btn) return;
  if (!confirm("Segur que vols eliminar aquesta cançó?")) return;
  apiFetch(`/api/songs/${btn.dataset.id}`, "DELETE")
    .then(() => { showStatus(songStatus, "✅ Cançó eliminada."); loadSongs(); })
    .catch(err => showStatus(songStatus, err.message, true));
});

// ── Funció d'escapament HTML ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Càrrega inicial ───────────────────────────────────────────────────────────
(async () => {
  await loadArtists();
  await loadAlbums();
  await loadSongs();
})();