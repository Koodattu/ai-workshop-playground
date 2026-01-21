# Technical Documentation

> In-depth technical guide for AI Workshop Playground

This document provides detailed technical information about the AI Workshop Playground architecture, implementation details, API specifications, and deployment considerations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Data Flow](#data-flow)
- [Authentication & Rate Limiting](#authentication--rate-limiting)
- [AI Integration](#ai-integration)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Frontend Architecture](#frontend-architecture)
- [Performance Optimizations](#performance-optimizations)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

AI Workshop Playground follows a three-tier architecture with a React frontend, Express.js backend, and MongoDB database.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                           │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │   Chat Panel    │  │  Monaco Editor  │  │   Preview Panel    │  │
│  │  (Prompts UI)   │  │  (Code Display) │  │ (Sandboxed iframe) │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────┬──────────┘  │
│           │                    │                      │             │
│           └────────────────────┼──────────────────────┘             │
│                                │                                    │
│                    ┌───────────▼───────────┐                        │
│                    │      API Client       │                        │
│                    │  (lib/api.ts)         │                        │
│                    └───────────┬───────────┘                        │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ HTTP/SSE
                                 │ (Server-Sent Events for streaming)
┌────────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (Express.js)                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Middleware Stack                          │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │  │
│  │  │   CORS     │→ │ workshopGuard│→ │  errorHandler        │ │  │
│  │  │            │  │ (Auth+Rate   │  │                      │ │  │
│  │  └────────────┘  │  Limiting)   │  └──────────────────────┘ │  │
│  │                  └──────────────┘                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Controllers                             │  │
│  │  ┌─────────────────┐           ┌──────────────────────────┐ │  │
│  │  │  aiController   │           │   adminController        │ │  │
│  │  │  - generateCode │           │   - CRUD passwords       │ │  │
│  │  │  - Gemini API   │           │   - Usage stats          │ │  │
│  │  └─────────────────┘           └──────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Mongoose Models                           │  │
│  │  ┌─────────────────┐           ┌──────────────────────────┐ │  │
│  │  │   Password      │           │        Usage             │ │  │
│  │  │   Schema        │           │        Schema            │ │  │
│  │  └─────────────────┘           └──────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Google Gemini API Client                        │  │
│  │              (@google/generative-ai)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                         MongoDB Database                            │
│                                                                     │
│  ┌──────────────────────┐        ┌──────────────────────────────┐  │
│  │   passwords          │        │         usage                │  │
│  │   Collection         │        │         Collection           │  │
│  │                      │        │                              │  │
│  │  - code (unique)     │        │  - passwordId (ref)          │  │
│  │  - expiresAt         │        │  - visitorId                 │  │
│  │  - maxUsesPerUser    │        │  - useCount                  │  │
│  │  - isActive          │        │  - compound index            │  │
│  └──────────────────────┘        └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Technology                       | Version | Purpose                         |
| -------------------------------- | ------- | ------------------------------- |
| **Next.js**                      | 15.x    | React framework with App Router |
| **React**                        | 19.x    | UI library                      |
| **TypeScript**                   | 5.x     | Type safety                     |
| **Tailwind CSS**                 | 3.x     | Utility-first styling           |
| **Monaco Editor**                | 0.52.x  | Code editor (VS Code engine)    |
| **next-intl**                    | 3.x     | Internationalization            |
| **@fingerprintjs/fingerprintjs** | 4.x     | Browser fingerprinting          |

### Backend

| Technology                | Version | Purpose                   |
| ------------------------- | ------- | ------------------------- |
| **Node.js**               | 18+     | JavaScript runtime        |
| **Express.js**            | 4.x     | Web framework             |
| **Mongoose**              | 8.x     | MongoDB ODM               |
| **@google/generative-ai** | 0.21.x  | Gemini API client         |
| **dotenv**                | 16.x    | Environment configuration |

### Infrastructure

| Technology         | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| **MongoDB**        | Document database for passwords and usage tracking |
| **Docker**         | Containerization                                   |
| **Docker Compose** | Multi-container orchestration                      |

## Data Flow

### Code Generation Request Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant MongoDB
    participant Gemini

    User->>Frontend: Enter prompt
    Frontend->>Backend: POST /api/generate<br/>{password, visitorId, prompt, code, history}

    Backend->>MongoDB: Validate password
    MongoDB-->>Backend: Password valid

    Backend->>MongoDB: Check usage limits
    MongoDB-->>Backend: Under limit

    Backend->>MongoDB: Increment usage count

    Backend->>Gemini: Generate code<br/>(streaming)

    loop Streaming
        Gemini-->>Backend: Code chunks
        Backend-->>Frontend: SSE events<br/>(code_start, code_chunk, code_end)
        Frontend->>Frontend: Update Monaco editor
    end

    Gemini-->>Backend: Final response
    Backend-->>Frontend: SSE complete event<br/>(message, remaining uses)
    Frontend->>User: Display results
```

### Authentication Flow

```mermaid
flowchart TD
    A[User enters password] --> B{workshopGuard middleware}
    B --> C[Validate password in DB]
    C --> D{Password valid?}
    D -->|No| E[Return 401 Unauthorized]
    D -->|Yes| F{Password active?}
    F -->|No| E
    F -->|Yes| G{Password expired?}
    G -->|Yes| E
    G -->|No| H[Generate/retrieve visitor ID]
    H --> I[Check usage for visitor+password]
    I --> J{Under limit?}
    J -->|No| K[Return 429 Too Many Requests]
    J -->|Yes| L[Continue to controller]
```

## Authentication & Rate Limiting

### Workshop Guard Middleware

The `workshopGuard` middleware (`backend/src/middleware/workshopGuard.js`) handles both authentication and rate limiting:

```javascript
// Pseudo-code flow
async function workshopGuard(req, res, next) {
  // 1. Extract credentials
  const { password, visitorId } = req.body;

  // 2. Validate password exists and is active
  const passwordDoc = await Password.findOne({
    code: password,
    isActive: true,
  });

  if (!passwordDoc || passwordDoc.expiresAt < now) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // 3. Check rate limits
  const usage = await Usage.findOne({
    passwordId: passwordDoc._id,
    visitorId,
  });

  if (usage && usage.useCount >= passwordDoc.maxUsesPerUser) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      limit: passwordDoc.maxUsesPerUser,
      remaining: 0,
    });
  }

  // 4. Attach to request and continue
  req.passwordDoc = passwordDoc;
  req.visitorId = visitorId;
  next();
}
```

### Usage Tracking Strategy

- **Per-Machine Identification**: Uses FingerprintJS to generate unique visitor IDs based on browser characteristics (canvas fingerprinting, WebGL, audio context)
- **Compound Indexing**: MongoDB compound index on `(passwordId, visitorId)` ensures fast lookups
- **Atomic Updates**: Usage count incremented atomically using `findOneAndUpdate` with `$inc`
- **No User Accounts**: Privacy-focused design - no personal information stored

### Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
```

## AI Integration

### Gemini API Configuration

The backend uses Google's Gemini 2.5 Flash model with structured output:

```javascript
// backend/src/controllers/aiController.js

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `You are a code generator for web development workshops.

    RULES:
    - Generate clean, production-ready HTML/CSS/JavaScript
    - NEVER include markdown formatting or code blocks
    - Output ONLY raw HTML code
    - Include inline CSS and JavaScript
    - Make designs modern, responsive, and visually appealing
    - Use semantic HTML5 elements
    - Ensure proper indentation`,

  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        code: { type: "string" },
      },
    },
  },
});
```

### Context Management

The backend maintains conversation context by sending:

1. **Existing Code** (if any): Current code in the editor
2. **Message History**: Last 10 messages from the conversation
3. **New Prompt**: User's current request

```javascript
const prompt = `
${existingCode ? `Current code:\n${existingCode}\n\n` : ""}
${messageHistory.length > 0 ? `Previous conversation:\n${formattedHistory}\n\n` : ""}
User request: ${userPrompt}
`;
```

This allows for iterative modifications like:

- "Add a contact form"
- "Make the header sticky"
- "Change the color scheme to blue"

### Streaming Implementation

**Backend (SSE - Server-Sent Events):**

```javascript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

// Stream start
res.write(`data: ${JSON.stringify({ type: "code_start" })}\n\n`);

// Stream chunks
const result = await model.generateContentStream(prompt);
for await (const chunk of result.stream) {
  const text = chunk.text();
  res.write(
    `data: ${JSON.stringify({
      type: "code_chunk",
      content: text,
    })}\n\n`,
  );
}

// Stream end
res.write(
  `data: ${JSON.stringify({
    type: "complete",
    message: parsed.message,
    remaining: remainingUses,
  })}\n\n`,
);
```

**Frontend (EventSource):**

```typescript
// frontend/src/lib/api.ts

const eventSource = new EventSource("/api/generate");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "code_start":
      onCodeStart?.();
      break;
    case "code_chunk":
      onCodeChunk?.(data.content);
      break;
    case "complete":
      onComplete?.(data);
      break;
  }
};
```

## API Reference

### Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: Configurable via `NEXT_PUBLIC_API_URL`

### Endpoints

#### Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "status": "ok"
}
```

---

#### Generate Code

```http
POST /api/generate
```

**Headers:**

```http
Content-Type: application/json
```

**Request Body:**

```json
{
  "password": "WORKSHOP2024",
  "visitorId": "fp_abc123def456",
  "prompt": "Create a landing page with a hero section",
  "existingCode": "<!DOCTYPE html>...", // Optional
  "messageHistory": [
    // Optional
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response (Server-Sent Events):**

The response is a stream of SSE events:

```
event: message
data: {"type":"code_start"}

event: message
data: {"type":"code_chunk","content":"<!DOCTYPE html>\n"}

event: message
data: {"type":"code_chunk","content":"<html>\n"}

...

event: message
data: {"type":"code_end"}

event: message
data: {"type":"complete","message":"Created a landing page","remaining":19}
```

**Error Response:**

```json
{
  "error": "Invalid or expired password",
  "code": "INVALID_PASSWORD"
}
```

**Status Codes:**

- `200` - Success (streaming)
- `401` - Invalid or expired password
- `429` - Rate limit exceeded
- `500` - Server error

---

#### Create Workshop Password

```http
POST /api/admin/passwords
```

**Headers:**

```http
Content-Type: application/json
X-Admin-Secret: your-admin-secret
```

**Request Body:**

```json
{
  "code": "SPRING2026",
  "expiresAt": "2026-06-30T23:59:59.999Z",
  "maxUsesPerUser": 30
}
```

**Response:**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "code": "SPRING2026",
  "expiresAt": "2026-06-30T23:59:59.999Z",
  "maxUsesPerUser": 30,
  "isActive": true,
  "createdAt": "2026-01-21T10:00:00.000Z"
}
```

---

#### List All Passwords

```http
GET /api/admin/passwords
```

**Headers:**

```http
X-Admin-Secret: your-admin-secret
```

**Response:**

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "code": "SPRING2026",
    "expiresAt": "2026-06-30T23:59:59.999Z",
    "maxUsesPerUser": 30,
    "isActive": true,
    "createdAt": "2026-01-21T10:00:00.000Z"
  }
]
```

---

#### Update Password

```http
PUT /api/admin/passwords/:id
```

**Headers:**

```http
Content-Type: application/json
X-Admin-Secret: your-admin-secret
```

**Request Body:**

```json
{
  "isActive": false
}
```

**Response:**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "code": "SPRING2026",
  "isActive": false,
  "expiresAt": "2026-06-30T23:59:59.999Z",
  "maxUsesPerUser": 30
}
```

---

#### Delete Password

```http
DELETE /api/admin/passwords/:id
```

**Headers:**

```http
X-Admin-Secret: your-admin-secret
```

**Response:**

```json
{
  "message": "Password deleted"
}
```

---

#### Get Usage Statistics

```http
GET /api/admin/usage
```

**Headers:**

```http
X-Admin-Secret: your-admin-secret
```

**Response:**

```json
{
  "totalPasswords": 5,
  "activePasswords": 3,
  "totalUsers": 47,
  "totalRequests": 892,
  "byPassword": [
    {
      "code": "SPRING2026",
      "users": 25,
      "requests": 487,
      "isActive": true
    }
  ]
}
```

## Database Schema

### Password Collection

```javascript
{
  _id: ObjectId,
  code: String,              // Unique workshop password
  expiresAt: Date,          // Expiration timestamp
  maxUsesPerUser: Number,   // Max requests per visitor
  isActive: Boolean,        // Can be disabled without deleting
  createdAt: Date,          // Auto-generated
  updatedAt: Date           // Auto-generated
}

