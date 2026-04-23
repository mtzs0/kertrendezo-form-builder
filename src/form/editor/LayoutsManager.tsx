import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Download, Trash2, Plus } from "lucide-react";
import {
  applyLayout,
  buildSnapshot,
  createLayout,
  deleteLayout,
  listLayouts,
  updateLayoutSnapshot,
  type FormLayout,
} from "../layoutsApi";
import type { FormField, FormGroup, FormSubGroup } from "../types";

interface Props {
  formId: string;
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
  /** Called after a successful apply so the editor reloads its state. */
  onApplied: () => Promise<void> | void;
}

export function LayoutsManager({ formId, groups, subGroups, fields, onApplied }: Props) {
  const [layouts, setLayouts] = useState<FormLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setLayouts(await listLayouts(formId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba a mentések betöltésekor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const handleSaveNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setSavingNew(true);
    setError(null);
    try {
      const snap = buildSnapshot(groups, subGroups, fields);
      await createLayout(formId, name, snap);
      setNewName("");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mentés sikertelen";
      setError(msg.includes("duplicate") ? "Már létezik mentés ezzel a névvel." : msg);
    } finally {
      setSavingNew(false);
    }
  };

  const handleOverwrite = async (layout: FormLayout) => {
    setBusyId(layout.id);
    setError(null);
    try {
      const snap = buildSnapshot(groups, subGroups, fields);
      await updateLayoutSnapshot(layout.id, snap);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Felülírás sikertelen");
    } finally {
      setBusyId(null);
    }
  };

  const handleLoad = async (layout: FormLayout) => {
    if (
      !window.confirm(
        `Betöltöd a(z) "${layout.name}" elrendezést? Az aktuális elrendezés felülíródik az élő űrlapban.`
      )
    )
      return;
    setBusyId(layout.id);
    setError(null);
    try {
      await applyLayout(formId, layout.snapshot);
      await onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Betöltés sikertelen");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (layout: FormLayout) => {
    if (!window.confirm(`Törlöd a(z) "${layout.name}" mentést?`)) return;
    setBusyId(layout.id);
    setError(null);
    try {
      await deleteLayout(layout.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Törlés sikertelen");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Elrendezés mentések</h3>
        <p className="text-sm text-muted-foreground">
          Mentsd el a jelenlegi mező-elrendezést egyedi névvel, és bármikor töltsd vissza.
          Csak a sorrend és a csoportbeosztás kerül mentésre — a mezők adatai változatlanok maradnak.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="layout_new_name">Új mentés a jelenlegi elrendezésből</Label>
        <div className="flex items-center gap-2">
          <Input
            id="layout_new_name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pl. Nyári verzió"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !savingNew && newName.trim()) handleSaveNew();
            }}
          />
          <Button onClick={handleSaveNew} disabled={!newName.trim() || savingNew}>
            {savingNew ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Mentés
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Mentett elrendezések</p>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Betöltés…</div>
        ) : layouts.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Még nincsenek mentések.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {layouts.map((l) => {
              const isBusy = busyId === l.id;
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Frissítve: {new Date(l.updated_at).toLocaleString("hu-HU")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleLoad(l)}
                    disabled={isBusy}
                    title="Betöltés az élő űrlapra"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Betöltés
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOverwrite(l)}
                    disabled={isBusy}
                    title="Jelenlegi elrendezés mentése erre a névre"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Felülírás
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(l)}
                    disabled={isBusy}
                    title="Mentés törlése"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
