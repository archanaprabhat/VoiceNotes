# VoiceNotes

A modern voice recording web application built with pure vanilla JavaScript, featuring real-time waveform visualization, AI transcription, and intelligent organization.

## Live Demo

**[Try it live on GitHub Pages](https://archanaprabhat.github.io/VoiceNotes/)**

## Features

### Core Functionality
- Audio recording with one-click microphone access
- Live waveform visualization using Canvas and Web Audio APIs
- Local storage with IndexedDB for persistence
- Clean interface for viewing all saved recordings
- Full playback controls with progress tracking and seek
- Built entirely with vanilla JavaScript (no frameworks)

### Additional Capabilities
- Responsive design for desktop and mobile
- Real-time recording duration timer
- Delete and download recordings
- AI transcription via Groq's Whisper API
- Smart AI-generated titles
- Quick search with keyboard shortcuts
- Calendar view for organization
- Daily AI-generated highlights
- Modern glassmorphism UI with dark mode

## Technology Stack

- HTML5 for semantic markup
- CSS3 with modern styling
- Vanilla JavaScript (no frameworks)
- Web Audio API for audio analysis and waveforms
- MediaRecorder API for recording
- IndexedDB for client-side storage
- Canvas API for visualization
- Groq API for AI features (optional)

## Getting Started

### Prerequisites
- Modern web browser with microphone access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/archanaprabhat/voice-notes.git
   cd voice-notes
   ```

2. Open in browser:
   - Simply open `index.html` in your browser, or
   - Use a local server:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx serve
   ```

3. Navigate to `http://localhost:8000` and allow microphone permissions

### Optional Configuration

To enable AI features with your own Groq API key:

1. Open `script.js`
2. Find line 350: `static GROQ_API_KEY = 'your-api-key-here'`
3. Replace with your API key from [console.groq.com](https://console.groq.com)

The app works fully without an API key—you simply won't have AI transcription and titles.

## Technical Implementation

### Waveform Visualization
- Web Audio API's AnalyserNode analyzes frequency data
- Canvas-based rendering with layered sine waves
- Smooth animations via requestAnimationFrame
- Dynamic amplitude responds to audio input

### Audio Recording
- MediaRecorder API captures audio in WebM format
- Blob storage with IndexedDB persistence
- Automatic cleanup of media streams

### Interface Design
- Glassmorphism aesthetic with backdrop filters
- Smooth transitions and animations
- Mobile-first responsive layout
- Keyboard shortcuts for efficiency

## Acknowledgments

- Design inspired by voicenotes.com
- AI powered by Groq's Whisper and Llama models

---

Built with vanilla JavaScript