// Indexes
{ code: 1 }  // Unique index
```

### Usage Collection

```javascript
{
  _id: ObjectId,
  passwordId: ObjectId,     // References Password._id
  visitorId: String,        // FingerprintJS ID
  useCount: Number,         // Number of requests made
  lastUsedAt: Date,         // Last request timestamp
  createdAt: Date,          // Auto-generated
  updatedAt: Date           // Auto-generated
}

// Indexes
{ passwordId: 1, visitorId: 1 }  // Compound unique index
{ passwordId: 1 }                 // For aggregation queries
```

### Mongoose Models

**Password Model:**

```javascript
// backend/src/models/Password.js

const passwordSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    maxUsesPerUser: {
      type: Number,
      default: 20,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);
```

**Usage Model:**

```javascript
// backend/src/models/Usage.js

const usageSchema = new mongoose.Schema(
  {
    passwordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Password",
      required: true,
    },
    visitorId: {
      type: String,
      required: true,
    },
    useCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for fast lookups
usageSchema.index({ passwordId: 1, visitorId: 1 }, { unique: true });
```

## Frontend Architecture

### Component Structure

```
src/
├── app/
│   ├── page.tsx                    # Main workspace page
│   ├── admin/page.tsx              # Admin dashboard
│   ├── layout.tsx                  # Root layout with providers
│   └── globals.css                 # Global styles
│
├── components/
│   ├── workspace/
│   │   ├── ChatPanel.tsx           # Chat interface (left panel)
│   │   ├── EditorPanel.tsx         # Monaco editor (center panel)
│   │   ├── PreviewPanel.tsx        # Live preview (right panel)
│   │   └── PasswordModal.tsx       # Workshop password input
│   │
│   ├── admin/
│   │   └── PasswordManager.tsx     # Admin password CRUD
│   │
│   └── ui/
│       ├── Button.tsx              # Reusable button
│       ├── LanguageSwitcher.tsx    # EN/FI toggle
│       ├── Spinner.tsx             # Loading indicator
│       └── Toast.tsx               # Notification system
│
├── contexts/
│   └── LanguageContext.tsx         # i18n state management
│
├── hooks/
│   ├── useLocalStorage.ts          # Persistent local state
│   └── useVisitorId.ts             # FingerprintJS wrapper
│
├── lib/
│   ├── api.ts                      # API client functions
│   ├── config.ts                   # Frontend configuration
│   └── templates.ts                # Code templates
│
└── types/
    └── index.ts                    # TypeScript definitions
```

### Key Components

#### ChatPanel

**Responsibilities:**

- Display conversation messages
- Handle prompt input
- Show workshop password status (remaining uses)
- Provide template selection
- Display loading states and errors

**State Management:**

- Messages array (user + assistant)
- Loading state
- Error state
- Remaining uses counter

#### EditorPanel

**Responsibilities:**

- Render Monaco editor
- Handle code streaming updates
- Auto-format code after generation
- Provide code editing capabilities (syntax highlighting, autocomplete, undo/redo)

**Performance Optimization:**

```typescript
// Direct Monaco API manipulation for streaming
const appendCode = useCallback((text: string) => {
  const editor = editorRef.current;
  if (!editor) return;

  // Get current position
  const model = editor.getModel();
  const lastLine = model.getLineCount();
  const lastColumn = model.getLineLength(lastLine) + 1;

  // Append text directly (O(1) operation)
  editor.executeEdits("streaming", [
    {
      range: new monaco.Range(lastLine, lastColumn, lastLine, lastColumn),
      text: text,
    },
  ]);

  // Auto-scroll to bottom
  editor.revealLine(lastLine + text.split("\n").length);
}, []);
```

**Features:**

- Line-by-line streaming (buffers incomplete lines)
- 60fps updates via `requestAnimationFrame`
- Cursor position preservation during formatting
- Keyboard shortcuts (Ctrl+S to format, etc.)

#### PreviewPanel

**Responsibilities:**

- Render user code in sandboxed iframe
- Handle auto-refresh toggle
- Provide fullscreen mode
- Display compilation errors (if any)

**Sandboxing:**

```tsx
<iframe sandbox="allow-scripts" srcDoc={code} className="w-full h-full" />
```

Security features:

- No `allow-same-origin` (prevents accessing parent window)
- No `allow-forms` (prevents form submission)
- Only `allow-scripts` (enables JavaScript)

### State Management

**Local Storage:**

- Workshop password (persistent across sessions)
- Visitor ID (persistent across sessions)
- Code state (not persistent - resets on reload)
- Language preference (persistent)

**React State:**

- Messages (in-memory during session)
- Code (in-memory during session)
- Loading/error states (ephemeral)
- Template selection (ephemeral)

### Internationalization (i18n)

**Implementation:**

- Uses `next-intl` for translations
- Supports English (`en`) and Finnish (`fi`)
- Language context wraps entire app
- Messages stored in `messages/en.json` and `messages/fi.json`

**Usage:**

```tsx
import { useTranslations } from "next-intl";

const Component = () => {
  const t = useTranslations("ChatPanel");
  return <p>{t("placeholder")}</p>;
};
```

## Performance Optimizations

### 1. Streaming Code Generation

**Problem**: Setting entire code string in React state on every chunk causes O(n) re-renders.

**Solution**: Direct Monaco editor API manipulation:

```typescript
// ❌ Bad: O(n²) complexity
setCode((prevCode) => prevCode + newChunk); // Re-renders entire editor

// ✅ Good: O(1) append operation
editor.executeEdits("streaming", [
  {
    range: new monaco.Range(lastLine, lastColumn, lastLine, lastColumn),
    text: newChunk,
  },
]);
```

**Result**: 60fps streaming performance even with large files.

### 2. Line Buffering

**Problem**: Streaming raw text can result in incomplete lines (e.g., `<div cla`).

**Solution**: Buffer incomplete lines until newline received:

```typescript
let buffer = "";

const handleChunk = (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split("\n");

  // Keep last incomplete line in buffer
  buffer = lines.pop() || "";

  // Append complete lines to editor
  if (lines.length > 0) {
    appendToEditor(lines.join("\n") + "\n");
  }
};
```

### 3. requestAnimationFrame Throttling

**Problem**: SSE can send chunks faster than browser can render.

**Solution**: Queue updates and process at 60fps:

```typescript
let updateQueued = false;
const chunks: string[] = [];

const queueUpdate = (chunk: string) => {
  chunks.push(chunk);

  if (!updateQueued) {
    updateQueued = true;
    requestAnimationFrame(() => {
      const allChunks = chunks.join("");
      chunks.length = 0;
      appendToEditor(allChunks);
      updateQueued = false;
    });
  }
};
```

### 4. Debounced Auto-formatting

**Problem**: Formatting large code on every change is expensive.

**Solution**: Format only after generation completes:

```typescript
// Wait for code_end event
if (event.type === "code_end") {
  // Auto-format after 100ms (allows buffer to flush)
  setTimeout(() => {
    editor.getAction("editor.action.formatDocument")?.run();
  }, 100);
}
```

### 5. Lazy Loading Monaco

**Implementation**:

```typescript
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <Spinner />
});
```

**Benefit**: Reduces initial bundle size by ~3MB.

## Deployment

### Docker Compose (Recommended)

**Production Deployment:**

1. Clone repository:

   ```bash
   git clone https://github.com/yourusername/ai-workshop-playground.git
   cd ai-workshop-playground
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

