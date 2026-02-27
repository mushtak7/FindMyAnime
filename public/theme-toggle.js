// Theme Toggle - Shared across all pages
(function () {
    // Apply saved theme on load (before paint)
    const saved = localStorage.getItem('fma-theme') || 'dark';
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Create toggle button
        const btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle theme');
        btn.setAttribute('title', 'Toggle Light/Dark theme');

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        btn.textContent = currentTheme === 'light' ? '🌙' : '☀️';

        btn.onclick = () => {
            const isDark = !document.documentElement.getAttribute('data-theme') ||
                document.documentElement.getAttribute('data-theme') === 'dark';

            if (isDark) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('fma-theme', 'light');
                btn.textContent = '🌙';
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('fma-theme', 'dark');
                btn.textContent = '☀️';
            }
        };

        document.body.appendChild(btn);
    });
})();
