require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const https = require("https");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

/* =====================
   RENDER BACKEND URL
===================== */
const RENDER_BACKEND = "https://anicrunch-backend.onrender.com";
const DB_URL = process.env.DATABASE_URL || "";
const USE_PROXY = !DB_URL || DB_URL === "your_postgresql_database_url_here";

/* =====================
   TRUST PROXY (RENDER)
===================== */
app.set("trust proxy", 1);

/* =====================
   BASIC MIDDLEWARE
===================== */
app.use(express.static(path.join(__dirname, "public")));

/* =====================
   CORS SETUP (FIXED)
===================== */
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

/* =====================
   REVERSE PROXY MODE
   When no local database is configured, proxy all /api/* requests
   to the Render backend. This keeps everything on localhost so
   session cookies work correctly (no cross-origin issues).
===================== */
if (USE_PROXY) {
  console.log("⚡ No local database configured. Proxying /api/* to Render backend...");

  // We need the raw body for proxying, so DON'T parse JSON globally in proxy mode.
  // Instead, collect the raw body and forward it.
  app.use("/api", (req, res) => {
    let bodyChunks = [];

    req.on("data", (chunk) => bodyChunks.push(chunk));
    req.on("end", () => {
      const bodyBuffer = Buffer.concat(bodyChunks);

      const options = {
        hostname: "anicrunch-backend.onrender.com",
        path: req.originalUrl,
        method: req.method,
        headers: {
          "Content-Type": req.headers["content-type"] || "application/json",
          "Cookie": req.headers.cookie || "",
        },
      };

      if (bodyBuffer.length > 0) {
        options.headers["Content-Length"] = bodyBuffer.length;
      }

      const proxyReq = https.request(options, (proxyRes) => {
        // Rewrite Set-Cookie headers: remove Domain and Secure flags so
        // the cookie is set for localhost instead of the Render domain
        const cookies = proxyRes.headers["set-cookie"];
        if (cookies) {
          const rewritten = cookies.map((c) =>
            c
              .replace(/Domain=[^;]+;?\s*/gi, "")
              .replace(/Secure;?\s*/gi, "")
              .replace(/SameSite=None/gi, "SameSite=Lax")
          );
          proxyRes.headers["set-cookie"] = rewritten;
        }

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (err) => {
        console.error("Proxy error:", err.message);
        res.status(502).json({ message: "Backend unavailable. The Render server may be waking up, please try again in 30 seconds." });
      });

      if (bodyBuffer.length > 0) {
        proxyReq.write(bodyBuffer);
      }
      proxyReq.end();
    });
  });
} else {
  // Only parse JSON when using local database routes
  app.use(express.json());
}

/* =====================
   SESSION SETUP (local DB mode only)
===================== */
if (!USE_PROXY) {
  app.use(
    session({
      name: "findmyanime.sid",
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })
  );
}

/* =====================
   RATE LIMITING
===================== */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

/* =====================
   DATABASE (SUPABASE) - only when configured
===================== */
const pool = USE_PROXY ? null : new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =====================
   AUTH GUARD
===================== */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Login required" });
  }
  next();
}

