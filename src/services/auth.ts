/**
 * ARTISAN MARKETPLACE: AUTHENTICATION SERVICE
 * File: src/services/auth.ts
 *
 * Uses Supabase Auth when configured via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,
 * otherwise delegates to the Express /api/auth/* endpoints (real scrypt + HMAC tokens).
 * Extensible for 'artisan', 'buyer', and future 'organization' account types.
 */

import { supabase } from "./supabase.ts";

export type AccountType = "artisan" | "buyer" | "organization";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  accountType: AccountType;
  organizationName?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  accountType: AccountType;
  organizationName?: string;
}

export interface AuthResult {
  success: boolean;
  user: AuthUser | null;
  error: string | null;
  requiresEmailConfirmation?: boolean;
}

const TOKEN_STORAGE_KEY = "artisan_auth_token_v1";

function isSupabaseConfigured(): boolean {
  try {
    const metaEnv = (import.meta as any)?.env || {};
    const url = String(metaEnv.VITE_SUPABASE_URL || metaEnv.SUPABASE_URL || "");
    const key = String(metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.SUPABASE_ANON_KEY || "");
    return Boolean(url && key && !url.includes("xyzcompany") && !key.includes("placeholder"));
  } catch {
    return false;
  }
}

export function getDashboardRouteForRole(accountType: AccountType | string | undefined): string {
  if (accountType === "artisan" || accountType === "organization") {
    return "/artisan/dashboard";
  }
  return "/buyer/dashboard";
}

function mapSupabaseUser(user: any): AuthUser {
  const meta = user?.user_metadata || {};
  const rawType = meta.account_type;
  const accountType: AccountType =
    rawType === "artisan" || rawType === "organization" ? rawType : "buyer";

  return {
    id: user.id,
    fullName: String(meta.full_name || user.email || "Artisan User"),
    email: String(user.email || ""),
    mobileNumber: String(meta.mobile_number || ""),
    accountType,
    organizationName: meta.organization_name ? String(meta.organization_name) : undefined,
  };
}

export class AuthService {
  public getMode(): "supabase" | "express" {
    return isSupabaseConfigured() ? "supabase" : "express";
  }

  public async getCurrentUser(): Promise<AuthUser | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data?.session?.user) return null;
        return mapSupabaseUser(data.session.user);
      } catch {
        return null;
      }
    }

    const token = this.getStoredToken();
    if (!token) return null;

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.clearStoredToken();
        return null;
      }
      const data = await res.json();
      return data?.user || null;
    } catch {
      return null;
    }
  }

  public async register(payload: RegisterPayload): Promise<AuthResult> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
          options: {
            data: {
              full_name: payload.fullName.trim(),
              mobile_number: payload.mobileNumber.trim(),
              account_type: payload.accountType,
              organization_name: payload.organizationName?.trim() || null,
            },
          },
        });

        if (error) {
          return { success: false, user: null, error: error.message };
        }

        if (data?.user) {
          // Best-effort profile sync to public.profiles
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              full_name: payload.fullName.trim(),
              email: payload.email.trim(),
              mobile_number: payload.mobileNumber.trim(),
              account_type: payload.accountType,
              organization_name: payload.organizationName?.trim() || null,
            });
          } catch {
            // Non-fatal if profiles table migration has not been applied yet
          }

          return {
            success: true,
            user: mapSupabaseUser(data.user),
            error: null,
            requiresEmailConfirmation: !data.session,
          };
        }

        return { success: false, user: null, error: "Registration could not be completed." };
      } catch (err: any) {
        return { success: false, user: null, error: err?.message || "Registration failed." };
      }
    }

    // Express backend auth
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return {
          success: false,
          user: null,
          error: "Authentication service is unavailable on static hosting. Configure Supabase Auth or run the backend server.",
        };
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, user: null, error: data.error || "Could not create account." };
      }
      if (data.token) {
        this.setStoredToken(data.token);
      }
      return { success: true, user: data.user, error: null };
    } catch {
      return {
        success: false,
        user: null,
        error: "Could not reach the authentication server. Please run the Node backend or configure Supabase Auth.",
      };
    }
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          return { success: false, user: null, error: error.message };
        }
        if (data?.user) {
          return { success: true, user: mapSupabaseUser(data.user), error: null };
        }
        return { success: false, user: null, error: "Invalid login credentials." };
      } catch (err: any) {
        return { success: false, user: null, error: err?.message || "Login failed." };
      }
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return {
          success: false,
          user: null,
          error: "Authentication service is unavailable on static hosting. Configure Supabase Auth or run the backend server.",
        };
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, user: null, error: data.error || "Invalid email or password." };
      }
      if (data.token) {
        this.setStoredToken(data.token);
      }
      return { success: true, user: data.user, error: null };
    } catch {
      return {
        success: false,
        user: null,
        error: "Could not reach the authentication server. Please run the Node backend or configure Supabase Auth.",
      };
    }
  }

  public async updateAccount(updates: {
    fullName?: string;
    mobileNumber?: string;
    email?: string;
    languagePreference?: string;
    notifyEnquiries?: boolean;
    notifyTips?: boolean;
  }): Promise<AuthResult> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.updateUser({
          data: {
            ...(updates.fullName !== undefined ? { full_name: updates.fullName } : {}),
            ...(updates.mobileNumber !== undefined ? { mobile_number: updates.mobileNumber } : {}),
          },
        });
        if (error) return { success: false, user: null, error: error.message };
        return { success: true, user: data?.user ? mapSupabaseUser(data.user) : null, error: null };
      } catch (err: any) {
        return { success: false, user: null, error: err?.message || "Could not update account." };
      }
    }

    const token = this.getStoredToken();
    if (!token) {
      return { success: false, user: null, error: "Sign in again to update account settings." };
    }
    try {
      const res = await fetch("/api/auth/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, user: null, error: data.error || "Could not update account." };
      }
      return { success: true, user: data.user, error: null };
    } catch {
      return { success: false, user: null, error: "Could not reach account service." };
    }
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return error ? { success: false, error: error.message } : { success: true, error: null };
      } catch (err: any) {
        return { success: false, error: err?.message || "Could not update password." };
      }
    }

    const token = this.getStoredToken();
    if (!token) {
      return { success: false, error: "Sign in again to change your password." };
    }
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Could not change password." };
      }
      return { success: true, error: null };
    } catch {
      return { success: false, error: "Could not reach authentication server." };
    }
  }

  public async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signout errors
      }
    } else {
      const token = this.getStoredToken();
      if (token) {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Ignore network errors on logout
        }
      }
    }
    this.clearStoredToken();
  }

  public getAccessToken(): string | null {
    return this.getStoredToken();
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private setStoredToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore storage errors
    }
  }

  private clearStoredToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export const authService = new AuthService();
