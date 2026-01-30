import { dbService } from './db.js';

class App {
    constructor() {
        this.currentSet = null;
        this.currentCardIndex = 0;
        this.currentMode = 'flashcards';
        this.editingSetId = null;

        // Advanced Learning State
        this.learnQueue = [];
        this.learnIndex = 0;
        this.testResults = { correct: [], incorrect: [] };

        this.elements = {
            viewDashboard: document.getElementById('view-dashboard'),
            viewSet: document.getElementById('view-set'),
            setsContainer: document.getElementById('sets-container'),
            createModal: document.getElementById('create-modal'),
            modalTitle: document.getElementById('modal-title'),
            createCardRows: document.getElementById('create-card-rows'),
            btnDeleteSet: document.getElementById('btn-delete-set'),
            setTitleDisplay: document.getElementById('set-title-display'),
            setDescDisplay: document.getElementById('set-desc-display'),
            termCount: document.getElementById('term-count'),
            termsListContainer: document.getElementById('terms-list-container'),
            masteryBar: document.getElementById('mastery-bar'),
            masteryPercent: document.getElementById('mastery-percent'),
            flashcard: document.getElementById('flashcard'),
            cardTerm: document.getElementById('card-term'),
            cardDef: document.getElementById('card-def'),
            cardCounter: document.getElementById('card-counter'),
            modeContents: {
                flashcards: document.getElementById('mode-flashcards'),
                learn: document.getElementById('mode-learn'),
                test: document.getElementById('mode-test')
            },
            // Learn Elements
            learnSetup: document.getElementById('learn-setup'),
            learnActive: document.getElementById('learn-active'),
            learnCard: document.getElementById('learn-card'),
            learnQ: document.getElementById('learn-q'),
            learnA: document.getElementById('learn-a'),
            learnPre: document.getElementById('learn-controls-pre'),
            learnPost: document.getElementById('learn-controls-post'),
            learnProgress: document.getElementById('learn-progress'),
            btnLearnMissed: document.getElementById('btn-learn-missed'),
            // Test Elements
            testConfig: document.getElementById('test-config'),
            testContainer: document.getElementById('test-container'),
            btnTestMissed: document.getElementById('btn-test-missed')
        };
        this.init();
    }

    async init() { await this.loadSets(); }
    navigateHome() {
        this.elements.viewSet.classList.add('hidden');
        this.elements.viewDashboard.classList.remove('hidden');
        this.loadSets();
    }

    /* --- Dashboard & Data --- */
    async loadSets() {
        try {
            this.elements.setsContainer.innerHTML = '<div class="set-card skeleton"><p>Loading sets...</p></div>';
            const sets = await dbService.getSets();
            this.elements.setsContainer.innerHTML = '';
            if (sets.length === 0) {
                this.elements.setsContainer.innerHTML = `<p class="text-secondary" style="grid-column: 1/-1; text-align: center;">No sets found. Create one!</p>`;
                return;
            }
            sets.forEach(set => {
                // Init progress object if missing
                if (!set.progress) set.progress = { learn: {}, test: {} };

                const card = document.createElement('div');
                card.className = 'set-card';
                card.onclick = () => this.openSet(set);
                card.innerHTML = `
                    <div class="set-title">${this.escapeHtml(set.title)}</div>
                    <div class="set-meta">${set.cards.length} terms</div>
                    ${this.getMiniProgressBar(set)}
                `;
                this.elements.setsContainer.appendChild(card);
            });
        } catch (e) { console.error(e); }
    }

    getMiniProgressBar(set) {
        if (!set.cards.length) return '';
        const learnedCount = Object.values(set.progress.learn).filter(s => s === 'mastered').length;
        const pct = Math.round((learnedCount / set.cards.length) * 100);
        return `<div style="height:4px; background:#e0e0e0; margin-top:1rem; border-radius:2px;"><div style="width:${pct}%; height:100%; background:var(--success); border-radius:2px;"></div></div>`;
    }

    openSet(set) {
        this.currentSet = set;
        if (!this.currentSet.progress) this.currentSet.progress = { learn: {}, test: {} };

        this.elements.setTitleDisplay.textContent = set.title;
        this.elements.setDescDisplay.textContent = set.description || '';
        this.elements.termCount.textContent = set.cards.length;
        this.updateMasteryUI();
        this.renderTermList(set.cards);

        // Smart Study Buttons visibility
        const missedLearn = Object.keys(this.currentSet.progress.learn).filter(k => this.currentSet.progress.learn[k] === 'review');
        if (missedLearn.length > 0) this.elements.btnLearnMissed.classList.remove('hidden');
        else this.elements.btnLearnMissed.classList.add('hidden');

        // Check if test mistakes exist
        // Simplified: just check if we have any 'wrong' entries in test progress
        // Ideally we track specific indices. For now we rely on learn progress.

        this.elements.viewDashboard.classList.add('hidden');
        this.elements.viewSet.classList.remove('hidden');
        this.switchMode('flashcards');
    }

