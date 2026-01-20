This is a comprehensive, technical blueprint for building the **AI Workshop Playground**. This plan covers the architecture, data schemas, specific logic for the "Workshop Auth," and the integration of the code execution environment.

---

## 1. System Architecture Overview

The application follows a classic **Three-Tier Architecture** packaged in **Docker**.

- **Frontend (Next.js):** A Single Page Application (SPA) layout. It handles state management (the code), user identification (fingerprinting), and the preview rendering (iframe).
- **Backend (Node.js/Express):** A RESTful API. It acts as a gatekeeper, validating the workshop password and enforcing rate limits before communicating with the Gemini API.
- **Database (MongoDB):** A document store to track active workshop sessions and per-user usage counts.

---

## 2. Technical Stack Deep-Dive

### Frontend

- **Framework:** Next.js 14+ (App Router).
- **Code Editor:** `@monaco-editor/react`. This is the most robust choice. It provides VS Code features (intellisense, syntax highlighting) out of the box.
- **State Management:** React `useState` and `useEffect`.
- **Identification:** `FingerprintJS` (Browser Fingerprinting) to track unique machines without requiring user accounts.

### Backend

- **Runtime:** Node.js with Express.
- **AI Integration:** `@google/generative-ai` SDK.
- **Database Client:** `mongoose` for structured interaction with MongoDB.

### Infrastructure

- **Orchestration:** Docker Compose.
- **Communication:** JSON over HTTP.

---

## 3. The "Workshop Auth" Implementation Logic

This is the most critical part of your request. Here is how to handle "machine-based" limits without full authentication.

### The Identification Strategy

1. **On Mount:** When the user opens the app, the frontend checks `localStorage` for a `visitorId`.
2. **Generation:** If it doesn't exist, use `FingerprintJS` to generate a hash of the browser/hardware attributes. Store this in `localStorage`.
3. **The Payload:** Every request to generate code looks like this:

```json
{
  "password": "WORKSHOP_CODE",
  "visitorId": "unique-machine-hash-123",
  "prompt": "Create a spinning 3D cube"
}
```

### The Database Schema (Mongoose)

```javascript
// Password Schema: Created by Admin
const passwordSchema = new Schema({
  code: { type: String, unique: true, required: true },
  expiresAt: { type: Date, required: true },
  maxUsesPerUser: { type: Number, default: 20 },
  isActive: { type: Boolean, default: true },
});

// Usage Schema: Tracks per-machine usage
const usageSchema = new Schema({
  passwordId: { type: Schema.Types.ObjectId, ref: "Password" },
  visitorId: { type: String, required: true },
  useCount: { type: Number, default: 0 },
});
```

---

## 4. Backend Logic Flow (The Proxy)

When the `POST /api/generate` endpoint is hit:

1. **Validate Password:** Check if the password exists in the `Passwords` collection and is not expired.
2. **Check Limit:** Find the `Usage` record for this `passwordId` + `visitorId`.

- If `useCount >= password.maxUsesPerUser`, return `429 Too Many Requests`.

3. **Call Gemini:** \* Initialize the Gemini model (e.g., `gemini-1.5-flash` for speed).

- Send the system instruction + user prompt.

4. **Process Response:**

- Clean the Markdown (remove ```html tags).
- **Increment `useCount**` in the DB.

5. **Return:** Send the raw code back to the frontend.

---

## 5. The Frontend 3-Column Layout

Using Tailwind CSS, you can create a fixed-height workspace that feels like a professional IDE.

### Layout Breakdown (Tailwind)

```html
<div class="flex h-screen overflow-hidden">
  <div class="w-1/4 border-r flex flex-col">
    <div class="flex-1 overflow-y-auto p-4"> {/* Chat History */} </div>
    <div class="p-4 border-t"> {/* Input Box */} </div>
  </div>

  <div class="w-1/3 border-r">
    <MonacoEditor
      language="html"
      value={code}
      onChange={(val) => setCode(val)}
    />
  </div>

  <div class="flex-1 bg-white">
    <iframe
      srcDoc={renderedCode}
      sandbox="allow-scripts"
      className="w-full h-full border-none"
    />
  </div>
</div>

```

---

## 6. Implementation Steps (Roadmap)

### Phase 1: The Core (Day 1)

- **Docker Setup:** Get Mongo, Express, and Next.js talking to each other.
- **The "Runner":** Create the iframe preview logic where typing in a text area updates the iframe in real-time.

### Phase 2: AI & Auth (Day 2)

- **Gemini Integration:** Set up the backend service to call the API.
- **Middleware:** Write the logic that checks the `visitorId` and `password` against MongoDB.
- **Cleaning Logic:** Write a regex or utility function to ensure the AI's response is valid HTML/JS/CSS without conversational filler.

### Phase 3: Admin & Polishing (Day 3)

- **Admin Route:** A simple page `/admin` where you can `POST` new workshop passwords.
- **UI Polish:** Add loading spinners (very important while the AI is thinking) and "Copy Code" buttons.
- **Error Handling:** Show clear messages if the password is wrong or the limit is reached.

---

## 7. Security & Abuse Prevention

- **The Sandbox:** The `sandbox="allow-scripts"` attribute is your primary defense. It prevents the code inside the iframe from accessing the user's cookies or the parent window's DOM.
- **API Key Safety:** Never expose the Gemini API key in the frontend. It stays strictly in the Docker environment variables on the backend.
- **CORS:** Configure Express to only accept requests from your Next.js frontend's URL.

---

## 1. The Core Infrastructure (Docker Compose)

We use Docker to ensure the workshop environment is identical for everyone.

**`docker-compose.yml` Snippet:**

```yaml
services:
  db:
    image: mongo:latest
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]

  backend:
    build: ./backend
    env_file: .env
    ports: ["5000:5000"]
    depends_on: [db]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 2. The "Workshop Auth" & Rate Limiter Middleware

