import { useState } from "react";
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
import { DemoPreview } from "@/form/editor/DemoPreview";
import { useDoubleHotkey, useIsMobile } from "@/form/hooks";
import { usePublishedForm } from "@/form/usePublishedForm";
import { EditorView } from "@/form/EditorView";

/**
 * What the user sees when they land on `/`.
 * Flip this back to "form" to make the public end-user form the default again.
 */
const DEFAULT_VIEW = "editor" as "editor" | "form";

const Index = () => {
  const isMobile = useIsMobile();
  const [confirmEditor, setConfirmEditor] = useState(false);
  const [editorOpen, setEditorOpen] = useState<boolean>(DEFAULT_VIEW === "editor");
  const { schema, title, description, formId, form, loading } = usePublishedForm("default");

  useDoubleHotkey(() => {
    if (!editorOpen) setConfirmEditor(true);
  });

  if (editorOpen) {
    return <EditorView slug="default" onExit={() => setEditorOpen(false)} />;
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
            />
          )}

        </div>
      </section>

      <AlertDialog open={confirmEditor} onOpenChange={setConfirmEditor}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Szerkesztő nézet megnyitása?</AlertDialogTitle>
            <AlertDialogDescription>
              A szerkesztő nézetben módosíthatod az űrlap mezőit, csoportjait és
              feltételeit. Folytatod?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEditor(false);
                setEditorOpen(true);
              }}
            >
              Megnyitás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default Index;