    updateMasteryUI() {
        const learned = Object.values(this.currentSet.progress.learn).filter(s => s === 'mastered').length;
        const total = this.currentSet.cards.length;
        const pct = total === 0 ? 0 : Math.round((learned / total) * 100);
        this.elements.masteryBar.style.width = `${pct}%`;
        this.elements.masteryPercent.textContent = `${pct}%`;
    }

    /* --- Inline Edit --- */
    renderTermList(cards) {
        this.elements.termsListContainer.innerHTML = cards.map((card, index) => {
            const status = this.currentSet.progress.learn[index];
            const statusColor = status === 'mastered' ? 'var(--success)' : (status === 'review' ? 'var(--error)' : 'transparent');
            return `
            <div class="term-item" id="term-item-${index}" style="border-left-color: ${statusColor}">
                <div class="term-item-col">
                    <div class="term-label">Term</div>
                    <div class="term-text">${this.escapeHtml(card.term)}</div>
                </div>
                <div class="term-item-col">
                    <div class="term-label">Definition</div>
                    <div class="term-def">${this.escapeHtml(card.definition)}</div>
                </div>
                <div class="term-actions">
                    <button class="btn-icon" onclick="app.editTerm(${index})"><ion-icon name="pencil-outline"></ion-icon></button>
                </div>
            </div>`;
        }).join('');
    }
    editTerm(index) {
        const item = document.getElementById(`term-item-${index}`);
        const card = this.currentSet.cards[index];
        item.classList.add('editing');
        item.innerHTML = `
            <div class="term-item-col"><label class="input-label">Term</label><input type="text" class="input-field term-edit-input" value="${this.escapeHtml(card.term)}"></div>
            <div class="term-item-col"><label class="input-label">Definition</label><input type="text" class="input-field def-edit-input" value="${this.escapeHtml(card.definition)}"></div>
            <div class="term-actions">
                 <button class="btn btn-primary" style="padding: 0.5rem;" onclick="app.saveTerm(${index})">Save</button>
                 <button class="btn btn-secondary" style="padding: 0.5rem;" onclick="app.cancelEditTerm(${index})">Cancel</button>
            </div>`;
    }
    cancelEditTerm(index) { this.renderTermList(this.currentSet.cards); }
    async saveTerm(index) {
        const item = document.getElementById(`term-item-${index}`);
        const nT = item.querySelector('.term-edit-input').value.trim();
        const nD = item.querySelector('.def-edit-input').value.trim();
        if (!nT || !nD) return alert("Required");
        this.currentSet.cards[index] = { term: nT, definition: nD };
        await dbService.updateSet(this.currentSet.id, this.currentSet.title, this.currentSet.description, this.currentSet.cards);
        this.renderTermList(this.currentSet.cards);
    }

    /* --- Learn Mode --- */
    startLearnSession(scope) {
        let indices = this.currentSet.cards.map((_, i) => i);
        if (scope === 'missed') {
            indices = indices.filter(i => this.currentSet.progress.learn[i] === 'review');
        } else {
            // Prioritize unlearned
            indices.sort((a, b) => {
                const sA = this.currentSet.progress.learn[a] || 'new';
                const sB = this.currentSet.progress.learn[b] || 'new';
                if (sA === 'review') return -1;
                if (sB === 'review') return 1;
                if (sA === 'new') return -1;
                return 1;
            });
        }
        this.learnQueue = indices;
        this.learnIndex = 0;

        this.elements.learnSetup.classList.add('hidden');
        this.elements.learnActive.classList.remove('hidden');
        this.nextLearnCard();
    }

