import { lazy, Suspense, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DemoPreview } from "@/form/editor/DemoPreview";
import { useDoubleHotkey, useIsMobile } from "@/form/hooks";
import { usePublishedForm } from "@/form/usePublishedForm";
import {
  getAdminPassword,
  getHotkeyKey,
  getHotkeyModifier,
} from "@/form/adminAccess";

const EditorView = lazy(() =>
  import("@/form/EditorView").then((m) => ({ default: m.EditorView }))
);

const Index = () => {
  const isMobile = useIsMobile();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const { schema, title, description, formId, form, loading } = usePublishedForm("default");

  // When the form isn't published, default to opening the editor (admin
  // hasn't shipped yet). When published, the live view loads by default
  // and the editor is only reachable via hotkey + password.
  useEffect(() => {
    if (loading) return;
    if (form && !form.published && !editorOpen) {
      setEditorOpen(true);
    }
  }, [loading, form, editorOpen]);

  useDoubleHotkey(
    () => {
      if (!editorOpen) {
        setPasswordInput("");
        setPasswordOpen(true);
      }
    },
    { key: getHotkeyKey(), modifier: getHotkeyModifier() }
  );

  const tryUnlock = () => {
    if (passwordInput === getAdminPassword()) {
      setPasswordOpen(false);
      setPasswordInput("");
      setEditorOpen(true);
    } else {
      toast.error("Hibás jelszó");
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

      <AlertDialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Szerkesztő nézet</AlertDialogTitle>
            <AlertDialogDescription>
              Add meg az admin jelszót a szerkesztő nézet megnyitásához.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin_pw">Jelszó</Label>
            <Input
              id="admin_pw"
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  tryUnlock();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPasswordInput("")}>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={tryUnlock}>Megnyitás</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default Index;
