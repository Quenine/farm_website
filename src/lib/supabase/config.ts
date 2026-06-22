import "server-only";

export function hasPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !url.includes("your-project");
  } catch {
    return false;
  }
}

export function hasAdminSupabaseConfig() {
  return (
    hasPublicSupabaseConfig() &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  );
}

export function getPublicSupabaseConfig() {
  if (!hasPublicSupabaseConfig()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function getAdminSupabaseConfig() {
  const publicConfig = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return { ...publicConfig, serviceRoleKey };
}
