import { config } from "./config";
import type { GenerateRequest, GenerateResponse, PasswordEntry, CreatePasswordRequest, UsageStats } from "@/types";

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, headers: response.headers };
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

  // Validate password
  async validatePassword(password: string, visitorId: string): Promise<boolean> {
    try {
      await this.request("/api/validate", {
        method: "POST",
        body: JSON.stringify({
          password,
          visitorId,
        }),
      });
      return true;
    } catch {
      return false;
    }
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
}

export const api = new ApiClient();
