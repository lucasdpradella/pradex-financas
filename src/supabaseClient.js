import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";
const ACCESS_TOKEN_KEY = "sb_token";
const REFRESH_TOKEN_KEY = "sb_refresh_token";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

export function persistSessionTokens(accessToken, refreshToken = "") {
  if (!accessToken) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearSessionTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredSessionTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || "",
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || "",
  };
}

export async function syncSupabaseSession(sessionLike) {
  if (!sessionLike) return null;
  const accessToken =
    typeof sessionLike === "string" ? sessionLike : sessionLike.accessToken || sessionLike.access_token || "";
  const refreshToken =
    typeof sessionLike === "string" ? "" : sessionLike.refreshToken || sessionLike.refresh_token || "";

  if (!accessToken) return null;

  if (refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session || null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: accessToken,
  });

  if (!error && data?.session) return data.session;

  const fallback = await supabase.auth.getSession();
  return fallback.data.session || null;
}
