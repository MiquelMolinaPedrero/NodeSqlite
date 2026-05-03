const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "artists.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

// ── Inicialització de la base de dades ──────────────────────────────────────
db.serialize(() => {
  // Taula artistes
  db.run(`
    CREATE TABLE IF NOT EXISTS artists (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL
    )
  `);

  // Taula àlbums
  db.run(`
    CREATE TABLE IF NOT EXISTS albums (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT    NOT NULL,
      artist_id INTEGER NOT NULL,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    )
  `);

  // Taula cançons
  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      title    TEXT    NOT NULL,
      album_id INTEGER NOT NULL,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
    )
  `);

  // Dades llavor: artistes, àlbums i cançons d'exemple
  const sampleData = [
    // Artistes catalans
    { artist: "Txarango", albums: [
      { title: "Benvinguts al llarg viatge", songs: ["Músic de carrer", "Som riu", "La dansa del ventre"] },
      { title: "El cor de la terra", songs: ["Al·lucinògens", "La vida és bonica", "Quan tot s'enlaira"] }
    ]},
    { artist: "Oques Grasses", albums: [
      { title: "Fans del sol", songs: ["Tornarem", "Compta amb mi", "Balada del despertar"] },
      { title: "Ara som gegants", songs: ["Ara som gegants", "Només somnis", "La flaca"] }
    ]},
    { artist: "Manel", albums: [
      { title: "Els millors professors europeus", songs: ["Benvolgut", "La serotonina", "Al mar!"] },
      { title: "Per la bona gent", songs: ["Boomerang", "La gent normal", "Teresa Rampell"] }
    ]},
    { artist: "Els Catarres", albums: [
      { title: "Tots els meus principis", songs: ["Jenifer", "La vida és així", "Fins que arribi l'alba"] }
    ]},
    // Artistes internacionals
    { artist: "Bad Bunny", albums: [
      { title: "Un Verano Sin Ti", songs: ["La Romana", "Titi Me Preguntó", "Moscow Mule"] },
      { title: "El Último Tour Del Mundo", songs: ["La Noche de Anoche", "Yo Perreo Sola", "BICHOTA"] }
    ]},
    { artist: "Dua Lipa", albums: [
      { title: "Future Nostalgia", songs: ["Levitating", "Don't Start Now", "Physical"] },
      { title: "Dua Lipa", songs: ["New Rules", "IDGAF", "Be the One"] }
    ]},
    { artist: "The Weeknd", albums: [
      { title: "After Hours", songs: ["Blinding Lights", "Heartless", "Save Your Tears"] },
      { title: "Starboy", songs: ["Starboy", "Die for You", "Reminder"] }
    ]},
    { artist: "Taylor Swift", albums: [
      { title: "Folklore", songs: ["Cardigan", "Exile", "The 1"] },
      { title: "Evermore", songs: ["Willow", "No Body, No Crime", "Marjorie"] }
    ]}
  ];

  // Inserir dades d'exemple
  sampleData.forEach(({ artist, albums }) => {
    db.get("SELECT id FROM artists WHERE name = ?", [artist], (err, row) => {
      if (!err && !row) {
        db.run("INSERT INTO artists (name) VALUES (?)", [artist], function(err) {
          if (!err) {
            const artistId = this.lastID;
            albums.forEach(({ title, songs }) => {
              db.run("INSERT INTO albums (title, artist_id) VALUES (?, ?)", [title, artistId], function(err) {
                if (!err) {
                  const albumId = this.lastID;
                  songs.forEach(song => {
                    db.run("INSERT INTO songs (title, album_id) VALUES (?, ?)", [song, albumId]);
                  });
                }
              });
            });
          }
        });
      }
    });
  });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ════════════════════════════════════════════════════════════
//  ARTISTES
// ════════════════════════════════════════════════════════════

// GET  /api/artists  → llista tots els artistes
app.get("/api/artists", (req, res) => {
  db.all("SELECT * FROM artists ORDER BY name ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/artists  → afegir artista   { name }
app.post("/api/artists", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "El nom és obligatori." });

  db.run("INSERT INTO artists (name) VALUES (?)", [name.trim()], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name: name.trim() });
  });
});

// PUT  /api/artists/:id  → modificar artista  { name }
app.put("/api/artists/:id", (req, res) => {
  const { name } = req.body;
  const { id }   = req.params;
  if (!name || !name.trim())
    return res.status(400).json({ error: "El nom és obligatori." });

  db.run(
    "UPDATE artists SET name = ? WHERE id = ?",
    [name.trim(), id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Artista no trobat." });
      res.json({ id: Number(id), name: name.trim() });
    }
  );
});

// DELETE /api/artists/:id  → eliminar artista (i els seus àlbums/cançons per CASCADE)
app.delete("/api/artists/:id", (req, res) => {
  const { id } = req.params;
  db.run("PRAGMA foreign_keys = ON");
  db.run("DELETE FROM artists WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Artista no trobat." });
    res.json({ deleted: Number(id) });
  });
});

// ════════════════════════════════════════════════════════════
//  ÀLBUMS
// ════════════════════════════════════════════════════════════

// GET  /api/albums  → llista tots els àlbums (amb nom artista)
app.get("/api/albums", (req, res) => {
  const sql = `
    SELECT albums.id, albums.title, albums.artist_id, artists.name AS artist_name
    FROM albums
    JOIN artists ON albums.artist_id = artists.id
    ORDER BY albums.title ASC
  `;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET  /api/artists/:id/albums  → àlbums d'un artista concret
app.get("/api/artists/:id/albums", (req, res) => {
  db.all(
    "SELECT * FROM albums WHERE artist_id = ? ORDER BY title ASC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST /api/albums  → afegir àlbum   { title, artist_id }
app.post("/api/albums", (req, res) => {
  const { title, artist_id } = req.body;
  if (!title || !title.trim() || !artist_id)
    return res.status(400).json({ error: "Títol i artista són obligatoris." });

  db.run(
    "INSERT INTO albums (title, artist_id) VALUES (?, ?)",
    [title.trim(), artist_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title: title.trim(), artist_id });
    }
  );
});

// DELETE /api/albums/:id  → eliminar àlbum (i les seves cançons per CASCADE)
app.delete("/api/albums/:id", (req, res) => {
  db.run("PRAGMA foreign_keys = ON");
  db.run("DELETE FROM albums WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Àlbum no trobat." });
    res.json({ deleted: Number(req.params.id) });
  });
});

// ════════════════════════════════════════════════════════════
//  CANÇONS
// ════════════════════════════════════════════════════════════

// GET  /api/songs  → llista totes les cançons (amb àlbum i artista)
app.get("/api/songs", (req, res) => {
  const sql = `
    SELECT songs.id, songs.title, songs.album_id,
           albums.title AS album_title,
           artists.id   AS artist_id,
           artists.name AS artist_name
    FROM songs
    JOIN albums  ON songs.album_id  = albums.id
    JOIN artists ON albums.artist_id = artists.id
    ORDER BY songs.title ASC
  `;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/songs  → afegir cançó   { title, album_id }
app.post("/api/songs", (req, res) => {
  const { title, album_id } = req.body;
  if (!title || !title.trim() || !album_id)
    return res.status(400).json({ error: "Títol i àlbum són obligatoris." });

  db.run(
    "INSERT INTO songs (title, album_id) VALUES (?, ?)",
    [title.trim(), album_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title: title.trim(), album_id });
    }
  );
});

// DELETE /api/songs/:id  → eliminar cançó
app.delete("/api/songs/:id", (req, res) => {
  db.run("DELETE FROM songs WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Cançó no trobada." });
    res.json({ deleted: Number(req.params.id) });
  });
});

// ── Arranc del servidor ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor a http://localhost:${PORT}`);
  console.log(`Base de dades SQLite: ${dbPath}`);
});