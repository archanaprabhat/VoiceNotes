
class Timer {
    constructor(displayElement) {
        this.displayElement = displayElement;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.interval = null;
    }

    start() {
        this.startTime = Date.now() - this.elapsedTime;
        this.interval = setInterval(() => this.update(), 100);
    }

    stop() {
        clearInterval(this.interval);
        this.elapsedTime = Date.now() - this.startTime;
    }

    reset() {
        this.stop();
        this.elapsedTime = 0;
        this.updateDisplay(0);
    }

    update() {
        const currentElapsed = Date.now() - this.startTime;
        this.updateDisplay(currentElapsed);
    }

    updateDisplay(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        this.displayElement.textContent = `${this.pad(m)}:${this.pad(s)}`;
    }

    pad(num) {
        return num.toString().padStart(2, '0');
    }

    getDurationString() {
        return this.displayElement.textContent;
    }
}


class StorageManager {
    static get DB_NAME() { return 'VoiceNotesDB'; }
    static get STORE_NAME() { return 'recordings'; }
    static get DB_VERSION() { return 1; }

    static async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onerror = (e) => reject(`Database error: ${e.target.error}`);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
        });
    }

    static async saveRecord(record) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

     static async updateRecord(id, updates) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (record) {
                    Object.assign(record, updates);
                    const updateRequest = store.put(record);
                    updateRequest.onsuccess = () => resolve(record);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Record not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    static async deleteRecord(id) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }


    static async getAllRecordings() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.STORE_NAME], 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result;
                results.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

class ToastManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${message}</span>`;
        this.container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}


class VoiceRecorder {
    constructor() {
        this.toastManager = new ToastManager();
        this.state = 'IDLE';
        this.isMenuExpanded = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.saveOnStop = false;

        this.cacheDOM();
        this.timer = new Timer(this.dom.timerDisplay);
        this.bindEvents();
        this.renderNotesList();
    }

    cacheDOM() {
        this.dom = {
            recordBtn: document.getElementById('record-btn'),
            idleView: document.getElementById('idle-view'),
            recordingView: document.getElementById('recording-view'),
            chevronBtn: document.getElementById('chevron-btn'),
            chevronUp: document.getElementById('chevron-up'),
            chevronDown: document.getElementById('chevron-down'),
            expandedMenu: document.getElementById('expanded-menu'),
            cancelBtn: document.getElementById('cancel-btn'),
            addNoteBtn: document.getElementById('add-note-btn'),
            recordingPill: document.getElementById('recording-pill'),
            pauseIcon: document.getElementById('pause-icon'),
            playIcon: document.getElementById('play-icon'),
            doneBtn: document.getElementById('done-btn'),
            timerDisplay: document.getElementById('timer'),

            notesList: document.getElementById('notes-list'),
        };
    }

        async renderNotesList() {
        try {
            const recordings = await StorageManager.getAllRecordings();
            this.dom.notesList.innerHTML = '';

            for (const note of recordings) {
                const noteEl = document.createElement('div');
                noteEl.className = 'note-item';
                noteEl.dataset.noteId = note.id;
                
                const dateObj = new Date(note.timestamp);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });


                noteEl.innerHTML = `
                    <div class="note-meta">
                        <span>${dateStr}</span>
                        <span class="dot"></span>
                        <span>${timeStr}</span>
                    </div>
                    
                    <div class="note-title">${note.title}</div>
                    
                    <div class="note-footer">
                        <!-- Player Pill -->
                        <div class="player-pill" data-id="${note.id}">
                            <div class="mini-play-btn">
                                <svg class="mini-play-icon play-symbol" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                <svg class="mini-play-icon pause-symbol hidden" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            </div>
                            
                            <div class="mini-progress-container">
                                <div class="mini-progress-track">
                                    <div class="mini-progress-fill" style="width: 0%"></div>
                                    <div class="mini-progress-knob" style="left: 0%"></div>
                                </div>
                            </div>
                            
                            <span class="duration-text">${note.duration}</span>
                        </div>

                        <!-- Action Buttons -->
                        <div class="action-group">
                            <button class="action-icon-btn" title="Summary">
                                <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                            </button>
                            <button class="action-icon-btn" title="Ask AI">
                                <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V7h2v4z"/></svg>
                            </button>
                            <button class="action-icon-btn" title="Share">
                                <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                            </button>
                                                        
                            <!-- Dropdown Wrapper for More Menu -->
                            <div class="dropdown-wrapper">
                                <button class="action-icon-btn more-btn" title="More">
                                    <svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                                </button>
                                
                                <div class="dropdown-menu">
                                    <button class="dropdown-item delete-option">
                                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                        Delete
                                    </button>
                                </div>

                                <div class="delete-confirmation">
                                    <div class="confirm-text">Are you sure you want to delete this note?</div>
                                    <div class="confirm-actions">
                                        <button class="btn-delete-confirm">Delete</button>
                                        <button class="btn-cancel">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                
                const playBtn = noteEl.querySelector('.mini-play-btn');
                const seekContainer = noteEl.querySelector('.mini-progress-container');
                const pill = noteEl.querySelector('.player-pill');

                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.togglePlayback(note, pill);
                });

                seekContainer.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleSeek(e, note, pill, seekContainer);
                });

               
                noteEl.addEventListener('click', () => {
                    if (hasTranscript) {
                        this.toggleTranscript(note.id);
                    }
                });

                
                const moreBtn = noteEl.querySelector('.more-btn');
                const menu = noteEl.querySelector('.dropdown-menu');
                const deleteOption = noteEl.querySelector('.delete-option');
                const confirmation = noteEl.querySelector('.delete-confirmation');
                const confirmBtn = noteEl.querySelector('.btn-delete-confirm');
                const cancelBtn = noteEl.querySelector('.btn-cancel');

                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCurrentlyOpen = menu.classList.contains('show');

                   
                    document.querySelectorAll('.dropdown-menu.show').forEach(el => el.classList.remove('show'));
                    document.querySelectorAll('.delete-confirmation.show').forEach(el => el.classList.remove('show'));

                    
                    if (!isCurrentlyOpen) {
                        menu.classList.add('show');
                    }
                });

                deleteOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.remove('show');
                    confirmation.classList.add('show');
                });

                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    confirmation.classList.remove('show');
                });

                confirmBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await StorageManager.deleteRecord(note.id);
                    this.toastManager.show('Note deleted');
                    this.renderNotesList(); // Refresh UI
                });

                this.dom.notesList.appendChild(noteEl);
            }
        } catch (err) {
            console.error("Error rendering notes:", err);
        }
    }

     togglePlayback(note, pillEl) {
        if (this.currentAudio && this.currentlyPlayingId !== note.id) {
            this.currentAudio.pause();
            const prevPill = document.querySelector(`.player-pill[data-id="${this.currentlyPlayingId}"]`);
            if (prevPill) this.resetPillUI(prevPill);
            
            this.currentAudio = null;
            this.currentlyPlayingId = null;
            if (this.playbackInterval) cancelAnimationFrame(this.playbackInterval);
        }

        if (!this.currentAudio || this.currentlyPlayingId !== note.id) {
            const audioUrl = URL.createObjectURL(note.blob);
            this.currentAudio = new Audio(audioUrl);
            this.currentlyPlayingId = note.id;
            
            this.currentAudio.addEventListener('ended', () => {
                 this.resetPillUI(pillEl);
                 this.currentAudio = null;
                 this.currentlyPlayingId = null;
                 if (this.playbackInterval) cancelAnimationFrame(this.playbackInterval);
            });
        }

        if (this.currentAudio.paused) {
            this.currentAudio.play();
            this.setPlayStateUI(pillEl, true);
            this.startProgressLoop(pillEl);
        } else {
            this.currentAudio.pause();
            this.setPlayStateUI(pillEl, false);
            if (this.playbackInterval) cancelAnimationFrame(this.playbackInterval);
        }
    }

    startProgressLoop(pillEl) {
        const update = () => {
            if (this.currentAudio && !this.currentAudio.paused) {
                const percent = (this.currentAudio.currentTime / this.currentAudio.duration) * 100 || 0;
                this.updatePillProgress(pillEl, percent);
                this.playbackInterval = requestAnimationFrame(update);
            }
        };
        update();
    }
    
    handleSeek(e, note, pillEl, container) {
        const wasPlaying = this.currentAudio && !this.currentAudio.paused;
        
        if (!this.currentAudio || this.currentlyPlayingId !== note.id) {
             this.togglePlayback(note, pillEl);
        }
        
        const rect = container.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const width = rect.width;
        const percent = Math.min(Math.max(offsetX / width, 0), 1);
        
        if (this.currentAudio) {
            if (Number.isFinite(this.currentAudio.duration)) {
                 this.currentAudio.currentTime = percent * this.currentAudio.duration;
                 this.updatePillProgress(pillEl, percent * 100);
            } else {
                this.currentAudio.onloadedmetadata = () => {
                     this.currentAudio.currentTime = percent * this.currentAudio.duration;
                     this.updatePillProgress(pillEl, percent * 100);
                };
            }
        }
    }

    setPlayStateUI(pillEl, isPlaying) {
        const playIcon = pillEl.querySelector('.play-symbol');
        const pauseIcon = pillEl.querySelector('.pause-symbol');
        if (isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
             playIcon.classList.remove('hidden');
             pauseIcon.classList.add('hidden');
        }
    }

    updatePillProgress(pillEl, percent) {
        const fill = pillEl.querySelector('.mini-progress-fill');
        const knob = pillEl.querySelector('.mini-progress-knob');
        if (fill && knob) {
            fill.style.width = `${percent}%`;
            knob.style.left = `${percent}%`;
        }
    }

    resetPillUI(pillEl) {
        this.setPlayStateUI(pillEl, false);
        this.updatePillProgress(pillEl, 0);
    }

    bindEvents() {
        this.dom.recordBtn.addEventListener('click', () => this.startRecording());
        this.dom.doneBtn.addEventListener('click', () => this.stopRecording(true));
        this.dom.cancelBtn.addEventListener('click', () => this.stopRecording(false));
        this.dom.recordingPill.addEventListener('click', () => this.togglePause());
        this.dom.chevronBtn.addEventListener('click', () => this.toggleMenu());
        this.dom.addNoteBtn.addEventListener('click', () => console.log('Add note feature coming soon'));
    }

    toggleMenu() {
        this.isMenuExpanded = !this.isMenuExpanded;
        this.dom.expandedMenu.classList.toggle('hidden', !this.isMenuExpanded);
        this.dom.chevronUp.classList.toggle('hidden', this.isMenuExpanded);
        this.dom.chevronDown.classList.toggle('hidden', !this.isMenuExpanded);
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.saveOnStop = false;

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };
            
                this.mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    if (this.saveOnStop) {
                        await this.saveRecording(audioBlob);
                    }
                    this.cleanup();
                };

            this.mediaRecorder.start();
            this.updateState('RECORDING');
            this.timer.start();

            if (this.isMenuExpanded) this.toggleMenu();

        } catch (err) {
            console.error('Microphone access denied:', err);
            alert('Microphone access is required to record audio.');
        }
    }

    togglePause() {
        if (this.state === 'RECORDING') {
            this.mediaRecorder.pause();
            this.updateState('PAUSED');
            this.timer.stop();
        } else if (this.state === 'PAUSED') {
            this.mediaRecorder.resume();
            this.updateState('RECORDING');
            this.timer.start();
        }
    }

    stopRecording(save) {
        if (this.mediaRecorder && this.state !== 'IDLE') {
            this.saveOnStop = save;
            this.mediaRecorder.stop();
        } else {
            this.cleanup();
        }
    }

   async saveRecording(blob) {
        const now = new Date();
        const record = {
            blob: blob,
            title: "Mock title",
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: this.timer.getDurationString(),
            timestamp: Date.now()
        };

        try {
            const recordId = await StorageManager.saveRecord(record);
            console.log('Saved with ID:', recordId);
            await this.renderNotesList();
        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    cleanup() {
        this.updateState('IDLE');
        this.timer.reset();
        
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        this.audioChunks = [];
        
        if (this.isMenuExpanded) this.toggleMenu();
    }

    updateState(newState) {
        this.state = newState;
        const isRecordingOrPaused = (newState === 'RECORDING' || newState === 'PAUSED');
        
        this.dom.idleView.classList.toggle('hidden', isRecordingOrPaused);
        this.dom.recordingView.classList.toggle('hidden', !isRecordingOrPaused);

        if (newState === 'RECORDING') {
            this.dom.pauseIcon.classList.remove('hidden');
            this.dom.playIcon.classList.add('hidden');
        } else if (newState === 'PAUSED') {
            this.dom.pauseIcon.classList.add('hidden');
            this.dom.playIcon.classList.remove('hidden');
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    new VoiceRecorder();
    console.log('Voice Recorder initialized');
});