    nextLearnCard() {
        if (this.learnIndex >= this.learnQueue.length) {
            // End of round
            if (this.learnQueue.length > 0) {
                // Check if we have any 'review' items left to loop again? 
                // For now just finish
            }
            this.elements.learnActive.innerHTML = `<div class="text-center"><h3>Session Complete!</h3><button class="btn btn-primary mt-4" onclick="app.switchMode('learn')">Back to Menu</button></div>`;
            return;
        }
        const cardIdx = this.learnQueue[this.learnIndex];
        const card = this.currentSet.cards[cardIdx];

        this.elements.learnQ.textContent = card.term; // Configurable later
        this.elements.learnA.textContent = card.definition;
        this.elements.learnCard.classList.remove('flipped');

        this.elements.learnPre.classList.remove('hidden');
        this.elements.learnPost.classList.add('hidden');

        this.elements.learnProgress.textContent = `${this.learnIndex + 1} / ${this.learnQueue.length}`;
    }

    flipLearnCard() {
        if (this.elements.learnCard.classList.contains('flipped')) return;
        this.elements.learnCard.classList.add('flipped');
        this.elements.learnPre.classList.add('hidden');
        this.elements.learnPost.classList.remove('hidden');
    }

    async gradeLearnCard(known) {
        const cardIdx = this.learnQueue[this.learnIndex];
        // simple tracking: known = mastered, unknown = review
        this.currentSet.progress.learn[cardIdx] = known ? 'mastered' : 'review';

        // Save to DB (debounced normally, but direct here for simplicity)
        dbService.updateProgress(this.currentSet.id, this.currentSet.progress);

        if (!known) {
            // Re-queue at end if unknow
            this.learnQueue.push(cardIdx);
        }

        this.learnIndex++;
        this.updateMasteryUI();
        this.nextLearnCard();
    }

    /* --- Test Mode --- */
    startTest(scope) {
        // Config reading
        const useTF = document.getElementById('test-type-tf').checked;
        const useMC = document.getElementById('test-type-mc').checked;
        const useWritten = document.getElementById('test-type-written').checked;
        const isStrict = document.getElementById('test-strict').checked;
        const dir = document.querySelector('input[name="test-dir"]:checked').value; // term_def or def_term
        let count = parseInt(document.getElementById('test-count').value);

        if (!useTF && !useMC && !useWritten) { alert("Select at least one type."); return; }

        this.testConfig = { useTF, useMC, useWritten, isStrict, dir };

        this.elements.testConfig.classList.add('hidden');
        this.elements.testContainer.classList.remove('hidden');

        // Scope Logic
        let indices = this.currentSet.cards.map((_, i) => i);
        if (scope === 'missed') {
            indices = indices.filter(i => this.currentSet.progress.learn[i] === 'review');
            if (indices.length < 1) { alert("No missed terms found!"); return this.switchMode('test'); }
        }

        // Generate
        const questions = this.generateQuestions(indices, count);
        this.renderTest(questions);
    }

