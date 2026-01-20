# AI Workshop Playground

An interactive web application for AI-powered code generation workshops. Users can describe what they want to build, and an AI generates HTML/CSS/JavaScript code that runs live in the browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Chat Panel  │  │ Code Editor  │  │   Live Preview       │  │
│  │  (Prompts)   │  │   (Monaco)   │  │   (Sandboxed iframe) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Express.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Workshop    │  │     Rate     │  │   Gemini API         │  │
│  │  Auth Guard  │──│    Limiter   │──│   Integration        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MongoDB                                  │
│     Passwords Collection    │    Usage Collection               │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **3-Column IDE Layout**: Chat panel, Monaco code editor, live preview
- **AI Code Generation**: Uses Google Gemini to generate HTML/CSS/JS code
- **Workshop Authentication**: Password-based access with configurable limits
- **Per-Machine Rate Limiting**: Track usage by browser fingerprint
- **Admin Dashboard**: Manage workshop passwords and view usage statistics
- **Sandboxed Execution**: User code runs safely in an isolated iframe

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (optional, for full deployment)
- Google Gemini API key

### Development Setup

1. **Clone and setup environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your GEMINI_API_KEY
   ```

2. **Start MongoDB (using Docker):**

   ```bash
   docker run -d -p 27017:27017 --name workshop-mongo mongo:latest
   ```

3. **Start the backend:**

   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. **Start the frontend:**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Open http://localhost:3000**

### Docker Compose (Production)

```bash
cp .env.example .env
# Edit .env with your configuration
docker-compose up --build
```

## Project Structure

```
ai-workshop-playground/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js              # Server entry
│       ├── config/               # Environment config
│       ├── controllers/          # Request handlers
│       │   ├── aiController.js   # Gemini integration
│       │   └── adminController.js
│       ├── middleware/           # Express middleware
│       │   ├── workshopGuard.js  # Auth + rate limiting
│       │   └── errorHandler.js
│       ├── models/               # Mongoose schemas
│       │   ├── Password.js
│       │   └── Usage.js
│       └── routes/               # API routes
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/                  # Next.js App Router
        │   ├── page.tsx          # Main workspace
        │   └── admin/page.tsx    # Admin dashboard
        ├── components/
        │   ├── workspace/        # Main UI components
        │   ├── ui/               # Reusable UI elements
        │   └── admin/            # Admin components
        ├── hooks/                # Custom React hooks
        ├── lib/                  # Utilities & API client
        └── types/                # TypeScript types
```

## API Endpoints

| Method | Endpoint                   | Description               |
| ------ | -------------------------- | ------------------------- |
| GET    | `/api/health`              | Health check              |
| POST   | `/api/generate`            | Generate code from prompt |
| POST   | `/api/admin/passwords`     | Create workshop password  |
| GET    | `/api/admin/passwords`     | List all passwords        |
| PUT    | `/api/admin/passwords/:id` | Update password           |
| DELETE | `/api/admin/passwords/:id` | Delete password           |
| GET    | `/api/admin/usage`         | Usage statistics          |

## Environment Variables

| Variable              | Description                | Default                       |
| --------------------- | -------------------------- | ----------------------------- |
| `PORT`                | Backend server port        | `5000`                        |
| `MONGO_URI`           | MongoDB connection string  | `mongodb://db:27017/workshop` |
| `GEMINI_API_KEY`      | Google Gemini API key      | Required                      |
| `FRONTEND_URL`        | CORS allowed origin        | `http://localhost:3000`       |
| `ADMIN_SECRET`        | Secret for admin endpoints | Required                      |
| `NEXT_PUBLIC_API_URL` | Backend URL for frontend   | `http://localhost:5000`       |

## Creating Workshop Passwords

Use the admin API to create workshop passwords:

```bash
curl -X POST http://localhost:5000/api/admin/passwords \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-admin-secret" \
  -d '{
    "code": "WORKSHOP2024",
    "expiresAt": "2024-12-31T23:59:59Z",
    "maxUsesPerUser": 20
  }'
```

## Security

- **Sandboxed iframe**: User-generated code runs with `sandbox="allow-scripts"`
- **API key protection**: Gemini API key never exposed to frontend
- **CORS**: Configured to accept requests only from the frontend URL
- **Rate limiting**: Per-machine limits prevent abuse
- **Admin protection**: Admin routes require `X-Admin-Secret` header

## License

ISC
