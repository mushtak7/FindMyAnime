/* FindMyAnime Dashboard - Fetches from Jikan API */
const JIKAN = 'https://api.jikan.moe/v4';
const delay = ms => new Promise(r => setTimeout(r, ms));

// Rate-limited fetch
const queue = [];
let lastCall = 0;
async function jikanFetch(url) {
    const now = Date.now();
    const wait = Math.max(0, lastCall + 400 - now);
    lastCall = now + wait;
    await delay(wait);
    const res = await fetch(url);
    if (res.status === 429) { await delay(1500); return jikanFetch(url); }
    if (!res.ok) throw new Error(`Jikan ${res.status}`);
    return res.json();
}

// Star SVG
const starSvg = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;

function makeCard(anime, badgeType) {
    const score = anime.score || anime.scored || '?';
    const title = anime.title_english || anime.title || 'Unknown';
    const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const eps = anime.episodes ? `${anime.episodes} eps` : anime.status || '';
    const malId = anime.mal_id;
    const badgeMap = { hot: 'badge-hot', new: 'badge-new', top: 'badge-top' };
    const badgeClass = badgeMap[badgeType] || '';
    const badgeLabel = badgeType ? badgeType.toUpperCase() : '';

    return `<div class="card-anime" onclick="window.location.href='/anime.html?id=${malId}'">
        <div class="card-img">
            ${badgeType ? `<span class="badge ${badgeClass}">${badgeLabel}</span>` : ''}
            <img src="${img}" alt="${title}" loading="lazy">
            <div class="card-overlay"></div>
        </div>
        <div class="card-info">
            <h3>${title}</h3>
            <p class="meta">${eps}</p>
            <div class="rating">${starSvg}<span>${score}</span></div>
        </div>
    </div>`;
}

function skeletons(n) {
    return Array(n).fill('<div class="skeleton-card"></div>').join('');
}

// Hero Stats
async function loadStats() {
    try {
        const animeData = await jikanFetch(`${JIKAN}/anime?limit=1`);
        const animeCount = animeData.pagination?.items?.total;
        if (animeCount) {
            document.getElementById('animeCountStat').textContent = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(animeCount) + '+';
        } else {
            document.getElementById('animeCountStat').textContent = '25K+';
        }

        const mangaData = await jikanFetch(`${JIKAN}/manga?limit=1`);
        const mangaCount = mangaData.pagination?.items?.total;
        if (mangaCount) {
            document.getElementById('mangaCountStat').textContent = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(mangaCount) + '+';
        } else {
            document.getElementById('mangaCountStat').textContent = '60K+';
        }
    } catch (e) {
        document.getElementById('animeCountStat').textContent = '25K+';
        document.getElementById('mangaCountStat').textContent = '60K+';
    }
}

// Trending
async function loadTrending() {
    const el = document.getElementById('trendingScroll');
    el.innerHTML = skeletons(8);
    try {
        const data = await jikanFetch(`${JIKAN}/top/anime?filter=airing&limit=24`);
        el.innerHTML = data.data.slice(0, 24).map((a, i) => makeCard(a, i < 3 ? 'hot' : (i < 6 ? 'new' : ''))).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--muted)">Could not load trending anime</p>'; }
}

