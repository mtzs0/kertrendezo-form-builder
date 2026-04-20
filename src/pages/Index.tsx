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
import { Badge } from "@/components/ui/badge";
import { Sprout } from "lucide-react";
import { FormView } from "@/form/FormView";
import { useDoubleHotkey, useIsMobile } from "@/form/hooks";
import { usePublishedForm } from "@/form/usePublishedForm";
import { EditorPlaceholder } from "@/form/EditorPlaceholder";

const Index = () => {
  const isMobile = useIsMobile();
  const [confirmEditor, setConfirmEditor] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { schema, title, description, formId, loading } = usePublishedForm("default");

  useDoubleHotkey(() => {
    if (!editorOpen) setConfirmEditor(true);
  });

  if (editorOpen) {
    return <EditorPlaceholder schema={schema} onExit={() => setEditorOpen(false)} />;
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
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sprout className="h-5 w-5" />
              </span>
              <Badge variant="secondary" className="font-medium">
                Kertrendező
              </Badge>
            </div>
            <h1
              id="kr-form-title"
              className="text-3xl md:text-4xl font-semibold text-foreground"
            >
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground max-w-2xl">{description}</p>
            )}
          </header>

          <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
            {loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <FormView
                schema={schema}
                layout={isMobile ? "vertical" : "horizontal"}
                formId={formId}
              />
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            Tipp: nyomd meg kétszer a{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[11px]">Ctrl</kbd>+
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[11px]">K</kbd>{" "}
            billentyűkombinációt a szerkesztő nézet megnyitásához.
          </p>
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