3. Build and start:

   ```bash
   docker-compose up --build -d
   ```

4. Verify:
   ```bash
   docker-compose ps
   curl http://localhost:5000/api/health
   ```

**Services:**

- `frontend`: Next.js app on port 3000
- `backend`: Express API on port 5000
- `db`: MongoDB on port 27017

**Volumes:**

- `mongodb_data`: Persists database across restarts

### Manual Deployment

**Backend:**

```bash
cd backend
npm install --production
npm run build  # If TypeScript
NODE_ENV=production node src/index.js
```

**Frontend:**

```bash
cd frontend
npm install --production
npm run build
npm start
```

**Requirements:**

- Node.js 18+
- MongoDB 5+
- Reverse proxy (nginx) for HTTPS
- Process manager (PM2) for production

### Environment Configuration

**Critical Variables:**

- `GEMINI_API_KEY` - Required for AI generation
- `ADMIN_SECRET` - Secure random string for admin access
- `MONGO_URI` - Production MongoDB connection string
- `FRONTEND_URL` - Must match actual frontend URL for CORS

**Production Checklist:**

- [ ] Set strong `ADMIN_SECRET`
- [ ] Use MongoDB authentication
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up monitoring (e.g., PM2, Prometheus)
- [ ] Configure log rotation
- [ ] Set `NODE_ENV=production`
- [ ] Test password creation flow
- [ ] Test rate limiting