// Big 3
function loadBig3() {
    const big3Data = [
        { title: 'One Piece', id: 21, eps: '1100+', status: 'Ongoing', members: '3.2M', desc: 'The legendary pirate adventure that has captivated millions for over two decades.', color: '#ff3366' },
        { title: 'Naruto', id: 20, eps: '720', status: 'Completed', members: '2.8M', desc: 'The ninja epic that defined a generation of anime fans worldwide.', color: '#00d4ff' },
        { title: 'Bleach', id: 269, eps: '366+', status: 'Ongoing', members: '2.1M', desc: 'Soul Reaper adventures with epic battles and supernatural powers.', color: '#9933ff' },
    ];
    const el = document.getElementById('big3Grid');
    // Load images from Jikan
    big3Data.forEach(async (b, i) => {
        try {
            const data = await jikanFetch(`${JIKAN}/anime/${b.id}`);
            const img = data.data.images?.jpg?.large_image_url || '';
            const score = data.data.score || '?';
            const card = el.children[i];
            if (card) {
                card.querySelector('img').src = img;
                card.querySelector('.big3-score').textContent = score;
            }
        } catch (e) { }
    });
    el.innerHTML = big3Data.map(b => `
        <div class="big3-card" onclick="window.location.href='/anime.html?id=${b.id}'" style="cursor:pointer">
            <div class="big3-header">
                <img src="" alt="${b.title}" loading="lazy">
                <div>
                    <h3>${b.title}</h3>
                    <p class="big3-meta">${b.eps} Episodes</p>
                    <span class="big3-status" style="background:${b.color}20;color:${b.color}">${b.status}</span>
                </div>
            </div>
            <p class="big3-desc">${b.desc}</p>
            <div class="big3-footer">
                <div class="rating">${starSvg}<span class="big3-score">...</span></div>
                <span style="font-size:13px;color:var(--muted)">${b.members} members</span>
            </div>
        </div>`).join('');
}

