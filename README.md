# InterviewMate 🤝

InterviewMate is a premium peer-to-peer mock interview platform that helps software engineers prepare for interviews together. By matching peers, providing live collaborative coding environments, pre-seeded questions, and automated AI feedback, InterviewMate takes the stress out of technical preparation.

---

## 🌟 Live Demo & Preview

* **Live Demo URL**: `https://interviewmate-demo-placeholder.web.app` (Placeholder)
* **Demo Video**: `https://youtube.com/placeholder-demo-video` (Placeholder)

### 📸 Screenshots
* **Dashboard Overview**: `[Dashboard Screenshot Placement]`
* **Collaborative Coding IDE**: `[Room Screenshot Placement]`
* **SVG feedback Report Card**: `[Feedback Report Screenshot Placement]`

---

## 🛠️ Tech Stack & Architecture

- **Frontend Core**: React 19 + TypeScript + Vite
- **Styling & Transitions**: Tailwind CSS v4 + Framer Motion (page animations and modal states)
- **Collaborative Editor**: Monaco Code Editor (used for coding logic with syntax highlighting)
- **Video & Audio Calling**: Agora RTC Web SDK (for real-time peer-to-peer visual channels)
- **Metrics Charting**: Recharts (for displaying session scores progression over time)
- **Backend & Synchronization**: Firebase Authentication + Firestore (real-time listeners syncing code editor inputs, language configurations, and question panels)
- **AI Feedback Engine**: Claude API (`claude-sonnet-4-20250514`) with a custom structured JSON analysis model (includes client-side AST logic analyzer fallback)

---

## 💻 Local Setup & Development

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org) (v18+) and `npm` installed.

### 2. Clone and Install
```bash
git clone https://github.com/placeholder/interviewmate.git
cd interviewmate
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and supply your Firebase, Agora, and Anthropic Claude credentials:

```env
# Firebase SDK Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Agora Video App ID
VITE_AGORA_APP_ID=your_agora_app_id

# Claude API Key (Optional: Can also be supplied inside the UI)
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

> [!NOTE]
> **No Credentials? No Problem!**
> If you do not configure any environment variables, InterviewMate automatically boots in **Mock Mode**. 
> - Authentication reads from local simulated databases.
> - Code and state updates sync in real-time between tabs using `localStorage` triggers.
> - Video calling automatically accesses your local webcam using standard `getUserMedia` guidelines.
> - AI feedback runs a smart local analyzer that reviews your actual code logic (e.g. nested loops vs maps) to output accurate reviews.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
To bundle and optimize the application for production hosting:
```bash
npm run build
```
The compiled assets will be written to the `dist/` directory.