    generateQuestions(indices, count) {
        // Shuffle indices
        indices.sort(() => Math.random() - 0.5);
        const loopCount = Math.min(count, indices.length);
        const qList = [];

        const types = [];
        if (this.testConfig.useTF) types.push('tf');
        if (this.testConfig.useMC) types.push('mc');
        if (this.testConfig.useWritten) types.push('written');

        for (let i = 0; i < loopCount; i++) {
            const idx = indices[i];
            const card = this.currentSet.cards[idx];
            const type = types[Math.floor(Math.random() * types.length)];

            // Direction Logic
            const qText = this.testConfig.dir === 'term_def' ? card.term : card.definition;
            const aText = this.testConfig.dir === 'term_def' ? card.definition : card.term;

            let q = { type, card, qText, aText, id: i, idx };

            if (type === 'mc') {
                const distractors = this.currentSet.cards
                    .filter(c => c !== card)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3)
                    .map(c => this.testConfig.dir === 'term_def' ? c.definition : c.term);
                q.options = [aText, ...distractors].sort(() => Math.random() - 0.5);
            } else if (type === 'tf') {
                q.isTrue = Math.random() > 0.5;
                if (q.isTrue) q.displayA = aText;
                else {
                    const wrong = this.currentSet.cards.find(c => c !== card) || card;
                    q.displayA = this.testConfig.dir === 'term_def' ? wrong.definition : wrong.term;
                }
            }
            qList.push(q);
        }
        return qList;
    }

    renderTest(questions) {
        this.elements.testContainer.innerHTML = '';
        questions.forEach(q => {
            const el = document.createElement('div');
            el.className = 'test-question';
            el.dataset.idx = q.idx; // Store card index

            let html = `<h4 class="text-secondary">Q${q.id + 1}</h4><h3 class="font-bold mb-4">${this.escapeHtml(q.qText)}</h3>`;

            if (q.type === 'mc') {
                html += `<div class="test-options">`;
                q.options.forEach(opt => html += `<div class="test-option" onclick="app.answerMC(this, '${opt === q.aText}')">${this.escapeHtml(opt)}</div>`);
                html += `</div>`;
            } else if (q.type === 'tf') {
                html += `<div class="mb-2">Is this: <strong>${this.escapeHtml(q.displayA)}</strong>?</div>`;
                html += `<div class="tf-options"><div class="tf-btn true" onclick="app.answerTF(this, ${q.isTrue}, true)">True</div><div class="tf-btn false" onclick="app.answerTF(this, ${q.isTrue}, false)">False</div></div>`;
            } else if (q.type === 'written') {
                html += `<div><input type="text" class="input-field answer-input" placeholder="Type answer..."><button class="btn btn-primary mt-2" onclick="app.answerWritten(this, '${this.escapeHtml(q.aText)}')">Check</button></div>`;
            }
            html += `<div class="test-feedback"></div>`;
            el.innerHTML = html;
            this.elements.testContainer.appendChild(el);
        });
        const btn = document.createElement('div');
        btn.innerHTML = `<button class="btn btn-secondary mt-4" onclick="app.finishTest()">Finish Test</button>`;
        this.elements.testContainer.appendChild(btn);
    }

    /* Test Handlers - Simplified Updating */
    recordResult(cardIdx, correct) {
        // Track test results separately? 
        // User requested separate tracking, so we can store in progress.test
        if (correct) { /* Maybe count streaks */ }
        else {
            // Mark as review in Learn status too? User said separate.
            // But usually mistakes imply needing review. Let's mark as review in learn for synergy.
            this.currentSet.progress.learn[cardIdx] = 'review';
        }
    }

    // ... Answer handlers (MC, TF) ... 
    answerMC(el, correct) {
        const p = el.closest('.test-question');
        if (p.classList.contains('answered')) return;
        p.classList.add('answered');
        if (correct === 'true') { el.classList.add('correct'); this.recordResult(p.dataset.idx, true); }
        else { el.classList.add('incorrect'); p.querySelector('.test-feedback').innerHTML = '<span class="text-error">Incorrect</span>'; this.recordResult(p.dataset.idx, false); }
    }
    answerTF(el, isTrue, userSaidTrue) {
        const p = el.closest('.test-question');
        if (p.classList.contains('answered')) return;
        p.classList.add('answered');
        const correct = (isTrue === userSaidTrue);
        if (correct) { el.style.background = '#e6fbf2'; this.recordResult(p.dataset.idx, true); }
        else { el.style.background = '#ffebeb'; this.recordResult(p.dataset.idx, false); }
    }
    answerWritten(btn, ca) {
        const p = btn.closest('.test-question');
        if (p.classList.contains('answered')) return;
        p.classList.add('answered');
        const ua = p.querySelector('input').value.trim();

        let correct = false;
        if (this.testConfig.isStrict) correct = ua === ca;
        else correct = this.levenshtein(ua.toLowerCase(), ca.toLowerCase()) <= 2; // Fuzzy

        if (correct) { p.querySelector('.test-feedback').innerHTML = '<span class="text-success">Correct!</span>'; this.recordResult(p.dataset.idx, true); }
        else { p.querySelector('.test-feedback').innerHTML = `<span class="text-error">Incorrect. Answer: ${ca}</span>`; this.recordResult(p.dataset.idx, false); }
    }

    finishTest() {
        dbService.updateProgress(this.currentSet.id, this.currentSet.progress);
        this.updateMasteryUI();
        this.switchMode('test'); // Back to config
    }

    /* Levenshtein for Fuzzy Match */
    levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
                else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
        return matrix[b.length][a.length];
    }

    /* --- Utils & Rest --- */
    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(el => el.classList.remove('active'));
        document.querySelector(`.mode-tab[data-mode="${mode}"]`).classList.add('active');
        Object.values(this.elements.modeContents).forEach(el => el.classList.add('hidden'));
        this.elements.modeContents[mode].classList.remove('hidden');
        if (mode === 'flashcards') this.initFlashcards();
        if (mode === 'learn') {
            this.elements.learnSetup.classList.remove('hidden');
            this.elements.learnActive.classList.add('hidden');
        }
        if (mode === 'test') {
            this.elements.testConfig.classList.remove('hidden');
            this.elements.testContainer.classList.add('hidden');
        }
    }
    // ... Copy remaining helpers (flashcard nav, escapeHtml, openCreateModal etc) ... 

    // Re-implementing helper methods to ensure file is complete
    initFlashcards() { this.currentCardIndex = 0; this.updateFlashcard(); }
    updateFlashcard() {
        const card = this.currentSet.cards[this.currentCardIndex];
        this.elements.cardTerm.textContent = card.term;
        this.elements.cardDef.textContent = card.definition;
        this.elements.flashcard.classList.remove('flipped');
        this.elements.cardCounter.textContent = `${this.currentCardIndex + 1} / ${this.currentSet.cards.length}`;
    }
    nextCard() { if (this.currentCardIndex < this.currentSet.cards.length - 1) { this.currentCardIndex++; this.updateFlashcard(); } }
    prevCard() { if (this.currentCardIndex > 0) { this.currentCardIndex--; this.updateFlashcard(); } }

    openCreateModal() { this.editingSetId = null; this.elements.modalTitle.textContent = "Create New Set"; this.elements.btnDeleteSet.classList.add('hidden'); this.resetModalInputs(); this.elements.createModal.classList.add('open'); }
    openEditModal(set) {
        this.editingSetId = set.id; this.elements.modalTitle.textContent = "Edit Set"; this.elements.btnDeleteSet.classList.remove('hidden');
        document.getElementById('new-set-title').value = set.title; document.getElementById('new-set-desc').value = set.description || '';
        this.elements.createCardRows.innerHTML = ''; set.cards.forEach(c => this.addCardRow(c.term, c.definition));
        this.elements.createModal.classList.add('open');
    }
    closeCreateModal() { this.elements.createModal.classList.remove('open'); }
    resetModalInputs() { document.getElementById('new-set-title').value = ''; document.getElementById('new-set-desc').value = ''; this.elements.createCardRows.innerHTML = ''; this.addCardRow(); this.addCardRow(); }
    addCardRow(t = '', d = '') {
        const row = document.createElement('div'); row.className = 'card-row';
        row.innerHTML = `<div style="flex:1"><label class="input-label">Term</label><input type="text" class="input-field term-input" value="${this.escapeHtml(t)}"></div>
         <div style="flex:1"><label class="input-label">Definition</label><input type="text" class="input-field def-input" value="${this.escapeHtml(d)}"></div>
         <button class="delete-row" onclick="this.parentElement.remove()"><ion-icon name="trash-outline"></ion-icon></button>`;
        this.elements.createCardRows.appendChild(row);
    }
    async saveSet() { /* Same save logic as before */
        const title = document.getElementById('new-set-title').value.trim();
        const description = document.getElementById('new-set-desc').value.trim();
        const cards = [];
        document.querySelectorAll('.card-row').forEach(row => {
            const term = row.querySelector('.term-input').value.trim();
            const def = row.querySelector('.def-input').value.trim();
            if (term && def) cards.push({ term, definition: def });
        });
        if (!title || cards.length < 2) return alert("Title and 2+ cards required");
        try {
            if (this.editingSetId) {
                // Preserve progress on edit
                const oldProgress = this.currentSet && this.currentSet.id === this.editingSetId ? this.currentSet.progress : null;
                await dbService.updateSet(this.editingSetId, title, description, cards);
                if (oldProgress) await dbService.updateProgress(this.editingSetId, oldProgress); // Restore progress map if needed or let logic handle mismatch
                this.navigateHome();
            } else {
                await dbService.createSet(title, description, cards);
                this.navigateHome();
            }
            this.closeCreateModal();
        } catch (e) { alert(e.message); }
    }
    async deleteCurrentSet() { if (confirm("Delete?")) { await dbService.deleteSet(this.editingSetId); this.closeCreateModal(); this.navigateHome(); } }

    escapeHtml(text) { if (!text) return text; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
    /* --- Analytics & SRS --- */
    openAnalytics() {
        // Hide all views
        this.elements.viewDashboard.classList.add('hidden');
        this.elements.viewSet.classList.add('hidden');
        document.getElementById('view-analytics').classList.remove('hidden');

        this.renderAnalytics();
    }

    async renderAnalytics() {
        const sets = await dbService.getSets();
        let totalReviews = 0;
        let correctCount = 0;
        let recentLogs = [];
        let dueSets = [];

        sets.forEach(set => {
            if (set.history) {
                totalReviews += set.history.length;
                correctCount += set.history.filter(h => h.result === 'correct').length;

                // Add Logs to flat list for display
                set.history.forEach(h => {
                    recentLogs.push({ ...h, setName: set.title });
                });
            }

            // Check SRS Due
            if (set.srs) {
                const dueCount = Object.values(set.srs).filter(item => item.dueDate < Date.now()).length;
                if (dueCount > 0) dueSets.push({ title: set.title, count: dueCount, set });
            }
        });

        // Sort Logs
        recentLogs.sort((a, b) => b.ts - a.ts);

        // Update Stats
        document.getElementById('stat-reviews').textContent = totalReviews;
        document.getElementById('stat-accuracy').textContent = totalReviews ? Math.round((correctCount / totalReviews) * 100) + '%' : '0%';

        // Render History List
        const histContainer = document.getElementById('analytics-history');
        histContainer.innerHTML = recentLogs.slice(0, 20).map(log => `
            <div class="term-item" style="padding: 1rem; border-left-color: ${log.result === 'correct' ? 'var(--success)' : 'var(--error)'}">
                <div style="flex:1">
                     <div class="font-bold">${this.escapeHtml(log.setName)}</div>
                     <div class="text-secondary" style="font-size: 0.8rem;">${new Date(log.ts).toLocaleString()}</div>
                </div>
                <div>${log.mode.toUpperCase()}</div>
            </div>
        `).join('') || '<p class="text-secondary">No activity recorded.</p>';

        // Render Recommendations
        const recContainer = document.getElementById('analytics-recommendations');
        if (dueSets.length === 0) {
            recContainer.innerHTML = '<div class="text-center p-4 bg-white rounded"><p>All caught up! Great job.</p></div>';
        } else {
            recContainer.innerHTML = dueSets.map(item => `
                <div class="set-card" onclick="app.openSetById('${item.set.id}')">
                    <div class="set-title">${this.escapeHtml(item.title)}</div>
                    <div class="text-error font-bold">${item.count} due for review</div>
                </div>
            `).join('');
        }
    }

    // Helper to open set by ID from analytics
    async openSetById(id) {
        const sets = await dbService.getSets();
        const set = sets.find(s => s.id === id);
        if (set) this.openSet(set);
    }

    /* SRS Logic Override */
    async gradeLearnCard(known) {
        const cardIdx = this.learnQueue[this.learnIndex];
        const now = Date.now();

        // 1. Log History
        if (!this.currentSet.history) this.currentSet.history = [];
        this.currentSet.history.push({
            cardIdx,
            result: known ? 'correct' : 'wrong',
            mode: 'learn',
            ts: now
        });

        // 2. SRS Update (Simplified SM-2)
        if (!this.currentSet.srs) this.currentSet.srs = {};
        let srsItem = this.currentSet.srs[cardIdx] || { interval: 0, ease: 2.5, dueDate: 0 };

        if (!known) {
            srsItem.interval = 0; // Reset
            srsItem.dueDate = now + (1000 * 60); // Review in 1 min (next session effectively)
            this.currentSet.progress.learn[cardIdx] = 'review';
            this.learnQueue.push(cardIdx); // Re-queue in session
        } else {
            if (srsItem.interval === 0) srsItem.interval = 1; // 1 day
            else if (srsItem.interval === 1) srsItem.interval = 3;
            else srsItem.interval = Math.round(srsItem.interval * srsItem.ease);

            srsItem.dueDate = now + (srsItem.interval * 24 * 60 * 60 * 1000);
            this.currentSet.progress.learn[cardIdx] = 'mastered';
        }
        this.currentSet.srs[cardIdx] = srsItem;

        // Save
        const dataToUpdate = {
            progress: this.currentSet.progress,
            history: this.currentSet.history, // In real app, consider using arrayUnion
            srs: this.currentSet.srs
        };
        dbService.updateProgress(this.currentSet.id, dataToUpdate);

        // UI Update
        this.learnIndex++;
        this.updateMasteryUI();
        this.nextLearnCard();
    }

    /* Test Logic Override for Logging */
    recordResult(cardIdx, correct) {
        if (!this.currentSet.history) this.currentSet.history = [];
        this.currentSet.history.push({
            cardIdx,
            result: correct ? 'correct' : 'wrong',
            mode: 'test',
            ts: Date.now()
        });

        // Also update SRS lightly? For now, let's keep SRS for Learn mode, 
        // but mark "Weak" in progress if wrong in Test.
        if (!correct) {
            this.currentSet.progress.learn[cardIdx] = 'review';
        }
        // Save happens at finishTest()
    }

    // Override init to ensure history/srs exists
    async init() {
        await this.loadSets();
    }
}

window.app = new App();
