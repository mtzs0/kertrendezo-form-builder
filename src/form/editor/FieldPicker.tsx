import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldType, FormField, FormGroup, FormSubGroup } from "@/form/types";

interface Props {
  fields: FormField[];
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onAddField: (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => void;
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

const TYPE_LABEL: Record<FieldType, string> = FIELD_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<FieldType, string>
);

interface Section {
  key: string;
  title: string;
  subtitle?: string;
  groupId?: string;
  subGroupId?: string;
  fields: FormField[];
}

export function FieldPicker({
  fields,
  groups,
  subGroups,
  selectedFieldId,
  onSelectField,
  onAddField,
}: Props) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FieldType | "all">("all");

  const sections = useMemo<Section[]>(() => {
    const sortedGroups = [...groups].sort((a, b) => a.location - b.location);
    const out: Section[] = [];

    const globalFields = fields
      .filter((f) => !f.groupId)
      .sort((a, b) => a.location - b.location);
    out.push({
      key: "__global",
      title: "Csoport nélküli mezők",
      fields: globalFields,
    });

    for (const g of sortedGroups) {
      const groupFields = fields
        .filter((f) => f.groupId === g.id && !f.subGroupId)
        .sort((a, b) => a.location - b.location);
      out.push({
        key: `g_${g.id}`,
        title: g.label || g.internalName || "(névtelen csoport)",
        subtitle: "Csoport",
        groupId: g.id,
        fields: groupFields,
      });
      const sortedSub = subGroups
        .filter((s) => s.groupId === g.id)
        .sort((a, b) => a.location - b.location);
      for (const sg of sortedSub) {
        out.push({
          key: `sg_${sg.id}`,
          title: sg.label || sg.internalName || "(névtelen al-csoport)",
          subtitle: `Al-csoport · ${g.label || g.internalName}`,
          groupId: g.id,
          subGroupId: sg.id,
          fields: fields
            .filter((f) => f.subGroupId === sg.id)
            .sort((a, b) => a.location - b.location),
        });
      }
    }
    return out;
  }, [fields, groups, subGroups]);

  const q = query.trim().toLowerCase();
  const matches = (f: FormField) => {
    if (typeFilter !== "all" && f.type !== typeFilter) return false;
    if (!q) return true;
    return (
      f.label?.toLowerCase().includes(q) ||
      f.internalName?.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q)
    );
  };

  const filteredSections = sections
    .map((s) => ({ ...s, fields: s.fields.filter(matches) }))
    .filter((s) => s.fields.length > 0 || (!q && typeFilter === "all"));

  const totalVisible = filteredSections.reduce((n, s) => n + s.fields.length, 0);

  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Mezők</h3>
          <p className="text-xs text-muted-foreground">
            {totalVisible} mező{totalVisible === 1 ? "" : ""} · válassz a szerkesztéshez
          </p>
        </div>
        <AddFieldMenu groups={groups} subGroups={subGroups} onAddField={onAddField} />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés név vagy típus szerint…"
            className="pl-8 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FieldType | "all")}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes típus</SelectItem>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
        {filteredSections.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Nincs találat.
          </p>
        )}
        {filteredSections.map((s) => (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  {s.title}
                </p>
                {s.subtitle && (
                  <p className="text-[10px] text-muted-foreground/80 truncate">{s.subtitle}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const type: FieldType = typeFilter === "all" ? "text" : typeFilter;
                  onAddField(type, { groupId: s.groupId, subGroupId: s.subGroupId });
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Új
              </Button>
            </div>
            {s.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1 py-1">
                Még nincs mező itt.
              </p>
            ) : (
              <div className="space-y-1">
                {s.fields.map((f) => {
                  const selected = f.id === selectedFieldId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onSelectField(f.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition-colors",
                        selected
                          ? "border-primary ring-1 ring-primary/30 bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-accent/40"
                      )}
                    >
                      <p className="text-sm font-medium truncate">
                        {f.label || "(névtelen)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {f.internalName || "—"} · {TYPE_LABEL[f.type]}
                        {f.required ? " · kötelező" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddFieldMenu({
  groups,
  subGroups,
  onAddField,
}: {
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  onAddField: (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => void;
}) {
  const sortedGroups = [...groups].sort((a, b) => a.location - b.location);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Új mező
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Csoport nélkül</DropdownMenuLabel>
        {FIELD_TYPES.map((t) => (
          <DropdownMenuItem key={`global_${t.value}`} onClick={() => onAddField(t.value)}>
            {t.label}
          </DropdownMenuItem>
        ))}
        {sortedGroups.length > 0 && <DropdownMenuSeparator />}
        {sortedGroups.map((g) => {
          const subs = subGroups
            .filter((s) => s.groupId === g.id)
            .sort((a, b) => a.location - b.location);
          return (
            <DropdownMenuSub key={g.id}>
              <DropdownMenuSubTrigger>
                {g.label || g.internalName || "(névtelen csoport)"}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuLabel>Csoport szintű</DropdownMenuLabel>
                {FIELD_TYPES.map((t) => (
                  <DropdownMenuItem
                    key={`g_${g.id}_${t.value}`}
                    onClick={() => onAddField(t.value, { groupId: g.id })}
                  >
                    {t.label}
                  </DropdownMenuItem>
                ))}
                {subs.length > 0 && <DropdownMenuSeparator />}
                {subs.map((sg) => (
                  <DropdownMenuSub key={sg.id}>
                    <DropdownMenuSubTrigger>
                      {sg.label || sg.internalName || "(névtelen al-csoport)"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {FIELD_TYPES.map((t) => (
                        <DropdownMenuItem
                          key={`sg_${sg.id}_${t.value}`}
                          onClick={() =>
                            onAddField(t.value, { groupId: g.id, subGroupId: sg.id })
                          }
                        >
                          {t.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
