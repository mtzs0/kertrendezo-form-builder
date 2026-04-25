import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Trash2, Plus } from "lucide-react";
import {
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
  /** Currently-active saved layout id, or null when "Jelenlegi nézet" is on. */
  activeLayoutId: string | null;
  /** Set the active layout (null = use current editor state). */
  onSetActiveLayout: (layoutId: string | null) => Promise<void>;
}

export function LayoutsManager({
  formId,
  groups,
  subGroups,
  fields,
  activeLayoutId,
  onSetActiveLayout,
}: Props) {
  const [layouts, setLayouts] = useState<FormLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "current" represents the virtual "Jelenlegi nézet" row.
  const [togglingId, setTogglingId] = useState<string | "current" | null>(null);

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
      // If this layout is currently active, refresh the active snapshot too.
      if (activeLayoutId === layout.id) {
        await onSetActiveLayout(layout.id);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Felülírás sikertelen");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (layout: FormLayout) => {
    if (!window.confirm(`Törlöd a(z) "${layout.name}" mentést?`)) return;
    setBusyId(layout.id);
    setError(null);
    try {
      // If we delete the active layout, fall back to "Jelenlegi nézet".
      if (activeLayoutId === layout.id) {
        await onSetActiveLayout(null);
      }
      await deleteLayout(layout.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Törlés sikertelen");
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Toggle the active layout. Exactly one toggle is on at a time, and at
   * least one is always on — so toggling OFF the active one is a no-op.
   * `target` = null means activating the "Jelenlegi nézet" virtual row.
   */
  const handleToggle = async (target: string | null, nextOn: boolean) => {
    const isCurrent = target === null;
    const isAlreadyActive = activeLayoutId === target;
    // Prevent turning off the only active toggle.
    if (!nextOn && isAlreadyActive) return;
    if (isAlreadyActive) return;
    setTogglingId(isCurrent ? "current" : (target as string));
    setError(null);
    try {
      await onSetActiveLayout(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktiválás sikertelen");
    } finally {
      setTogglingId(null);
    }
  };

  const currentActive = activeLayoutId === null;

  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Elrendezés mentések</h3>
        <p className="text-sm text-muted-foreground">
          Mentsd el a jelenlegi mező-elrendezést egyedi névvel. A „Publikus
          űrlap" kapcsolóval választhatod ki, melyik verzió jelenjen meg az
          éles, publikus űrlapon a végfelhasználóknak — egyszerre csak egy
          lehet aktív.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 italic">
          Megjegyzés: az „Előnézet" fül mindig a jelenlegi szerkesztői állapotot
          mutatja, függetlenül attól, melyik mentés aktív.
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
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {/* Column header row — labels the toggle column on the right. */}
            <li className="flex items-center gap-3 px-3 py-1.5 bg-muted/50">
              <div className="min-w-0 flex-1" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Publikus űrlap
              </span>
            </li>
            {/* Virtual "Jelenlegi nézet" row — always present, slightly different style. */}
            <li
              className={`flex items-center gap-3 px-3 py-2.5 ${
                currentActive ? "bg-primary/5" : "bg-muted/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium italic">Jelenlegi nézet</p>
                <p className="text-xs text-muted-foreground">
                  Az „Űrlap" tab szerkesztett állapota élesben.
                </p>
              </div>
              {togglingId === "current" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={currentActive}
                  onCheckedChange={(v) => handleToggle(null, v)}
                  aria-label="Jelenlegi nézet aktiválása"
                />
              )}
            </li>

            {layouts.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground bg-background">
                Még nincsenek mentések.
              </li>
            ) : (
              layouts.map((l) => {
                const isBusy = busyId === l.id;
                const isActive = activeLayoutId === l.id;
                return (
                  <li
                    key={l.id}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      isActive ? "bg-primary/5" : "bg-background"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Frissítve: {new Date(l.updated_at).toLocaleString("hu-HU")}
                      </p>
                    </div>
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
                    {togglingId === l.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => handleToggle(l.id, v)}
                        aria-label={`„${l.name}" aktiválása`}
                      />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
