import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FormField, FormGroup, FormSubGroup, WidthPercent } from "@/form/types";
import { WIDTH_OPTIONS } from "@/form/types";

interface Props {
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;

  /** Reorder placed top-level groups. */
  onReorderGroups: (orderedIds: string[]) => void;
  /** Reorder placed sub-groups within a parent group. */
  onReorderSubGroups: (groupId: string, orderedIds: string[]) => void;
  /** Reorder placed fields within a container (group/sub-group/global). */
  onReorderFields: (
    container: { groupId?: string | null; subGroupId?: string | null },
    orderedIds: string[]
  ) => void;

  /** Place or unplace items by patching their parent + location. */
  onPlaceGroup: (id: string, location: number) => void;
  onPlaceSubGroup: (id: string, location: number) => void;
  onPlaceField: (
    id: string,
    target: { groupId: string | null; subGroupId: string | null; location: number }
  ) => void;

  /**
   * Re-parent a group (top-level ↔ sub-group). `parentGroupId` = null promotes
   * an existing sub-group to top-level; otherwise demotes the group to a
   * sub-group of the given parent.
   */
  onNestGroup: (id: string, parentGroupId: string | null, location: number) => void;

  /** Width updates for groups and sub-groups (fields use the config panel). */
  onChangeGroupWidth: (id: string, width: WidthPercent | undefined) => void;
  onChangeSubGroupWidth: (id: string, width: WidthPercent | undefined) => void;

  /** Move every currently placed field back to the unplaced palette. */
  onClearAllFields?: () => void;
}

function WidthInlineSelect({
  value,
  onChange,
}: {
  value: WidthPercent | undefined;
  onChange: (w: WidthPercent | undefined) => void;
}) {
  return (
    <select
      value={value ?? 100}
      onChange={(e) => {
        const n = Number(e.target.value) as WidthPercent;
        onChange(n === 100 ? undefined : n);
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="text-[11px] rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
      title="Szélesség"
    >
      <option value={100}>100%</option>
      {WIDTH_OPTIONS.filter((w) => w !== 100).map((w) => (
        <option key={w} value={w}>
          {w}%
        </option>
      ))}
    </select>
  );
}

// ---------- Drag item identity ----------
// `group` and `subgroup` are the same underlying entity now (rows in form_groups);
// the kind only tells us where the drag started so the editor can preserve
// "dragging a top-level group" vs. "dragging a sub-group" semantics until the
// drop target reassigns it.
type DragKind = "group" | "subgroup" | "field";
interface DragData {
  kind: DragKind;
  /** For sub-groups: the parent group id at drag-start. */
  parentGroupId?: string;
}

// ---------- Drop target identity ----------
type DropTarget =
  | { kind: "palette"; itemKind: "group" | "field" }
  | { kind: "groups-canvas" }
  | { kind: "subgroups-of"; groupId: string }
  | { kind: "fields-of"; groupId: string | null; subGroupId: string | null };

function dropId(t: DropTarget): string {
  switch (t.kind) {
    case "palette":
      return `palette:${t.itemKind}`;
    case "groups-canvas":
      return `groups`;
    case "subgroups-of":
      return `subgroups:${t.groupId}`;
    case "fields-of":
      return `fields:${t.groupId ?? "_"}:${t.subGroupId ?? "_"}`;
  }
}

// ---------- Small visual chip ----------
function Chip({
  label,
  subtitle,
  selected,
  onSelect,
  className,
}: {
  label: string;
  subtitle?: string;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs select-none",
        onSelect && "cursor-pointer",
        selected
          ? "border-primary ring-1 ring-primary/30 bg-primary/5"
          : "border-border hover:border-primary/40",
        className
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-medium truncate max-w-[160px]">{label}</span>
      {subtitle && <span className="text-muted-foreground truncate">· {subtitle}</span>}
    </div>
  );
}

function DraggableChip({
  id,
  data,
  label,
  subtitle,
  selected,
  onSelect,
}: {
  id: string;
  data: DragData;
  label: string;
  subtitle?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Chip label={label} subtitle={subtitle} selected={selected} onSelect={onSelect} />
    </div>
  );
}

function DropZone({
  target,
  children,
  empty,
  className,
  stack,
}: {
  target: DropTarget;
  children: React.ReactNode;
  empty?: string;
  className?: string;
  /** When true, lay children out vertically (one per row). */
  stack?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(target), data: { target } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed p-2 min-h-[44px] transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border bg-background/40",
        className
      )}
    >
      <div className={cn(stack ? "flex flex-col gap-1.5 items-stretch" : "flex flex-wrap gap-1.5")}>
        {children}
      </div>
      {empty && (
        <p className="text-[11px] text-muted-foreground italic px-1 py-1">{empty}</p>
      )}
    </div>
  );
}