## Environment Variables

### Backend (.env)

```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
MONGO_URI=mongodb://username:password@host:27017/workshop?authSource=admin

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Security
ADMIN_SECRET=your_secure_random_secret_here
FRONTEND_URL=https://workshop.yourdomain.com

# Optional: Gemini Model (defaults to gemini-2.5-flash)
GEMINI_MODEL=gemini-2.5-flash
```

### Frontend (.env.local)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Docker Compose (.env)

```bash
# Inherits backend and frontend variables
# Additional Docker-specific:
COMPOSE_PROJECT_NAME=workshop
```

## Security Considerations

### 1. API Key Protection

- ✅ Gemini API key stored only on backend
- ✅ Never exposed in frontend code or network responses
- ✅ Environment variable not committed to Git

### 2. Admin Authentication

- ✅ Admin routes protected by `X-Admin-Secret` header
- ✅ Secret should be cryptographically random (use `openssl rand -hex 32`)
- ❌ No rate limiting on admin routes (consider adding)
- ❌ No IP whitelisting (consider for production)

### 3. CORS Configuration

```javascript
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Admin-Secret"],
  }),
);
```

**Recommendations:**

- Use exact origin (not wildcard)
- Restrict methods to required only
- Validate `X-Admin-Secret` on every admin request

### 4. Sandboxed Code Execution

