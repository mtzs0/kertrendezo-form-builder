import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Check, CircleAlert, Loader2 } from "lucide-react";
import { FormView } from "./FormView";
import { useEditorSchema } from "./useEditorSchema";
import { StructureEditor } from "./editor/StructureEditor";
import { FieldConfigPanel } from "./editor/FieldConfigPanel";
import { FieldPicker } from "./editor/FieldPicker";

interface Props {
  /** Form slug to edit. Defaults to "default". */
  slug?: string;
  /** Optional exit handler — if omitted, the back button is hidden. */
  onExit?: () => void;
}

const DEFAULTS = {
  title: "Kerttervező űrlap",
  description: "Mondd el, milyen kertet álmodtál meg, és mi felvesszük veled a kapcsolatot.",
};

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Mentés…
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-primary">
        <Check className="h-3.5 w-3.5" />
        Elmentve
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
      <CircleAlert className="h-3.5 w-3.5" />
      Mentés sikertelen
    </span>
  );
}

export function EditorView({ slug = "default", onExit }: Props) {
  const editor = useEditorSchema(slug, DEFAULTS);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const selectedField = editor.fields.find((f) => f.id === selectedFieldId) ?? null;

  return (
    <main className="min-h-screen kr-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onExit && (
              <Button variant="ghost" size="sm" onClick={onExit}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Kilépés
              </Button>
            )}
            <h1 className="text-xl md:text-2xl font-semibold truncate">Szerkesztő nézet</h1>
            <SaveIndicator status={editor.saveStatus} />
          </div>
        </div>

        {editor.error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Hiba: {editor.error}
          </div>
        )}

        <Tabs defaultValue="form" className="w-full">
          <TabsList>
            <TabsTrigger value="form">Űrlap</TabsTrigger>
            <TabsTrigger value="field">Mező</TabsTrigger>
            <TabsTrigger value="preview">Előnézet</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
                <StructureEditor
                  groups={editor.groups}
                  subGroups={editor.subGroups}
                  fields={editor.fields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onReorderGroups={editor.reorderGroups}
                  onReorderSubGroups={editor.reorderSubGroups}
                  onReorderFields={editor.reorderFields}
                  onPlaceGroup={(id, location) => editor.patchGroup(id, { location })}
                  onPlaceSubGroup={(id, location) => editor.patchSubGroup(id, { location })}
                  onPlaceField={(id, target) =>
                    editor.patchField(id, {
                      groupId: target.groupId ?? undefined,
                      subGroupId: target.subGroupId ?? undefined,
                      location: target.location,
                    })
                  }
                />
                <aside className="lg:sticky lg:top-4 self-start">
                  <FieldConfigPanel
                    field={selectedField}
                    onChange={(patch) => selectedField && editor.patchField(selectedField.id, patch)}
                    onDelete={async () => {
                      if (!selectedField) return;
                      await editor.removeField(selectedField.id);
                      setSelectedFieldId(null);
                    }}
                  />
                </aside>
              </div>
            )}
          </TabsContent>

          <TabsContent value="field" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
                <FieldPicker
                  fields={editor.fields}
                  groups={editor.groups}
                  subGroups={editor.subGroups}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onAddField={async (type, opts) => {
                    const id = await editor.addField(type, opts);
                    setSelectedFieldId(id);
                  }}
                />
                <div>
                  <FieldConfigPanel
                    field={selectedField}
                    onChange={(patch) =>
                      selectedField && editor.patchField(selectedField.id, patch)
                    }
                    onDelete={async () => {
                      if (!selectedField) return;
                      await editor.removeField(selectedField.id);
                      setSelectedFieldId(null);
                    }}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
              {editor.loading ? (
                <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
              ) : (
                <FormView schema={editor.schema} layout="horizontal" formId={editor.form?.id ?? null} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
