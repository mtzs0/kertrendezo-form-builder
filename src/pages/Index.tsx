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
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { schema, title, description, formId, form, loading } = usePublishedForm("default");

  // When the form isn't published, auto-open the editor for signed-in users.
  useEffect(() => {
    if (loading || !ready) return;
    if (session && form && !form.published && !editorOpen) {
      setEditorOpen(true);
    }
  }, [loading, ready, session, form, editorOpen]);

  useDoubleHotkey(
    () => {
      if (editorOpen) return;
      if (session) {
        setEditorOpen(true);
      } else {
        setPassword("");
        setAuthOpen(true);
      }
    },
    { key: getHotkeyKey(), modifier: getHotkeyModifier() }
  );

  const submitAuth = async () => {
    if (!password) {
      toast.error("Add meg a jelszót");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unlock", {
        body: { password },
      });
      if (error) throw error;
      if (!data?.token_hash || !data?.email) throw new Error("Érvénytelen válasz");
      const { error: vErr } = await supabase.auth.verifyOtp({
        email: data.email,
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (vErr) throw vErr;
      toast.success("Bejelentkezve");
      setAuthOpen(false);
      setEditorOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hibás jelszó");
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
            <AlertDialogTitle>Admin bejelentkezés</AlertDialogTitle>
            <AlertDialogDescription>
              Add meg a jelszót a szerkesztő megnyitásához.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="admin_pw">Jelszó</Label>
              <Input
                id="admin_pw"
                type="password"
                autoFocus
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
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setAuthOpen(false)} disabled={busy}>Mégse</Button>
            <Button onClick={submitAuth} disabled={busy}>
              {busy ? "…" : "Bejelentkezés"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default Index;
