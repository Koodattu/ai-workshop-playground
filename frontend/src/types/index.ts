export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  errorDetails?: string;
  errorCode?: string;
}

export interface GenerateRequest {
  password: string;
  visitorId: string;
  prompt: string;
  existingCode?: string;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface GenerateResponse {
  message: string;
  code: string;
}

export interface PasswordEntry {
  _id: string;
  code: string;
  expiresAt: string;
  maxUsesPerUser: number;
  isActive: boolean;
  createdAt?: string;
}

export interface UsageStats {
  _id: string;
  totalUses: number;
  uniqueUsers: number;
  maxUsesPerUser: number;
  passwordCode: string;
  passwordActive: boolean;
  passwordExpires: string;
  avgUsesPerUser: number;
}

export interface ApiError {
  error: string;
  errorCode?: string;
  details?: string[];
  remainingUses?: number;
}

export interface CreatePasswordRequest {
  code: string;
  expiresAt: string;
  maxUsesPerUser: number;
}

// Streaming types
export interface StreamChunk {
  type: "chunk";
  chunk: string;
  accumulated: string;
}

export interface StreamCodeStart {
  type: "code-start";
}

export interface StreamCodeChunk {
  type: "code-chunk";
  chunk: string;
}

export interface StreamCodeComplete {
  type: "code-complete";
}

export interface StreamMessageComplete {
  type: "message-complete";
  message: string;
}

export interface StreamDoneEvent {
  type: "done";
  message: string;
  code: string;
  projectName?: string;
  remaining: number;
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
  errorCode?: string;
  details?: string[];
  remainingUses?: number;
}

export interface StreamMessageUpdate {
  type: "message-update";
  message: string;
}

export interface StreamCodeUpdate {
  type: "code-update";
  code: string;
}

export type StreamEvent =
  | StreamChunk
  | StreamCodeStart
  | StreamCodeChunk
  | StreamCodeComplete
  | StreamMessageComplete
  | StreamDoneEvent
  | StreamErrorEvent
  | StreamMessageUpdate
  | StreamCodeUpdate;

export interface StreamCallbacks {
  onChunk?: (chunk: string, accumulated: string) => void;
  onMessageUpdate?: (message: string) => void;
  onCodeUpdate?: (code: string) => void;
  onCodeStart?: () => void;
  onCodeChunk?: (chunk: string) => void;
  onCodeComplete?: () => void;
  onMessageComplete?: (message: string) => void;
  onDone?: (data: { message: string; code: string; projectName?: string; remaining: number }) => void;
  onError?: (error: string, remainingUses?: number, errorCode?: string, details?: string[]) => void;
}

// Preview control interface
export interface PreviewControl {
  disableAutoRefresh: () => void;
  enableAutoRefresh: () => void;
  forceRefresh: (newCode?: string) => void;
}

// Custom template interface for user-created templates
export interface CustomTemplate {
  id: string;
  name: string;
  code: string;
  projectName?: string; // LLM-provided project name
  createdAt: number; // timestamp for sorting/deletion
  updatedAt: number; // timestamp for tracking last modification
}

// Configuration for custom template management
export const CUSTOM_TEMPLATE_CONFIG = {
  MAX_TEMPLATES: 10,
  ID_PREFIX: "custom-",
  STORAGE_KEY: "custom-templates",
} as const;

// System-wide statistics
export interface SystemStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalThoughtsTokens: number;
  totalTokens: number;
  totalEstimatedCost: number; // in cents
  uniqueUsers: number;
  avgTokensPerRequest: number;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
  activePasswords: number;
}

// Token breakdown (reusable)
export interface TokenBreakdown {
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// User stats within a password
export interface PasswordUserStats {
  visitorId: string;
  requestCount: number;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  estimatedCost: number;
  lastUsed: string;
  firstUsed: string;
}

// Detailed password stats
export interface PasswordDetailedStats {
  password: {
    _id: string;
    code: string;
    isActive: boolean;
    expiresAt: string;
    isExpired: boolean;
    maxUsesPerUser: number;
  };
  stats: TokenBreakdown & {
    totalRequests: number;
  };
  users: PasswordUserStats[];
}

// Paginated users response
export interface PaginatedUsersResponse {
  users: PasswordUserStats[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}

// Request log entry
export interface RequestLogEntry {
  _id: string;
  passwordId: string;
  passwordCode?: string;
  visitorId: string;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
  generationType: string;
  createdAt: string;
}

// Time series data point
export interface TimeSeriesDataPoint {
  timestamp: string;
  requests: number;
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Time series response
export interface TimeSeriesResponse {
  period: "day" | "week" | "month";
  startDate: string;
  endDate: string;
  dataPoints: TimeSeriesDataPoint[];
}

// Shared template interface for templates loaded from share links
export interface SharedTemplate {
  id: string; // local id (shared-{timestamp})
  shareId: string; // the 4-letter share code from the server
  code: string;
  title: string | null;
  projectName?: string; // LLM-provided project name for shared projects
  loadedAt: number; // timestamp when loaded
}

// Configuration for shared template management
export const SHARED_TEMPLATE_CONFIG = {
  MAX_TEMPLATES: 10,
  ID_PREFIX: "shared-",
  STORAGE_KEY: "shared-templates",
} as const;

// Share API response types
export interface CreateShareResponse {
  shareId: string;
  createdAt: string;
}

export interface GetShareResponse {
  shareId: string;
  code: string;
  title: string | null;
  projectName?: string;
  createdAt: string;
}
