import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/**
 * Lightweight auth session hook. Subscribes to Supabase auth state and
 * exposes the current session. Use this to gate admin UIs and writes.
 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Set up listener FIRST, then fetch existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, user: session?.user ?? null };
}