// Sortable wrapper for an entire placed-group BOX. The whole title row acts as
// the drag handle (so users can grab the box itself rather than just a chip).
function SortableGroupBox({
  groupId,
  children,
}: {
  groupId: string;
  children: (handle: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupId,
    data: { kind: "group" } satisfies DragData,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
    >
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// ---------- Main component ----------
export function StructureEditor(props: Props) {
  const {
    groups,
    subGroups,
    fields,
    selectedFieldId,
    onSelectField,
    onReorderGroups,
    onReorderSubGroups,
    onReorderFields,
    onPlaceGroup,
    onPlaceSubGroup,
    onPlaceField,
    onNestGroup,
    onChangeGroupWidth,
    onChangeSubGroupWidth,
    onClearAllFields,
  } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  // ---------- Partition placed vs unplaced ----------
  const { placedGroups, unplacedGroups } = useMemo(() => {
    const placed = groups.filter((g) => g.location > 0).sort((a, b) => a.location - b.location);
    const unplaced = groups.filter((g) => g.location <= 0);
    return { placedGroups: placed, unplacedGroups: unplaced };
  }, [groups]);

  const placedSubGroupsByGroup = useMemo(() => {
    const m = new Map<string, FormSubGroup[]>();
    for (const sg of subGroups) {
      if (sg.location > 0) {
        const arr = m.get(sg.groupId) ?? [];
        arr.push(sg);
        m.set(sg.groupId, arr);
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => a.location - b.location);
    return m;
  }, [subGroups]);

  const unplacedSubGroups = useMemo(
    () => subGroups.filter((sg) => sg.location <= 0),
    [subGroups]
  );

  // The unified palette: top-level unplaced groups + unplaced sub-groups (which
  // are conceptually the same kind of thing now — both are rows in form_groups).
  const unplacedAll = useMemo(
    () => [
      ...unplacedGroups.map((g) => ({ kind: "group" as const, item: g })),
      ...unplacedSubGroups.map((sg) => ({ kind: "subgroup" as const, item: sg })),
    ],
    [unplacedGroups, unplacedSubGroups]
  );

  const placedFieldsByContainer = useMemo(() => {
    const m = new Map<string, FormField[]>();
    for (const f of fields) {
      if (f.location <= 0) continue;
      const key = `${f.groupId ?? "_"}:${f.subGroupId ?? "_"}`;
      const arr = m.get(key) ?? [];
      arr.push(f);
      m.set(key, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.location - b.location);
    return m;
  }, [fields]);

  const unplacedFields = useMemo(() => fields.filter((f) => f.location <= 0), [fields]);

  const fieldsIn = (groupId: string | null, subGroupId: string | null): FormField[] =>
    placedFieldsByContainer.get(`${groupId ?? "_"}:${subGroupId ?? "_"}`) ?? [];

  // ---------- DnD handlers ----------
  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const data = active.data.current as DragData | undefined;
    if (!data) return;
    const activeStr = String(active.id);
    const overStr = String(over.id);

    // ----- Determine drop target -----
    let target: DropTarget | null = null;
    let overItemId: string | null = null;

    const overData = over.data.current as { target?: DropTarget } | undefined;
    if (overData?.target) {
      target = overData.target;
    } else {
      // Over an item — find which container it belongs to.
      overItemId = overStr;
      target = inferContainerFor(overItemId, data.kind, {
        groups,
        subGroups,
        fields,
      });
    }
    if (!target) return;

    // ----- Group / Sub-group (same underlying entity) -----
    if (data.kind === "group" || data.kind === "subgroup") {
      // Drop on the unified palette → unplace the item entirely. If it was a
      // sub-group, also promote it to top-level so it returns to the right
      // section of the palette.
      if (target.kind === "palette" && target.itemKind === "group") {
        if (data.kind === "subgroup") {
          onNestGroup(activeStr, null, 0);
        } else {
          onPlaceGroup(activeStr, 0);
        }
        return;
      }

      // Dropped into a group's sub-group zone → demote to sub-group of that group.
      if (target.kind === "subgroups-of") {
        // Don't allow nesting a group inside itself.
        if (target.groupId === activeStr) return;
        const currentInGroup = (placedSubGroupsByGroup.get(target.groupId) ?? [])
          .map((s) => s.id)
          .filter((id) => id !== activeStr);
        const overIdx = overItemId ? currentInGroup.indexOf(overItemId) : -1;
        const insertAt = overIdx === -1 ? currentInGroup.length : overIdx;
        // If the item is already a sub-group of the same parent, just reorder.
        const currentSub = subGroups.find((s) => s.id === activeStr);
        if (currentSub && currentSub.groupId === target.groupId && currentSub.location > 0) {
          currentInGroup.splice(insertAt, 0, activeStr);
          onReorderSubGroups(target.groupId, currentInGroup);
        } else {
          onNestGroup(activeStr, target.groupId, insertAt + 1);
        }
        return;
      }

      // Dropped onto the top-level groups canvas (or its inner field zones) →
      // promote to top-level (or just reorder if already top-level).
      if (target.kind === "groups-canvas" || target.kind === "fields-of") {
        const ids = placedGroups.map((g) => g.id).filter((id) => id !== activeStr);
        const overIdx = overItemId ? ids.indexOf(overItemId) : -1;
        const insertAt = overIdx === -1 ? ids.length : overIdx;
        ids.splice(insertAt, 0, activeStr);
        if (data.kind === "subgroup") {
          // Promote: write parent_group_id = null + new location.
          onNestGroup(activeStr, null, insertAt + 1);
          // Also persist the surrounding ordering.
          onReorderGroups(ids);
        } else {
          onReorderGroups(ids);
        }
        return;
      }

      return;
    }

    if (data.kind === "field") {
      if (target.kind === "palette" && target.itemKind === "field") {
        onPlaceField(activeStr, { groupId: null, subGroupId: null, location: 0 });
        return;
      }
      if (target.kind === "fields-of") {
        const containerFields = fieldsIn(target.groupId, target.subGroupId);
        const ids = containerFields.map((f) => f.id).filter((id) => id !== activeStr);
        const overIdx = overItemId ? ids.indexOf(overItemId) : ids.length;
        ids.splice(overIdx === -1 ? ids.length : overIdx, 0, activeStr);

        const cur = fields.find((f) => f.id === activeStr);
        const sameContainer =
          cur &&
          (cur.groupId ?? null) === target.groupId &&
          (cur.subGroupId ?? null) === target.subGroupId;
        if (sameContainer) {
          onReorderFields(
            { groupId: target.groupId, subGroupId: target.subGroupId },
            ids
          );
        } else {
          const insertIdx = overIdx === -1 ? ids.length - 1 : overIdx;
          onPlaceField(activeStr, {
            groupId: target.groupId,
            subGroupId: target.subGroupId,
            location: insertIdx + 1,
          });
        }
      }
    }
  }

  // ---------- Render ----------
  const activeChip = activeId ? renderActive(activeId, { groups, subGroups, fields }) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* ---------- Palette ---------- */}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Nem elhelyezett elemek</h3>
            <p className="text-xs text-muted-foreground">
              Húzd az elemeket az alábbi struktúrába a megjelenítéshez. Új csoportokat a
              „Csoport" fülön, új mezőket a „Mező" fülön tudsz létrehozni. Egy csoport
              al-csoporttá válik, ha másik csoport al-csoport zónájába húzod.
            </p>
          </div>

          <div className="space-y-2">
            <PaletteRow label="Csoportok">
              <DropZone
                target={{ kind: "palette", itemKind: "group" }}
                empty={unplacedAll.length ? undefined : "Nincs elhelyezetlen csoport."}
              >
                <SortableContext
                  items={unplacedAll.map((u) => u.item.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {unplacedAll.map(({ kind, item }) => (
                    <DraggableChip
                      key={item.id}
                      id={item.id}
                      data={
                        kind === "group"
                          ? { kind: "group" }
                          : { kind: "subgroup", parentGroupId: (item as FormSubGroup).groupId }
                      }
                      label={item.label || item.internalName || "(névtelen csoport)"}
                    />
                  ))}
                </SortableContext>
              </DropZone>
            </PaletteRow>

            <PaletteRow label="Mezők">
              <DropZone
                target={{ kind: "palette", itemKind: "field" }}
                empty={unplacedFields.length ? undefined : "Nincs elhelyezetlen mező."}
              >
                <SortableContext
                  items={unplacedFields.map((f) => f.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {unplacedFields.map((f) => (
                    <DraggableChip
                      key={f.id}
                      id={f.id}
                      data={{ kind: "field" }}
                      label={f.label || f.internalName || "(névtelen mező)"}
                      subtitle={f.type}
                      selected={selectedFieldId === f.id}
                      onSelect={() => onSelectField(f.id)}
                    />
                  ))}
                </SortableContext>
              </DropZone>
            </PaletteRow>
          </div>
        </section>

        {/* ---------- Canvas ---------- */}
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Űrlap struktúra</h3>
              <p className="text-xs text-muted-foreground">A megjelenő űrlap sorrendje és csoportosítása.</p>
            </div>
            {onClearAllFields && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearAllFields}
                disabled={fields.every((f) => f.location <= 0)}
                title="Az összes elhelyezett mező visszahelyezése a nem elhelyezett elemek közé."
              >
                <Eraser className="h-4 w-4 mr-1" />
                Ürítés
              </Button>
            )}
          </div>

          {/* Global placed fields (no group) */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Csoport nélküli mezők
            </p>
            <DropZone
              target={{ kind: "fields-of", groupId: null, subGroupId: null }}
              stack
              empty={
                fieldsIn(null, null).length ? undefined : "Húzz ide mezőt a csoport nélküli megjelenítéshez."
              }
            >
              <SortableContext
                items={fieldsIn(null, null).map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fieldsIn(null, null).map((f) => (
                  <DraggableChip
                    key={f.id}
                    id={f.id}
                    data={{ kind: "field" }}
                    label={f.label || f.internalName || "(névtelen mező)"}
                    subtitle={f.type}
                    selected={selectedFieldId === f.id}
                    onSelect={() => onSelectField(f.id)}
                  />
                ))}
              </SortableContext>
            </DropZone>
          </div>

          {/* Placed groups — stacked vertically (one per row) */}
          <DropZone
            target={{ kind: "groups-canvas" }}
            empty={placedGroups.length ? undefined : "Húzz ide csoportot a struktúra felépítéséhez."}
            className="!border-solid !p-0 !bg-transparent space-y-3"
          >
            <SortableContext
              items={placedGroups.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3">
                {placedGroups.map((g) => {
                  const placedSubs = placedSubGroupsByGroup.get(g.id) ?? [];
                  return (
                    <SortableGroupBox key={g.id} groupId={g.id}>
                      {({ attributes, listeners }) => (
                        <>
                          {/* Title row = drag handle for the entire group box */}
                          <div
                            {...attributes}
                            {...listeners}
                            className="flex items-center gap-2 cursor-grab active:cursor-grabbing -mx-1 px-1 py-0.5 rounded hover:bg-accent/30"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {g.label || g.internalName || "(névtelen csoport)"}
                            </span>
                            <span className="text-xs text-muted-foreground">csoport</span>
                            <div className="ml-auto flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">Szélesség</span>
                              <WidthInlineSelect
                                value={g.width}
                                onChange={(w) => onChangeGroupWidth(g.id, w)}
                              />
                            </div>
                          </div>

                          {/* Group-level fields */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                              Mezők
                            </p>
                            <DropZone
                              target={{ kind: "fields-of", groupId: g.id, subGroupId: null }}
                              stack
                              empty={
                                fieldsIn(g.id, null).length ? undefined : "Húzz ide mezőt a csoport szintre."
                              }
                            >
                              <SortableContext
                                items={fieldsIn(g.id, null).map((f) => f.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {fieldsIn(g.id, null).map((f) => (
                                  <DraggableChip
                                    key={f.id}
                                    id={f.id}
                                    data={{ kind: "field" }}
                                    label={f.label || f.internalName || "(névtelen mező)"}
                                    subtitle={f.type}
                                    selected={selectedFieldId === f.id}
                                    onSelect={() => onSelectField(f.id)}
                                  />
                                ))}
                              </SortableContext>
                            </DropZone>
                          </div>

                          {/* Sub-groups */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                              Al-csoportok
                            </p>
                            <DropZone
                              target={{ kind: "subgroups-of", groupId: g.id }}
                              empty={
                                placedSubs.length
                                  ? undefined
                                  : "Húzz ide csoportot, hogy ezen csoport al-csoportja legyen."
                              }
                            >
                              <SortableContext
                                items={placedSubs.map((s) => s.id)}
                                strategy={horizontalListSortingStrategy}
                              >
                                {placedSubs.map((sg) => (
                                  <div key={sg.id} className="inline-flex items-center gap-1">
                                    <DraggableChip
                                      id={sg.id}
                                      data={{ kind: "subgroup", parentGroupId: sg.groupId }}
                                      label={sg.label || sg.internalName || "(névtelen al-csoport)"}
                                    />
                                    <WidthInlineSelect
                                      value={sg.width}
                                      onChange={(w) => onChangeSubGroupWidth(sg.id, w)}
                                    />
                                  </div>
                                ))}
                              </SortableContext>
                            </DropZone>

                            {placedSubs.map((sg) => (
                              <div
                                key={`fields-${sg.id}`}
                                className="ml-4 mt-1 rounded-lg border border-border/70 bg-secondary/30 p-2 space-y-1"
                              >
                                <p className="text-[11px] text-muted-foreground px-1">
                                  <span className="font-medium">
                                    {sg.label || sg.internalName || "(névtelen al-csoport)"}
                                  </span>{" "}
                                  mezői
                                </p>
                                <DropZone
                                  target={{ kind: "fields-of", groupId: g.id, subGroupId: sg.id }}
                                  stack
                                  empty={
                                    fieldsIn(g.id, sg.id).length ? undefined : "Húzz ide mezőt."
                                  }
                                >
                                  <SortableContext
                                    items={fieldsIn(g.id, sg.id).map((f) => f.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {fieldsIn(g.id, sg.id).map((f) => (
                                      <DraggableChip
                                        key={f.id}
                                        id={f.id}
                                        data={{ kind: "field" }}
                                        label={f.label || f.internalName || "(névtelen mező)"}
                                        subtitle={f.type}
                                        selected={selectedFieldId === f.id}
                                        onSelect={() => onSelectField(f.id)}
                                      />
                                    ))}
                                  </SortableContext>
                                </DropZone>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </SortableGroupBox>
                  );
                })}
              </div>
            </SortableContext>
          </DropZone>
        </section>
      </div>

      <DragOverlay>{activeChip}</DragOverlay>
    </DndContext>
  );
}

function PaletteRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">{label}</p>
      {children}
    </div>
  );
}

function renderActive(
  id: string,
  data: { groups: FormGroup[]; subGroups: FormSubGroup[]; fields: FormField[] }
) {
  const g = data.groups.find((x) => x.id === id);
  if (g) return <Chip label={g.label || g.internalName || "(névtelen csoport)"} />;
  const sg = data.subGroups.find((x) => x.id === id);
  if (sg) return <Chip label={sg.label || sg.internalName || "(névtelen al-csoport)"} />;
  const f = data.fields.find((x) => x.id === id);
  if (f) return <Chip label={f.label || f.internalName || "(névtelen mező)"} subtitle={f.type} />;
  return null;
}

function inferContainerFor(
  itemId: string,
  draggedKind: DragKind,
  data: { groups: FormGroup[]; subGroups: FormSubGroup[]; fields: FormField[] }
): DropTarget | null {
  // Resolve which thing the pointer is over, then map to a container that makes
  // sense for the dragged kind.
  const overGroup = data.groups.find((x) => x.id === itemId);
  const overSubGroup = data.subGroups.find((x) => x.id === itemId);
  const overField = data.fields.find((x) => x.id === itemId);

  if (draggedKind === "group" || draggedKind === "subgroup") {
    if (overGroup) {
      return overGroup.location <= 0
        ? { kind: "palette", itemKind: "group" }
        : { kind: "groups-canvas" };
    }
    if (overSubGroup) {
      return overSubGroup.location <= 0
        ? { kind: "palette", itemKind: "group" }
        : { kind: "subgroups-of", groupId: overSubGroup.groupId };
    }
    if (overField && overField.location > 0 && overField.groupId) {
      return { kind: "groups-canvas" };
    }
    return null;
  }

  // field
  if (overField) {
    if (overField.location <= 0) return { kind: "palette", itemKind: "field" };
    return {
      kind: "fields-of",
      groupId: overField.groupId ?? null,
      subGroupId: overField.subGroupId ?? null,
    };
  }
  return null;
}
