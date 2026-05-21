import { lazy, Suspense, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DemoPreview } from "@/form/editor/DemoPreview";
import { useDoubleHotkey, useIsMobile } from "@/form/hooks";
import { usePublishedForm } from "@/form/usePublishedForm";
import { useAuthSession } from "@/form/useAuthSession";
import { supabase } from "@/integrations/supabase/client";
import {
  getHotkeyKey,
  getHotkeyModifier,
} from "@/form/adminAccess";

const EditorView = lazy(() =>
  import("@/form/EditorView").then((m) => ({ default: m.EditorView }))
);

const Index = () => {
  const isMobile = useIsMobile();
  const { session, ready } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { schema, title, description, formId, form, loading } = usePublishedForm("default");

  // When the form isn't published, auto-open the editor — BUT only for
  // signed-in users. Anonymous visitors must always go through Ctrl+K + login.
  useEffect(() => {
    if (loading || !ready) return;
    if (session && form && !form.published && !editorOpen) {
      setEditorOpen(true);
    }
  }, [loading, ready, session, form, editorOpen]);

  // After login, auto-claim the loaded form if it has no owner yet (one-time
  // bootstrap so the very first admin gets ownership of the existing form).
  useEffect(() => {
    if (!session || !formId) return;
    (async () => {
      const { error } = await supabase.rpc("claim_form", { _form_id: formId });
      if (error) {
        // Silent — already owned, or another user owns it. That's fine.
        console.debug("claim_form skipped", error.message);
      }
    })();
  }, [session, formId]);

  useDoubleHotkey(
    () => {
      if (editorOpen) return;
      if (session) {
        setEditorOpen(true);
      } else {
        setEmail("");
        setPassword("");
        setMode("signin");
        setAuthOpen(true);
      }
    },
    { key: getHotkeyKey(), modifier: getHotkeyModifier() }
  );

  const submitAuth = async () => {
    if (!email || !password) {
      toast.error("Add meg az emailt és a jelszót");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bejelentkezve");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Fiók létrehozva — most jelentkezz be");
        setMode("signin");
        setBusy(false);
        return;
      }
      setAuthOpen(false);
      setEditorOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hitelesítési hiba");
    } finally {
      setBusy(false);
    }
  };

  if (editorOpen) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-muted-foreground">
            Szerkesztő betöltése…
          </div>
        }
      >
        <EditorView slug="default" onExit={() => setEditorOpen(false)} />
      </Suspense>
    );
  }

  return (
    <main className="min-h-screen kr-surface">
      <section
        className="w-full mx-auto"
        style={{ minHeight: isMobile ? "auto" : "800px" }}
        aria-labelledby="kr-form-title"
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <header className="flex flex-col gap-3 mb-8">
            {title && (
              <h1
                id="kr-form-title"
                className="text-3xl md:text-4xl font-semibold text-foreground"
              >
                {title}
              </h1>
            )}
            {description && (
              <p className="text-muted-foreground max-w-2xl">{description}</p>
            )}
          </header>

          {loading ? (
            <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8 py-16 text-center text-muted-foreground">Betöltés…</div>
          ) : (
            <DemoPreview
              fields={schema.fields}
              groups={schema.groups}
              subGroups={schema.subGroups}
              formId={formId}
              thankYouText={form?.thank_you_text ?? null}
              showDemoButton={false}
              buttonBackground={schema.buttonBackground}
              tabsBackground={schema.tabsBackground}
            />
          )}
        </div>
      </section>

      <AlertDialog open={authOpen} onOpenChange={setAuthOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === "signin" ? "Admin bejelentkezés" : "Admin fiók létrehozása"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "signin"
                ? "Jelentkezz be a szerkesztő megnyitásához."
                : "Hozz létre egy admin fiókot. Az első létrehozó kapja meg a meglévő űrlapot."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="admin_email">Email</Label>
              <Input
                id="admin_email"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin_pw">Jelszó</Label>
              <Input
                id="admin_pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitAuth();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Még nincs fiókod? Regisztráció" : "Van fiókod? Bejelentkezés"}
            </button>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setAuthOpen(false)} disabled={busy}>Mégse</Button>
            <Button onClick={submitAuth} disabled={busy}>
              {busy ? "…" : mode === "signin" ? "Bejelentkezés" : "Regisztráció"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default Index;