/* =====================
   AUTH ROUTES
===================== */
app.post("/api/signup", authLimiter, async (req, res) => {
  const username = req.body.username?.trim().toLowerCase();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hash]
    );

    req.session.user = {
      id: result.rows[0].id,
      username: result.rows[0].username
    };

    res.json({ user: result.rows[0].username });
  } catch (err) {
    if (err.code === "23505") { // Unique violation code
      return res.status(409).json({ message: "User already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const username = req.body.username?.trim().toLowerCase();
  const password = req.body.password;

  try {
    const result = await pool.query(
      "SELECT id, username, password FROM users WHERE username=$1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.user = { id: user.id, username: user.username };
    res.json({ user: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("findmyanime.sid");
    res.json({ success: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

/* =====================
   WATCHLIST ROUTES
===================== */
app.get("/api/watchlist", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT anime_id FROM watchlists WHERE user_id=$1",
      [req.session.user.id]
    );

    res.json(result.rows.map(r => r.anime_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching watchlist" });
  }
});

app.post("/api/watchlist/add", requireAuth, async (req, res) => {
  const { animeId } = req.body;

  try {
    await pool.query(
      "INSERT INTO watchlists (user_id, anime_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.session.user.id, animeId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding to watchlist" });
  }
});

app.post("/api/watchlist/remove", requireAuth, async (req, res) => {
  const { animeId } = req.body;

  try {
    await pool.query(
      "DELETE FROM watchlists WHERE user_id=$1 AND anime_id=$2",
      [req.session.user.id, animeId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error removing from watchlist" });
  }
});

/* =====================
   MANGA LIBRARY ROUTES
===================== */
app.get("/api/manga-library", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT manga_id, status, chapters_read, volumes_read FROM manga_library WHERE user_id=$1",
      [req.session.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching manga library" });
  }
});

app.post("/api/manga-library/add", requireAuth, async (req, res) => {
  const { mangaId, status } = req.body;
  const validStatuses = ['reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'];
  const s = validStatuses.includes(status) ? status : 'plan_to_read';

  try {
    await pool.query(
      `INSERT INTO manga_library (user_id, manga_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, manga_id) DO UPDATE SET status = $3`,
      [req.session.user.id, mangaId, s]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding to manga library" });
  }
});

app.post("/api/manga-library/update", requireAuth, async (req, res) => {
  const { mangaId, status, chaptersRead, volumesRead } = req.body;
  try {
    await pool.query(
      `UPDATE manga_library SET status = COALESCE($3, status),
       chapters_read = COALESCE($4, chapters_read),
       volumes_read = COALESCE($5, volumes_read)
       WHERE user_id = $1 AND manga_id = $2`,
      [req.session.user.id, mangaId, status || null, chaptersRead ?? null, volumesRead ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating manga" });
  }
});

app.post("/api/manga-library/remove", requireAuth, async (req, res) => {
  const { mangaId } = req.body;
  try {
    await pool.query(
      "DELETE FROM manga_library WHERE user_id=$1 AND manga_id=$2",
      [req.session.user.id, mangaId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error removing from manga library" });
  }
});

/* =====================
   USER STATS ROUTE
===================== */
app.get("/api/user/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [anime, manga, reviews, posts] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM watchlists WHERE user_id=$1", [userId]),
      pool.query("SELECT COUNT(*) FROM manga_library WHERE user_id=$1", [userId]),
      pool.query("SELECT COUNT(*) FROM reviews WHERE user_id=$1", [userId]),
      pool.query("SELECT COUNT(*) FROM posts WHERE user_id=$1", [userId])
    ]);
    res.json({
      animeCount: parseInt(anime.rows[0].count),
      mangaCount: parseInt(manga.rows[0].count),
      reviewCount: parseInt(reviews.rows[0].count),
      postCount: parseInt(posts.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

/* =====================
   USER ACTIVITY ROUTE
===================== */
app.get("/api/user/activity", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [reviews, posts] = await Promise.all([
      pool.query(
        `SELECT reviews.id, reviews.target_id, reviews.target_type, reviews.rating, reviews.comment, reviews.created_at
         FROM reviews WHERE reviews.user_id = $1
         ORDER BY reviews.created_at DESC LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT id, content, category, created_at FROM posts
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      )
    ]);
    res.json({
      recentReviews: reviews.rows,
      recentPosts: posts.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching activity" });
  }
});

/* =====================
   GLOBAL FEED ROUTE (for Homepage)
===================== */
app.get("/api/feed/recent", async (req, res) => {
  try {
    const [reviews, posts] = await Promise.all([
      pool.query(
        `SELECT reviews.id, reviews.target_id, reviews.target_type, reviews.rating,
                reviews.comment, reviews.created_at, users.username
         FROM reviews JOIN users ON reviews.user_id = users.id
         ORDER BY reviews.created_at DESC LIMIT 4`
      ),
      pool.query(
        `SELECT posts.id, posts.content, posts.category, posts.created_at, users.username
         FROM posts JOIN users ON posts.user_id = users.id
         ORDER BY posts.created_at DESC LIMIT 4`
      )
    ]);
    res.json({
      recentReviews: reviews.rows,
      recentPosts: posts.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching feed" });
  }
});

/* =====================
   DATABASE INIT (Tables)
===================== */
async function initDB() {
  try {
    // Users table MUST be created first (other tables reference it)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        anime_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, anime_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'discussion',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        target_id INTEGER NOT NULL,
        target_type VARCHAR(20) DEFAULT 'anime',
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manga_library (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        manga_id INTEGER NOT NULL,
        status VARCHAR(30) DEFAULT 'plan_to_read',
        chapters_read INTEGER DEFAULT 0,
        volumes_read INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, manga_id)
      )
    `);
    console.log("✅ Database tables initialized");
  } catch (err) {
    console.error("⚠️ DB init error (tables may already exist):", err.message);
  }
}

if (pool) initDB();

/* =====================
   COMMUNITY POSTS ROUTES
===================== */
app.get("/api/posts", async (req, res) => {
  const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  try {
    const result = await pool.query(
      `SELECT posts.id, posts.content, posts.category, posts.created_at, users.username
       FROM posts JOIN users ON posts.user_id = users.id
       ORDER BY posts.created_at ${sort}
       LIMIT 50`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching posts" });
  }
});

app.post("/api/posts", requireAuth, async (req, res) => {
  const { content, category } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Content is required" });
  }
  const validCategories = ['discussion', 'review', 'recommendation', 'question', 'meme'];
  const cat = validCategories.includes(category) ? category : 'discussion';

  try {
    const result = await pool.query(
      "INSERT INTO posts (user_id, content, category) VALUES ($1, $2, $3) RETURNING id",
      [req.session.user.id, content.trim().substring(0, 2000), cat]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating post" });
  }
});

/* =====================
   REVIEWS ROUTES
===================== */
app.get("/api/reviews/:targetId", async (req, res) => {
  const { targetId } = req.params;
  const targetType = req.query.type || 'anime';
  try {
    const result = await pool.query(
      `SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at, users.username
       FROM reviews JOIN users ON reviews.user_id = users.id
       WHERE reviews.target_id = $1 AND reviews.target_type = $2
       ORDER BY reviews.created_at DESC
       LIMIT 30`,
      [targetId, targetType]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching reviews" });
  }
});

app.post("/api/reviews", requireAuth, async (req, res) => {
  const { targetId, targetType, rating, comment } = req.body;
  if (!targetId || !rating || !comment) {
    return res.status(400).json({ message: "Missing fields" });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be 1-5" });
  }
  const type = ['anime', 'manga'].includes(targetType) ? targetType : 'anime';

  try {
    await pool.query(
      "INSERT INTO reviews (user_id, target_id, target_type, rating, comment) VALUES ($1, $2, $3, $4, $5)",
      [req.session.user.id, targetId, type, rating, comment.trim().substring(0, 2000)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating review" });
  }
});

/* =====================
   START SERVER
===================== */
app.listen(PORT, () => {
  console.log(`✅ FindMyAnime backend running on port ${PORT}`);
});

module.exports = app;
