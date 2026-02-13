
# AniCrunch 🎌  
A fast, modern anime discovery platform built with performance, UX, and SEO in mind.

🌐 Live site: https://anicrunch.vercel.app/

---

## 🚀 Overview

**AniCrunch** is a web application for discovering anime through trending, seasonal, and recommended sections, featuring a cinematic hero banner, responsive layouts, and strong performance on both mobile and desktop.

The project focuses on:
- ⚡ High performance (90+ Lighthouse)
- 📱 Mobile-first responsive design
- ♿ Accessibility best practices
- 🔍 SEO readiness (Search Console, sitemap, robots)
- 🎨 Modern UI with smooth animations

---

## ✨ Features

- 🎬 **Hero banner** with anime highlights
- 🔥 **Trending & Seasonal anime sections**
- 🎯 **Recommendations preview**
- 🔎 **Search with instant results**
- 🧩 **Genre filtering**
- 📅 **Schedule view**
- ⭐ **Watchlist support**
- 🧠 Skeleton loading states
- 🖥 Desktop & 📱 mobile optimized layouts

---

## 🛠 Tech Stack

- **Vanilla JavaScript** (Frontend)
- **Node.js & Express** (Backend)
- **PostgreSQL / Supabase** (Database)
- **Vercel** (Hosting & deployment)
- **Google Search Console** (SEO monitoring)

No frameworks. No heavy libraries. Optimized for speed.

---

## 📈 Performance & SEO

- ✅ Lighthouse Performance: **90+ (Mobile & Desktop)**
- ✅ Accessibility: **96–100**
- ✅ SEO: **100**
- ✅ CLS, LCP, FCP optimized
- ✅ Mobile-friendly

SEO setup includes:
- `sitemap.xml`
- `robots.txt`
- Google Search Console verification
- Correct XML content-type handling on Vercel

---

### Local Development

This is a full-stack project.

1.  **Clone the repo**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Setup Environment**:
    Create a `.env` file based on `.env.example` and add your `DATABASE_URL` (Supabase).
4.  **Start the server**:
    ```bash
    npm run dev
    ```
5.  Open `http://localhost:3000` in your browser.



### 📦 Deployment

AniCrunch is optimized for deployment on **Vercel**.

1.  **Environment Variables**: You must set the following in your Vercel project settings:
    - `DATABASE_URL`: Your Supabase connection string.
    - `SESSION_SECRET`: A secure random string.
2.  **Automatic Deployment**: Every push to the `main` branch triggers a new deployment.

🔮 Roadmap

.Dynamic anime detail pages

.JSON-LD structured data (Anime schema)

.Dynamic sitemap generation

.Pagination-friendly URLs

.Progressive Web App (PWA)

.User accounts & sync



🤝 Contributing

Contributions, ideas, and suggestions are welcome.

Fork the repo

Create a feature branch

Submit a pull request


📄 License

This project is for educational and personal use.
Anime data belongs to their respective owners.


❤️ Credits

Built with passion for anime, performance, and clean UI.

If you like the project, consider giving it a ⭐ on GitHub.

