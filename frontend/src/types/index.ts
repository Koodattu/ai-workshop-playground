export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  errorDetails?: string;
  errorCode?: string;
  failedPrompt?: string;
}

// Chat mode type - determines whether AI generates code (EDIT) or just responds (ASK)
export type ChatMode = "edit" | "ask";

// AI model preference sent as a symbolic value; backend maps it to provider model IDs.
export type ModelPreference = "fast" | "balanced" | "accurate" | "gpt54mini" | "gpt54" | "gpt55";
export type ThinkingLevel = "none" | "low" | "medium" | "high" | "xhigh";
export type AuthMode = "password" | "api-key";
export type ApiKeyProvider = "gemini" | "openai";

export interface UserApiKeySettings {
  gemini: string;
  openai: string;
  accessToken: string;
}

export interface GenerationUsageSummary {
  provider: ApiKeyProvider;
  modelPreference: ModelPreference | string;
  modelId: string;
  modelLabel: string;
  modelThinking?: ThinkingLevel | string | null;
  mode: ChatMode;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCost: number;
  addedLines: number;
  removedLines: number;
  createdAt: string;
}

export interface ApiKeyUsageEntry extends GenerationUsageSummary {
  id: string;
}

export interface GenerateRequest {
  authMode?: AuthMode;
  password?: string;
  apiKeys?: Partial<Record<ApiKeyProvider, string>>;
  apiKeyAccessToken?: string;
  visitorId: string;
  prompt: string;
  existingCode?: string;
  parentVersionId?: string | null;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  mode?: ChatMode;
  modelPreference?: ModelPreference;
}

export interface GenerateResponse {
  message: string;
  code: string;
  projectName?: string;
  editMode?: "replace_all" | "patch";
  version?: CodeVersion;
  usage?: GenerationUsageSummary | null;
}

export interface VersionListRequest {
  authMode?: AuthMode;
  password?: string;
  visitorId: string;
  apiKeyAccessToken?: string;
  includeCode?: boolean;
}

export interface ModelSettingsEntry {
  enabled: boolean;
  thinking: ThinkingLevel;
}

export type ModelSettings = Record<ModelPreference, ModelSettingsEntry>;

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
  editMode?: "replace_all" | "patch";
  version?: CodeVersion;
  remaining?: number;
  usage?: GenerationUsageSummary | null;
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
  onDone?: (data: { message: string; code: string; projectName?: string; editMode?: "replace_all" | "patch"; version?: CodeVersion; remaining?: number; usage?: GenerationUsageSummary | null }) => void;
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
  currentVersionId?: string | null; // latest AI version for this creation
  rootVersionId?: string | null; // root version tree for this creation
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
  mode?: "edit" | "ask";
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

// Share link entry for admin tracking
export interface ShareLinkEntry {
  _id: string;
  shareId: string;
  code: string;
  title: string | null;
  projectName: string | null;
  createdAt: string;
}

export interface CodeVersion {
  id: string;
  _id?: string;
  visitorId: string;
  passwordId?: string | null;
  accessMode?: AuthMode | string | null;
  parentVersionId?: string | null;
  rootVersionId?: string | null;
  code: string;
  codePreview?: string;
  codeLength?: number;
  prompt: string;
  message: string;
  projectName?: string | null;
  modelProvider?: "gemini" | "openai" | null;
  modelPreference?: ModelPreference | string | null;
  modelId?: string | null;
  modelLabel?: string | null;
  modelShortLabel?: string | null;
  modelThinking?: ThinkingLevel | string | null;
  editMode: "replace_all" | "patch";
  editCount: number;
  edits?: Array<{ oldText: string; newText: string }>;
  manualEditsSinceParent?: boolean;
  createdAt: string;
  updatedAt?: string;
}
