export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  errorDetails?: string;
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
  visitorId: string;
  passwordId: string;
  usageCount: number;
  lastUsedAt: string;
}

export interface ApiError {
  error: string;
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
  remaining: number;
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
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
  onDone?: (data: { message: string; code: string; remaining: number }) => void;
  onError?: (error: string, remainingUses?: number) => void;
}

// Preview control interface
export interface PreviewControl {
  disableAutoRefresh: () => void;
  enableAutoRefresh: () => void;
}
