export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface GenerateRequest {
  password: string;
  visitorId: string;
  prompt: string;
  existingCode?: string;
}

export interface GenerateResponse {
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
