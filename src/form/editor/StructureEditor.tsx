import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldType, FormField, FormGroup, FormSubGroup } from "@/form/types";
import { SortableItem } from "./SortableItem";

interface Props {
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;

  onAddGroup: () => void;
  onPatchGroup: (id: string, patch: Partial<FormGroup>) => void;
  onRemoveGroup: (id: string) => void;
  onReorderGroups: (orderedIds: string[]) => void;

  onAddSubGroup: (groupId: string) => void;
  onPatchSubGroup: (id: string, patch: Partial<FormSubGroup>) => void;
  onRemoveSubGroup: (id: string) => void;
  onReorderSubGroups: (groupId: string, orderedIds: string[]) => void;

  onAddField: (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => void;
  onRemoveField: (id: string) => void;
  onReorderFields: (
    container: { groupId?: string | null; subGroupId?: string | null },
    orderedIds: string[]
  ) => void;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Szöveg" },
  { value: "textarea", label: "Hosszú szöveg" },
  { value: "slider", label: "Csúszka" },
  { value: "radio", label: "Rádió" },
  { value: "checkbox", label: "Jelölőnégyzet" },
  { value: "select", label: "Kiválasztás" },
  { value: "phone", label: "Telefonszám" },
  { value: "date", label: "Dátum" },
  { value: "image", label: "Kép feltöltés" },
];

function AddFieldButton({
  onAdd,
  size = "sm",
}: {
  onAdd: (type: FieldType) => void;
  size?: "sm" | "default";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size}>
          <Plus className="h-4 w-4 mr-1" />
          Mező
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {FIELD_TYPES.map((t) => (
          <DropdownMenuItem key={t.value} onClick={() => onAdd(t.value)}>
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FieldRow({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <SortableItem id={field.id}>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg border bg-card px-3 py-2 cursor-pointer transition-colors",
          selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40"
        )}
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{field.label || "(névtelen)"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {field.internalName || "—"} · {field.type}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </SortableItem>
  );
}

export function StructureEditor(props: Props) {
  const {
    groups,
    subGroups,
    fields,
    selectedFieldId,
    onSelectField,
    onAddGroup,
    onPatchGroup,
    onRemoveGroup,
    onReorderGroups,
    onAddSubGroup,
    onPatchSubGroup,
    onRemoveSubGroup,
    onReorderSubGroups,
    onAddField,
    onRemoveField,
    onReorderFields,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.location - b.location), [groups]);
  const globalFields = useMemo(
    () => fields.filter((f) => !f.groupId).sort((a, b) => a.location - b.location),
    [fields]
  );

  const handleGroupDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = sortedGroups.map((g) => g.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorderGroups(next);
  };

  return (
    <div className="space-y-6">
      {/* Global (no-group) fields */}
      <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Csoport nélküli mezők
          </h3>
          <AddFieldButton onAdd={(t) => onAddField(t)} />
        </div>
        <FieldList
          containerKey="__global"
          fields={globalFields}
          selectedFieldId={selectedFieldId}
          onSelect={onSelectField}
          onRemove={onRemoveField}
          onReorder={(ids) => onReorderFields({ groupId: null, subGroupId: null }, ids)}
        />
      </section>

      {/* Groups */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
        <SortableContext items={sortedGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {sortedGroups.map((g) => (
              <SortableItem key={g.id} id={g.id}>
                <GroupCard
                  group={g}
                  subGroups={subGroups
                    .filter((s) => s.groupId === g.id)
                    .sort((a, b) => a.location - b.location)}
                  groupFields={fields
                    .filter((f) => f.groupId === g.id && !f.subGroupId)
                    .sort((a, b) => a.location - b.location)}
                  fieldsBySubGroup={subGroups
                    .filter((s) => s.groupId === g.id)
                    .reduce<Record<string, FormField[]>>((acc, sg) => {
                      acc[sg.id] = fields
                        .filter((f) => f.subGroupId === sg.id)
                        .sort((a, b) => a.location - b.location);
                      return acc;
                    }, {})}
                  selectedFieldId={selectedFieldId}
                  onSelectField={onSelectField}
                  onPatchGroup={onPatchGroup}
                  onRemoveGroup={onRemoveGroup}
                  onAddSubGroup={onAddSubGroup}
                  onPatchSubGroup={onPatchSubGroup}
                  onRemoveSubGroup={onRemoveSubGroup}
                  onReorderSubGroups={onReorderSubGroups}
                  onAddField={onAddField}
                  onRemoveField={onRemoveField}
                  onReorderFields={onReorderFields}
                />
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" onClick={onAddGroup}>
        <Plus className="h-4 w-4 mr-1" />
        Új csoport
      </Button>
    </div>
  );
}

function FieldList({
  fields,
  selectedFieldId,
  onSelect,
  onRemove,
  onReorder,
}: {
  containerKey: string;
  fields: FormField[];
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const handleEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };

  if (!fields.length) {
    return (
      <p className="text-xs text-muted-foreground italic px-1">Még nincs mező itt.</p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              selected={selectedFieldId === f.id}
              onSelect={() => onSelect(f.id)}
              onRemove={() => onRemove(f.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function GroupCard({
  group,
  subGroups,
  groupFields,
  fieldsBySubGroup,
  selectedFieldId,
  onSelectField,
  onPatchGroup,
  onRemoveGroup,
  onAddSubGroup,
  onPatchSubGroup,
  onRemoveSubGroup,
  onReorderSubGroups,
  onAddField,
  onRemoveField,
  onReorderFields,
}: {
  group: FormGroup;
  subGroups: FormSubGroup[];
  groupFields: FormField[];
  fieldsBySubGroup: Record<string, FormField[]>;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onPatchGroup: (id: string, patch: Partial<FormGroup>) => void;
  onRemoveGroup: (id: string) => void;
  onAddSubGroup: (groupId: string) => void;
  onPatchSubGroup: (id: string, patch: Partial<FormSubGroup>) => void;
  onRemoveSubGroup: (id: string) => void;
  onReorderSubGroups: (groupId: string, orderedIds: string[]) => void;
  onAddField: (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => void;
  onRemoveField: (id: string) => void;
  onReorderFields: (
    container: { groupId?: string | null; subGroupId?: string | null },
    orderedIds: string[]
  ) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleSubGroupDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = subGroups.map((s) => s.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorderSubGroups(group.id, next);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Csoport belső név</label>
          <Input
            value={group.internalName}
            onChange={(e) => onPatchGroup(group.id, { internalName: e.target.value })}
            placeholder="pl. kapcsolat"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Csoport külső név</label>
          <Input
            value={group.label}
            onChange={(e) => onPatchGroup(group.id, { label: e.target.value })}
            placeholder="Pl. Kapcsolat"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AddFieldButton onAdd={(t) => onAddField(t, { groupId: group.id })} />
        <Button variant="outline" size="sm" onClick={() => onAddSubGroup(group.id)}>
          <Plus className="h-4 w-4 mr-1" />
          Al-csoport
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemoveGroup(group.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Csoport törlés
        </Button>
      </div>

      {/* Group-level fields */}
      <FieldList
        containerKey={`g_${group.id}`}
        fields={groupFields}
        selectedFieldId={selectedFieldId}
        onSelect={onSelectField}
        onRemove={onRemoveField}
        onReorder={(ids) => onReorderFields({ groupId: group.id, subGroupId: null }, ids)}
      />

      {/* Sub-groups */}
      {subGroups.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubGroupDragEnd}>
          <SortableContext items={subGroups.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {subGroups.map((sg) => (
                <SortableItem key={sg.id} id={sg.id}>
                  <div className="rounded-xl border border-border/70 bg-secondary/40 p-3 md:p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        value={sg.internalName}
                        onChange={(e) => onPatchSubGroup(sg.id, { internalName: e.target.value })}
                        placeholder="al-csoport belső név"
                      />
                      <Input
                        value={sg.label}
                        onChange={(e) => onPatchSubGroup(sg.id, { label: e.target.value })}
                        placeholder="Al-csoport külső név"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <AddFieldButton
                        onAdd={(t) => onAddField(t, { groupId: group.id, subGroupId: sg.id })}
                      />
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveSubGroup(sg.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Törlés
                      </Button>
                    </div>
                    <FieldList
                      containerKey={`sg_${sg.id}`}
                      fields={fieldsBySubGroup[sg.id] ?? []}
                      selectedFieldId={selectedFieldId}
                      onSelect={onSelectField}
                      onRemove={onRemoveField}
                      onReorder={(ids) =>
                        onReorderFields({ groupId: group.id, subGroupId: sg.id }, ids)
                      }
                    />
                  </div>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
