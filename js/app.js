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
            accuracyBar: document.getElementById('accuracy-bar'),
            accuracyPercent: document.getElementById('accuracy-percent'),
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
        document.getElementById('view-analytics').classList.add('hidden');
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
                // Init progress object if missing or incomplete
                if (!set.progress) set.progress = {};
                if (!set.progress.learn) set.progress.learn = {};
                if (!set.progress.test) set.progress.test = {};

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
        } catch (e) {
            console.error(e);
            this.elements.setsContainer.innerHTML = '<p class="text-error">Error loading sets. See console.</p>';
        }
    }

    getMiniProgressBar(set) {
        if (!set.cards.length) return '';
        // Safety check
        const learnProgress = set.progress && set.progress.learn ? set.progress.learn : {};
        const learnedCount = Object.values(learnProgress).filter(s => s === 'mastered').length;
        const pct = Math.round((learnedCount / set.cards.length) * 100);
        return `<div style="height:4px; background:#e0e0e0; margin-top:1rem; border-radius:2px;"><div style="width:${pct}%; height:100%; background:var(--success); border-radius:2px;"></div></div>`;
    }

    openSet(set) {
        this.currentSet = set;
        // Re-ensure structure
        if (!this.currentSet.progress) this.currentSet.progress = {};
        if (!this.currentSet.progress.learn) this.currentSet.progress.learn = {};
        if (!this.currentSet.progress.test) this.currentSet.progress.test = {};
        if (!this.currentSet.testStats) this.currentSet.testStats = {};

        this.elements.setTitleDisplay.textContent = set.title;
        this.elements.setDescDisplay.textContent = set.description || '';
        this.elements.termCount.textContent = set.cards.length;
        this.updateMasteryUI();
        this.renderTermList(set.cards);

        // Smart Study Buttons visibility
        const unmasteredLearn = this.currentSet.cards.map((_, i) => i)
            .filter(i => this.currentSet.progress.learn[i] !== 'mastered');
        if (unmasteredLearn.length > 0) this.elements.btnLearnMissed.classList.remove('hidden');
        else this.elements.btnLearnMissed.classList.add('hidden');

        // Check if test mistakes exist
        // Simplified: just check if we have any 'wrong' entries in test progress
        // Ideally we track specific indices. For now we rely on learn progress.

        this.elements.viewDashboard.classList.add('hidden');
        document.getElementById('view-analytics').classList.add('hidden');
        this.elements.viewSet.classList.remove('hidden');
        this.switchMode('flashcards');
    }

    updateMasteryUI() {
        const total = this.currentSet.cards.length;
        const totalLearned = Object.values(this.currentSet.progress.learn).filter(s => s === 'mastered').length;
        const learnPct = total === 0 ? 0 : Math.round((totalLearned / total) * 100);
        this.elements.masteryBar.style.width = `${learnPct}%`;
        this.elements.masteryPercent.textContent = `${learnPct}%`;

        let testAttempts = 0;
        let testCorrect = 0;
        if (this.currentSet.testStats) {
            Object.values(this.currentSet.testStats).forEach(stat => {
                testAttempts += stat.totalAttempts || 0;
                testCorrect += stat.correctAttempts || 0;
            });
        }
        const testPct = testAttempts === 0 ? 0 : Math.round((testCorrect / testAttempts) * 100);
        this.elements.accuracyBar.style.width = `${testPct}%`;
        this.elements.accuracyPercent.textContent = `${testPct}%`;
    }

    /* --- Inline Edit & UI Enhancements --- */
    renderTermList(cards) {
        let html = cards.map((card, index) => {
            const status = this.currentSet.progress.learn[index];
            const statusColor = status === 'mastered' ? 'var(--success)' : (status === 'review' ? 'var(--error)' : 'transparent');

            // Generate test stats HTML
            const stats = this.currentSet.testStats && this.currentSet.testStats[index] ? this.currentSet.testStats[index] : null;
            let statsHtml = '';
            if (stats && stats.totalAttempts > 0) {
                const acc = Math.round((stats.correctAttempts / stats.totalAttempts) * 100);
                const recent = (stats.history || []).map(r => r ? '✅' : '❌').join('');
                statsHtml = `
                    <div class="card-stats">
                        <span>Accuracy: <strong>${acc}%</strong> (${stats.correctAttempts}/${stats.totalAttempts})</span>
                        <span>Recent: <strong class="stat-trend">${recent}</strong></span>
                    </div>
                `;
            } else {
                statsHtml = `<div class="card-stats"><span>No test data yet.</span></div>`;
            }

            return `
            <div class="term-item" id="term-item-${index}" style="border-left-color: ${statusColor}">
                <div class="term-item-col" style="flex: 2;">
                    <div class="term-label">Term</div>
                    <div class="term-text font-bold">${this.escapeHtml(card.term)}</div>
                    ${statsHtml}
                </div>
                <div class="term-item-col" style="flex: 3;">
                    <div class="term-label">Definition</div>
                    <div class="term-def">${this.escapeHtml(card.definition)}</div>
                </div>
                <div class="term-actions">
                    <button class="btn-icon" onclick="app.editTerm(${index})"><ion-icon name="pencil-outline"></ion-icon></button>
                </div>
            </div>`;
        }).join('');

        // Add "Add Card" button at the end of the list
        html += `
            <div class="text-center mt-4">
                <button class="btn btn-secondary" onclick="app.addNewCard()">
                    <ion-icon name="add-circle-outline" style="margin-right: 0.5rem;"></ion-icon> Add Card
                </button>
            </div>
        `;
        this.elements.termsListContainer.innerHTML = html;
    }

    async addNewCard() {
        // Prompt user quickly or just append empty? Let's append empty and enter edit mode.
        this.currentSet.cards.push({ term: "New Term", definition: "New Definition" });
        await this.saveCurrentSet(); // Save immediately to persist
        this.renderTermList(this.currentSet.cards);
        this.editTerm(this.currentSet.cards.length - 1); // Auto open edit
    }

    async deleteCard(index) {
        if (!confirm("Delete this card?")) return;
        this.currentSet.cards.splice(index, 1);
        await this.saveCurrentSet();
        this.renderTermList(this.currentSet.cards);
    }

    // Helper to save current set structure (title/desc/cards) ignoring progress update
    async saveCurrentSet() {
        await dbService.updateSet(this.currentSet.id, this.currentSet.title, this.currentSet.description, this.currentSet.cards);
    }

    editTerm(index) {
        const item = document.getElementById(`term-item-${index}`);
        const card = this.currentSet.cards[index];
        item.classList.add('editing');
        // Changed input to textarea for definition
        item.innerHTML = `
            <div class="term-item-col">
                <label class="input-label">Term</label>
                <input type="text" class="input-field term-edit-input" value="${this.escapeHtml(card.term)}">
            </div>
            <div class="term-item-col">
                <label class="input-label">Definition</label>
                <textarea class="input-field def-edit-input" rows="3">${this.escapeHtml(card.definition)}</textarea>
            </div>
            <div class="term-actions" style="flex-direction: column; gap: 0.5rem;">
                 <button class="btn btn-primary" style="padding: 0.5rem; width: 100%;" onclick="app.saveTerm(${index})">Save</button>
                 <button class="btn btn-secondary" style="padding: 0.5rem; width: 100%;" onclick="app.cancelEditTerm(${index})">Cancel</button>
                 <button class="btn btn-secondary text-error" style="padding: 0.5rem; width: 100%;" onclick="app.deleteCard(${index})"><ion-icon name="trash"></ion-icon></button>
            </div>`;
    }
    cancelEditTerm(index) { this.renderTermList(this.currentSet.cards); }
    async saveTerm(index) {
        const item = document.getElementById(`term-item-${index}`);
        const nT = item.querySelector('.term-edit-input').value.trim();
        const nD = item.querySelector('textarea.def-edit-input').value.trim();
        if (!nT || !nD) return alert("Required");
        this.currentSet.cards[index] = { term: nT, definition: nD };
        await this.saveCurrentSet();
        this.renderTermList(this.currentSet.cards);
    }

    /* --- Learn Mode & Scientific SRS V2 --- */
    startLearnSession(scope) {
        let indices = this.currentSet.cards.map((_, i) => i);
        if (scope === 'missed') {
            indices = indices.filter(i => this.currentSet.progress.learn[i] !== 'mastered');
        } else {
            // Sort by Needs Review -> New -> Mastered
            indices.sort((a, b) => {
                const sA = this.currentSet.progress.learn[a] || 'new';
                const sB = this.currentSet.progress.learn[b] || 'new';
                const rank = { 'review': 0, 'new': 1, 'mastered': 2 };
                return rank[sA] - rank[sB];
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
            this.elements.learnActive.innerHTML = `
                <div class="text-center" style="padding: 2rem;">
                    <h3>Session Complete!</h3>
                    <p class="text-secondary mt-2">Come back tomorrow to strengthen your memory!</p>
                    <button class="btn btn-primary mt-4" onclick="app.switchMode('learn')">Back to Menu</button>
                </div>`;
            return;
        }
        const cardIdx = this.learnQueue[this.learnIndex];
        const card = this.currentSet.cards[cardIdx];

        this.elements.learnQ.textContent = card.term;
        this.elements.learnQ.style.fontSize = this.autoFontSize(card.term);
        this.elements.learnA.textContent = card.definition;
        this.elements.learnA.style.fontSize = this.autoFontSize(card.definition);
        this.elements.learnCard.classList.remove('flipped');

        this.elements.learnPre.classList.remove('hidden');
        this.elements.learnPost.classList.add('hidden');

        this.elements.learnProgress.textContent = `${this.learnIndex + 1} / ${this.learnQueue.length}`;
    }

    flipLearnCard() {
        this.elements.learnCard.classList.toggle('flipped');
        if (this.elements.learnCard.classList.contains('flipped')) {
            this.elements.learnPre.classList.add('hidden');
            this.elements.learnPost.classList.remove('hidden');
        } else {
            this.elements.learnPre.classList.remove('hidden');
            this.elements.learnPost.classList.add('hidden');
        }
    }

    /* Scientific SRS Algorithm (Forgetting Curve) */
    async gradeLearnCard(known) {
        const cardIdx = this.learnQueue[this.learnIndex];
        const now = Date.now();

        // Log History
        if (!this.currentSet.history) this.currentSet.history = [];
        this.currentSet.history.push({ cardIdx, result: known ? 'correct' : 'wrong', mode: 'learn', ts: now });

        // Update SRS
        if (!this.currentSet.srs) this.currentSet.srs = {};
        let srsItem = this.currentSet.srs[cardIdx] || { interval: 0, stage: 0, dueDate: 0 };

        if (!known) {
            // Reset to Day 1
            srsItem.stage = 0;
            srsItem.interval = 0;
            srsItem.dueDate = now + (1000 * 60); // 1 min (immediate review)
            this.currentSet.progress.learn[cardIdx] = 'review';
            // Logic: if wrong, push to end of current queue to review again THIS session?
            // For simple "Forgetting curve", we just mark it.
            // But usually you want to clear it today. Let's push to queue.
            this.learnQueue.push(cardIdx);
        } else {
            // Move up the ladder: 1d -> 3d -> 7d -> 14d -> 30d
            const intervals = [1, 3, 7, 14, 30];
            let currentStage = srsItem.stage || 0;

            if (currentStage < intervals.length) {
                srsItem.interval = intervals[currentStage];
                srsItem.stage = currentStage + 1;
            } else {
                srsItem.interval = 30; // Max out at monthly
            }

            srsItem.dueDate = now + (srsItem.interval * 24 * 60 * 60 * 1000);
            this.currentSet.progress.learn[cardIdx] = 'mastered';
        }
        this.currentSet.srs[cardIdx] = srsItem;

        // Save progress Flattened
        const dataToUpdate = {
            progress: this.currentSet.progress,
            history: this.currentSet.history,
            srs: this.currentSet.srs,
            testStats: this.currentSet.testStats
        };
        dbService.updateProgress(this.currentSet.id, dataToUpdate);

        this.learnIndex++;
        this.updateMasteryUI();
        this.nextLearnCard();
    }

    /* --- Test Mode V2 (Step-by-step) --- */
    startTest(scope) {
        /* Config Reading */
        const useTF = document.getElementById('test-type-tf').checked;
        const useMC = document.getElementById('test-type-mc').checked;
        const useWritten = document.getElementById('test-type-written').checked;
        const isStrict = document.getElementById('test-strict').checked;
        const dirEl = document.querySelector('input[name="test-dir"]:checked');
        const dir = dirEl ? dirEl.value : 'term_def';
        let count = parseInt(document.getElementById('test-count').value);

        if (!useTF && !useMC && !useWritten) { alert("Select at least one type."); return; }
        this.testConfig = { useTF, useMC, useWritten, isStrict, dir };

        /* View Switching */
        this.elements.testConfig.classList.add('hidden');
        this.elements.testContainer.classList.remove('hidden');

        /* Question Generation */
        let indices = this.currentSet.cards.map((_, i) => i);
        if (scope === 'missed') {
            indices = indices.filter(i => this.currentSet.progress.learn[i] === 'review');
            if (indices.length < 1) { alert("No missed terms found!"); return this.switchMode('test'); }
        }

        const questions = this.generateQuestions(indices, count);

        // Init Test State
        this.testState = {
            questions: questions,
            currentIndex: 0,
            score: 0,
            answers: [] // { question, userCorrect, correctAns }
        };

        this.renderTestQuestion();
    }

    generateQuestions(indices, count) {
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

    renderTestQuestion() {
        const q = this.testState.questions[this.testState.currentIndex];

        // Progress Indicator
        let html = `
            <div class="flex justify-between items-center mb-4 text-secondary">
                <span>Question ${this.testState.currentIndex + 1} of ${this.testState.questions.length}</span>
                <span>Type: ${q.type.toUpperCase()}</span>
            </div>
            <div class="test-question active" style="margin-bottom: 2rem;">
                <h2 class="font-bold mb-6" style="font-size: 1.5rem;">${this.escapeHtml(q.qText)}</h2>
        `;

        // Render Options based on type
        if (q.type === 'mc') {
            html += `<div class="test-options">`;
            q.options.forEach((opt, idx) => {
                html += `<div class="test-option" id="opt-${idx}">${this.escapeHtml(opt)}</div>`;
            });
            html += `</div>`;
        } else if (q.type === 'tf') {
            html += `
                <div class="mb-4 text-xl">Is this: <strong>${this.escapeHtml(q.displayA)}</strong>?</div>
                <div class="tf-options">
                    <div class="tf-btn true" id="btn-true">True</div>
                    <div class="tf-btn false" id="btn-false">False</div>
                </div>`;
        } else if (q.type === 'written') {
            html += `
                <div>
                    <textarea class="input-field answer-input mb-4" rows="3" placeholder="Type your answer..."></textarea>
                    <button class="btn btn-primary" id="btn-submit">Submit Answer</button>
                    <button class="btn btn-secondary" id="btn-dontknow">Don't Know</button>
                </div>`;
        }

        html += `<div class="test-feedback mt-4"></div></div>`;
        this.elements.testContainer.innerHTML = html;

        // Bind Events manually to avoid string injection issues
        if (q.type === 'mc') {
            q.options.forEach((opt, idx) => {
                document.getElementById(`opt-${idx}`).onclick = (e) => this.handleMC(e.target, opt === q.aText);
            });
        } else if (q.type === 'tf') {
            document.getElementById('btn-true').onclick = (e) => this.handleTF(e.target, q.isTrue, true);
            document.getElementById('btn-false').onclick = (e) => this.handleTF(e.target, q.isTrue, false);
        } else if (q.type === 'written') {
            const input = this.elements.testContainer.querySelector('.answer-input');
            document.getElementById('btn-submit').onclick = () => this.handleWritten(input.value, q.aText);
            document.getElementById('btn-dontknow').onclick = () => this.handleWritten("", q.aText);
            input.focus();
        }
    }

    /* Test Handlers */
    async handleMC(el, isCorrect) {
        if (el.classList.contains('correct') || el.classList.contains('incorrect')) return; // already answered

        if (isCorrect) el.classList.add('correct');
        else el.classList.add('incorrect');

        await this.processAnswer(isCorrect, isCorrect ? "Correct!" : "Incorrect.");
    }

    async handleTF(el, expected, actual) {
        const isCorrect = expected === actual;
        if (isCorrect) el.style.background = '#e6fbf2';
        else el.style.background = '#ffebeb';

        await this.processAnswer(isCorrect, isCorrect ? "Correct!" : "Incorrect.");
    }

    async handleWritten(userVal, correctVal) {
        let isCorrect = false;
        const ua = userVal.trim();
        if (this.testConfig.isStrict) isCorrect = ua === correctVal;
        else isCorrect = this.levenshtein(ua.toLowerCase(), correctVal.toLowerCase()) <= 2;

        const feedback = isCorrect ? "Correct!" : `Incorrect. Answer: ${correctVal}`;
        await this.processAnswer(isCorrect, feedback);
    }

    async processAnswer(isCorrect, feedbackText) {
        const fbEl = this.elements.testContainer.querySelector('.test-feedback');
        fbEl.innerHTML = `<span class="${isCorrect ? 'text-success' : 'text-error'} font-bold">${feedbackText}</span>`;

        // Save Result
        const q = this.testState.questions[this.testState.currentIndex];
        this.testState.answers.push({ q, isCorrect });
        if (isCorrect) this.testState.score++;

        // Log to Global History
        this.recordResult(q.idx, isCorrect);

        // Wait a moment then nex
        setTimeout(() => {
            this.testState.currentIndex++;
            if (this.testState.currentIndex < this.testState.questions.length) {
                this.renderTestQuestion();
            } else {
                this.renderTestResults();
            }
        }, 1500);
    }

    renderTestResults() {
        // Save Progress
        dbService.updateProgress(this.currentSet.id, {
            progress: this.currentSet.progress,
            history: this.currentSet.history,
            srs: this.currentSet.srs,
            testStats: this.currentSet.testStats
        });

        const pct = Math.round((this.testState.score / this.testState.questions.length) * 100);
        let msg = pct >= 80 ? "Great job!" : "Keep practicing!";

        let html = `
            <div class="text-center" style="padding: 2rem;">
                <h2 class="font-bold mb-2">Test Complete</h2>
                <div style="font-size: 3rem; font-weight: 800; color: var(--primary); margin: 1rem 0;">${pct}%</div>
                <p class="text-secondary mb-6">${msg}</p>
                
                <div class="flex justify-center gap-4">
                     <button class="btn btn-secondary" onclick="app.switchMode('test')">New Test</button>
                     <button class="btn btn-primary" onclick="app.startTest('missed')">Retest Incorrect</button>
                </div>
            </div>
        `;
        this.elements.testContainer.innerHTML = html;
        this.updateMasteryUI();
    }

    recordResult(cardIdx, correct) {
        if (!this.currentSet.history) this.currentSet.history = [];
        this.currentSet.history.push({
            cardIdx,
            result: correct ? 'correct' : 'wrong',
            mode: 'test',
            ts: Date.now()
        });

        if (!this.currentSet.testStats) this.currentSet.testStats = {};
        if (!this.currentSet.testStats[cardIdx]) {
            this.currentSet.testStats[cardIdx] = {
                totalAttempts: 0,
                correctAttempts: 0,
                history: []
            };
        }

        let stat = this.currentSet.testStats[cardIdx];
        stat.totalAttempts++;
        if (correct) stat.correctAttempts++;
        stat.history.push(correct);
        if (stat.history.length > 5) stat.history.shift(); // Keep last 5
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
    autoFontSize(text) {
        const len = text ? text.length : 0;
        if (len < 30) return '2rem';
        if (len < 80) return '1.5rem';
        if (len < 150) return '1.25rem';
        return '1rem';
    }

    initFlashcards() { this.currentCardIndex = 0; this.updateFlashcard(); }
    updateFlashcard() {
        const card = this.currentSet.cards[this.currentCardIndex];
        this.elements.cardTerm.textContent = card.term;
        this.elements.cardTerm.style.fontSize = this.autoFontSize(card.term);
        this.elements.cardDef.textContent = card.definition;
        this.elements.cardDef.style.fontSize = this.autoFontSize(card.definition);
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
         <div style="flex:1"><label class="input-label">Definition</label><textarea class="input-field def-input" rows="3">${this.escapeHtml(d)}</textarea></div>
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
                set.history.forEach(h => recentLogs.push({ ...h, setName: set.title }));
            }
            if (set.srs) {
                const dueCount = Object.values(set.srs).filter(item => item.dueDate < Date.now()).length;
                if (dueCount > 0) dueSets.push({ title: set.title, count: dueCount, set });
            }
        });
        recentLogs.sort((a, b) => b.ts - a.ts);
        document.getElementById('stat-reviews').textContent = totalReviews;
        document.getElementById('stat-accuracy').textContent = totalReviews ? Math.round((correctCount / totalReviews) * 100) + '%' : '0%';
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
        const recContainer = document.getElementById('analytics-recommendations');
        if (dueSets.length === 0) recContainer.innerHTML = '<div class="text-center p-4 bg-white rounded"><p>All caught up! Great job.</p></div>';
        else recContainer.innerHTML = dueSets.map(item => `<div class="set-card" onclick="app.openSetById('${item.set.id}')"><div class="set-title">${this.escapeHtml(item.title)}</div><div class="text-error font-bold">${item.count} due for review</div></div>`).join('');
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
            srs: this.currentSet.srs,
            testStats: this.currentSet.testStats
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

        if (!this.currentSet.testStats) this.currentSet.testStats = {};
        if (!this.currentSet.testStats[cardIdx]) {
            this.currentSet.testStats[cardIdx] = { totalAttempts: 0, correctAttempts: 0, history: [] };
        }
        let stat = this.currentSet.testStats[cardIdx];
        stat.totalAttempts++;
        if (correct) stat.correctAttempts++;
        stat.history.push(correct);
        if (stat.history.length > 5) stat.history.shift();
    }

    // Override init to ensure history/srs exists
    async init() {
        await this.loadSets();
    }
}

window.app = new App();
