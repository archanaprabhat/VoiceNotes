/**
 * Timer Class - Handles stopwatch functionality
 */
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



/**
 * StorageManager Class - IndexedDB operations
 */
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

class VoiceRecorder {
    constructor() {
        this.state = 'IDLE';
        this.isMenuExpanded = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.saveOnStop = false;

        this.cacheDOM();
        this.timer = new Timer(this.dom.timerDisplay);
        this.bindEvents();
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
            canvas: document.getElementById('waveform')
        };
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
            title: 'Voice Note',
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: this.timer.getDurationString(),
            timestamp: Date.now()
        };

        try {
            const recordId = await StorageManager.saveRecord(record);
            console.log('Recording saved with ID:', recordId);
            
            // Verify it was saved
            const allRecordings = await StorageManager.getAllRecordings();
            console.log('Total recordings in database:', allRecordings.length);
            console.log('All recordings:', allRecordings);
            
            alert(`Recording saved! Duration: ${record.duration}`);
        } catch (error) {
            console.error('Failed to save recording:', error);
            alert('Failed to save recording. Please try again.');
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