**Current Implementation:**

```tsx
<iframe sandbox="allow-scripts" />
```

**Sandbox Restrictions:**

- ✅ No access to parent window
- ✅ No cookies or local storage access
- ✅ No form submission
- ✅ No top-level navigation
- ⚠️ JavaScript execution allowed (needed for functionality)

**Limitations:**

- Cannot prevent infinite loops
- Cannot limit CPU/memory usage
- No protection against DOM manipulation attacks within iframe

**Mitigations:**

- Timeout on code execution (manual refresh)
- No persistent state across refreshes
- Iframe isolated from parent document

### 5. Rate Limiting

**Current Implementation:**

- ✅ Per-machine limits prevent abuse
- ✅ Configurable max uses per password
- ✅ Atomic usage increment (no race conditions)

**Limitations:**

- ❌ No global rate limit (all workshop passwords combined)
- ❌ No IP-based rate limiting
- ❌ Fingerprint can be spoofed with browser extensions

**Recommendations for Production:**

- Add express-rate-limit for global limits
- Implement IP-based rate limiting at nginx level
- Consider CAPTCHA for repeated failures

### 6. Input Validation

**Backend Validation:**

```javascript
// Example: validateRequest middleware
const { body, validationResult } = require("express-validator");

app.post(
  "/api/generate",
  body("password").isString().trim().notEmpty(),
  body("visitorId").isString().trim().notEmpty(),
  body("prompt").isString().trim().isLength({ min: 1, max: 2000 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Continue...
  },
);
```

