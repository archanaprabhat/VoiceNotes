# VoiceNotes

Web application for capturing and organizing audio recordings built with vanilla JavaScript and object-oriented design principles, combining real-time audio visualization, AI transcription, search functionality, and calendar views.

https://github.com/user-attachments/assets/3fd12dc4-cc57-43f3-a157-7a98411eab65

**Live Demo: https://archanaprabhat.github.io/VoiceNotes/**

## Features

**Recording**

- Audio recording using MediaRecorder API
- Real-time waveform visualization with multi-layered sine wave animation using Canvas and Web Audio API
- Persistent local storage using IndexedDB for audio blobs and metadata
- Play and pause controls with countdown timer and click-to-seek functionality
- Progress bar with visual feedback during playback

**AI Capabilities**

- Automatic speech-to-text transcription using Groq's Whisper-large-v3 model
- Title generation from transcripts using Llama 3.3 70B Versatile
- Monthly highlights summaries
- Background processing keeps UI responsive

**Search**

- Search across titles and transcripts
- Keyboard shortcut with Ctrl/Cmd+K (changes based on OS)
- Filtering using regex
- Highlighting of selected text with smooth scrolling

**Calendar**

- Day highlighting for dates containing recordings
- View all notes for a selected date in chronological order
- Month navigation with future date blocking
- Skeleton loading states
- Dynamic messages based on recording streaks
- Monthly highlights analyzing all recordings to extract 2 to 4 key insights

**Additional Features**

- Toast notifications
- Download recordings
- Delete recordings with confirmation
- Responsive design with mobile-first approach

## Technical Architecture

**Design Patterns**

- Modular class-based architecture with separation of concerns
- Centralized state management
- Asynchronous pattern using async/await and Promises
- Event-driven interaction

**Recording Lifecycle**

When recording starts, the app requests microphone access and initializes MediaRecorder. When recording stops, audio chunks combine into a single Blob and save immediately to IndexedDB with processing placeholders for title and transcript, making the note appear in the list instantly. In the background, the audio converts to FormData and sends to Groq's Whisper API for transcription. The transcript then goes to Llama for title generation. IndexedDB updates with the actual title and transcript, and the UI refreshes to show the final content.

## Tech Stack

**Frontend**

- HTML5, CSS3 (glassmorphism, animations, Grid, Flexbox)
- Vanilla JavaScript (ES6+ classes, async/await, Promises)
- SVGs from Figma and Lucide React

**Web APIs**

- MediaRecorder, Web Audio (AudioContext, AnalyserNode)
- Canvas, IndexedDB, Fetch

**External Services**

- Groq API (Whisper-large-v3, Llama 3.3 70B Versatile)

## Quick Start

Clone the repository and navigate to the project directory. Open index.html in your browser or run a local server. Allow microphone permissions when prompted.

**Note:** The app works fully offline. AI features (transcription, titles, highlights) require a Groq API key.
