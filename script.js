
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

class Visualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.animationId = null;
        this.isActive = false;

        // Wave physics parameters - multiple small waves
        this.waves = [
            { speed: 0.0012, amplitude: 0.08, frequency: 4.5, phase: 0 },
            { speed: 0.0010, amplitude: 0.06, frequency: 5.2, phase: Math.PI / 3 },
            { speed: 0.0015, amplitude: 0.07, frequency: 3.8, phase: Math.PI / 2 },
            { speed: 0.0008, amplitude: 0.05, frequency: 6.0, phase: Math.PI },
            { speed: 0.0013, amplitude: 0.06, frequency: 4.2, phase: Math.PI / 4 }
        ];

        // Audio envelope tracking
        this.smoothedLevel = 0;
        this.targetLevel = 0;
        this.peakLevel = 0;
        
        // Frequency band tracking for natural response
        this.freqBands = new Float32Array(3); // low, mid, high
        this.smoothedBands = new Float32Array(3);

        // Wave displacement for continuous flow
        this.timeOffset = 0;
        this.lastTime = performance.now();

        // Dynamic amplitude multiplier
        this.baseAmplitude = 0.4; // Moderate baseline for visible ripples
        this.dynamicAmplitude = 0;
    }

    setup(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256; 
        this.analyser.smoothingTimeConstant = 0.1; 

        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.analyser);

        this.isActive = true;
        this.lastTime = performance.now();
        this.draw();
    }

    analyzeAudio() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeData = new Uint8Array(this.analyser.fftSize);
        
        this.analyser.getByteFrequencyData(dataArray);
        this.analyser.getByteTimeDomainData(timeData);

        // Calculate RMS from time domain for overall energy
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);

        // Extract frequency bands for natural wave modulation
        const lowEnd = Math.floor(bufferLength * 0.1);
        const midEnd = Math.floor(bufferLength * 0.4);
        
        let lowSum = 0, midSum = 0, highSum = 0;
        
        for (let i = 0; i < lowEnd; i++) {
            lowSum += dataArray[i];
        }
        for (let i = lowEnd; i < midEnd; i++) {
            midSum += dataArray[i];
        }
        for (let i = midEnd; i < bufferLength; i++) {
            highSum += dataArray[i];
        }

        this.freqBands[0] = (lowSum / lowEnd) / 255;
        this.freqBands[1] = (midSum / (midEnd - lowEnd)) / 255;
        this.freqBands[2] = (highSum / (bufferLength - midEnd)) / 255;

        // Smooth frequency bands for fluid motion
        for (let i = 0; i < 3; i++) {
            const diff = this.freqBands[i] - this.smoothedBands[i];
            this.smoothedBands[i] += diff * 0.3;
        }

        return rms;
    }

    draw() {
        if (!this.isActive) return;

        this.animationId = requestAnimationFrame(this.draw.bind(this));

        const now = performance.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        // Analyze audio input
        const rms = this.analyzeAudio();

        // Ultra-smooth envelope with physics-based attack/release
        const attack = 0.25;
        const release = 0.15;
        const k = rms > this.smoothedLevel ? attack : release;
        this.smoothedLevel += (rms - this.smoothedLevel) * k;

        // Track peak for dynamic range
        this.peakLevel = Math.max(this.peakLevel * 0.99, this.smoothedLevel);

        // Dynamic amplitude: baseline + voice surge
        const voiceEnergy = this.peakLevel > 0.01 
            ? (this.smoothedLevel / this.peakLevel) 
            : 0;
        
        this.targetLevel = this.baseAmplitude + voiceEnergy * 3.0;
        this.dynamicAmplitude += (this.targetLevel - this.dynamicAmplitude) * 0.2;

        // Update time offset for continuous horizontal flow
        this.timeOffset += deltaTime;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const centerY = this.canvas.height / 2;
        const maxHeight = this.canvas.height * 0.35;

        // Solid color instead of gradient
        this.ctx.fillStyle = '#5b8fe7ff';

        // Draw composite wave with multiple layers
        const resolution = 128;
        const segmentWidth = this.canvas.width / resolution;

        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height);

        // Generate wave points
        for (let i = 0; i <= resolution; i++) {
            const x = i * segmentWidth;
            const t = i / resolution;

            let yOffset = 0;

            // Composite multiple sine waves with frequency band modulation
            this.waves.forEach((wave, idx) => {
                const bandMod = this.smoothedBands[idx % 3];
                const phaseShift = wave.phase + this.timeOffset * wave.speed;
                
                // Multiple frequencies create organic water-like motion
                const primaryWave = Math.sin(t * Math.PI * wave.frequency + phaseShift);
                const secondaryWave = Math.sin(t * Math.PI * wave.frequency * 1.7 + phaseShift * 1.3);
                
                // Combine waves with band modulation
                const combined = (primaryWave * 0.7 + secondaryWave * 0.3);
                const modulated = combined * (1 + bandMod * 0.5);
                
                yOffset += modulated * wave.amplitude;
            });

            // Apply dynamic amplitude (baseline + voice surge)
            const amplitude = maxHeight * this.dynamicAmplitude;
            const y = centerY + yOffset * amplitude;

            if (i === 0) {
                this.ctx.lineTo(x, y);
            } else {
                // Smooth curves using quadratic bezier
                const prevX = (i - 1) * segmentWidth;
                const prevT = (i - 1) / resolution;
                
                let prevYOffset = 0;
                this.waves.forEach((wave, idx) => {
                    const bandMod = this.smoothedBands[idx % 3];
                    const phaseShift = wave.phase + this.timeOffset * wave.speed;
                    const primaryWave = Math.sin(prevT * Math.PI * wave.frequency + phaseShift);
                    const secondaryWave = Math.sin(prevT * Math.PI * wave.frequency * 1.7 + phaseShift * 1.3);
                    const combined = (primaryWave * 0.7 + secondaryWave * 0.3);
                    const modulated = combined * (1 + bandMod * 0.5);
                    prevYOffset += modulated * wave.amplitude;
                });
                
                const prevY = centerY + prevYOffset * amplitude;
                
                const cpX = (prevX + x) / 2;
                const cpY = (prevY + y) / 2;
                
                this.ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
            }
        }

        // Complete the fill shape
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
    }

    stop() {
        this.isActive = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

class GroqService {
    static GROQ_API_KEY = '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'; 
    static TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
    static CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

    static async transcribeAudio(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('model', 'whisper-large-v3');
            formData.append('response_format', 'json');

            const response = await fetch(this.TRANSCRIPTION_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Transcription failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.text || '';
        } catch (error) {
            console.error('Transcription error:', error);
            return 'Transcription failed';
        }
    }

    static async generateTitle(transcript) {
        try {
            const response = await fetch(this.CHAT_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that generates concise, descriptive titles for voice notes. Generate a title that is 3-6 words long, capturing the main topic or theme of the transcript. Return only the title, nothing else.'
                        },
                        {
                            role: 'user',
                            content: `Generate a title for this transcript:\n\n${transcript}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 20
                })
            });

            if (!response.ok) {
                throw new Error(`Title generation failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content?.trim() || 'Untitled Note';
        } catch (error) {
            console.error('Title generation error:', error);
            return 'Untitled Note';
        }
    }
    
    static async generateDayHighlights(notes) {
        try {
            if (!notes || notes.length === 0) return [];
            
            // Prepare context from all notes
            const notesContext = notes.map((note, idx) => 
                `Note ${idx + 1} (${note.time}): "${note.title}"\nTranscript: ${note.transcript || 'No transcript available'}`
            ).join('\n\n');
            
            const response = await fetch(this.CHAT_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert at analyzing voice notes and extracting key highlights. Generate 2-4 concise, actionable highlights from the provided notes. Each highlight should be a short phrase (3-8 words) capturing important topics, decisions, or action items. Return ONLY a JSON array of strings, nothing else.'
                        },
                        {
                            role: 'user',
                            content: `Analyze these voice notes and extract key highlights:\n\n${notesContext}\n\nReturn format: ["highlight 1", "highlight 2", "highlight 3"]`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                })
            });

            if (!response.ok) {
                throw new Error(`Highlights generation failed: ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content?.trim();
            
            // Parse JSON response
            try {
                const highlights = JSON.parse(content);
                return Array.isArray(highlights) ? highlights.slice(0, 4) : [];
            } catch (parseError) {
                console.error('Failed to parse highlights JSON:', parseError);
                // Fallback: extract highlights from text
                return this.extractHighlightsFromText(content);
            }
        } catch (error) {
            console.error('Highlights generation error:', error);
            return [];
        }
    }
    
    static extractHighlightsFromText(text) {
        // Fallback method to extract highlights if JSON parsing fails
        const lines = text.split('\n').filter(line => line.trim());
        return lines
            .map(line => line.replace(/^[-*•]\s*/, '').replace(/^["']|["']$/g, '').trim())
            .filter(line => line.length > 0 && line.length < 100)
            .slice(0, 4);
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

class VoiceNotesApp {
    constructor() {
        // UI states
        this.toastManager = new ToastManager();
        this.state = 'IDLE';
        this.isMenuExpanded = false;
        this.expandedNoteId = null; // Track which note's transcript is expanded
        
        // Core Logic -- Recording
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.saveOnStop = false;
        
        // Core Logic -- Playback
        this.currentAudio = null;
        this.currentlyPlayingId = null;
        this.playbackInterval = null;

        // Helpers -- UI
        this.cacheDOM();
        this.timer = new Timer(this.dom.timerDisplay);
        this.visualizer = new Visualizer(this.dom.canvas);

        // Global click to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-wrapper') && !e.target.closest('.floating-help-container')) {
                document.querySelectorAll('.dropdown-menu.show, .delete-confirmation.show, .help-dropdown.show').forEach(el => {
                    el.classList.remove('show');
                });
            }
        });
        
        this.bindEvents();
        this.renderNotesList();
        this.updateKeyboardShortcut();
    }

    updateKeyboardShortcut() {
        // Detect if user is on Mac
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const shortcutModifier = document.getElementById('shortcut-modifier');
        if (shortcutModifier && isMac) {
            shortcutModifier.textContent = 'Cmd +';
        }
    }

    cacheDOM() {
        this.dom = {
            header: document.querySelector('.search-header'),
            recordBtn: document.getElementById('record-btn'),
            idleView: document.getElementById('idle-view'),
            recordingView: document.getElementById('recording-view'),
            notesList: document.getElementById('notes-list'),
            
            // Menu
            chevronBtn: document.getElementById('chevron-btn'),
            chevronUp: document.getElementById('chevron-up'),
            chevronDown: document.getElementById('chevron-down'),
            expandedMenu: document.getElementById('expanded-menu'),
            cancelBtn: document.getElementById('cancel-btn'),
            addNoteBtn: document.getElementById('add-note-btn'),
            
            // Interaction
            recordingPill: document.getElementById('recording-pill'),
            pauseIcon: document.getElementById('pause-icon'),
            playIcon: document.getElementById('play-icon'),
            doneBtn: document.getElementById('done-btn'),
            
            // Display
            timerDisplay: document.getElementById('timer'),
            canvas: document.getElementById('waveform'),
            
            // Floating Help
            helpBtn: document.getElementById('help-btn'),
            helpDropdown: document.getElementById('help-dropdown')
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

                const isProcessing = note.title === "processing";
                const hasTranscript = note.transcript && note.transcript !== "processing";
                const isExpanded = this.expandedNoteId === note.id;

                noteEl.innerHTML = `
                    <div class="note-meta">
                        <span>${dateStr}</span>
                        <span class="dot"></span>
                        <span>${timeStr}</span>
                    </div>
                    
                    <div class="note-title">${note.title}${isProcessing ? "..." : ""}</div>
                    ${hasTranscript ? `<div class="note-transcript ${isExpanded ? 'expanded' : ''}">${note.transcript}</div>` : ''}

                    <div class="note-footer">
                        <!-- Player Pill -->
                        <div class="player-pill" data-id="${note.id}">
                            <div class="mini-play-btn">
                                <svg class="mini-play-icon play-symbol" width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="playBtn-z2DCpAJd" style="display: block;"><path class="dark:fill-greyEE dark:stroke-greyEE" d="M8 18L8 6L18.6667 11.3333L8 18Z" fill="black" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>
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
                                <img src="./assets/summary.svg" alt="Summary">
                            </button>
                            <button class="action-icon-btn" title="Edit">
                                <img src="./assets/edit.svg" alt="Edit">
                            </button>
                            <button class="action-icon-btn" title="Share">
                                <img src="./assets/share.svg" alt="Share">
                            </button>
                                                        
                            <!-- Dropdown Wrapper for More Menu -->
                            <div class="dropdown-wrapper">
                                <button class="action-icon-btn more-btn" title="More">
                                    <img src="./assets/more_icon.svg" alt="More">
                                </button>
                                
                                <div class="dropdown-menu">
                                    <button class="dropdown-item download-option">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 11L8 3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                                            <path d="M11 8L8 11L5 8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M14 13L14 14C14 14.5523 13.5523 15 13 15L3 15C2.44772 15 2 14.5523 2 14L2 13" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                                        </svg>
                                        Download
                                    </button>
                                    <button class="dropdown-item delete-option">
                                        <svg data-v-50cbeda8="" width="13" height="16" viewBox="0 0 13 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path class="stroke-red38" d="M2.12891 3.76172L2.61433 12.9847C2.64239 13.518 2.65643 13.7846 2.76917 13.9871C2.86841 14.1653 3.01978 14.3089 3.20299 14.3987C3.41111 14.5006 3.67811 14.5006 4.21212 14.5006H9.08898C9.62299 14.5006 9.88999 14.5006 10.0981 14.3987C10.2813 14.3089 10.4327 14.1653 10.5319 13.9871C10.6447 13.7846 10.6587 13.518 10.6868 12.9847L11.1722 3.76172" stroke="#9B9B9B" stroke-width="1.1" stroke-linejoin="round"></path><path class="stroke-red38" d="M4.05078 4.32617V3.10014C4.05078 2.54009 4.05078 2.26007 4.15977 2.04615C4.25565 1.85799 4.40863 1.70501 4.59679 1.60914C4.8107 1.50014 5.09073 1.50014 5.65078 1.50014H7.65155C8.21161 1.50014 8.49163 1.50014 8.70554 1.60914C8.89371 1.70501 9.04669 1.85799 9.14256 2.04615C9.25155 2.26007 9.25155 2.54009 9.25155 3.10014V4.32617" stroke="#" stroke-width="1.1" stroke-linejoin="round"></path><path class="stroke-red38" d="M1 3.76172H12.3041" stroke="#9B9B9B" stroke-linecap="round"></path><path class="stroke-red38" d="M6.65234 6.02246V11.6745" stroke="#9B9B9B" stroke-linecap="round"></path><path class="stroke-red38" d="M6.65625 6.02051V12.2378" stroke="#9B9B9B" stroke-linecap="round"></path><path class="stroke-red38" d="M8.91749 6.02051L8.69141 12.2378" stroke="#9B9B9B" stroke-linecap="round"></path><path class="stroke-red38" d="M4.39844 6.02051L4.62452 12.2378" stroke="#9B9B9B" stroke-linecap="round"></path></svg>
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
                
                // Bind Events
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

                // Click on note item to expand/collapse transcript
                noteEl.addEventListener('click', () => {
                    if (hasTranscript) {
                        this.toggleTranscript(note.id);
                    }
                });

                // Bind Dropdown/Delete Events
                const moreBtn = noteEl.querySelector('.more-btn');
                const menu = noteEl.querySelector('.dropdown-menu');
                const downloadOption = noteEl.querySelector('.download-option');
                const deleteOption = noteEl.querySelector('.delete-option');
                const confirmation = noteEl.querySelector('.delete-confirmation');
                const confirmBtn = noteEl.querySelector('.btn-delete-confirm');
                const cancelBtn = noteEl.querySelector('.btn-cancel');

                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCurrentlyOpen = menu.classList.contains('show');

                    // 1. Force close ALL dropdowns properly
                    document.querySelectorAll('.dropdown-menu.show').forEach(el => el.classList.remove('show'));
                    document.querySelectorAll('.delete-confirmation.show').forEach(el => el.classList.remove('show'));

                    // 2. Toggle current one ONLY if it wasn't open
                    if (!isCurrentlyOpen) {
                        menu.classList.add('show');
                    }
                });

                downloadOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.remove('show');
                    
                    // Create download link
                    const url = URL.createObjectURL(note.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${note.title}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    this.toastManager.show('Download started');
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

    toggleTranscript(noteId) {
        if (this.expandedNoteId === noteId) {
            this.expandedNoteId = null;
        } else {
            this.expandedNoteId = noteId;
        }
        this.renderNotesList();
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
            
            const remaining = this.currentAudio.duration - this.currentAudio.currentTime;
            this.updateDurationDisplay(pillEl, remaining);
            
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

    updateDurationDisplay(pillEl, remainingSeconds) {
    const durationText = pillEl.querySelector('.duration-text');
    if (durationText && Number.isFinite(remainingSeconds)) {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = Math.floor(remainingSeconds % 60);
        durationText.textContent = `${this.pad(minutes)}:${this.pad(seconds)}`;
    }
}

pad(num) {
    return num.toString().padStart(2, '0');
}

    resetPillUI(pillEl) {
    this.setPlayStateUI(pillEl, false);
    this.updatePillProgress(pillEl, 0);
    
    const noteId = parseInt(pillEl.dataset.id);
    StorageManager.getAllRecordings().then(recordings => {
        const note = recordings.find(r => r.id === noteId);
        if (note) {
            const durationText = pillEl.querySelector('.duration-text');
            if (durationText) {
                durationText.textContent = note.duration;
            }
        }
    });
}

    bindEvents() {
        this.dom.recordBtn.addEventListener('click', () => this.startRecording());
        this.dom.doneBtn.addEventListener('click', () => this.stopRecording(true));
        this.dom.cancelBtn.addEventListener('click', () => this.stopRecording(false));
        this.dom.recordingPill.addEventListener('click', () => this.togglePause());
        this.dom.chevronBtn.addEventListener('click', () => this.toggleMenu());
        this.dom.addNoteBtn.addEventListener('click', () => console.log('Add note clicked (Feature pending)'));
        
        // Floating Help
        this.dom.helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dom.helpDropdown.classList.toggle('show');
        });

        // Tags Selection
        const tagsWrapper = document.querySelector('.tags-wrapper');
        if (tagsWrapper) {
            tagsWrapper.addEventListener('click', (e) => {
                const tag = e.target.closest('.tag-item');
                if (tag) {
                    tagsWrapper.querySelectorAll('.tag-item').forEach(t => t.classList.remove('active'));
                    tag.classList.add('active');
                }
            });
        }

        // Search Modal Functionality
        const searchInput = document.querySelector('.search-input');
        const searchModal = document.getElementById('search-modal');
        const searchModalInput = document.getElementById('search-modal-input');
        const searchCancelBtn = document.getElementById('search-cancel-btn');
        const searchModalOverlay = document.querySelector('.search-modal-overlay');
        const searchPlaceholder = document.getElementById('search-placeholder');
        const searchResults = document.getElementById('search-results');

        // Open search modal when clicking on main search input
        if (searchInput) {
            searchInput.addEventListener('click', (e) => {
                e.preventDefault();
                this.openSearchModal();
            });
            
            // Make search input readonly to prevent keyboard on mobile
            searchInput.setAttribute('readonly', 'true');
        }

        // Ctrl+K keyboard shortcut to open search
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.openSearchModal();
            }
            
            // Escape key to close search modal
            if (e.key === 'Escape' && searchModal && !searchModal.classList.contains('hidden')) {
                this.closeSearchModal();
            }
        });

        // Close search modal handlers
        if (searchCancelBtn) {
            searchCancelBtn.addEventListener('click', () => {
                this.closeSearchModal();
            });
        }

        if (searchModalOverlay) {
            searchModalOverlay.addEventListener('click', () => {
                this.closeSearchModal();
            });
        }

        // Real-time search functionality
        if (searchModalInput) {
            searchModalInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
            });
        }

        // Header Scroll
        window.addEventListener('scroll', () => {
            if (window.scrollY > 0) {
                this.dom.header.classList.add('scrolled');
            } else {
                this.dom.header.classList.remove('scrolled');
            }
        });
    }

    openSearchModal() {
        const searchModal = document.getElementById('search-modal');
        const searchModalInput = document.getElementById('search-modal-input');
        
        if (searchModal) {
            searchModal.classList.remove('hidden');
            // Focus on input after animation
            setTimeout(() => {
                if (searchModalInput) {
                    searchModalInput.focus();
                }
            }, 100);
            
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }
    }

    closeSearchModal() {
        const searchModal = document.getElementById('search-modal');
        const searchModalInput = document.getElementById('search-modal-input');
        const searchPlaceholder = document.getElementById('search-placeholder');
        const searchResults = document.getElementById('search-results');
        
        if (searchModal) {
            searchModal.classList.add('hidden');
            
            // Clear search input and results
            if (searchModalInput) {
                searchModalInput.value = '';
            }
            
            // Show placeholder, hide results
            if (searchPlaceholder) {
                searchPlaceholder.classList.remove('hidden');
            }
            if (searchResults) {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
            }
            
            // Restore body scroll
            document.body.style.overflow = '';
        }
    }

    async performSearch(query) {
        const searchPlaceholder = document.getElementById('search-placeholder');
        const searchResults = document.getElementById('search-results');
        
        if (!query || query.trim() === '') {
            // Show placeholder when no query
            if (searchPlaceholder) searchPlaceholder.classList.remove('hidden');
            if (searchResults) {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
            }
            return;
        }

        // Hide placeholder, show results
        if (searchPlaceholder) searchPlaceholder.classList.add('hidden');
        if (searchResults) searchResults.classList.remove('hidden');

        try {
            const recordings = await StorageManager.getAllRecordings();
            const lowerQuery = query.toLowerCase();
            
            // Filter recordings based on title and transcript
            const filteredResults = recordings.filter(note => {
                const titleMatch = note.title && note.title.toLowerCase().includes(lowerQuery);
                const transcriptMatch = note.transcript && 
                                       note.transcript !== 'processing' && 
                                       note.transcript.toLowerCase().includes(lowerQuery);
                return titleMatch || transcriptMatch;
            });

            // Display results
            if (filteredResults.length === 0) {
                searchResults.innerHTML = `
                    <div class="search-placeholder">
                        <p class="search-placeholder-text">No results found for "${this.escapeHtml(query)}"</p>
                    </div>
                `;
            } else {
                searchResults.innerHTML = filteredResults.map(note => {
                    const highlightedTitle = this.highlightText(note.title, query);
                    const snippet = this.getSearchSnippet(note.transcript, query);
                    
                    return `
                        <div class="search-result-item" data-note-id="${note.id}">
                            <div class="search-result-title">${highlightedTitle}</div>
                            ${snippet ? `<div class="search-result-snippet">${snippet}</div>` : ''}
                        </div>
                    `;
                }).join('');

                // Add click handlers to results
                searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const noteId = parseInt(item.dataset.noteId);
                        this.closeSearchModal();
                        
                        // Scroll to the note in the main list
                        setTimeout(() => {
                            const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
                            if (noteElement) {
                                noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Highlight the note briefly
                                noteElement.style.backgroundColor = '#fff3cd';
                                setTimeout(() => {
                                    noteElement.style.backgroundColor = '';
                                }, 2000);
                            }
                        }, 300);
                    });
                });
            }
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = `
                <div class="search-placeholder">
                    <p class="search-placeholder-text">An error occurred while searching</p>
                </div>
            `;
        }
    }

    highlightText(text, query) {
        if (!text || !query) return this.escapeHtml(text);
        
        const escapedText = this.escapeHtml(text);
        const escapedQuery = this.escapeHtml(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        
        return escapedText.replace(regex, '<span class="search-highlight">$1</span>');
    }

    getSearchSnippet(text, query, contextLength = 100) {
        if (!text || text === 'processing' || !query) return '';
        
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) return '';
        
        // Get context around the match
        const start = Math.max(0, index - contextLength / 2);
        const end = Math.min(text.length, index + query.length + contextLength / 2);
        
        let snippet = text.substring(start, end);
        
        // Add ellipsis if needed
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        return this.highlightText(snippet, query);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            
            this.visualizer.setup(stream);
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
        } catch (error) {
            console.error('Microphone access error:', error);
            this.toastManager.show('Please allow microphone access in your browser');
            this.updateState('IDLE');
        }
    }

    togglePause() {
        if (this.state === 'RECORDING') {
            this.mediaRecorder.pause();
            this.visualizer.isActive = false; 
            this.updateState('PAUSED');
            this.timer.stop();
        } else if (this.state === 'PAUSED') {
            this.mediaRecorder.resume();
            this.visualizer.isActive = true;
            this.visualizer.draw();
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
            title: "processing",
            transcript: "processing",
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: this.timer.getDurationString(),
            timestamp: Date.now()
        };

        try {
            const recordId = await StorageManager.saveRecord(record);
            console.log('Saved with ID:', recordId);
            await this.renderNotesList();

            // Process in background
            this.processRecording(recordId, blob);
        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    async processRecording(recordId, blob) {
        try {
            // Step 1: Transcribe
            console.log('Starting transcription...');
            const transcript = await GroqService.transcribeAudio(blob);
            console.log('Transcript:', transcript);

            // Step 2: Generate title
            console.log('Generating title...');
            const title = await GroqService.generateTitle(transcript);
            console.log('Title:', title);

            // Step 3: Update database
            await StorageManager.updateRecord(recordId, {
                transcript: transcript,
                title: title
            });

            // Step 4: Refresh UI
            await this.renderNotesList();
            console.log('Processing complete!');
        } catch (error) {
            console.error('Processing error:', error);
            // Update with error state
            await StorageManager.updateRecord(recordId, {
                transcript: 'Processing failed',
                title: 'Untitled Note'
            });
            await this.renderNotesList();
        }
    }

    cleanup() {
        this.updateState('IDLE');
        this.timer.reset();
        this.visualizer.stop();
        
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        this.audioChunks = [];
        this.isPaused = false;
        
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

// Init
document.addEventListener('DOMContentLoaded', () => new VoiceNotesApp());
// Calendar Manager Class
class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.isHighlightsVisible = false;
        this.selectedDay = null;
        this.notesCache = {}; 
        
        this.dom = {
            calendarBtn: document.querySelector('[title="Calendar"]'),
            calendarPopover: document.getElementById('calendar-popover'),
            calendarBackdrop: document.getElementById('calendar-backdrop'),
            calendarMonth: document.getElementById('calendar-month'),
            calendarYear: document.getElementById('calendar-year'),
            calendarGrid: document.getElementById('calendar-grid'),
            prevMonthBtn: document.getElementById('prev-month-btn'),
            nextMonthBtn: document.getElementById('next-month-btn'),
            highlightsToggleBtn: document.getElementById('highlights-toggle-btn'),
            highlightsToggleText: document.getElementById('highlights-toggle-text'),
            highlightsContainer: document.getElementById('highlights-container'),
            dayDetailsContainer: document.getElementById('day-details-container'),
            streakText: document.getElementById('streak-text')
        };
        
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        this.dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        this.bindEvents();
        this.loadNotesAndRender();
    }
    
    calculateStreak() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let streak = 0;
        let currentDate = new Date(today);
        
        // Count consecutive days backwards from today
        while (true) {
            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;
            const notesForDay = this.notesCache[dateKey];
            
            if (notesForDay && notesForDay.length > 0) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        // Update streak display
        if (streak > 0) {
            this.dom.streakText.textContent = `You are on a ${streak}-day streak and rank 686,933 globally.`;
        } else {
            this.dom.streakText.textContent = 'Start recording to build your streak!';
        }
    }
    
    bindEvents() {
        // Toggle calendar visibility
        this.dom.calendarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCalendar();
        });
        
        // Close calendar when clicking outside or on backdrop
        document.addEventListener('click', (e) => {
            if (!this.dom.calendarPopover.contains(e.target) && 
                !this.dom.calendarBtn.contains(e.target)) {
                this.closeCalendar();
            }
        });
        
        // Close on backdrop click
        this.dom.calendarBackdrop.addEventListener('click', () => {
            this.closeCalendar();
        });
        
        // Month navigation
        this.dom.prevMonthBtn.addEventListener('click', () => this.previousMonth());
        this.dom.nextMonthBtn.addEventListener('click', () => this.nextMonth());
        
        // Highlights toggle
        this.dom.highlightsToggleBtn.addEventListener('click', () => this.toggleHighlights());
    }
    
    toggleCalendar() {
        const isHidden = this.dom.calendarPopover.classList.contains('hidden');
        if (isHidden) {
            this.dom.calendarPopover.classList.remove('hidden');
            this.dom.calendarBackdrop.classList.remove('hidden');
        } else {
            this.closeCalendar();
        }
    }
    
    closeCalendar() {
        this.dom.calendarPopover.classList.add('hidden');
        this.dom.calendarBackdrop.classList.add('hidden');
    }
    
    async toggleHighlights() {
        this.isHighlightsVisible = !this.isHighlightsVisible;
        
        if (this.isHighlightsVisible) {
            // Close day details if open
            this.hideDayDetails();
            
            // Show skeleton loading
            this.dom.highlightsContainer.innerHTML = this.getSkeletonHighlights();
            this.dom.highlightsContainer.classList.remove('hidden');
            this.dom.highlightsToggleText.textContent = 'Hide highlights';
            
            // Get all notes from current month
            const allNotesThisMonth = [];
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            
            for (let day = 1; day <= daysInMonth; day++) {
                const notes = this.getNotesForDay(this.currentYear, this.currentMonth, day);
                allNotesThisMonth.push(...notes);
            }
            
            if (allNotesThisMonth.length > 0) {
                // Generate highlights from all notes this month
                const highlights = await GroqService.generateDayHighlights(allNotesThisMonth);
                
                // Display highlights
                if (highlights.length > 0) {
                    let html = '<div class="highlights-title">Highlights</div><div class="highlights-list">';
                    highlights.forEach(highlight => {
                        html += `
                            <div class="highlight-item">
                                <div class="highlight-bullet"></div>
                                <span class="highlight-text">${highlight}</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                    this.dom.highlightsContainer.innerHTML = html;
                } else {
                    this.dom.highlightsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #9B9B9B; font-size: 13px;">No highlights available</div>';
                }
            } else {
                this.dom.highlightsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #9B9B9B; font-size: 13px;">No notes this month</div>';
            }
        } else {
            this.dom.highlightsContainer.classList.add('hidden');
            this.dom.highlightsToggleText.textContent = 'View highlights';
        }
    }
    
    getSkeletonHighlights() {
        return `
            <div class="highlights-title">Highlights</div>
            <div class="highlights-list">
                <div class="skeleton skeleton-highlight"></div>
                <div class="skeleton skeleton-highlight"></div>
                <div class="skeleton skeleton-highlight"></div>
            </div>
        `;
    }
    
    getSkeletonDayNotes() {
        return `
            <div class="notes-list-container">
                <div class="skeleton-note">
                    <div class="skeleton skeleton-note-time"></div>
                    <div class="skeleton skeleton-note-title"></div>
                </div>
                <div class="skeleton-note">
                    <div class="skeleton skeleton-note-time"></div>
                    <div class="skeleton skeleton-note-title"></div>
                </div>
                <div class="skeleton-note">
                    <div class="skeleton skeleton-note-time"></div>
                    <div class="skeleton skeleton-note-title"></div>
                </div>
            </div>
        `;
    }
    
    previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.loadNotesAndRender();
        this.updateNavigationButtons();
    }
    
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.loadNotesAndRender();
        this.updateNavigationButtons();
    }
    
    updateNavigationButtons() {
        const today = new Date();
        const isCurrentMonth = this.currentMonth === today.getMonth() && 
                              this.currentYear === today.getFullYear();
        
        // Disable next button if we're in current month
        if (isCurrentMonth) {
            this.dom.nextMonthBtn.classList.add('disabled');
        } else {
            this.dom.nextMonthBtn.classList.remove('disabled');
        }
    }
    
    async loadNotesAndRender() {
        await this.loadNotesFromDB();
        this.renderCalendar();
        this.calculateStreak();
    }
    
    async loadNotesFromDB() {
        try {
            const allNotes = await StorageManager.getAllRecordings();
            this.notesCache = {};
            
            // Group notes by date with full data for highlights generation
            allNotes.forEach(note => {
                const noteDate = new Date(note.timestamp);
                const dateKey = `${noteDate.getFullYear()}-${noteDate.getMonth()}-${noteDate.getDate()}`;
                
                if (!this.notesCache[dateKey]) {
                    this.notesCache[dateKey] = [];
                }
                
                this.notesCache[dateKey].push({
                    id: note.id,
                    title: note.title,
                    time: note.time,
                    timestamp: note.timestamp,
                    transcript: note.transcript // Include transcript for highlights
                });
            });
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }
    
    getNotesForDay(year, month, day) {
        const dateKey = `${year}-${month}-${day}`;
        return this.notesCache[dateKey] || [];
    }
    
    async showDayDetails(year, month, day) {
        const notes = this.getNotesForDay(year, month, day);
        if (notes.length === 0) return;
        
        this.selectedDay = { year, month, day };
        
        // Close highlights if open
        if (this.isHighlightsVisible) {
            this.isHighlightsVisible = false;
            this.dom.highlightsContainer.classList.add('hidden');
            this.dom.highlightsToggleText.textContent = 'View highlights';
        }
        
        const date = new Date(year, month, day);
        const dayName = this.dayNames[date.getDay()];
        const monthName = this.monthNames[month];
        const formattedDate = `${dayName}, ${monthName.slice(0, 3)} ${day}, ${year}`;
        
        // Show skeleton loading
        this.dom.dayDetailsContainer.innerHTML = `
            <a href="#" class="day-details-date">${formattedDate}</a>
            ${this.getSkeletonDayNotes()}
        `;
        this.dom.dayDetailsContainer.classList.remove('hidden');
        
        // Small delay to show skeleton
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Build final HTML (no highlights section here - only in top highlights toggle)
        let html = `
            <a href="#" class="day-details-date">${formattedDate}</a>
            <div class="notes-list-container">
        `;
        
        notes.forEach(note => {
            html += `
                <div class="note-item-calendar" data-note-id="${note.id}">
                    <span class="note-time">${note.time}</span>
                    <span class="note-title-calendar">${note.title}</span>
                </div>
            `;
        });
        
        html += `</div>`;
        
        if (notes.length > 3) {
            html += `
                <div class="see-all-notes-btn">
                    <button>See all notes</button>
                </div>
            `;
        }
        
        this.dom.dayDetailsContainer.innerHTML = html;
    }
    
    hideDayDetails() {
        this.selectedDay = null;
        this.dom.dayDetailsContainer.classList.add('hidden');
    }
    
    renderCalendar() {
        // Update month and year display
        this.dom.calendarMonth.textContent = this.monthNames[this.currentMonth];
        this.dom.calendarYear.textContent = this.currentYear;
        
        // Clear existing calendar and hide day details
        this.dom.calendarGrid.innerHTML = '';
        this.hideDayDetails();
        
        // Get first day of month (0 = Sunday, 1 = Monday, etc.)
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        // Adjust to make Monday = 0
        const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;
        
        // Get number of days in month
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        // Get today's date for highlighting
        const today = new Date();
        const isCurrentMonth = this.currentMonth === today.getMonth() && 
                              this.currentYear === today.getFullYear();
        const todayDate = today.getDate();
        
        // Create calendar grid
        let dayCounter = 1;
        let totalWeeks = Math.ceil((firstDayAdjusted + daysInMonth) / 7);
        
        for (let week = 0; week < totalWeeks; week++) {
            const weekRow = document.createElement('div');
            weekRow.className = 'calendar-week';
            
            for (let day = 0; day < 7; day++) {
                const dayCell = document.createElement('div');
                dayCell.className = 'calendar-day';
                
                // Calculate if this cell should have a day number
                const cellIndex = week * 7 + day;
                
                if (cellIndex >= firstDayAdjusted && dayCounter <= daysInMonth) {
                    const currentDay = dayCounter;
                    dayCell.textContent = currentDay;
                    
                    // Check if this day has notes (dynamically from IndexedDB)
                    const notesForDay = this.getNotesForDay(this.currentYear, this.currentMonth, currentDay);
                    if (notesForDay.length > 0) {
                        dayCell.classList.add('has-notes');
                        dayCell.addEventListener('click', () => {
                            // Remove selected class from all days
                            document.querySelectorAll('.calendar-day.selected').forEach(el => {
                                el.classList.remove('selected');
                            });
                            // Add selected class to clicked day
                            dayCell.classList.add('selected');
                            // Show day details
                            this.showDayDetails(this.currentYear, this.currentMonth, currentDay);
                        });
                    }
                    
                    // Mark today (but don't make it black)
                    if (isCurrentMonth && currentDay === todayDate) {
                        dayCell.classList.add('today');
                    }
                    
                    dayCounter++;
                } else {
                    dayCell.classList.add('invisible');
                }
                
                weekRow.appendChild(dayCell);
            }
            
            this.dom.calendarGrid.appendChild(weekRow);
        }
        
        this.updateNavigationButtons();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new CalendarManager();
    }, 100);
});

// Profile Modal Manager
class ProfileModalManager {
    constructor() {
        this.dom = {
            profileBtn: document.querySelector('.profile-circle'),
            profileModal: document.getElementById('profile-modal'),
            profileBackdrop: document.getElementById('profile-modal-backdrop'),
            closeBtn: document.getElementById('profile-close-btn'),
            resumeSection: document.getElementById('resume-section'),
            portfolioSection: document.getElementById('portfolio-section'),
            emailSection: document.getElementById('email-section'),
            whatsappSection: document.getElementById('whatsapp-section')
        };
        
        this.portfolioUrl = 'https://archana-prabhat.vercel.app/';
        this.email = 'archanaprabhathtk@gmail.com';
        
    
        const phone = "916282581851"; 
        this.whatsappUrl = `https://wa.me/${phone}`;
        
        this.bindEvents();
    }
    
    bindEvents() {
        // Open modal when clicking profile circle
        if (this.dom.profileBtn) {
            this.dom.profileBtn.addEventListener('click', () => this.openModal());
        }
        
        // Close modal
        if (this.dom.closeBtn) {
            this.dom.closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (this.dom.profileBackdrop) {
            this.dom.profileBackdrop.addEventListener('click', () => this.closeModal());
        }
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.dom.profileModal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
        
        // Resume download
        if (this.dom.resumeSection) {
            this.dom.resumeSection.addEventListener('click', () => this.downloadResume());
        }
        
        // Portfolio link
        if (this.dom.portfolioSection) {
            this.dom.portfolioSection.addEventListener('click', () => this.openPortfolio());
        }
        
        // Email
        if (this.dom.emailSection) {
            this.dom.emailSection.addEventListener('click', () => this.openEmail());
        }
        
        // WhatsApp
        if (this.dom.whatsappSection) {
            this.dom.whatsappSection.addEventListener('click', () => this.openWhatsApp());
        }
    }
    
    openModal() {
        this.dom.profileModal.classList.remove('hidden');
        this.dom.profileBackdrop.classList.remove('hidden');
        
        // Trigger animation
        setTimeout(() => {
            this.dom.profileModal.classList.add('show');
            this.dom.profileBackdrop.classList.add('show');
        }, 10);
    }
    
    closeModal() {
        this.dom.profileModal.classList.remove('show');
        this.dom.profileBackdrop.classList.remove('show');
        
        setTimeout(() => {
            this.dom.profileModal.classList.add('hidden');
            this.dom.profileBackdrop.classList.add('hidden');
        }, 250);
    }
    
    downloadResume() {
        // Create a temporary link to download the resume
        const link = document.createElement('a');
        link.href = 'assets/resume.pdf';
        link.download = 'Archana_TK_Resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    openPortfolio() {
        window.open(this.portfolioUrl, '_blank');
    }
    
    openEmail() {
        window.location.href = `mailto:${this.email}`;
    }
    
    openWhatsApp() {
        window.open(this.whatsappUrl, '_blank');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new ProfileModalManager();
    }, 100);
});