**Current Status:**

- ❌ No explicit input validation library used
- ⚠️ Basic validation in workshopGuard
- ❌ No prompt length limits enforced

**Recommendations:**

- Add `express-validator`
- Limit prompt length (e.g., 2000 chars)
- Sanitize user inputs before logging
- Validate message history array length

## Troubleshooting

### Common Issues

#### 1. "Invalid or expired password"

**Symptoms**: User cannot generate code despite correct password.

**Diagnosis:**

```bash
# Check password in database
mongosh workshop
db.passwords.findOne({ code: "WORKSHOP2024" })
```

**Solutions:**

- Verify password exists and `isActive: true`
- Check `expiresAt` is in the future
- Ensure password is uppercase (schema enforces this)

#### 2. "Rate limit exceeded"

**Symptoms**: User gets 429 error even though they haven't used all requests.

**Diagnosis:**

```bash
# Check usage count
db.usage.findOne({
  visitorId: "fp_abc123",
  passwordId: ObjectId("...")
})
```

**Solutions:**

- Reset usage: `db.usage.deleteOne({ visitorId: "..." })`
- Increase limit: `db.passwords.updateOne({ code: "..." }, { $set: { maxUsesPerUser: 50 } })`
- User may have changed browsers (new visitor ID)

#### 3. Code generation not streaming

**Symptoms**: Code appears all at once instead of line-by-line.

**Diagnosis:**

- Check browser console for SSE errors
- Verify `Content-Type: text/event-stream` in network tab
- Check for nginx/proxy buffering settings

**Solutions:**

