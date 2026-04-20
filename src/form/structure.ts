import type {
  ConditionGroup,
  FieldCondition,
  FormField,
  FormSchema,
  FormValues,
} from "./types";

/** Sort by location ascending (stable). */
const byLocation = <T extends { location: number }>(a: T, b: T) =>
  a.location - b.location;

export interface RenderSubGroup {
  kind: "subgroup";
  id: string;
  label: string;
  location: number;
  fields: FormField[];
}

export interface RenderGroupChild {
  kind: "field";
  field: FormField;
}

export interface RenderGroup {
  kind: "group";
  id: string;
  label: string;
  location: number;
  /** Sub-groups (each containing their fields) plus group-level fields, in order. */
  children: Array<RenderSubGroup | RenderGroupChild>;
}

export interface RenderGlobalField {
  kind: "field";
  field: FormField;
}

export type RenderItem = RenderGroup | RenderGlobalField;

/**
 * Build a render tree from a schema:
 * - Top-level: groups (sorted by location) + global fields (no groupId), sorted together by location.
 * - Inside each group: sub-groups + group-level fields (no subGroupId), sorted together by location.
 * - Inside each sub-group: fields sorted by location.
 */
export function buildRenderTree(schema: FormSchema): RenderItem[] {
  const items: RenderItem[] = [];

  // Global fields (no group)
  const globalFields = schema.fields
    .filter((f) => !f.groupId)
    .sort(byLocation)
    .map<RenderGlobalField>((field) => ({ kind: "field", field }));

  // Groups
  const groups = schema.groups
    .slice()
    .sort(byLocation)
    .map<RenderGroup>((group) => {
      const subGroupsForGroup = schema.subGroups
        .filter((sg) => sg.groupId === group.id)
        .sort(byLocation);

      const subGroupRender: RenderSubGroup[] = subGroupsForGroup.map((sg) => ({
        kind: "subgroup",
        id: sg.id,
        label: sg.label,
        location: sg.location,
        fields: schema.fields
          .filter((f) => f.groupId === group.id && f.subGroupId === sg.id)
          .sort(byLocation),
      }));

      const groupLevelFields: RenderGroupChild[] = schema.fields
        .filter((f) => f.groupId === group.id && !f.subGroupId)
        .sort(byLocation)
        .map((field) => ({ kind: "field" as const, field }));

      const children = [...subGroupRender, ...groupLevelFields].sort(
        (a, b) => {
          const al = a.kind === "subgroup" ? a.location : a.field.location;
          const bl = b.kind === "subgroup" ? b.location : b.field.location;
          return al - bl;
        }
      );

      return {
        kind: "group",
        id: group.id,
        label: group.label,
        location: group.location,
        children,
      };
    });

  // Merge global fields and groups by location
  return [...groups, ...globalFields].sort((a, b) => {
    const al = a.kind === "group" ? a.location : a.field.location;
    const bl = b.kind === "group" ? b.location : b.field.location;
    return al - bl;
  });
}

// ---------- Conditions ----------

function evalCondition(c: FieldCondition, values: FormValues): boolean {
  const v = values[c.fieldId];
  switch (c.operator) {
    case "is":
    case "equals":
      return v === c.value;
    case "is_not":
      return v !== c.value;
    case "greater_than":
      return typeof v === "number" && typeof c.value === "number" && v > c.value;
    case "less_than":
      return typeof v === "number" && typeof c.value === "number" && v < c.value;
    case "contains":
      if (Array.isArray(v)) return (v as unknown[]).map(String).includes(String(c.value));
      if (typeof v === "string") return v.includes(String(c.value));
      return false;
    default:
      return true;
  }
}

export function evalConditionGroup(
  group: ConditionGroup,
  values: FormValues
): boolean {
  if (!group.rules.length) return true;
  const results = group.rules.map((r) =>
    "combinator" in r ? evalConditionGroup(r, values) : evalCondition(r, values)
  );
  return group.combinator === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}

export function isFieldVisible(field: FormField, values: FormValues): boolean {
  if (!field.condition) return true;
  return evalConditionGroup(field.condition, values);
}
