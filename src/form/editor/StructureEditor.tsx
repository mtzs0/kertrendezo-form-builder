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
import { useSortable, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
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

  /** Width updates for groups and sub-groups (fields use the config panel). */
  onChangeGroupWidth: (id: string, width: WidthPercent | undefined) => void;
  onChangeSubGroupWidth: (id: string, width: WidthPercent | undefined) => void;
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
type DragKind = "group" | "subgroup" | "field";
interface DragData {
  kind: DragKind;
  /** For sub-groups: parent group id (sub-groups can only move within their group). */
  parentGroupId?: string;
}

// ---------- Drop target identity ----------
type DropTarget =
  | { kind: "palette"; itemKind: DragKind }
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
}: {
  target: DropTarget;
  children: React.ReactNode;
  empty?: string;
  className?: string;
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
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {empty && (
        <p className="text-[11px] text-muted-foreground italic px-1 py-1">{empty}</p>
      )}
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
    onChangeGroupWidth,
    onChangeSubGroupWidth,
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
    // 1) If dropped on another sortable item, infer its container.
    // 2) If dropped on a DropZone, use its `target`.
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

    // ----- Apply by kind -----
    if (data.kind === "group") {
      if (target.kind === "palette" && target.itemKind === "group") {
        onPlaceGroup(activeStr, 0);
        return;
      }
      if (target.kind === "groups-canvas") {
        // Reorder/append in placed groups list.
        const ids = placedGroups.map((g) => g.id).filter((id) => id !== activeStr);
        const overIdx = overItemId ? ids.indexOf(overItemId) : ids.length;
        ids.splice(overIdx === -1 ? ids.length : overIdx, 0, activeStr);
        onReorderGroups(ids);
      }
      return;
    }

    if (data.kind === "subgroup") {
      const sg = subGroups.find((s) => s.id === activeStr);
      if (!sg) return;
      if (target.kind === "palette" && target.itemKind === "subgroup") {
        onPlaceSubGroup(activeStr, 0);
        return;
      }
      if (target.kind === "subgroups-of") {
        // Sub-groups stay within their own parent group.
        if (target.groupId !== sg.groupId) return;
        const ids = (placedSubGroupsByGroup.get(sg.groupId) ?? [])
          .map((s) => s.id)
          .filter((id) => id !== activeStr);
        const overIdx = overItemId ? ids.indexOf(overItemId) : ids.length;
        ids.splice(overIdx === -1 ? ids.length : overIdx, 0, activeStr);
        onReorderSubGroups(sg.groupId, ids);
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

        // If field already lives in this container, reorder is enough.
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
          // Cross-container: place at the chosen index.
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
              Húzd az elemeket az alábbi struktúrába a megjelenítéshez. Új elemeket a „Mező" fülön
              tudsz létrehozni.
            </p>
          </div>

          <div className="space-y-2">
            <PaletteRow label="Csoportok">
              <DropZone
                target={{ kind: "palette", itemKind: "group" }}
                empty={unplacedGroups.length ? undefined : "Nincs elhelyezetlen csoport."}
              >
                <SortableContext
                  items={unplacedGroups.map((g) => g.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {unplacedGroups.map((g) => (
                    <DraggableChip
                      key={g.id}
                      id={g.id}
                      data={{ kind: "group" }}
                      label={g.label || g.internalName || "(névtelen csoport)"}
                    />
                  ))}
                </SortableContext>
              </DropZone>
            </PaletteRow>

            <PaletteRow label="Al-csoportok">
              <DropZone
                target={{ kind: "palette", itemKind: "subgroup" }}
                empty={unplacedSubGroups.length ? undefined : "Nincs elhelyezetlen al-csoport."}
              >
                <SortableContext
                  items={unplacedSubGroups.map((s) => s.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {unplacedSubGroups.map((sg) => {
                    const parent = groups.find((g) => g.id === sg.groupId);
                    return (
                      <DraggableChip
                        key={sg.id}
                        id={sg.id}
                        data={{ kind: "subgroup", parentGroupId: sg.groupId }}
                        label={sg.label || sg.internalName || "(névtelen al-csoport)"}
                        subtitle={parent?.label || parent?.internalName}
                      />
                    );
                  })}
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
          <div>
            <h3 className="text-sm font-semibold">Űrlap struktúra</h3>
            <p className="text-xs text-muted-foreground">A megjelenő űrlap sorrendje és csoportosítása.</p>
          </div>

          {/* Global placed fields (no group) */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Csoport nélküli mezők
            </p>
            <DropZone
              target={{ kind: "fields-of", groupId: null, subGroupId: null }}
              empty={
                fieldsIn(null, null).length ? undefined : "Húzz ide mezőt a csoport nélküli megjelenítéshez."
              }
            >
              <SortableContext
                items={fieldsIn(null, null).map((f) => f.id)}
                strategy={horizontalListSortingStrategy}
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

          {/* Placed groups */}
          <DropZone
            target={{ kind: "groups-canvas" }}
            empty={placedGroups.length ? undefined : "Húzz ide csoportot a struktúra felépítéséhez."}
            className="!border-solid !p-0 !bg-transparent space-y-3"
          >
            <SortableContext
              items={placedGroups.map((g) => g.id)}
              strategy={horizontalListSortingStrategy}
            >
              {placedGroups.map((g) => {
                const placedSubs = placedSubGroupsByGroup.get(g.id) ?? [];
                return (
                  <div key={g.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <DraggableChip
                        id={g.id}
                        data={{ kind: "group" }}
                        label={g.label || g.internalName || "(névtelen csoport)"}
                      />
                      <span className="text-xs text-muted-foreground">csoport</span>
                    </div>

                    {/* Group-level fields */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                        Mezők
                      </p>
                      <DropZone
                        target={{ kind: "fields-of", groupId: g.id, subGroupId: null }}
                        empty={
                          fieldsIn(g.id, null).length ? undefined : "Húzz ide mezőt a csoport szintre."
                        }
                      >
                        <SortableContext
                          items={fieldsIn(g.id, null).map((f) => f.id)}
                          strategy={horizontalListSortingStrategy}
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
                            : "Húzz ide al-csoportot ehhez a csoporthoz."
                        }
                      >
                        <SortableContext
                          items={placedSubs.map((s) => s.id)}
                          strategy={horizontalListSortingStrategy}
                        >
                          {placedSubs.map((sg) => (
                            <DraggableChip
                              key={sg.id}
                              id={sg.id}
                              data={{ kind: "subgroup", parentGroupId: sg.groupId }}
                              label={sg.label || sg.internalName || "(névtelen al-csoport)"}
                            />
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
                            empty={
                              fieldsIn(g.id, sg.id).length ? undefined : "Húzz ide mezőt."
                            }
                          >
                            <SortableContext
                              items={fieldsIn(g.id, sg.id).map((f) => f.id)}
                              strategy={horizontalListSortingStrategy}
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
                  </div>
                );
              })}
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
  // Same-kind targeting: figure out which container the over-item lives in.
  if (draggedKind === "group") {
    const g = data.groups.find((x) => x.id === itemId);
    if (!g) return null;
    if (g.location <= 0) return { kind: "palette", itemKind: "group" };
    return { kind: "groups-canvas" };
  }
  if (draggedKind === "subgroup") {
    const sg = data.subGroups.find((x) => x.id === itemId);
    if (!sg) return null;
    if (sg.location <= 0) return { kind: "palette", itemKind: "subgroup" };
    return { kind: "subgroups-of", groupId: sg.groupId };
  }
  // field
  const f = data.fields.find((x) => x.id === itemId);
  if (!f) return null;
  if (f.location <= 0) return { kind: "palette", itemKind: "field" };
  return {
    kind: "fields-of",
    groupId: f.groupId ?? null,
    subGroupId: f.subGroupId ?? null,
  };
}