```nginx
# Nginx configuration for SSE
location /api/generate {
    proxy_pass http://backend:5000;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
}
```

#### 4. MongoDB connection errors

**Symptoms**: Backend crashes with `MongoServerError`.

**Diagnosis:**

```bash
# Test MongoDB connection
mongosh $MONGO_URI
```

**Solutions:**

- Verify MongoDB is running: `docker ps | grep mongo`
- Check connection string format
- Ensure network connectivity
- Verify authentication credentials

#### 5. CORS errors in browser

**Symptoms**: Network requests fail with CORS policy errors.

**Diagnosis:**
Check browser console:

```
Access to fetch at 'http://localhost:5000/api/generate' from origin
'http://localhost:3000' has been blocked by CORS policy
```

**Solutions:**

- Verify `FRONTEND_URL` in backend `.env` matches frontend URL
- Restart backend after changing environment variables
- Check for trailing slashes (should not have)

#### 6. Monaco editor not loading

**Symptoms**: Center panel shows loading spinner indefinitely.

**Diagnosis:**

- Check browser console for errors
- Verify Monaco CDN accessibility
- Check network tab for failed requests

**Solutions:**

```typescript
// Use fallback CDN
<Editor
  options={{
    ...editorOptions,
    // Add CDN fallback
    monacoPath: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs'
  }}
/>
```

#### 7. High memory usage

**Symptoms**: Backend/frontend consuming excessive RAM.

**Diagnosis:**

```bash
docker stats
```

**Solutions:**

- Limit conversation history (currently 10 messages)
- Clear old usage records: `db.usage.deleteMany({ lastUsedAt: { $lt: <30_days_ago> } })`
- Restart services periodically
- Add memory limits to Docker containers:
  ```yaml
  services:
    backend:
      deploy:
        resources:
          limits:
            memory: 512M
  ```

### Debug Mode

Enable debug logging:

```bash
# Backend
DEBUG=workshop:* npm run dev

# View MongoDB queries
MONGOOSE_DEBUG=true npm run dev
```

### Health Checks

**Backend:**

```bash
curl http://localhost:5000/api/health
# Expected: {"status":"ok"}
```

**Database:**

```bash
mongosh workshop --eval "db.adminCommand('ping')"
```

**Frontend:**

```bash
curl -I http://localhost:3000
# Expected: HTTP 200
```

---

## Performance Benchmarks

### Code Generation

- **Time to First Byte**: ~500ms (depends on Gemini API)
- **Streaming Rate**: ~60 chunks/second (throttled by requestAnimationFrame)
- **Average Generation Time**: 3-8 seconds for full page
- **Editor Update Performance**: 60fps during streaming

### API Response Times

- `GET /api/health`: <10ms
- `POST /api/admin/passwords`: ~50ms (database write)
- `GET /api/admin/passwords`: ~30ms (database read)
- `POST /api/generate`: 3-8s (streaming, depends on prompt)

### Database Performance

- Password lookup: <5ms (indexed)
- Usage count check: <5ms (compound index)
- Usage increment: <10ms (atomic update)

---

## Future Enhancements

### Planned Features

- [ ] **Code History**: Save/restore previous generations
- [ ] **Export Projects**: Download generated code as ZIP
- [ ] **Code Sharing**: Generate shareable links
- [ ] **Multi-file Projects**: Generate multiple files (HTML, CSS, JS separate)
- [ ] **Framework Support**: React, Vue, Svelte templates
- [ ] **Dark/Light Theme**: User preference for editor theme
- [ ] **Collaborative Mode**: Multiple users on same code
- [ ] **Video Tutorials**: Embed learning resources

### Technical Improvements

- [ ] **WebSocket**: Replace SSE with WebSocket for bidirectional communication
- [ ] **Redis Caching**: Cache password lookups and usage counts
- [ ] **Metrics Dashboard**: Prometheus + Grafana for monitoring
- [ ] **Automated Tests**: Jest + Playwright test suites
- [ ] **CI/CD Pipeline**: GitHub Actions for deployment
- [ ] **Horizontal Scaling**: Load balancer + multiple backend instances
- [ ] **CDN**: Serve static assets from CDN

---

## Support & Contributing

For technical questions or bug reports, please open an issue on GitHub.

**Contribution Guidelines:**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (if applicable)
5. Submit a pull request

---

**Last Updated**: January 21, 2026
**Version**: 1.0.0
