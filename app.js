/* ============================================
   BIBLIOTHEQUE - Main Application Logic
   ============================================ */

class BibliothequeApp {
    constructor() {
        this.currentUser = null; // 'partner1' | 'partner2' | null
        this.currentPage = 'dashboard';
        this.editingBookId = null;
        this.recapUser = 'combined';
        this.charts = {};

        this.init();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    init() {
        this.loadTheme();
        this.updateLoginNames();
        this.setupStarRating();
        this.setupKeyboardShortcuts();

        // Check if first time — show setup
        const settings = this.getSettings();
        if (!settings.partner1.name && !settings.partner2.name) {
            // First visit — could auto-show setup, but let them explore first
        }
    }

    // ==========================================
    // DATA LAYER — LocalStorage
    // ==========================================
    getSettings() {
        const defaults = {
            partner1: { name: 'Ian', password: '', goal: 24 },
            partner2: { name: 'Hannah', password: '', goal: 24 },
            theme: 'light'
        };
        try {
            const saved = JSON.parse(localStorage.getItem('biblio_settings'));
            return saved ? { ...defaults, ...saved } : defaults;
        } catch {
            return defaults;
        }
    }

    saveSettings(settings) {
        localStorage.setItem('biblio_settings', JSON.stringify(settings));
    }

    getBooks(userId) {
        try {
            return JSON.parse(localStorage.getItem(`biblio_books_${userId}`)) || [];
        } catch {
            return [];
        }
    }

    saveBooks(userId, books) {
        localStorage.setItem(`biblio_books_${userId}`, JSON.stringify(books));
    }

    getAllBooks() {
        return {
            partner1: this.getBooks('partner1'),
            partner2: this.getBooks('partner2')
        };
    }

    getPartnerName(id) {
        const settings = this.getSettings();
        return settings[id]?.name || (id === 'partner1' ? 'Ian' : 'Hannah');
    }

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    showPasswordPrompt(userId) {
        this.pendingUser = userId;
        const settings = this.getSettings();
        const name = this.getPartnerName(userId);

        // If no password set, just log in
        if (!settings[userId].password) {
            this.loginAs(userId);
            return;
        }

        document.getElementById('password-modal-name').textContent = name;
        document.getElementById('password-input').value = '';
        document.getElementById('password-error').style.display = 'none';
        document.getElementById('password-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('password-input').focus(), 100);
    }

    checkPassword(e) {
        e.preventDefault();
        const settings = this.getSettings();
        const input = document.getElementById('password-input').value;

        if (input === settings[this.pendingUser].password) {
            this.closePasswordModal();
            this.loginAs(this.pendingUser);
        } else {
            document.getElementById('password-error').style.display = 'block';
            document.getElementById('password-input').value = '';
            document.getElementById('password-input').focus();
        }
    }

    closePasswordModal() {
        document.getElementById('password-modal').style.display = 'none';
    }

    loginAs(userId) {
        this.currentUser = userId;
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';

        this.updateSidebarUser();
        this.navigateTo('dashboard');
    }

    logout() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.destroyCharts();

        document.getElementById('app-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-screen').classList.add('active');
    }

    // ==========================================
    // SETUP
    // ==========================================
    showSetup() {
        const settings = this.getSettings();
        document.getElementById('setup-name1').value = settings.partner1.name || '';
        document.getElementById('setup-pass1').value = settings.partner1.password || '';
        document.getElementById('setup-goal1').value = settings.partner1.goal || 24;
        document.getElementById('setup-name2').value = settings.partner2.name || '';
        document.getElementById('setup-pass2').value = settings.partner2.password || '';
        document.getElementById('setup-goal2').value = settings.partner2.goal || 24;
        document.getElementById('setup-modal').style.display = 'flex';
    }

    closeSetup() {
        document.getElementById('setup-modal').style.display = 'none';
    }

    saveSetup(e) {
        e.preventDefault();
        const settings = this.getSettings();
        settings.partner1.name = document.getElementById('setup-name1').value.trim() || 'Ian';
        settings.partner1.password = document.getElementById('setup-pass1').value;
        settings.partner1.goal = parseInt(document.getElementById('setup-goal1').value) || 24;
        settings.partner2.name = document.getElementById('setup-name2').value.trim() || 'Hannah';
        settings.partner2.password = document.getElementById('setup-pass2').value;
        settings.partner2.goal = parseInt(document.getElementById('setup-goal2').value) || 24;

        this.saveSettings(settings);
        this.updateLoginNames();
        this.closeSetup();
        this.showToast('Settings saved successfully');

        if (this.currentUser) {
            this.updateSidebarUser();
            if (this.currentPage === 'dashboard') this.renderDashboard();
        }
    }

    updateLoginNames() {
        const settings = this.getSettings();
        document.getElementById('partner1-login-name').textContent = settings.partner1.name || 'Ian';
        document.getElementById('partner2-login-name').textContent = settings.partner2.name || 'Hannah';
    }

    // ==========================================
    // THEME
    // ==========================================
    loadTheme() {
        const settings = this.getSettings();
        document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    }

    toggleTheme() {
        const settings = this.getSettings();
        settings.theme = settings.theme === 'light' ? 'dark' : 'light';
        this.saveSettings(settings);
        document.documentElement.setAttribute('data-theme', settings.theme);
    }

    // ==========================================
    // NAVIGATION
    // ==========================================
    navigateTo(page) {
        // If going to 'joint' from login, allow without auth
        if (page === 'joint' || page === 'recap') {
            if (!this.currentUser) {
                this.currentUser = null;
                document.getElementById('login-screen').classList.remove('active');
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'flex';
                this.updateSidebarUser();
            }
        }

        this.currentPage = page;
        this.destroyCharts();
        this.updateActiveNav(page);
        this.closeSidebar();

        const main = document.getElementById('main-content');
        switch (page) {
            case 'dashboard': main.innerHTML = this.renderDashboard(); break;
            case 'my-books': main.innerHTML = this.renderMyBooks(); break;
            case 'add-book': main.innerHTML = this.renderAddBookPage(); break;
            case 'challenges': main.innerHTML = this.renderChallenges(); break;
            case 'joint': main.innerHTML = this.renderJoint(); break;
            case 'recap': main.innerHTML = this.renderRecap(); break;
            case 'data': main.innerHTML = this.renderDataPage(); break;
        }

        // Post-render: initialize charts
        requestAnimationFrame(() => {
            this.initChartsForPage(page);
        });

        window.scrollTo(0, 0);
    }

    updateActiveNav(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
    }

    // ==========================================
    // SIDEBAR
    // ==========================================
    updateSidebarUser() {
        const settings = this.getSettings();
        const avatar = document.getElementById('sidebar-avatar');
        const username = document.getElementById('sidebar-username');
        const readingCount = document.getElementById('sidebar-reading-count');

        if (this.currentUser) {
            const name = this.getPartnerName(this.currentUser);
            avatar.textContent = name.charAt(0).toUpperCase();
            username.textContent = name;
            const books = this.getBooks(this.currentUser);
            const finished = books.filter(b => b.shelf === 'finished').length;
            readingCount.textContent = `${finished} books this year`;
        } else {
            avatar.textContent = '?';
            username.textContent = 'Guest';
            readingCount.textContent = 'Viewing together';
        }
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
    }

    // ==========================================
    // BOOK CRUD
    // ==========================================
    openAddBookModal() {
        this.editingBookId = null;
        document.getElementById('book-modal-title').textContent = 'Add a New Book';
        document.getElementById('book-form').reset();
        document.getElementById('book-rating').value = '0';
        document.getElementById('book-id').value = '';
        document.getElementById('delete-book-btn').style.display = 'none';
        this.updateStarDisplay(0);
        document.getElementById('book-modal').style.display = 'flex';
    }

    openEditBookModal(bookId) {
        if (!this.currentUser) return;
        const books = this.getBooks(this.currentUser);
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        this.editingBookId = bookId;
        document.getElementById('book-modal-title').textContent = 'Edit Book';
        document.getElementById('book-id').value = book.id;
        document.getElementById('book-title').value = book.title;
        document.getElementById('book-author').value = book.author;
        document.getElementById('book-pages').value = book.pages || '';
        document.getElementById('book-current-page').value = book.currentPage || '';
        document.getElementById('book-date-started').value = book.dateStarted || '';
        document.getElementById('book-date-finished').value = book.dateFinished || '';
        document.getElementById('book-genre').value = book.genre || '';
        document.getElementById('book-rating').value = book.rating || 0;
        document.getElementById('book-shelf').value = book.shelf || 'want-to-read';
        document.getElementById('book-cover').value = book.cover || '';
        document.getElementById('book-notes').value = book.notes || '';
        document.getElementById('delete-book-btn').style.display = 'inline-flex';
        this.updateStarDisplay(book.rating || 0);
        document.getElementById('book-modal').style.display = 'flex';
    }

    closeBookModal() {
        document.getElementById('book-modal').style.display = 'none';
        this.editingBookId = null;
    }

    saveBook(e) {
        e.preventDefault();
        if (!this.currentUser) {
            this.showToast('Please log in to add books');
            return;
        }

        const books = this.getBooks(this.currentUser);
        const bookData = {
            id: this.editingBookId || this.generateId(),
            title: document.getElementById('book-title').value.trim(),
            author: document.getElementById('book-author').value.trim(),
            pages: parseInt(document.getElementById('book-pages').value) || 0,
            currentPage: parseInt(document.getElementById('book-current-page').value) || 0,
            dateStarted: document.getElementById('book-date-started').value,
            dateFinished: document.getElementById('book-date-finished').value,
            genre: document.getElementById('book-genre').value,
            rating: parseInt(document.getElementById('book-rating').value) || 0,
            shelf: document.getElementById('book-shelf').value,
            cover: document.getElementById('book-cover').value.trim(),
            notes: document.getElementById('book-notes').value.trim(),
            addedAt: new Date().toISOString()
        };

        // Auto-set shelf based on dates
        if (bookData.dateFinished && bookData.shelf === 'currently-reading') {
            bookData.shelf = 'finished';
        }

        const existingIndex = books.findIndex(b => b.id === bookData.id);
        if (existingIndex >= 0) {
            bookData.addedAt = books[existingIndex].addedAt;
            books[existingIndex] = bookData;
        } else {
            books.push(bookData);
        }

        this.saveBooks(this.currentUser, books);
        this.closeBookModal();
        this.showToast(this.editingBookId ? 'Book updated!' : 'Book added to your shelf!');
        this.navigateTo(this.currentPage);
    }

    deleteBook() {
        if (!this.editingBookId || !this.currentUser) return;
        if (!confirm('Are you sure you want to remove this book?')) return;

        let books = this.getBooks(this.currentUser);
        books = books.filter(b => b.id !== this.editingBookId);
        this.saveBooks(this.currentUser, books);
        this.closeBookModal();
        this.showToast('Book removed');
        this.navigateTo(this.currentPage);
    }

    saveBookFromPage(e) {
        e.preventDefault();
        if (!this.currentUser) {
            this.showToast('Please log in to add books');
            return;
        }

        const books = this.getBooks(this.currentUser);
        const bookData = {
            id: this.generateId(),
            title: document.getElementById('qa-title').value.trim(),
            author: document.getElementById('qa-author').value.trim(),
            pages: parseInt(document.getElementById('qa-pages').value) || 0,
            currentPage: parseInt(document.getElementById('qa-current-page').value) || 0,
            dateStarted: document.getElementById('qa-date-started').value,
            dateFinished: document.getElementById('qa-date-finished').value,
            genre: document.getElementById('qa-genre').value,
            rating: parseInt(document.getElementById('qa-rating').value) || 0,
            shelf: document.getElementById('qa-shelf').value,
            cover: document.getElementById('qa-cover').value.trim(),
            notes: document.getElementById('qa-notes').value.trim(),
            addedAt: new Date().toISOString()
        };

        if (bookData.dateFinished && bookData.shelf === 'currently-reading') {
            bookData.shelf = 'finished';
        }

        books.push(bookData);
        this.saveBooks(this.currentUser, books);
        this.showToast('Book added to your shelf!');
        this.navigateTo('my-books');
    }

    // ==========================================
    // COVER SEARCH (Open Library)
    // ==========================================
    searchCover() {
        const title = document.getElementById('book-title').value;
        const author = document.getElementById('book-author').value;
        document.getElementById('cover-search-input').value = `${title} ${author}`.trim();
        document.getElementById('cover-results').innerHTML = '';
        document.getElementById('cover-modal').style.display = 'flex';
        if (title || author) this.performCoverSearch();
    }

    async performCoverSearch() {
        const query = document.getElementById('cover-search-input').value.trim();
        if (!query) return;

        const results = document.getElementById('cover-results');
        results.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">Searching...</p>';

        try {
            const resp = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12`);
            const data = await resp.json();

            if (!data.docs || data.docs.length === 0) {
                results.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">No covers found</p>';
                return;
            }

            results.innerHTML = data.docs
                .filter(d => d.cover_i)
                .slice(0, 12)
                .map(d => `
                    <div class="cover-result" onclick="app.selectCover('https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg')">
                        <img src="https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg" alt="${this.escapeHtml(d.title)}" loading="lazy">
                    </div>
                `).join('');

            if (results.innerHTML === '') {
                results.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">No covers found</p>';
            }
        } catch (err) {
            results.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">Search failed. Please try again.</p>';
        }
    }

    selectCover(url) {
        document.getElementById('book-cover').value = url;
        this.closeCoverModal();
    }

    closeCoverModal() {
        document.getElementById('cover-modal').style.display = 'none';
    }

    // ==========================================
    // STAR RATING
    // ==========================================
    setupStarRating() {
        document.getElementById('star-rating').addEventListener('click', (e) => {
            const star = e.target.closest('.star');
            if (!star) return;
            const val = parseInt(star.dataset.value);
            document.getElementById('book-rating').value = val;
            this.updateStarDisplay(val);
        });
    }

    updateStarDisplay(value) {
        document.querySelectorAll('#star-rating .star').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.value) <= value);
        });
    }

    // ==========================================
    // STATISTICS HELPERS
    // ==========================================
    getStats(userId) {
        const books = this.getBooks(userId);
        const settings = this.getSettings();
        const now = new Date();
        const year = now.getFullYear();

        const finished = books.filter(b => b.shelf === 'finished');
        const currentlyReading = books.filter(b => b.shelf === 'currently-reading');
        const wantToRead = books.filter(b => b.shelf === 'want-to-read');

        // Books finished this year
        const finishedThisYear = finished.filter(b => {
            if (!b.dateFinished) return true; // count all finished if no date
            return new Date(b.dateFinished).getFullYear() === year;
        });

        const totalPages = finishedThisYear.reduce((sum, b) => sum + (b.pages || 0), 0);
        const totalBooks = finishedThisYear.length;
        const monthsElapsed = now.getMonth() + 1;
        const avgPerMonth = totalBooks > 0 ? (totalBooks / monthsElapsed).toFixed(1) : 0;

        // Reading pace
        let totalDaysReading = 0;
        let totalPagesForPace = 0;
        finishedThisYear.forEach(b => {
            if (b.dateStarted && b.dateFinished && b.pages) {
                const start = new Date(b.dateStarted);
                const end = new Date(b.dateFinished);
                const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                totalDaysReading += days;
                totalPagesForPace += b.pages;
            }
        });
        const pagesPerDay = totalDaysReading > 0 ? Math.round(totalPagesForPace / totalDaysReading) : 0;

        // Genre breakdown
        const genreCounts = {};
        finishedThisYear.forEach(b => {
            if (b.genre) {
                genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
            }
        });

        // Longest book
        const longestBook = finishedThisYear.reduce((max, b) => (b.pages || 0) > (max?.pages || 0) ? b : max, null);

        // Shortest book
        const shortestBook = finishedThisYear.filter(b => b.pages > 0).reduce((min, b) => !min || b.pages < min.pages ? b : min, null);

        // Highest rated
        const highestRated = finishedThisYear.filter(b => b.rating > 0).reduce((max, b) => !max || b.rating > max.rating ? b : max, null);

        // Average rating
        const ratedBooks = finishedThisYear.filter(b => b.rating > 0);
        const avgRating = ratedBooks.length > 0 ? (ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length).toFixed(1) : 0;

        // Monthly reading data
        const monthlyData = Array(12).fill(0);
        finishedThisYear.forEach(b => {
            if (b.dateFinished) {
                const m = new Date(b.dateFinished).getMonth();
                monthlyData[m]++;
            }
        });

        // Reading streak (days with pages read — simplified: consecutive days in date ranges)
        let longestStreak = 0;
        const readingDays = new Set();
        books.filter(b => b.dateStarted).forEach(b => {
            const start = new Date(b.dateStarted);
            const end = b.dateFinished ? new Date(b.dateFinished) : now;
            const d = new Date(start);
            while (d <= end) {
                readingDays.add(d.toISOString().split('T')[0]);
                d.setDate(d.getDate() + 1);
            }
        });
        // Calculate streak from sorted days
        const sortedDays = [...readingDays].sort();
        let currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
            const prev = new Date(sortedDays[i - 1]);
            const curr = new Date(sortedDays[i]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
        if (sortedDays.length === 1) longestStreak = 1;

        const goal = settings[userId]?.goal || 24;

        return {
            books, finished, currentlyReading, wantToRead,
            finishedThisYear, totalPages, totalBooks,
            avgPerMonth, pagesPerDay, genreCounts,
            longestBook, shortestBook, highestRated, avgRating,
            monthlyData, longestStreak, goal, readingDays
        };
    }

    // Fun fact generator
    getFunFact(totalPages) {
        const facts = [
            { threshold: 0, text: "Start your reading journey — every page is an adventure!" },
            { threshold: 100, text: `You've read ${totalPages.toLocaleString()} pages — that's taller than a stack of ${Math.floor(totalPages / 250)} novels!` },
            { threshold: 500, text: `${totalPages.toLocaleString()} pages read — that's about the height of ${(totalPages * 0.1 / 25.4).toFixed(1)} rulers stacked up!` },
            { threshold: 1000, text: `${totalPages.toLocaleString()} pages! If laid end to end, that's about ${(totalPages * 0.24 / 1000).toFixed(1)}km of text!` },
            { threshold: 3000, text: `${totalPages.toLocaleString()} pages — you've read the equivalent of the entire Lord of the Rings ${(totalPages / 1178).toFixed(1)} times!` },
            { threshold: 5000, text: `${totalPages.toLocaleString()} pages! That's like climbing Mount Everest ${(totalPages * 0.1 / 8849000).toFixed(4)} times in paper height... ok, you'll get there!` },
            { threshold: 8000, text: `${totalPages.toLocaleString()} pages of pure literary adventure. You're a reading machine!` },
            { threshold: 10000, text: `${totalPages.toLocaleString()} pages! You've entered the 10K club. That's legendary.` },
        ];

        let fact = facts[0];
        for (const f of facts) {
            if (totalPages >= f.threshold) fact = f;
        }
        return fact.text;
    }

    // ==========================================
    // RENDER: DASHBOARD
    // ==========================================
    renderDashboard() {
        if (!this.currentUser) return this.renderJoint();

        const stats = this.getStats(this.currentUser);
        const name = this.getPartnerName(this.currentUser);

        return `
        <div class="page-header animate-in">
            <h1>Welcome back, ${this.escapeHtml(name)}</h1>
            <p class="page-subtitle">Your reading journey awaits</p>
        </div>

        ${stats.totalPages > 0 ? `
        <div class="fun-fact animate-in">
            <span class="fun-fact-icon">&#10024;</span>
            <span>${this.getFunFact(stats.totalPages)}</span>
        </div>` : ''}

        <div class="stats-grid">
            <div class="stat-card gold-accent animate-in">
                <div class="stat-card-label">Books Read</div>
                <div class="stat-card-value">${stats.totalBooks}</div>
                <div class="stat-card-sub">finished this year</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Pages Read</div>
                <div class="stat-card-value">${stats.totalPages.toLocaleString()}</div>
                <div class="stat-card-sub">total pages</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Avg / Month</div>
                <div class="stat-card-value">${stats.avgPerMonth}</div>
                <div class="stat-card-sub">books per month</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Reading Pace</div>
                <div class="stat-card-value">${stats.pagesPerDay}</div>
                <div class="stat-card-sub">pages per day</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Longest Streak</div>
                <div class="stat-card-value">${stats.longestStreak}</div>
                <div class="stat-card-sub">consecutive days</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Avg Rating</div>
                <div class="stat-card-value">${stats.avgRating}</div>
                <div class="stat-card-sub">out of 5 stars</div>
            </div>
        </div>

        ${this.renderGoalProgress(stats)}

        ${stats.currentlyReading.length > 0 ? `
        <div class="section-header">
            <h2>Currently Reading</h2>
        </div>
        <div class="currently-reading-grid">
            ${stats.currentlyReading.map(b => this.renderReadingCard(b)).join('')}
        </div>` : ''}

        <div class="charts-grid">
            <div class="chart-card">
                <h3>Books Per Month</h3>
                <div class="chart-container"><canvas id="monthly-chart"></canvas></div>
            </div>
            <div class="chart-card">
                <h3>Favorite Genres</h3>
                <div class="chart-container"><canvas id="genre-chart"></canvas></div>
            </div>
        </div>

        ${this.renderHeatmap(stats)}
        `;
    }

    renderGoalProgress(stats) {
        const pct = Math.min(100, Math.round((stats.totalBooks / stats.goal) * 100));
        const remaining = Math.max(0, stats.goal - stats.totalBooks);

        return `
        <div class="goal-card animate-in">
            <div class="goal-header">
                <h3>Reading Goal ${new Date().getFullYear()}</h3>
                <span class="goal-count">${stats.totalBooks} / ${stats.goal}</span>
            </div>
            <div class="goal-progress-bar">
                <div class="goal-progress-fill" style="width: ${pct}%"></div>
            </div>
            <div class="goal-subtext">
                ${pct >= 100 ? "You've reached your goal! Amazing!" : `${remaining} more to go — you've got this!`}
                &nbsp;&bull;&nbsp; ${pct}% complete
            </div>
        </div>`;
    }

    renderReadingCard(book) {
        const progress = book.pages > 0 ? Math.round((book.currentPage / book.pages) * 100) : 0;
        const coverHtml = book.cover
            ? `<img src="${this.escapeHtml(book.cover)}" alt="">`
            : `<div class="placeholder-cover">${this.escapeHtml(book.title.substring(0, 30))}</div>`;

        return `
        <div class="reading-card animate-in" onclick="app.openEditBookModal('${book.id}')">
            <div class="reading-card-cover">${coverHtml}</div>
            <div class="reading-card-info">
                <div class="reading-card-title">${this.escapeHtml(book.title)}</div>
                <div class="reading-card-author">${this.escapeHtml(book.author)}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="progress-text">
                    <span>${book.currentPage || 0} of ${book.pages || '?'} pages</span>
                    <span>${progress}%</span>
                </div>
            </div>
        </div>`;
    }

    renderHeatmap(stats) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthCells = months.map((m, i) => {
            const count = stats.monthlyData[i];
            const level = Math.min(5, count);
            return `
            <div class="heatmap-month">
                <div class="heatmap-label">${m}</div>
                <div class="heatmap-cell" data-count="${level}" title="${count} book${count !== 1 ? 's' : ''} in ${m}"></div>
            </div>`;
        }).join('');

        return `
        <div class="heatmap-card animate-in">
            <h3>Monthly Reading Heatmap</h3>
            <div class="heatmap-grid">${monthCells}</div>
        </div>`;
    }

    // ==========================================
    // RENDER: MY BOOKS
    // ==========================================
    renderMyBooks(activeShelf = 'currently-reading') {
        if (!this.currentUser) return '<p>Please log in to see your books.</p>';

        const books = this.getBooks(this.currentUser);
        const shelves = {
            'currently-reading': books.filter(b => b.shelf === 'currently-reading'),
            'finished': books.filter(b => b.shelf === 'finished'),
            'want-to-read': books.filter(b => b.shelf === 'want-to-read')
        };

        const shelfBooks = shelves[activeShelf] || [];

        return `
        <div class="page-header animate-in">
            <h1>My Books</h1>
            <p class="page-subtitle">Your personal library</p>
        </div>

        <div class="shelf-tabs">
            <button class="shelf-tab ${activeShelf === 'currently-reading' ? 'active' : ''}" onclick="app.switchShelf('currently-reading')">
                Currently Reading <span class="tab-count">${shelves['currently-reading'].length}</span>
            </button>
            <button class="shelf-tab ${activeShelf === 'finished' ? 'active' : ''}" onclick="app.switchShelf('finished')">
                Finished <span class="tab-count">${shelves['finished'].length}</span>
            </button>
            <button class="shelf-tab ${activeShelf === 'want-to-read' ? 'active' : ''}" onclick="app.switchShelf('want-to-read')">
                Want to Read <span class="tab-count">${shelves['want-to-read'].length}</span>
            </button>
        </div>

        ${shelfBooks.length === 0 ? `
        <div class="empty-shelf">
            <div class="empty-shelf-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
            </div>
            <p>No books here yet. Time to add one!</p>
            <button class="btn btn-primary" onclick="app.openAddBookModal()" style="margin-top:1rem">Add a Book</button>
        </div>` : `
        <div class="books-grid">
            ${shelfBooks.map(b => this.renderBookCard(b)).join('')}
        </div>`}

        <div style="margin-top:2rem;text-align:center">
            <button class="btn btn-primary btn-lg" onclick="app.openAddBookModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                Add New Book
            </button>
        </div>`;
    }

    switchShelf(shelf) {
        this.currentPage = 'my-books';
        document.getElementById('main-content').innerHTML = this.renderMyBooks(shelf);
    }

    renderBookCard(book) {
        const coverHtml = book.cover
            ? `<img src="${this.escapeHtml(book.cover)}" alt="">`
            : `<div class="placeholder-cover-lg">${this.escapeHtml(book.title.substring(0, 40))}</div>`;

        const ratingHtml = book.rating > 0
            ? `<span class="book-card-rating">${'&#9733;'.repeat(book.rating)}</span>`
            : '';

        const progressHtml = book.shelf === 'currently-reading' && book.pages > 0 ? `
            <div class="book-card-progress">
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${Math.round((book.currentPage / book.pages) * 100)}%"></div>
                </div>
            </div>` : '';

        return `
        <div class="book-card animate-in" onclick="app.openEditBookModal('${book.id}')">
            <div class="book-card-cover">
                ${coverHtml}
                ${ratingHtml}
            </div>
            <div class="book-card-body">
                <div class="book-card-title">${this.escapeHtml(book.title)}</div>
                <div class="book-card-author">${this.escapeHtml(book.author)}</div>
                ${book.genre ? `<span class="book-card-genre">${this.escapeHtml(book.genre)}</span>` : ''}
                ${progressHtml}
            </div>
        </div>`;
    }

    // ==========================================
    // RENDER: ADD BOOK PAGE
    // ==========================================
    renderAddBookPage() {
        return `
        <div class="add-book-page">
            <div class="page-header animate-in">
                <h1>Add a Book</h1>
                <p class="page-subtitle">What are you reading next?</p>
            </div>

            <form class="quick-add-form" onsubmit="app.saveBookFromPage(event)">
                <div class="form-grid">
                    <div class="form-group full-width">
                        <label for="qa-title">Title *</label>
                        <input type="text" id="qa-title" required placeholder="Enter book title">
                    </div>
                    <div class="form-group full-width">
                        <label for="qa-author">Author *</label>
                        <input type="text" id="qa-author" required placeholder="Enter author name">
                    </div>
                    <div class="form-group">
                        <label for="qa-pages">Total Pages</label>
                        <input type="number" id="qa-pages" placeholder="e.g., 350" min="1">
                    </div>
                    <div class="form-group">
                        <label for="qa-current-page">Current Page</label>
                        <input type="number" id="qa-current-page" placeholder="e.g., 0" min="0">
                    </div>
                    <div class="form-group">
                        <label for="qa-date-started">Date Started</label>
                        <input type="date" id="qa-date-started">
                    </div>
                    <div class="form-group">
                        <label for="qa-date-finished">Date Finished</label>
                        <input type="date" id="qa-date-finished">
                    </div>
                    <div class="form-group">
                        <label for="qa-genre">Genre</label>
                        <select id="qa-genre">
                            <option value="">Select genre...</option>
                            <option value="Fiction">Fiction</option>
                            <option value="Non-Fiction">Non-Fiction</option>
                            <option value="Mystery">Mystery</option>
                            <option value="Thriller">Thriller</option>
                            <option value="Romance">Romance</option>
                            <option value="Sci-Fi">Sci-Fi</option>
                            <option value="Fantasy">Fantasy</option>
                            <option value="Horror">Horror</option>
                            <option value="Biography">Biography</option>
                            <option value="Memoir">Memoir</option>
                            <option value="Self-Help">Self-Help</option>
                            <option value="History">History</option>
                            <option value="Science">Science</option>
                            <option value="Philosophy">Philosophy</option>
                            <option value="Poetry">Poetry</option>
                            <option value="Business">Business</option>
                            <option value="Psychology">Psychology</option>
                            <option value="Travel">Travel</option>
                            <option value="Cooking">Cooking</option>
                            <option value="Art">Art</option>
                            <option value="Religion">Religion</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="qa-shelf">Shelf *</label>
                        <select id="qa-shelf" required>
                            <option value="currently-reading">Currently Reading</option>
                            <option value="finished">Finished</option>
                            <option value="want-to-read">Want to Read</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="qa-rating">Rating (if finished)</label>
                        <select id="qa-rating">
                            <option value="0">No rating</option>
                            <option value="1">1 Star</option>
                            <option value="2">2 Stars</option>
                            <option value="3">3 Stars</option>
                            <option value="4">4 Stars</option>
                            <option value="5">5 Stars</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="qa-cover">Cover Image URL</label>
                        <input type="url" id="qa-cover" placeholder="Paste URL or leave blank">
                    </div>
                    <div class="form-group full-width">
                        <label for="qa-notes">Notes</label>
                        <textarea id="qa-notes" rows="3" placeholder="Your thoughts..."></textarea>
                    </div>
                </div>
                <div style="margin-top:1rem">
                    <button type="submit" class="btn btn-primary btn-lg">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                        Add to Shelf
                    </button>
                </div>
            </form>
        </div>`;
    }

    // ==========================================
    // RENDER: CHALLENGES & BADGES
    // ==========================================
    renderChallenges() {
        if (!this.currentUser) return '<p>Please log in to see challenges.</p>';

        const stats = this.getStats(this.currentUser);
        const badges = this.calculateBadges(stats);
        const challenges = this.calculateChallenges(stats);

        return `
        <div class="page-header animate-in">
            <h1>Challenges &amp; Achievements</h1>
            <p class="page-subtitle">Unlock badges as you read</p>
        </div>

        <div class="section-header"><h2>Reading Challenges</h2></div>
        <div class="challenges-grid">
            ${challenges.map(c => `
            <div class="challenge-card ${c.completed ? 'completed' : ''} animate-in">
                <div class="challenge-icon">${c.icon}</div>
                <div class="challenge-title">${c.title}</div>
                <div class="challenge-desc">${c.description}</div>
                <div class="challenge-progress">
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width:${Math.min(100, c.progress)}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${c.current} / ${c.target}</span>
                        <span>${Math.min(100, Math.round(c.progress))}%</span>
                    </div>
                </div>
            </div>`).join('')}
        </div>

        <div class="section-header" style="margin-top:2rem"><h2>Badges Earned</h2></div>
        <div class="badge-grid">
            ${badges.map(b => `
            <div class="badge-card ${b.earned ? 'earned' : 'locked'} animate-in">
                <div class="badge-icon">${b.icon}</div>
                <div class="badge-name">${b.name}</div>
                <div class="badge-desc">${b.description}</div>
            </div>`).join('')}
        </div>`;
    }

    calculateChallenges(stats) {
        const settings = this.getSettings();
        const goal = stats.goal;
        return [
            {
                icon: '&#128218;', title: `Read ${goal} Books`, description: `Your annual reading goal`,
                current: stats.totalBooks, target: goal,
                progress: (stats.totalBooks / goal) * 100,
                completed: stats.totalBooks >= goal
            },
            {
                icon: '&#128214;', title: 'Page Turner', description: 'Read 5,000 pages this year',
                current: stats.totalPages, target: 5000,
                progress: (stats.totalPages / 5000) * 100,
                completed: stats.totalPages >= 5000
            },
            {
                icon: '&#127775;', title: 'Genre Explorer', description: 'Read books from 5+ different genres',
                current: Object.keys(stats.genreCounts).length, target: 5,
                progress: (Object.keys(stats.genreCounts).length / 5) * 100,
                completed: Object.keys(stats.genreCounts).length >= 5
            },
            {
                icon: '&#128293;', title: 'Reading Streak', description: 'Maintain a 30-day reading streak',
                current: stats.longestStreak, target: 30,
                progress: (stats.longestStreak / 30) * 100,
                completed: stats.longestStreak >= 30
            },
            {
                icon: '&#128171;', title: 'Speed Reader', description: 'Average 50+ pages per day',
                current: stats.pagesPerDay, target: 50,
                progress: (stats.pagesPerDay / 50) * 100,
                completed: stats.pagesPerDay >= 50
            },
            {
                icon: '&#128218;', title: 'Bookworm', description: 'Have 3+ books in progress at once',
                current: stats.currentlyReading.length, target: 3,
                progress: (stats.currentlyReading.length / 3) * 100,
                completed: stats.currentlyReading.length >= 3
            }
        ];
    }

    calculateBadges(stats) {
        return [
            { icon: '&#127793;', name: 'First Chapter', description: 'Finish your first book', earned: stats.totalBooks >= 1 },
            { icon: '&#128218;', name: 'Bookworm', description: 'Read 10 books', earned: stats.totalBooks >= 10 },
            { icon: '&#128081;', name: 'Royalty', description: 'Read 25 books', earned: stats.totalBooks >= 25 },
            { icon: '&#127942;', name: 'Champion', description: 'Read 50 books', earned: stats.totalBooks >= 50 },
            { icon: '&#128142;', name: 'Genre Explorer', description: 'Read 5+ genres', earned: Object.keys(stats.genreCounts).length >= 5 },
            { icon: '&#128293;', name: 'On Fire', description: '7-day streak', earned: stats.longestStreak >= 7 },
            { icon: '&#9889;', name: 'Lightning', description: '30-day streak', earned: stats.longestStreak >= 30 },
            { icon: '&#127775;', name: 'Critic', description: 'Rate 10+ books', earned: stats.finished.filter(b => b.rating > 0).length >= 10 },
            { icon: '&#128214;', name: 'Page Turner', description: 'Read 5,000 pages', earned: stats.totalPages >= 5000 },
            { icon: '&#127968;', name: 'Librarian', description: '50+ books on shelves', earned: stats.books.length >= 50 },
            { icon: '&#128151;', name: 'Five Stars', description: 'Give a 5-star rating', earned: stats.finished.some(b => b.rating === 5) },
            { icon: '&#128640;', name: 'Goal Crusher', description: 'Meet your annual goal', earned: stats.totalBooks >= stats.goal },
        ];
    }

    // ==========================================
    // RENDER: JOINT / TOGETHER
    // ==========================================
    renderJoint() {
        const stats1 = this.getStats('partner1');
        const stats2 = this.getStats('partner2');
        const name1 = this.getPartnerName('partner1');
        const name2 = this.getPartnerName('partner2');

        const combined = {
            books: stats1.totalBooks + stats2.totalBooks,
            pages: stats1.totalPages + stats2.totalPages,
        };

        // Find shared books (same title + author)
        const sharedBooks = this.findSharedBooks(stats1.finished, stats2.finished);

        return `
        <div class="joint-header animate-in">
            <h1>Our Reading Journey Together</h1>
            <p>Building a reading legacy, one book at a time</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card gold-accent animate-in">
                <div class="stat-card-label">Combined Books</div>
                <div class="stat-card-value">${combined.books}</div>
                <div class="stat-card-sub">finished together</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Combined Pages</div>
                <div class="stat-card-value">${combined.pages.toLocaleString()}</div>
                <div class="stat-card-sub">total pages read</div>
            </div>
            <div class="stat-card animate-in">
                <div class="stat-card-label">Books in Common</div>
                <div class="stat-card-value">${sharedBooks.length}</div>
                <div class="stat-card-sub">shared reads</div>
            </div>
        </div>

        <div class="section-header"><h2>Friendly Competition</h2></div>
        <div class="comparison-grid">
            <div class="comparison-card animate-in">
                <h3>${this.escapeHtml(name1)}</h3>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Books Read</span>
                    <span class="comparison-stat-value">${stats1.totalBooks}</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Pages Read</span>
                    <span class="comparison-stat-value">${stats1.totalPages.toLocaleString()}</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Avg Rating</span>
                    <span class="comparison-stat-value">${stats1.avgRating} &#9733;</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Longest Streak</span>
                    <span class="comparison-stat-value">${stats1.longestStreak} days</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Genres Explored</span>
                    <span class="comparison-stat-value">${Object.keys(stats1.genreCounts).length}</span>
                </div>
            </div>
            <div class="comparison-vs">
                <div class="vs-badge">VS</div>
            </div>
            <div class="comparison-card animate-in">
                <h3>${this.escapeHtml(name2)}</h3>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Books Read</span>
                    <span class="comparison-stat-value">${stats2.totalBooks}</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Pages Read</span>
                    <span class="comparison-stat-value">${stats2.totalPages.toLocaleString()}</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Avg Rating</span>
                    <span class="comparison-stat-value">${stats2.avgRating} &#9733;</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Longest Streak</span>
                    <span class="comparison-stat-value">${stats2.longestStreak} days</span>
                </div>
                <div class="comparison-stat">
                    <span class="comparison-stat-label">Genres Explored</span>
                    <span class="comparison-stat-value">${Object.keys(stats2.genreCounts).length}</span>
                </div>
            </div>
        </div>

        ${sharedBooks.length > 0 ? `
        <div class="shared-books">
            <div class="section-header"><h2>Books You've Both Read</h2></div>
            <div class="shared-book-list">
                ${sharedBooks.map(sb => `
                <div class="shared-book-card animate-in">
                    <div class="book-mini-cover">
                        ${sb.cover ? `<img src="${this.escapeHtml(sb.cover)}" alt="">` : ''}
                    </div>
                    <div class="shared-book-info">
                        <div class="shared-book-title">${this.escapeHtml(sb.title)}</div>
                        <div class="shared-book-author">${this.escapeHtml(sb.author)}</div>
                        <div class="shared-book-ratings">
                            <span>${this.escapeHtml(name1)}: ${sb.rating1 > 0 ? '&#9733;'.repeat(sb.rating1) : 'Unrated'}</span>
                            <span>${this.escapeHtml(name2)}: ${sb.rating2 > 0 ? '&#9733;'.repeat(sb.rating2) : 'Unrated'}</span>
                        </div>
                    </div>
                </div>`).join('')}
            </div>
        </div>` : ''}

        <div class="charts-grid">
            <div class="chart-card">
                <h3>Monthly Comparison</h3>
                <div class="chart-container"><canvas id="joint-monthly-chart"></canvas></div>
            </div>
            <div class="chart-card">
                <h3>Combined Genre Map</h3>
                <div class="chart-container"><canvas id="joint-genre-chart"></canvas></div>
            </div>
        </div>`;
    }

    findSharedBooks(books1, books2) {
        const shared = [];
        for (const b1 of books1) {
            const match = books2.find(b2 =>
                b1.title.toLowerCase().trim() === b2.title.toLowerCase().trim() &&
                b1.author.toLowerCase().trim() === b2.author.toLowerCase().trim()
            );
            if (match) {
                shared.push({
                    title: b1.title,
                    author: b1.author,
                    cover: b1.cover || match.cover,
                    rating1: b1.rating,
                    rating2: match.rating
                });
            }
        }
        return shared;
    }

    // ==========================================
    // RENDER: YEAR IN REVIEW
    // ==========================================
    renderRecap() {
        const year = new Date().getFullYear();
        const stats1 = this.getStats('partner1');
        const stats2 = this.getStats('partner2');
        const name1 = this.getPartnerName('partner1');
        const name2 = this.getPartnerName('partner2');

        let stats, displayName;
        if (this.recapUser === 'partner1') {
            stats = stats1; displayName = name1;
        } else if (this.recapUser === 'partner2') {
            stats = stats2; displayName = name2;
        } else {
            // Combined
            stats = {
                totalBooks: stats1.totalBooks + stats2.totalBooks,
                totalPages: stats1.totalPages + stats2.totalPages,
                avgPerMonth: ((parseFloat(stats1.avgPerMonth) + parseFloat(stats2.avgPerMonth))).toFixed(1),
                pagesPerDay: stats1.pagesPerDay + stats2.pagesPerDay,
                longestStreak: Math.max(stats1.longestStreak, stats2.longestStreak),
                avgRating: ((parseFloat(stats1.avgRating) + parseFloat(stats2.avgRating)) / 2).toFixed(1),
                genreCounts: this.mergeGenres(stats1.genreCounts, stats2.genreCounts),
                longestBook: (stats1.longestBook?.pages || 0) > (stats2.longestBook?.pages || 0) ? stats1.longestBook : stats2.longestBook,
                shortestBook: this.pickShortest(stats1.shortestBook, stats2.shortestBook),
                highestRated: (stats1.highestRated?.rating || 0) > (stats2.highestRated?.rating || 0) ? stats1.highestRated : stats2.highestRated,
                monthlyData: stats1.monthlyData.map((v, i) => v + stats2.monthlyData[i]),
                finishedThisYear: [...stats1.finishedThisYear, ...stats2.finishedThisYear],
            };
            displayName = 'Both of Us';
        }

        const topGenres = Object.entries(stats.genreCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);

        return `
        <div class="recap-container" id="recap-screenshot-area">
            <div class="recap-hero animate-in">
                <div class="recap-year">${year}</div>
                <h1>Year in Books</h1>
                <p>A look back at our reading journey</p>
            </div>

            <div class="recap-user-toggle">
                <button class="recap-toggle-btn ${this.recapUser === 'combined' ? 'active' : ''}" onclick="app.setRecapUser('combined')">${name1} &amp; ${name2}</button>
                <button class="recap-toggle-btn ${this.recapUser === 'partner1' ? 'active' : ''}" onclick="app.setRecapUser('partner1')">${this.escapeHtml(name1)}</button>
                <button class="recap-toggle-btn ${this.recapUser === 'partner2' ? 'active' : ''}" onclick="app.setRecapUser('partner2')">${this.escapeHtml(name2)}</button>
            </div>

            <div class="recap-big-stats">
                <div class="recap-big-stat animate-in">
                    <div class="big-number">${stats.totalBooks}</div>
                    <div class="big-label">Books Read</div>
                </div>
                <div class="recap-big-stat animate-in">
                    <div class="big-number">${(stats.totalPages || 0).toLocaleString()}</div>
                    <div class="big-label">Pages Read</div>
                </div>
                <div class="recap-big-stat animate-in">
                    <div class="big-number">${stats.avgPerMonth || 0}</div>
                    <div class="big-label">Books / Month</div>
                </div>
                <div class="recap-big-stat animate-in">
                    <div class="big-number">${stats.longestStreak || 0}</div>
                    <div class="big-label">Day Streak</div>
                </div>
            </div>

            <div class="recap-section">
                <h2>Highlights</h2>
                ${stats.longestBook ? `
                <div class="recap-highlight animate-in">
                    <div class="recap-highlight-label">Longest Book</div>
                    <div class="recap-highlight-value">${this.escapeHtml(stats.longestBook.title)} (${stats.longestBook.pages} pages)</div>
                </div>` : ''}
                ${stats.shortestBook ? `
                <div class="recap-highlight animate-in">
                    <div class="recap-highlight-label">Quickest Read</div>
                    <div class="recap-highlight-value">${this.escapeHtml(stats.shortestBook.title)} (${stats.shortestBook.pages} pages)</div>
                </div>` : ''}
                ${stats.highestRated ? `
                <div class="recap-highlight animate-in">
                    <div class="recap-highlight-label">Top Rated</div>
                    <div class="recap-highlight-value">${this.escapeHtml(stats.highestRated.title)} (${'&#9733;'.repeat(stats.highestRated.rating)})</div>
                </div>` : ''}
                ${topGenres.length > 0 ? `
                <div class="recap-highlight animate-in">
                    <div class="recap-highlight-label">Top Genres</div>
                    <div class="recap-highlight-value">${topGenres.map(([g, c]) => `${g} (${c})`).join(', ')}</div>
                </div>` : ''}
            </div>

            <div class="charts-grid">
                <div class="chart-card">
                    <h3>Reading Timeline</h3>
                    <div class="chart-container"><canvas id="recap-monthly-chart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>Genre Breakdown</h3>
                    <div class="chart-container"><canvas id="recap-genre-chart"></canvas></div>
                </div>
            </div>

            <div class="recap-export-section animate-in">
                <p>Save and share your year in review</p>
                <button class="btn btn-primary btn-lg" onclick="app.exportRecapImage()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Export as Image
                </button>
            </div>
        </div>`;
    }

    setRecapUser(user) {
        this.recapUser = user;
        this.navigateTo('recap');
    }

    mergeGenres(g1, g2) {
        const merged = { ...g1 };
        for (const [k, v] of Object.entries(g2)) {
            merged[k] = (merged[k] || 0) + v;
        }
        return merged;
    }

    pickShortest(a, b) {
        if (!a) return b;
        if (!b) return a;
        return a.pages < b.pages ? a : b;
    }

    async exportRecapImage() {
        const el = document.getElementById('recap-screenshot-area');
        if (!el) return;

        try {
            this.showToast('Generating image...');
            const canvas = await html2canvas(el, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
                scale: 2,
                useCORS: true,
                logging: false
            });
            const link = document.createElement('a');
            link.download = `reading-recap-${new Date().getFullYear()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            this.showToast('Image saved!');
        } catch (err) {
            this.showToast('Export failed — try a smaller view');
            console.error(err);
        }
    }

    // ==========================================
    // RENDER: DATA / BACKUP
    // ==========================================
    renderDataPage() {
        return `
        <div class="data-page">
            <div class="page-header animate-in">
                <h1>Backup &amp; Export</h1>
                <p class="page-subtitle">Keep your reading data safe</p>
            </div>

            <div class="data-card animate-in">
                <h3>Export Data</h3>
                <p>Download all your reading data as a JSON file. You can import this later to restore everything.</p>
                <button class="btn btn-primary" onclick="app.exportData()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export JSON
                </button>
            </div>

            <div class="data-card animate-in">
                <h3>Import Data</h3>
                <p>Restore from a previously exported JSON file. This will merge with existing data.</p>
                <input type="file" id="import-file" accept=".json" onchange="app.importData(event)">
                <button class="btn btn-ghost" onclick="document.getElementById('import-file').click()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import JSON
                </button>
            </div>

            <div class="data-card animate-in">
                <h3>Clear All Data</h3>
                <p>Remove all saved data. This cannot be undone! Export first as a backup.</p>
                <button class="btn btn-danger" onclick="app.clearAllData()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    Clear Everything
                </button>
            </div>
        </div>`;
    }

    exportData() {
        const data = {
            settings: this.getSettings(),
            books_partner1: this.getBooks('partner1'),
            books_partner2: this.getBooks('partner2'),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bibliotheque-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Data exported successfully');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.settings) this.saveSettings(data.settings);
                if (data.books_partner1) {
                    const existing = this.getBooks('partner1');
                    const existingIds = new Set(existing.map(b => b.id));
                    const newBooks = data.books_partner1.filter(b => !existingIds.has(b.id));
                    this.saveBooks('partner1', [...existing, ...newBooks]);
                }
                if (data.books_partner2) {
                    const existing = this.getBooks('partner2');
                    const existingIds = new Set(existing.map(b => b.id));
                    const newBooks = data.books_partner2.filter(b => !existingIds.has(b.id));
                    this.saveBooks('partner2', [...existing, ...newBooks]);
                }

                this.updateLoginNames();
                this.loadTheme();
                this.showToast(`Data imported! ${data.books_partner1?.length || 0} + ${data.books_partner2?.length || 0} books processed.`);
                if (this.currentUser) {
                    this.updateSidebarUser();
                    this.navigateTo(this.currentPage);
                }
            } catch (err) {
                this.showToast('Import failed — invalid file format');
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    clearAllData() {
        if (!confirm('Are you sure? This will delete ALL your reading data permanently.')) return;
        if (!confirm('Really? This cannot be undone. Export a backup first!')) return;

        localStorage.removeItem('biblio_settings');
        localStorage.removeItem('biblio_books_partner1');
        localStorage.removeItem('biblio_books_partner2');
        this.showToast('All data cleared');
        this.logout();
    }

    // ==========================================
    // CHARTS
    // ==========================================
    destroyCharts() {
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};
    }

    initChartsForPage(page) {
        const colors = {
            gold: '#C4A265',
            goldLight: '#D4B87A',
            teal: '#1B4D4F',
            burgundy: '#6B2D3E',
            sage: '#7A8B6F',
            rose: '#C4918A',
            plum: '#5B3A6B',
            emerald: '#2D6B4F',
            navy: '#1A2332',
        };

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#A8A29E' : '#6B6B6B';
        const gridColor = isDark ? '#2D3748' : '#E8E2D8';

        const chartDefaults = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: textColor, font: { family: 'Inter', size: 12 } }
                }
            }
        };

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if (page === 'dashboard' && this.currentUser) {
            const stats = this.getStats(this.currentUser);
            this.createMonthlyChart('monthly-chart', stats.monthlyData, months, colors, textColor, gridColor, chartDefaults);
            this.createGenreChart('genre-chart', stats.genreCounts, colors, chartDefaults);
        }

        if (page === 'joint') {
            const stats1 = this.getStats('partner1');
            const stats2 = this.getStats('partner2');
            this.createJointMonthlyChart('joint-monthly-chart', stats1, stats2, months, colors, textColor, gridColor, chartDefaults);
            const mergedGenres = this.mergeGenres(stats1.genreCounts, stats2.genreCounts);
            this.createGenreChart('joint-genre-chart', mergedGenres, colors, chartDefaults);
        }

        if (page === 'recap') {
            let monthlyData, genreCounts;
            if (this.recapUser === 'partner1') {
                const s = this.getStats('partner1');
                monthlyData = s.monthlyData;
                genreCounts = s.genreCounts;
            } else if (this.recapUser === 'partner2') {
                const s = this.getStats('partner2');
                monthlyData = s.monthlyData;
                genreCounts = s.genreCounts;
            } else {
                const s1 = this.getStats('partner1');
                const s2 = this.getStats('partner2');
                monthlyData = s1.monthlyData.map((v, i) => v + s2.monthlyData[i]);
                genreCounts = this.mergeGenres(s1.genreCounts, s2.genreCounts);
            }
            this.createMonthlyChart('recap-monthly-chart', monthlyData, months, colors, textColor, gridColor, chartDefaults);
            this.createGenreChart('recap-genre-chart', genreCounts, colors, chartDefaults);
        }
    }

    createMonthlyChart(canvasId, data, months, colors, textColor, gridColor, defaults) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Books Finished',
                    data: data,
                    backgroundColor: colors.gold + '80',
                    borderColor: colors.gold,
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                ...defaults,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                },
                plugins: {
                    ...defaults.plugins,
                    legend: { display: false }
                }
            }
        });
    }

    createGenreChart(canvasId, genreCounts, colors, defaults) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const labels = Object.keys(genreCounts);
        const data = Object.values(genreCounts);
        const palette = [colors.gold, colors.teal, colors.burgundy, colors.sage, colors.rose, colors.plum, colors.emerald, colors.navy, '#E8B4B8', '#4A9B8E', '#8B5CF6', '#F59E0B'];

        if (labels.length === 0) {
            labels.push('No data yet');
            data.push(1);
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: palette.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
                }]
            },
            options: {
                ...defaults,
                cutout: '60%',
                plugins: {
                    ...defaults.plugins,
                    legend: {
                        position: 'right',
                        labels: {
                            color: defaults.plugins.legend.labels.color,
                            font: { family: 'Inter', size: 11 },
                            padding: 12,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        }
                    }
                }
            }
        });
    }

    createJointMonthlyChart(canvasId, stats1, stats2, months, colors, textColor, gridColor, defaults) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const name1 = this.getPartnerName('partner1');
        const name2 = this.getPartnerName('partner2');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: name1,
                        data: stats1.monthlyData,
                        backgroundColor: colors.gold + '80',
                        borderColor: colors.gold,
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                    {
                        label: name2,
                        data: stats2.monthlyData,
                        backgroundColor: colors.teal + '80',
                        borderColor: colors.teal,
                        borderWidth: 1,
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                ...defaults,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    generateId() {
        return 'bk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeBookModal();
                this.closePasswordModal();
                this.closeSetup();
                this.closeCoverModal();
                this.closeSidebar();
            }
        });
    }
}

// Initialize
const app = new BibliothequeApp();
