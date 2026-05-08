import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Check, CircleAlert, ExternalLink, Loader2 } from "lucide-react";
import { FormView } from "./FormView";
import { useEditorSchema } from "./useEditorSchema";
import { StructureEditor } from "./editor/StructureEditor";
import { FieldConfigPanel } from "./editor/FieldConfigPanel";
import { FieldPicker } from "./editor/FieldPicker";
import { ConditionEditor } from "./editor/ConditionEditor";
import { GroupsManager } from "./editor/GroupsManager";
import { LayoutsManager } from "./editor/LayoutsManager";
import { ConditionCanvas } from "./editor/ConditionCanvas";
import { DemoPreview } from "./editor/DemoPreview";

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
  const [conditionEnabledByField, setConditionEnabledByField] = useState<
    Record<string, boolean>
  >({});

  const selectedField = editor.fields.find((f) => f.id === selectedFieldId) ?? null;
  const hasCondition = !!(selectedField?.condition && selectedField.condition.rules.length > 0);
  const showConditionEditor =
    !!selectedField && (hasCondition || !!conditionEnabledByField[selectedField.id]);

  return (
    <main className="min-h-screen kr-surface">
      <div className="w-full px-4 md:px-8 py-6">
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

        <Tabs defaultValue="demo-preview" className="w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="field">Mező</TabsTrigger>
              <TabsTrigger value="group">Csoport</TabsTrigger>
              <TabsTrigger value="canvas">Vizuális feltételek</TabsTrigger>
              <TabsTrigger value="demo-preview">Előnézet</TabsTrigger>
              <TabsTrigger value="form">Űrlap (régi)</TabsTrigger>
              <TabsTrigger value="preview">Előnézet (régi)</TabsTrigger>
              <TabsTrigger value="settings">Beállítások</TabsTrigger>
            </TabsList>
            <Button
              type="button"
              onClick={() => {
                const url =
                  editor.form?.output_url ??
                  "https://docs.google.com/spreadsheets/d/1j-p8GgXY5SrlrxgW-fhk560JvT0sHSEXrY00A-JCMmU/edit?usp=sharing";
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="ml-4 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Output
            </Button>
          </div>


          <TabsContent value="form" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <div className="space-y-5">
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
                    onNestGroup={(id, parentGroupId, location) => editor.nestGroup(id, parentGroupId, location)}
                    onPlaceField={(id, target) =>
                      editor.patchField(id, {
                        groupId: target.groupId ?? undefined,
                        subGroupId: target.subGroupId ?? undefined,
                        location: target.location,
                      })
                    }
                    onChangeGroupWidth={(id, width) => editor.patchGroup(id, { width })}
                    onChangeSubGroupWidth={(id, width) => editor.patchSubGroup(id, { width })}
                    onClearAllFields={() => {
                      editor.fields
                        .filter((f) => f.location > 0)
                        .forEach((f) =>
                          editor.patchField(f.id, {
                            location: 0,
                            groupId: undefined,
                            subGroupId: undefined,
                          })
                        );
                    }}
                  />
                  <aside className="lg:sticky lg:top-4 self-start">
                    <FieldConfigPanel
                      field={selectedField}
                      onChange={(patch) => selectedField && editor.patchField(selectedField.id, patch)}
                      onChangeOptions={(fid, opts) => editor.setFieldOptions(fid, opts)}
                      onDelete={() => {
                        if (!selectedField) return;
                        // On the Űrlap tab the "Törlés" button only unplaces the
                        // field — it stays available in the unplaced palette.
                        editor.patchField(selectedField.id, {
                          location: 0,
                          groupId: undefined,
                          subGroupId: undefined,
                        });
                        setSelectedFieldId(null);
                      }}
                      deleteLabel="Eltávolítás"
                    />
                  </aside>
                </div>
                {editor.form && (
                  <LayoutsManager
                    formId={editor.form.id}
                    groups={editor.groups}
                    subGroups={editor.subGroups}
                    fields={editor.fields}
                    activeLayoutId={editor.activeLayoutId}
                    onSetActiveLayout={editor.setActiveLayout}
                    onReloadEditor={editor.reload}
                  />
                )}
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
                <div className="space-y-5">
                  {selectedField && showConditionEditor && (
                    <ConditionEditor
                      currentFieldId={selectedField.id}
                      currentFieldLabel={selectedField.label || selectedField.internalName}
                      allFields={editor.fields}
                      value={selectedField.condition}
                      onChange={(next) =>
                        editor.setFieldCondition(selectedField.id, next)
                      }
                    />
                  )}
                  {selectedField && (
                    <div className="rounded-2xl border border-border bg-card kr-shadow-soft px-5 md:px-6 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Megjelenítési feltétel</p>
                        <p className="text-xs text-muted-foreground">
                          A mező csak akkor jelenjen meg, ha a megadott feltétel(ek) igazak.
                        </p>
                      </div>
                      <Switch
                        checked={showConditionEditor}
                        onCheckedChange={(v) => {
                          setConditionEnabledByField((s) => ({
                            ...s,
                            [selectedField.id]: v,
                          }));
                          if (!v && hasCondition) {
                            editor.setFieldCondition(selectedField.id, undefined);
                          }
                        }}
                      />
                    </div>
                  )}
                  <FieldConfigPanel
                    field={selectedField}
                    onChange={(patch) =>
                      selectedField && editor.patchField(selectedField.id, patch)
                    }
                    onChangeOptions={(fid, opts) => editor.setFieldOptions(fid, opts)}
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

          <TabsContent value="group" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <GroupsManager
                groups={editor.groups}
                subGroups={editor.subGroups}
                fields={editor.fields}
                onAddGroup={editor.addGroup}
                onAddSubGroup={editor.addSubGroup}
                onPatchGroup={editor.patchGroup}
                onPatchSubGroup={editor.patchSubGroup}
                onRemoveGroup={editor.removeGroup}
                onRemoveSubGroup={editor.removeSubGroup}
                onSetGroupCondition={editor.setGroupCondition}
              />
            )}
          </TabsContent>

          <TabsContent value="canvas" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <div className="space-y-5">
                <ConditionCanvas
                  fields={editor.fields}
                  groups={editor.groups}
                  subGroups={editor.subGroups}
                  formId={editor.form?.id ?? null}
                  onSetCondition={editor.setFieldCondition}
                  onSetGroupCondition={editor.setGroupCondition}
                  onPatchField={editor.patchField}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onAddField={async (type) => {
                    const id = await editor.addField(type);
                    setSelectedFieldId(id);
                    return id;
                  }}
                  onDuplicateField={async (id) => {
                    const newId = await editor.duplicateField(id);
                    if (newId) setSelectedFieldId(newId);
                    return newId;
                  }}
                  onAddGroup={editor.addGroup}
                  onAddSubGroup={editor.addSubGroup}
                  onRemoveGroup={editor.removeGroup}
                  onRemoveSubGroup={editor.removeSubGroup}
                  onPatchGroup={editor.patchGroup}
                  onPatchSubGroup={editor.patchSubGroup}
                  onNestGroup={editor.nestGroup}
                  fieldConfigPanel={
                    <FieldConfigPanel
                      field={editor.fields.find((f) => f.id === selectedFieldId) ?? null}
                      onChange={(patch) => {
                        if (selectedFieldId) editor.patchField(selectedFieldId, patch);
                      }}
                      onChangeOptions={(fid, opts) => editor.setFieldOptions(fid, opts)}
                      onDelete={async () => {
                        if (!selectedFieldId) return;
                        await editor.removeField(selectedFieldId);
                        setSelectedFieldId(null);
                      }}
                    />
                  }
                />
                {editor.form && (
                  <LayoutsManager
                    formId={editor.form.id}
                    groups={editor.groups}
                    subGroups={editor.subGroups}
                    fields={editor.fields}
                    activeLayoutId={editor.activeLayoutId}
                    onSetActiveLayout={editor.setActiveLayout}
                    onReloadEditor={editor.reload}
                  />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="demo-preview" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <DemoPreview
                fields={editor.fields}
                groups={editor.groups}
                subGroups={editor.subGroups}
                formId={editor.form?.id ?? null}
                thankYouText={editor.form?.thank_you_text ?? null}
              />
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
              {editor.loading ? (
                <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
              ) : (
                <div className="space-y-6">
                  {(editor.form?.title || editor.form?.description) && (
                    <header className="space-y-2">
                      {editor.form?.title && (
                        <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                          {editor.form.title}
                        </h2>
                      )}
                      {editor.form?.description && (
                        <p className="text-muted-foreground max-w-2xl">
                          {editor.form.description}
                        </p>
                      )}
                    </header>
                  )}
                  <FormView
                    schema={editor.previewSchema}
                    layout="horizontal"
                    formId={editor.form?.id ?? null}
                    showDemoButton
                    thankYouText={editor.form?.thank_you_text ?? null}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {editor.loading ? (
              <div className="py-16 text-center text-muted-foreground">Betöltés…</div>
            ) : (
              <SettingsPanel
                title={editor.form?.title ?? ""}
                description={editor.form?.description ?? ""}
                webhookUrl={editor.form?.webhook_url ?? ""}
                thankYouText={editor.form?.thank_you_text ?? ""}
                outputUrl={editor.form?.output_url ?? ""}
                onChangeTitle={(v) => editor.patchForm({ title: v })}
                onChangeDescription={(v) => editor.patchForm({ description: v || null })}
                onChangeWebhookUrl={(v) => editor.patchForm({ webhook_url: v.trim() ? v.trim() : null })}
                onChangeThankYouText={(v) => editor.patchForm({ thank_you_text: v.trim() ? v : null })}
                onChangeOutputUrl={(v) => editor.patchForm({ output_url: v.trim() ? v.trim() : null })}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

interface SettingsPanelProps {
  title: string;
  description: string;
  webhookUrl: string;
  thankYouText: string;
  outputUrl: string;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeWebhookUrl: (value: string) => void;
  onChangeThankYouText: (value: string) => void;
  onChangeOutputUrl: (value: string) => void;
}

function SettingsPanel({
  title,
  description,
  webhookUrl,
  thankYouText,
  outputUrl,
  onChangeTitle,
  onChangeDescription,
  onChangeWebhookUrl,
  onChangeThankYouText,
  onChangeOutputUrl,
}: SettingsPanelProps) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList>
        <TabsTrigger value="general">Általános</TabsTrigger>
        <TabsTrigger value="webhook">Webhook</TabsTrigger>
        <TabsTrigger value="thankyou">Köszönő oldal</TabsTrigger>
        <TabsTrigger value="output">Output</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4">
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold">Általános beállítások</h3>
              <p className="text-sm text-muted-foreground">
                Az élő nézet és az előnézet tetején megjelenő szövegek.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings_title">Cím</Label>
              <Input
                id="settings_title"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="Pl. Kerttervezés foglalás"
              />
              <p className="text-xs text-muted-foreground">
                A űrlap főcíme, ami az oldal tetején nagyban jelenik meg.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings_subtitle">Alcím</Label>
              <Textarea
                id="settings_subtitle"
                rows={3}
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                placeholder="Pl. Töltsd ki az alábbi űrlapot, és hamarosan visszajelzünk az időpontról."
              />
              <p className="text-xs text-muted-foreground">
                Rövid leírás a cím alatt. Üresen hagyva nem jelenik meg.
              </p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="webhook" className="mt-4">
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold">Webhook</h3>
              <p className="text-sm text-muted-foreground">
                Ha megadsz egy URL-t, minden beküldött űrlap adata POST kéréssel ide továbbításra kerül (JSON formátumban).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings_webhook">Webhook URL</Label>
              <Input
                id="settings_webhook"
                type="url"
                value={webhookUrl}
                onChange={(e) => onChangeWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
              <p className="text-xs text-muted-foreground">
                Üresen hagyva nem történik továbbítás. A változás automatikusan mentésre kerül.
              </p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="thankyou" className="mt-4">
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold">Köszönő oldal</h3>
              <p className="text-sm text-muted-foreground">
                Sikeres beküldés után az űrlap helyén megjelenő üzenet.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings_thankyou">Köszönő szöveg</Label>
              <Textarea
                id="settings_thankyou"
                rows={4}
                value={thankYouText}
                onChange={(e) => onChangeThankYouText(e.target.value)}
                placeholder="Pl. Köszönjük! Hamarosan jelentkezünk."
              />
              <p className="text-xs text-muted-foreground">
                Üresen hagyva az alapértelmezett „Köszönjük! A foglalást rögzítettük." szöveg jelenik meg.
              </p>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
