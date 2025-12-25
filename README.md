# 🎙️ VoiceNotes
A modern, feature-rich voice recording web application built with **pure vanilla JavaScript**, featuring real-time waveform visualization, AI transcription, and intelligent organization.

## 🌟 Live Demo

**[Try it live on GitHub Pages](https://archanaprabhat.github.io/VoiceNotes/)** 

## ✨ Features

### Core Features (Challenge Requirements)

- ✅ **Audio Recording** - One-click recording with microphone access
- ✅ **Live Waveform Visualization** - Real-time animated waveform using Canvas API and Web Audio API
- ✅ **Local Storage** - All recordings saved in IndexedDB for persistence
- ✅ **Recordings List** - Clean interface displaying all saved recordings
- ✅ **Playback Controls** - Play/pause with progress tracking and seek functionality
- ✅ **Pure Vanilla JS** - No frameworks, just HTML, CSS, and JavaScript

### Bonus Features

- ✅ **Responsive Design** - Works seamlessly on desktop and mobile
- ✅ **Recording Duration** - Real-time timer during recording
- ✅ **Delete Recordings** - Remove unwanted recordings
- ✅ **Download Audio** - Export recordings as WebM files

### Additional Features (Beyond Requirements)

- 🤖 **AI Transcription** - Automatic speech-to-text using Groq's Whisper API
- 🎯 **Smart Titles** - AI-generated titles for each recording
- 🔍 **Search** - Quick search with Ctrl/Cmd+K keyboard shortcut
- 📅 **Calendar View** - Organize recordings by date
- ✨ **Modern UI** - Glassmorphism design with smooth animations
- 🎨 **Dark Mode Ready** - Professional aesthetic
- 📊 **Daily Highlights** - AI-generated summaries of your notes

## 🛠️ Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with glassmorphism effects
- **Vanilla JavaScript** - No frameworks or libraries
- **Web Audio API** - Real-time audio analysis and waveform generation
- **MediaRecorder API** - Audio recording
- **IndexedDB** - Client-side storage
- **Canvas API** - Waveform visualization
- **Groq API** - AI transcription and title generation (optional)

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Microphone access

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/archanaprabhat/voice-notes.git
   cd voice-notes
   ```

2. **Open in browser**

   - Simply open `index.html` in your browser
   - Or use a local server:

   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve
   ```

3. **Access the app**
   - Navigate to `http://localhost:8000`
   - Allow microphone permissions when prompted

### Configuration (Optional)

The app includes AI features powered by Groq API. To use your own API key:

1. Open `script.js`
2. Find line 350: `static GROQ_API_KEY = 'your-api-key-here'`
3. Replace with your Groq API key from [console.groq.com](https://console.groq.com)

> **Note:** The app works perfectly without the API key - you just won't get AI transcription and titles.


## 💡 Key Technical Highlights

### Real-time Waveform

- Uses Web Audio API's `AnalyserNode` for frequency analysis
- Canvas-based rendering with multiple sine wave layers
- Smooth animations using `requestAnimationFrame`
- Dynamic amplitude based on audio input levels

### Audio Recording

- MediaRecorder API for capturing audio
- Blob storage with WebM format
- IndexedDB for persistent storage
- Automatic cleanup of media streams

### UI/UX

- Glassmorphism design with backdrop filters
- Smooth transitions and micro-animations
- Responsive layout with mobile-first approach
- Keyboard shortcuts for power users


##  Acknowledgments

- Design inspiration from [voicenotes.com](https://voicenotes.com)
- Icons from custom SVG designs
- AI powered by Groq's Whisper and Llama models

---

**Built with ❤️ using pure Vanilla JavaScript**
