import { config } from "./config";
import type {
  GenerateRequest,
  GenerateResponse,
  PasswordEntry,
  CreatePasswordRequest,
  UsageStats,
  StreamCallbacks,
  SystemStats,
  PasswordDetailedStats,
  PaginatedUsersResponse,
  RequestLogEntry,
  TimeSeriesResponse,
  CreateShareResponse,
  GetShareResponse,
} from "@/types";

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: this.getHttpErrorMessage(response.status) }));
        // Create an error object that includes both the message and the error code
        const errorObj = new Error(error.error || this.getHttpErrorMessage(response.status));
        // Attach errorCode and details as properties so they can be accessed by error handlers
        (errorObj as any).errorCode = error.errorCode;
        (errorObj as any).details = error.details;
        throw errorObj;
      }

      const data = await response.json();
      return { data, headers: response.headers };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      // Network errors - these will be caught by components and translated there
      throw new Error("NETWORK_ERROR");
    }
  }

  private getHttpErrorMessage(status: number): string {
    // Return error codes that can be translated by the UI layer
    switch (status) {
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 429:
        return "TOO_MANY_REQUESTS";
      case 400:
        return "VALIDATION_ERROR";
      case 500:
      case 502:
      case 503:
        return "SERVER_ERROR";
      default:
        return `HTTP_${status}`;
    }
  }

  // Generate code endpoint
  async generateCode(request: GenerateRequest): Promise<{ response: GenerateResponse; remainingUses?: number }> {
    const { data, headers } = await this.request<GenerateResponse>("/api/generate", {
      method: "POST",
      body: JSON.stringify(request),
    });

    const remainingUses = headers.get("X-Remaining-Uses");

    return {
      response: data,
      remainingUses: remainingUses ? parseInt(remainingUses, 10) : undefined,
    };
  }

  // Generate code with streaming
  async generateCodeStream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<() => void> {
    const url = `${this.baseUrl}/api/generate`;
    const abortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: this.getHttpErrorMessage(response.status) }));
        const errorMessage = error.error || this.getHttpErrorMessage(response.status);
        // Pass the full error object including errorCode if available
        callbacks.onError?.(errorMessage, undefined, error.errorCode, error.details);
        return () => abortController.abort();
      }

      // Read the response as a stream
      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.("No response body");
        return () => abortController.abort();
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // Start reading the stream
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines from the buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

            for (const line of lines) {
              if (!line.trim()) continue;

              // Parse SSE format (lines starting with "data: ")
              if (line.startsWith("data: ")) {
                try {
                  const jsonData = line.slice(6); // Remove "data: " prefix
                  const event = JSON.parse(jsonData);

                  // Handle different event types
                  switch (event.type) {
                    case "chunk":
                      callbacks.onChunk?.(event.chunk, event.accumulated);
                      break;
                    case "code-start":
                      callbacks.onCodeStart?.();
                      break;
                    case "code-chunk":
                      callbacks.onCodeChunk?.(event.chunk);
                      break;
                    case "code-complete":
                      callbacks.onCodeComplete?.();
                      break;
                    case "message-complete":
                      callbacks.onMessageComplete?.(event.message);
                      break;
                    case "message-update":
                      callbacks.onMessageUpdate?.(event.message);
                      break;
                    case "code-update":
                      callbacks.onCodeUpdate?.(event.code);
                      break;
                    case "done":
                      callbacks.onDone?.({
                        message: event.message,
                        code: event.code,
                        remaining: event.remaining,
                      });
                      break;
                    case "error":
                      callbacks.onError?.(event.error, event.remainingUses, event.errorCode, event.details);
                      break;
                  }
                } catch (parseError) {
                  console.error("Failed to parse SSE data:", parseError);
                }
              }
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name !== "AbortError") {
            callbacks.onError?.(error.message || "NETWORK_ERROR");
          }
        } finally {
          reader.releaseLock();
        }
      })();

      // Return cleanup function
      return () => abortController.abort();
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        callbacks.onError?.(error.message || "NETWORK_ERROR");
      }
      return () => abortController.abort();
    }
  }

  // Validate password - returns validation result with usage info
  async validatePassword(password: string, visitorId: string): Promise<{ valid: boolean; remainingUses: number; maxUses: number; isRateLimited: boolean }> {
    const { data } = await this.request<{
      valid: boolean;
      message: string;
      remainingUses: number;
      maxUses: number;
      isRateLimited: boolean;
    }>("/api/validate", {
      method: "POST",
      body: JSON.stringify({
        password,
        visitorId,
      }),
    });
    return {
      valid: data.valid,
      remainingUses: data.remainingUses,
      maxUses: data.maxUses,
      isRateLimited: data.isRateLimited,
    };
  }

  // Admin endpoints
  async verifyAdminSecret(adminSecret: string): Promise<boolean> {
    try {
      await this.request<{ authenticated: boolean; message: string }>("/api/admin/verify", {
        method: "POST",
        headers: {
          "X-Admin-Secret": adminSecret,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getPasswords(adminSecret: string): Promise<PasswordEntry[]> {
    const { data } = await this.request<{ count: number; passwords: PasswordEntry[] }>("/api/admin/passwords", {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data.passwords;
  }

  async createPassword(adminSecret: string, request: CreatePasswordRequest): Promise<PasswordEntry> {
    const { data } = await this.request<PasswordEntry>("/api/admin/passwords", {
      method: "POST",
      headers: {
        "X-Admin-Secret": adminSecret,
      },
      body: JSON.stringify(request),
    });
    return data;
  }

  async deletePassword(adminSecret: string, passwordId: string): Promise<void> {
    await this.request(`/api/admin/passwords/${passwordId}`, {
      method: "DELETE",
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
  }

  async togglePassword(adminSecret: string, passwordId: string, isActive: boolean): Promise<PasswordEntry> {
    const { data } = await this.request<PasswordEntry>(`/api/admin/passwords/${passwordId}`, {
      method: "PUT",
      headers: {
        "X-Admin-Secret": adminSecret,
      },
      body: JSON.stringify({ isActive }),
    });
    return data;
  }

  async getUsageStats(adminSecret: string): Promise<UsageStats[]> {
    const { data } = await this.request<{ overall: { totalUses: number; uniqueUsers: number }; byPassword: UsageStats[] }>("/api/admin/usage", {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data.byPassword;
  }

  // Get system-wide stats
  async getSystemStats(adminSecret: string): Promise<SystemStats> {
    const { data } = await this.request<SystemStats>("/api/admin/stats/system", {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data;
  }

  // Get detailed stats for a specific password
  async getPasswordDetailedStats(adminSecret: string, passwordId: string): Promise<PasswordDetailedStats> {
    const { data } = await this.request<PasswordDetailedStats>(`/api/admin/stats/password/${passwordId}`, {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data;
  }

  // Get paginated users for a password
  async getUsersForPassword(adminSecret: string, passwordId: string, page: number = 1, limit: number = 20): Promise<PaginatedUsersResponse> {
    const { data } = await this.request<PaginatedUsersResponse>(`/api/admin/stats/password/${passwordId}/users?page=${page}&limit=${limit}`, {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data;
  }

  // Get recent request logs
  async getRecentRequests(adminSecret: string, limit: number = 50, passwordId?: string): Promise<RequestLogEntry[]> {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());
    if (passwordId) {
      params.set("passwordId", passwordId);
    }

    const { data } = await this.request<{ count: number; requests: RequestLogEntry[] }>(`/api/admin/stats/requests?${params.toString()}`, {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data.requests;
  }

  // Get time series data
  async getTokenTimeSeries(adminSecret: string, period: "day" | "week" | "month", passwordId?: string): Promise<TimeSeriesResponse> {
    const params = new URLSearchParams();
    params.set("period", period);
    if (passwordId) {
      params.set("passwordId", passwordId);
    }

    const { data } = await this.request<TimeSeriesResponse>(`/api/admin/stats/timeseries?${params.toString()}`, {
      headers: {
        "X-Admin-Secret": adminSecret,
      },
    });
    return data;
  }

  // Create a share link
  async createShareLink(code: string, title?: string): Promise<CreateShareResponse> {
    const { data } = await this.request<{ message: string; data: CreateShareResponse }>("/api/share", {
      method: "POST",
      body: JSON.stringify({ code, title }),
    });
    return data.data;
  }

  // Get shared code by share ID
  async getSharedCode(shareId: string): Promise<GetShareResponse> {
    const { data } = await this.request<{ message: string; data: GetShareResponse }>(`/api/share/${shareId}`);
    return data.data;
  }
}

export const api = new ApiClient();