This is the "brain" of your security. It identifies users by a `visitorId` (generated on the frontend) and validates the workshop `password`.

### Backend Logic (`middleware/auth.js`)

This middleware checks if the password is valid and if the specific machine has reached its prompt limit.

```javascript
const Password = require("../models/Password");
const Usage = require("../models/Usage");

const workshopGuard = async (req, res, next) => {
  const { password, visitorId } = req.body;

  // 1. Validate Password
  const passDoc = await Password.findOne({
    code: password,
    expiresAt: { $gt: new Date() },
  });

  if (!passDoc) return res.status(401).json({ error: "Invalid or expired password" });

  // 2. Check/Update Usage for this specific machine (visitorId)
  let usage = await Usage.findOne({ passwordId: passDoc._id, visitorId });

  if (!usage) {
    usage = new Usage({ passwordId: passDoc._id, visitorId, useCount: 0 });
  }

  if (usage.useCount >= passDoc.maxUsesPerUser) {
    return res.status(429).json({ error: "Prompt limit reached for this workshop." });
  }

  // 3. Increment usage and move to the controller
  usage.useCount += 1;
  await usage.save();
  next();
};
```

---

## 3. Gemini SDK Integration & System Prompting

To ensure the AI returns **only** code that won't break your frontend, use a strict system instruction.

### The System Instruction

Define this at the start of your Gemini session:

> "You are an expert web developer. Your goal is to generate a single-file web application using only HTML, CSS, and Vanilla JavaScript.
> **CRITICAL RULES:**
>
> 1. Return ONLY the code inside a single Markdown code block.
> 2. Do not include any conversational text, explanations, or 'Here is your code' headers.
> 3. Use internal `<style>` and `<script>` tags.
> 4. Ensure the code is self-contained and does not require external assets."

### The Generation Logic (`controllers/aiController.js`)

````javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateCode = async (req, res) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([SYSTEM_INSTRUCTION, req.body.prompt]);
  const rawText = result.response.text();

  // CLEANING: Extract code between ```html and ```
  const codeRegex = /```html?([\s\S]*?)```/i;
  const match = rawText.match(codeRegex);
  const cleanCode = match ? match[1].trim() : rawText;

  res.json({ code: cleanCode });
};
````

---

## 4. Frontend Layout (Next.js + Tailwind)

We want a layout that feels like a professional IDE.

### The Code-Runner Component

```javascript
import Editor from "@monaco-editor/react";
import { useState } from "react";

export default function Workspace() {
  const [code, setCode] = useState("<h1>Build something!</h1>");
  const [prompt, setPrompt] = useState("");

  const handleGenerate = async () => {
    // API Call to /api/generate with { prompt, password, visitorId }
    // Update 'code' state with response
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-white">
      {/* 1. Chat/Prompt Column */}
      <div className="w-1/4 border-r border-slate-700 p-4 flex flex-col">
        <h2 className="text-xl font-bold mb-4">AI Chat</h2>
        <div className="flex-1 overflow-auto"> {/* Chat log here */} </div>
        <textarea className="bg-slate-800 p-2 rounded w-full" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button onClick={handleGenerate} className="bg-blue-600 p-2 mt-2 rounded">
          Generate
        </button>
      </div>

      {/* 2. Monaco Editor Column */}
      <div className="w-1/3 border-r border-slate-700">
        <Editor height="100%" theme="vs-dark" defaultLanguage="html" value={code} onChange={(val) => setCode(val)} options={{ minimap: { enabled: false } }} />
      </div>

      {/* 3. Preview Column */}
      <div className="flex-1 bg-white">
        <iframe srcDoc={code} title="output" sandbox="allow-scripts" className="w-full h-full" />
      </div>
    </div>
  );
}
```

---

## 5. Implementation Checklist

| Step  | Task              | Details                                                                                     |
| ----- | ----------------- | ------------------------------------------------------------------------------------------- |
| **1** | **Database Init** | Create a script to seed the `Passwords` collection with your workshop codes.                |
| **2** | **Visitor ID**    | Use `localStorage.setItem('visitorId', crypto.randomUUID())` if it doesn't exist.           |
| **3** | **API Security**  | Ensure your Express backend has **CORS** enabled only for the frontend URL.                 |
| **4** | **Error States**  | If the AI fails or the limit is hit, show a "Toast" notification instead of a blank screen. |
| **5** | **Admin View**    | Create a route at `/admin` (password protected) to see all usage counts in a table.         |