// Top Rated
async function loadTopRated() {
    const el = document.getElementById('topRatedScroll');
    el.innerHTML = skeletons(8);
    try {
        const data = await jikanFetch(`${JIKAN}/top/anime?limit=24`);
        el.innerHTML = data.data.slice(0, 24).map((a, i) => {
            const title = a.title_english || a.title;
            const img = a.images?.jpg?.image_url || '';
            return `<div class="top-rated-item card-anime" onclick="window.location.href='/anime.html?id=${a.mal_id}'" style="cursor:pointer">
                <div class="top-rated-rank">#${i + 1}</div>
                <img src="${img}" alt="${title}" loading="lazy">
                <div class="top-rated-info">
                    <h3>${title}</h3>
                    <p class="meta">${a.episodes || '?'} Episodes</p>
                    <div class="rating">${starSvg}<span>${a.score || '?'}</span></div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--muted)">Could not load top rated</p>'; }
}

// GOAT
async function loadGOAT() {
    const el = document.getElementById('goatScroll');
    el.innerHTML = skeletons(8);
    try {
        const data = await jikanFetch(`${JIKAN}/top/anime?filter=bypopularity&limit=24`);
        el.innerHTML = data.data.slice(0, 24).map(a => makeCard(a, '')).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--muted)">Could not load GOAT list</p>'; }
}

// Fan Favorites
async function loadFanFav() {
    const el = document.getElementById('fanFavScroll');
    el.innerHTML = skeletons(8);
    try {
        const data = await jikanFetch(`${JIKAN}/top/anime?filter=favorite&limit=24`);
        el.innerHTML = data.data.slice(0, 24).map(a => {
            const fav = a.favorites ? `${(a.favorites / 1000).toFixed(0)}K` : '';
            return makeCard(a, '') + '';  // reuse card but we'll add favorites
        }).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--muted)">Could not load fan favorites</p>'; }
}

// Manga
async function loadManga() {
    const el = document.getElementById('mangaScroll');
    el.innerHTML = skeletons(6);
    try {
        const data = await jikanFetch(`${JIKAN}/top/manga?limit=12`);
        el.innerHTML = data.data.slice(0, 12).map(m => {
            const title = m.title_english || m.title || '';
            const img = m.images?.jpg?.image_url || '';
            const ch = m.chapters ? `Ch. ${m.chapters}` : m.status || '';
            return `<div class="card-anime" onclick="window.location.href='/manga-details.html?id=${m.mal_id}'">
                <div class="card-img" style="aspect-ratio:3/4">
                    <img src="${img}" alt="${title}" loading="lazy">
                    <div class="card-overlay"></div>
                </div>
                <div class="card-info">
                    <h3>${title}</h3>
                    <p class="meta" style="color:var(--accent)">${ch}</p>
                </div>
            </div>`;
        }).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--muted)">Could not load manga</p>'; }
}

// Community (from backend)
async function loadCommunity() {
    const el = document.getElementById('discussionFeed');
    try {
        const res = await fetch('/api/feed/recent');
        if (!res.ok) throw new Error();
        const data = await res.json();
        const posts = data.recentPosts || [];
        if (posts.length === 0) {
            el.innerHTML = '<div class="community-card"><p style="color:var(--muted)">No posts yet. Be the first to start a discussion!</p></div>';
            return;
        }
        el.innerHTML = posts.map(p => `
            <div class="community-card">
                <div class="discussion-header">
                    <img src="https://i.pravatar.cc/100?u=${p.username}" alt="${p.username}">
                    <div><h4>${p.username}</h4><span class="time">${new Date(p.created_at).toLocaleDateString()}</span></div>
                </div>
                <p class="discussion-content">${p.content}</p>
                <div class="discussion-actions">
                    <button><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg> Like</button>
                    <button onclick="window.location.href='/community.html'"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> Comment</button>
                </div>
            </div>`).join('');
    } catch (e) {
        el.innerHTML = '<div class="community-card"><p style="color:var(--muted)">Join our community to see and create posts!</p></div>';
    }
}

// Auth state
async function checkAuth() {
    const el = document.getElementById('authArea');
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data.user) {
            el.innerHTML = `
                <a href="/profile.html" class="auth-link">👤 ${data.user.username || data.user}</a>
                <a href="/watchlist.html" class="auth-link">📋 Watchlist</a>
                <button onclick="logout()" class="auth-link" style="cursor:pointer">Logout</button>`;
        }
    } catch (e) { }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

// Search
function setupSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');
    let timeout;

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            dropdown?.classList.remove('show');
        }
    });

    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2 && dropdown.innerHTML !== '') {
            dropdown.classList.add('show');
        }
    });

    input.addEventListener('input', () => {
        clearTimeout(timeout);
        const q = input.value.trim();

        if (q.length < 2) {
            dropdown.classList.remove('show');
            return;
        }

        dropdown.innerHTML = '<div class="search-loading">Searching...</div>';
        dropdown.classList.add('show');

        timeout = setTimeout(async () => {
            try {
                const data = await jikanFetch(`${JIKAN}/anime?q=${encodeURIComponent(q)}&limit=8`);
                if (data.data.length === 0) {
                    dropdown.innerHTML = '<div class="search-loading">No results found</div>';
                    return;
                }
                dropdown.innerHTML = data.data.map(a => {
                    const title = a.title_english || a.title;
                    const img = a.images?.jpg?.image_url || '';
                    const eps = a.episodes ? `${a.episodes} eps` : a.status || '';
                    const score = a.score || '?';
                    return `<a href="/anime.html?id=${a.mal_id}" class="search-result-item">
                        <img src="${img}" alt="${title}" loading="lazy">
                        <div class="search-result-info">
                            <h4>${title}</h4>
                            <p>${eps}</p>
                            <div class="rating">${starSvg} <span>${score}</span></div>
                        </div>
                    </a>`;
                }).join('');
            } catch (e) {
                dropdown.innerHTML = '<div class="search-loading">Error fetching results</div>';
            }
        }, 600);
    });
}

let animeGenresLoaded = false;
let currentAnimeGenreId = null;

// Tabs
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;

            document.querySelectorAll('.content-section').forEach(s => {
                s.style.display = (tab === 'all' || s.dataset.section === tab) ? '' : 'none';
            });

            if (tab === 'genres') {
                document.getElementById('genreContainer').style.display = 'block';
                if (!animeGenresLoaded) await loadAnimeGenres();

                if (!currentAnimeGenreId) {
                    const firstChip = document.querySelector('#genreScroll .genre-chip');
                    if (firstChip) firstChip.click();
                }
            } else if (tab === 'all') {
                // If 'all', hide genre grid grid specifically if no genre selected, or just hide genre section
                document.getElementById('genreContainer').style.display = 'none';
            }
        });
    });
}

async function loadAnimeGenres() {
    try {
        const res = await jikanFetch('https://api.jikan.moe/v4/genres/anime');
        if (res.data) {
            const scroll = document.getElementById('genreScroll');
            const safeGenres = res.data.filter(g => g.name !== 'Hentai' && g.name !== 'Erotica' && g.name !== 'Boys Love' && g.name !== 'Girls Love');

            scroll.innerHTML = safeGenres.map(g =>
                `<button class="genre-chip" data-id="${g.mal_id}">${g.name}</button>`
            ).join('');

            document.querySelectorAll('#genreScroll .genre-chip').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    document.querySelectorAll('#genreScroll .genre-chip').forEach(c => c.classList.remove('active'));
                    e.target.classList.add('active');
                    currentAnimeGenreId = e.target.dataset.id;
                    loadAnimeByGenre(currentAnimeGenreId);
                });
            });
            animeGenresLoaded = true;
        }
    } catch (err) {
        console.error("Failed to load anime genres", err);
    }
}

async function loadAnimeByGenre(genreId) {
    const grid = document.getElementById('genreGrid');
    const loading = document.getElementById('genreLoading');

    grid.innerHTML = '';
    loading.style.display = 'block';

    try {
        const data = await jikanFetch(`https://api.jikan.moe/v4/anime?genres=${genreId}&order_by=popularity&sort=asc&limit=24`);
        if (data.data?.length) {
            grid.innerHTML = data.data.map(a => makeCard(a)).join('');
        } else {
            grid.innerHTML = '<p style="text-align:center; color:var(--muted); grid-column:1/-1; padding:40px;">No anime found.</p>';
        }
    } catch (err) {
        grid.innerHTML = '<p style="text-align:center; color:var(--error); grid-column:1/-1; padding:40px;">Failed to load anime.</p>';
    } finally {
        loading.style.display = 'none';
    }
}

// Scroll buttons
function setupScrollBtns() {
    const scrollAmount = 300;
    document.getElementById('scrollLeftTrending')?.addEventListener('click', () => {
        document.getElementById('trendingScroll')?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    document.getElementById('scrollRightTrending')?.addEventListener('click', () => {
        document.getElementById('trendingScroll')?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    document.getElementById('scrollLeftTopRated')?.addEventListener('click', () => {
        document.getElementById('topRatedScroll')?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    document.getElementById('scrollRightTopRated')?.addEventListener('click', () => {
        document.getElementById('topRatedScroll')?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    document.getElementById('scrollLeftGoat')?.addEventListener('click', () => {
        document.getElementById('goatScroll')?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    document.getElementById('scrollRightGoat')?.addEventListener('click', () => {
        document.getElementById('goatScroll')?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    document.getElementById('scrollLeftFanFav')?.addEventListener('click', () => {
        document.getElementById('fanFavScroll')?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    document.getElementById('scrollRightFanFav')?.addEventListener('click', () => {
        document.getElementById('fanFavScroll')?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    document.getElementById('scrollLeft')?.addEventListener('click', () => {
        document.getElementById('mangaScroll')?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    document.getElementById('scrollRight')?.addEventListener('click', () => {
        document.getElementById('mangaScroll')?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
}

// Intersection observer for fade-in
function setupAnimations() {
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));
}

// Mobile Menu
function setupMobileMenu() {
    const btn = document.getElementById('menuBtn');
    const menu = document.getElementById('mobileMenu');
    if (btn && menu) {
        btn.addEventListener('click', () => menu.classList.toggle('hidden'));
        menu.addEventListener('click', () => menu.classList.add('hidden'));
    }
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
    setupSearch();
    setupTabs();
    setupScrollBtns();
    setupMobileMenu();
    checkAuth();

    // Load sections with staggered delays for rate limiting
    loadStats();
    loadTrending();
    await delay(500);
    loadBig3();
    await delay(500);
    loadTopRated();
    await delay(500);
    loadGOAT();
    await delay(500);
    loadFanFav();
    await delay(500);
    loadManga();
    await delay(300);
    loadCommunity();

    // Start animations after small delay
    setTimeout(setupAnimations, 200);
});
