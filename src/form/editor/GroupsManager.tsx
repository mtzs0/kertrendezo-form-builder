import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Trash2, Filter } from "lucide-react";
import type { ConditionGroup, FormField, FormGroup, FormSubGroup } from "@/form/types";
import { ConditionEditor } from "./ConditionEditor";

interface Props {
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
  onAddGroup: () => Promise<string | undefined> | void;
  onAddSubGroup: (groupId: string) => Promise<string | undefined> | void;
  onPatchGroup: (id: string, patch: Partial<FormGroup>) => void;
  onPatchSubGroup: (id: string, patch: Partial<FormSubGroup>) => void;
  onRemoveGroup: (id: string) => Promise<void> | void;
  onRemoveSubGroup: (id: string) => Promise<void> | void;
  onSetGroupCondition: (groupId: string, condition: ConditionGroup | undefined) => Promise<void> | void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Standalone manager for groups and sub-groups. Creating/renaming/deleting
 * happens here; placement (drag into structure) still lives on the Űrlap tab.
 */
export function GroupsManager({
  groups,
  subGroups,
  fields,
  onAddGroup,
  onAddSubGroup,
  onPatchGroup,
  onPatchSubGroup,
  onRemoveGroup,
  onRemoveSubGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const fieldsInGroup = (gid: string) =>
    fields.filter((f) => f.groupId === gid).length;
  const subGroupsOf = (gid: string) =>
    subGroups
      .filter((sg) => sg.groupId === gid)
      .sort((a, b) => a.location - b.location);
  const fieldsInSubGroup = (sgid: string) =>
    fields.filter((f) => f.subGroupId === sgid).length;

  const sortedGroups = [...groups].sort((a, b) => {
    // Placed first (location > 0), then unplaced.
    if (a.location > 0 && b.location <= 0) return -1;
    if (a.location <= 0 && b.location > 0) return 1;
    if (a.location > 0 && b.location > 0) return a.location - b.location;
    return a.internalName.localeCompare(b.internalName);
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Csoportok</h3>
            <p className="text-sm text-muted-foreground">
              Hozz létre csoportokat és al-csoportokat. Az elhelyezésük (sorrend
              és szélesség) az „Űrlap" fülön történik.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => onAddGroup()}>
            <Plus className="h-4 w-4 mr-1" />
            Új csoport
          </Button>
        </div>

        {sortedGroups.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Még nincs csoport. Hozz létre egyet a fenti gombbal.
          </p>
        )}

        <div className="space-y-3">
          {sortedGroups.map((g) => {
            const isOpen = expanded[g.id] ?? true;
            const sgs = subGroupsOf(g.id);
            return (
              <div
                key={g.id}
                className="rounded-lg border border-border bg-secondary/30"
              >
                <div className="flex items-start gap-2 p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => toggle(g.id)}
                    aria-label={isOpen ? "Becsuk" : "Kinyit"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Külső név (megjelenített)
                      </Label>
                      <Input
                        value={g.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          const auto =
                            !g.internalName ||
                            g.internalName === slugify(g.label);
                          onPatchGroup(g.id, {
                            label,
                            ...(auto
                              ? { internalName: slugify(label) || g.internalName }
                              : {}),
                          });
                        }}
                        placeholder="Pl. Kapcsolattartás"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Belső név
                      </Label>
                      <Input
                        value={g.internalName}
                        onChange={(e) =>
                          onPatchGroup(g.id, {
                            internalName: slugify(e.target.value),
                          })
                        }
                        placeholder="kapcsolat"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pt-5">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {g.location > 0 ? "elhelyezve" : "elhelyezetlen"} ·{" "}
                      {fieldsInGroup(g.id)} mező
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (
                          confirm(
                            `Biztos törlöd a(z) „${g.label || g.internalName}" csoportot? Az al-csoportok is törlődnek.`
                          )
                        )
                          onRemoveGroup(g.id);
                      }}
                      aria-label="Csoport törlése"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border px-3 py-3 space-y-3 bg-background/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        Al-csoportok
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddSubGroup(g.id)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Új al-csoport
                      </Button>
                    </div>

                    {sgs.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Nincs al-csoport ebben a csoportban.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sgs.map((sg) => (
                          <div
                            key={sg.id}
                            className="flex items-start gap-2 rounded-md border border-border bg-card p-2"
                          >
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">
                                  Külső név
                                </Label>
                                <Input
                                  value={sg.label}
                                  onChange={(e) => {
                                    const label = e.target.value;
                                    const auto =
                                      !sg.internalName ||
                                      sg.internalName === slugify(sg.label);
                                    onPatchSubGroup(sg.id, {
                                      label,
                                      ...(auto
                                        ? {
                                            internalName:
                                              slugify(label) || sg.internalName,
                                          }
                                        : {}),
                                    });
                                  }}
                                  placeholder="Pl. Cím adatok"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">
                                  Belső név
                                </Label>
                                <Input
                                  value={sg.internalName}
                                  onChange={(e) =>
                                    onPatchSubGroup(sg.id, {
                                      internalName: slugify(e.target.value),
                                    })
                                  }
                                  placeholder="cim_adatok"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 pt-5">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {sg.location > 0 ? "elhelyezve" : "elhelyezetlen"} ·{" "}
                                {fieldsInSubGroup(sg.id)} mező
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Biztos törlöd a(z) „${sg.label || sg.internalName}" al-csoportot?`
                                    )
                                  )
                                    onRemoveSubGroup(sg.id);
                                }}
                                aria-label="Al-csoport törlése"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
