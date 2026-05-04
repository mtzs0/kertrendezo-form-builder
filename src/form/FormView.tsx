import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { FieldRenderer } from "./FieldRenderer";
import {
  buildRenderTree,
  filterPlacedSchema,
  isFieldVisible,
  isGroupVisible,
  packByWidth,
  type RenderGroup,
  type RenderGroupChild,
  type RenderItem,
  type RenderSubGroup,
} from "./structure";
import { submitForm } from "./api";
import { StepNavigator, type StepGroup } from "./StepNavigator";
import type { FormSchema, FormValues, FormField } from "./types";

/** "group-level" pseudo sub-step id for fields directly on a group. */
const GROUP_LEVEL_SUB = "__group_level__";

interface Props {
  schema: FormSchema;
  /** "horizontal" = desktop/tablet wide layout, "vertical" = mobile stacked. */
  layout: "horizontal" | "vertical";
  /** When provided, submissions are persisted to Supabase under this form id. */
  formId?: string | null;
  /** When true, shows a "Demo" button that auto-fills all fields with sample data. */
  showDemoButton?: boolean;
  /** Optional thank-you message shown after a successful submission. */
  thankYouText?: string | null;
  /**
   * Optional listener invoked whenever the internal `values` map changes.
   * Used by the demo preview to drive its "reveal fields one-by-one" mode.
   */
  onValuesChange?: (values: FormValues) => void;
}

function randomString(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildDemoValues(schema: FormSchema): FormValues {
  // Only fill fields actually placed in the form structure (location > 0)
  // and whose group/sub-group (if any) is also placed.
  const placed = filterPlacedSchema(schema);
  const groupIds = new Set(placed.groups.map((g) => g.id));
  const subGroupIds = new Set(placed.subGroups.map((s) => s.id));
  const fields = placed.fields.filter((f) => {
    if (f.groupId && !groupIds.has(f.groupId)) return false;
    if (f.subGroupId && !subGroupIds.has(f.subGroupId)) return false;
    return true;
  });

  const values: FormValues = {};
  for (const field of fields) {
    switch (field.type) {
      case "text":
      case "textarea":
        values[field.id] = randomString(10);
        break;
      case "email":
        values[field.id] = "test@test.com";
        break;
      case "phone":
        values[field.id] = "06701234567";
        break;
      case "post_code":
        values[field.id] = "1027";
        break;
      case "city":
        values[field.id] = "Budapest";
        break;
      case "street":
        values[field.id] = "Margit krt. 64/b";
        break;
      case "date":
        values[field.id] = new Date();
        break;
      case "slider": {
        const stops = field.customStops && field.customStops.length > 0
          ? [field.min, ...field.customStops, field.max]
          : null;
        if (stops) {
          values[field.id] = pickRandom(stops);
        } else {
          const step = field.step ?? 1;
          const range = field.max - field.min;
          const steps = Math.floor(range / step);
          values[field.id] = field.min + Math.floor(Math.random() * (steps + 1)) * step;
        }
        break;
      }
      case "radio":
      case "select": {
        if (field.options.length > 0) values[field.id] = pickRandom(field.options).dataName;
        break;
      }
      case "checkbox": {
        if (field.options.length > 0) {
          const count = 1 + Math.floor(Math.random() * field.options.length);
          const shuffled = [...field.options].sort(() => Math.random() - 0.5);
          values[field.id] = shuffled.slice(0, count).map((o) => o.dataName);
        }
        break;
      }
      case "image":
      case "label":
        // Skip: image upload requires real files; label collects no value.
        break;
      case "repeater": {
        // Generate 1–2 demo instances using each child's default demo logic.
        const childCount = 1 + Math.floor(Math.random() * 2);
        const out: Record<string, unknown>[] = [];
        for (let i = 0; i < childCount; i++) {
          const inst: Record<string, unknown> = {};
          for (const c of field.children ?? []) {
            switch (c.type) {
              case "text":
              case "textarea":
                inst[c.internalName] = randomString(8);
                break;
              case "email":
                inst[c.internalName] = "test@test.com";
                break;
              case "phone":
                inst[c.internalName] = "06701234567";
                break;
              case "post_code":
                inst[c.internalName] = "1027";
                break;
              case "city":
                inst[c.internalName] = "Budapest";
                break;
              case "street":
                inst[c.internalName] = "Margit krt. 64/b";
                break;
              case "slider":
                inst[c.internalName] = c.min + Math.floor(Math.random() * (c.max - c.min));
                break;
              case "radio":
              case "select":
                if (c.options.length > 0) inst[c.internalName] = pickRandom(c.options).dataName;
                break;
              case "checkbox":
                if (c.options.length > 0) inst[c.internalName] = [pickRandom(c.options).dataName];
                break;
              default:
                break;
            }
          }
          out.push(inst);
        }
        values[field.id] = out as FormValues[string];
        break;
      }
    }
  }
  return values;
}

export function FormView({ schema, layout, formId, showDemoButton, thankYouText, onValuesChange }: Props) {
  const [values, setValues] = useState<FormValues>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [seenGroupIds, setSeenGroupIds] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => buildRenderTree(filterPlacedSchema(schema)), [schema]);

  // Lookup maps for group / sub-group condition checks.
  const groupById = useMemo(() => {
    const m = new Map<string, typeof schema.groups[number]>();
    for (const g of schema.groups) m.set(g.id, g);
    return m;
  }, [schema.groups]);
  const subGroupById = useMemo(() => {
    const m = new Map<string, typeof schema.subGroups[number]>();
    for (const s of schema.subGroups) m.set(s.id, s);
    return m;
  }, [schema.subGroups]);

  // Notify parent of value changes so the demo preview can drive its
  // "reveal one-by-one" mode based on which fields have been answered.
  useEffect(() => {
    onValuesChange?.(values);
  }, [values, onValuesChange]);

  // Stepped mode is active when at least one top-level group is placed.
  // Groups become steps; their sub-groups (+ group-level fields as a pseudo
  // sub-step) become sub-steps. Global (no-group) top-level fields are NOT
  // rendered in stepped mode per requirement.
  const allGroupSteps = useMemo<RenderGroup[]>(
    () => tree.filter((it): it is RenderGroup => it.kind === "group"),
    [tree],
  );
  // Filter out group-steps whose `condition` evaluates false.
  const groupSteps = useMemo<RenderGroup[]>(() => {
    return allGroupSteps.filter((g) => {
      const meta = groupById.get(g.id);
      if (!meta) return true;
      return isGroupVisible(meta, values, seenGroupIds);
    });
  }, [allGroupSteps, groupById, values, seenGroupIds]);
  const isStepped = groupSteps.length > 0;

  /**
   * Build per-group sub-step ids in render order. Group-level fields (children
   * with kind === "field") are merged into a single pseudo sub-step rendered
   * at their first occurrence position.
   */
  const subStepsByGroup = useMemo(() => {
    const out: Record<string, { ids: string[]; labels: Record<string, string> }> = {};
    for (const g of groupSteps) {
      const ids: string[] = [];
      const labels: Record<string, string> = {};
      let pseudoAdded = false;
      for (const child of g.children) {
        if (child.kind === "subgroup") {
          const meta = subGroupById.get(child.id);
          if (meta && !isGroupVisible(meta, values, seenGroupIds)) continue;
          ids.push(child.id);
          labels[child.id] = child.label;
        } else if (!pseudoAdded) {
          ids.push(GROUP_LEVEL_SUB);
          labels[GROUP_LEVEL_SUB] = "Általános";
          pseudoAdded = true;
        }
      }
      out[g.id] = { ids, labels };
    }
    return out;
  }, [groupSteps, subGroupById, values, seenGroupIds]);

  // Active step state.
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [activeSubByGroup, setActiveSubByGroup] = useState<Record<string, string | null>>({});
  const [maxGroupIdx, setMaxGroupIdx] = useState(0);
  const [maxSubIdxByGroup, setMaxSubIdxByGroup] = useState<Record<string, number>>({});

  // Reset stepper when groups change shape.
  const groupsKey = groupSteps.map((g) => g.id).join("|");
  useEffect(() => {
    setActiveGroupIdx(0);
    setMaxGroupIdx(0);
    setActiveSubByGroup({});
    setMaxSubIdxByGroup({});
  }, [groupsKey]);

  const activeGroup = isStepped ? groupSteps[activeGroupIdx] : null;
  const activeSubId = activeGroup
    ? (activeSubByGroup[activeGroup.id] ?? subStepsByGroup[activeGroup.id]?.ids[0] ?? null)
    : null;

  const handleChange = (id: string, v: FormValues[string]) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  const renderField = (field: FormField) => {
    if (!isFieldVisible(field, values)) return null;
    return (
      <FieldRenderer
        key={field.id}
        field={field}
        value={values[field.id]}
        onChange={handleChange}
        layout={layout}
      />
    );
  };

  /**
   * Filter helpers: items hidden by display conditions are removed BEFORE
   * width-packing so they don't leave empty space in the row.
   */
  const visibleFields = (fields: FormField[]) =>
    fields.filter((f) => isFieldVisible(f, values));

  const subGroupHasVisible = (sg: RenderSubGroup) => visibleFields(sg.fields).length > 0;

  const groupHasVisible = (g: RenderGroup) =>
    g.children.some((c) =>
      c.kind === "field" ? isFieldVisible(c.field, values) : subGroupHasVisible(c),
    );

  const visibleGroupChildren = (g: RenderGroup) =>
    g.children.filter((c) =>
      c.kind === "field" ? isFieldVisible(c.field, values) : subGroupHasVisible(c),
    );

  const visibleTopItems = (items: RenderItem[]) =>
    items.filter((it) =>
      it.kind === "field" ? isFieldVisible(it.field, values) : groupHasVisible(it),
    );

  /** Render an array of items (fields/subgroups/groups) as width-packed rows. */
  function renderPacked<T>(
    items: T[],
    getWidth: (it: T) => number | undefined,
    renderOne: (it: T) => React.ReactNode,
    keyOf: (it: T) => string,
  ) {
    if (layout === "vertical") {
      return (
        <div className="flex flex-col gap-4">
          {items.map((it) => (
            <div key={keyOf(it)}>{renderOne(it)}</div>
          ))}
        </div>
      );
    }
    const rows = packByWidth(items, (it) => {
      const w = getWidth(it);
      if (w === 25 || w === 33 || w === 40 || w === 50 || w === 60 || w === 100) return w;
      return undefined;
    });
    return (
      <div className="flex flex-col gap-5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-wrap gap-x-6 gap-y-5">
            {row.map(({ item, width }) => (
              <div
                key={keyOf(item)}
                style={{ flexBasis: `calc(${width}% - 1.5rem)`, maxWidth: `calc(${width}% - 1.5rem)` }}
                className="min-w-0 flex-grow-0 flex-shrink-0"
              >
                {renderOne(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function collectFieldsForSubStep(group: RenderGroup, subId: string): FormField[] {
    if (subId === GROUP_LEVEL_SUB) {
      return group.children
        .filter((c): c is RenderGroupChild => c.kind === "field")
        .map((c) => c.field);
    }
    const sg = group.children.find(
      (c): c is RenderSubGroup => c.kind === "subgroup" && c.id === subId,
    );
    return sg?.fields ?? [];
  }

  /** Soft-warn missing required (visible) fields in current sub-step. */
  const collectMissingInCurrentStep = (): string[] => {
    if (!activeGroup || !activeSubId) return [];
    const fields = collectFieldsForSubStep(activeGroup, activeSubId);
    const missing: string[] = [];
    for (const f of fields) {
      if (!isFieldVisible(f, values)) continue;
      if (!f.required) continue;
      const v = values[f.id];
      const empty =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (empty) missing.push(f.label || f.internalName);
    }
    return missing;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId) {
      console.log("Form submitted (local only)", values);
      setValues({});
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    try {
      await submitForm(formId, values);
      setValues({});
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("Hiba történt a beküldés során. Próbáld újra.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const text = thankYouText?.trim() || "Köszönjük! A foglalást rögzítettük.";
    return (
      <div className="py-20 md:py-28 text-center">
        <h2 className="text-2xl md:text-4xl font-semibold text-foreground whitespace-pre-line">
          {text}
        </h2>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Az űrlap üres.
      </div>
    );
  }

  // ---- Non-stepped (legacy) rendering: only used when no groups are placed ----
  const renderTopItem = (item: RenderItem) => {
    if (item.kind === "field") return renderField(item.field);
    return renderGroup(item);
  };
  const topWidth = (item: RenderItem) =>
    item.kind === "field" ? item.field.width : (item as RenderGroup).width;

  function renderGroup(group: RenderGroup) {
    const children = visibleGroupChildren(group);
    const renderChild = (child: RenderSubGroup | RenderGroupChild) => {
      if (child.kind === "field") return renderField(child.field);
      return renderSubGroup(child);
    };
    const childWidth = (child: RenderSubGroup | RenderGroupChild) =>
      child.kind === "field" ? child.field.width : child.width;
    return (
      <section key={group.id} className="space-y-4">
        {renderPacked(
          children,
          childWidth,
          renderChild,
          (c) => (c.kind === "field" ? c.field.id : c.id),
        )}
      </section>
    );
  }
  function renderSubGroup(sg: RenderSubGroup) {
    const fields = visibleFields(sg.fields);
    return (
      <div className="rounded-xl border border-border/70 bg-secondary/40 p-4 md:p-5 space-y-4 h-full">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {sg.label}
        </h4>
        {renderPacked(
          fields,
          (f) => f.width,
          (f) => renderField(f),
          (f) => f.id,
        )}
      </div>
    );
  }

  // ---- Stepped-mode active sub-step body ----
  function renderActiveSubStep() {
    if (!activeGroup || !activeSubId) return null;
    const fields = visibleFields(collectFieldsForSubStep(activeGroup, activeSubId));
    return (
      <div className="space-y-5">
        {renderPacked(
          fields,
          (f) => f.width,
          (f) => renderField(f),
          (f) => f.id,
        )}
      </div>
    );
  }

  const isLastGroup = activeGroupIdx === groupSteps.length - 1;
  const subInfo = activeGroup ? subStepsByGroup[activeGroup.id] : null;
  const activeSubIdxInGroup =
    activeGroup && activeSubId && subInfo ? subInfo.ids.indexOf(activeSubId) : -1;
  const isLastSubInGroup = subInfo
    ? activeSubIdxInGroup === subInfo.ids.length - 1
    : true;
  const isFinalStep = isStepped && isLastGroup && isLastSubInGroup;

  const goNext = () => {
    if (!isStepped || !activeGroup || !subInfo) return;
    const missing = collectMissingInCurrentStep();
    if (missing.length > 0) {
      toast.warning(
        `Hiányzó kötelező mezők: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`,
      );
    }
    if (!isLastSubInGroup) {
      const nextSubId = subInfo.ids[activeSubIdxInGroup + 1];
      setActiveSubByGroup((p) => ({ ...p, [activeGroup.id]: nextSubId }));
      setMaxSubIdxByGroup((p) => ({
        ...p,
        [activeGroup.id]: Math.max(p[activeGroup.id] ?? 0, activeSubIdxInGroup + 1),
      }));
      return;
    }
    if (!isLastGroup) {
      const nextIdx = activeGroupIdx + 1;
      setActiveGroupIdx(nextIdx);
      setMaxGroupIdx((m) => Math.max(m, nextIdx));
    }
  };

  const stepNavGroups: StepGroup[] = groupSteps.map((g) => ({
    id: g.id,
    label: g.label,
    subIds: subStepsByGroup[g.id]?.ids ?? [],
    subLabels: subStepsByGroup[g.id]?.labels ?? {},
  }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {isStepped && (
        <StepNavigator
          groups={stepNavGroups}
          activeGroupIndex={activeGroupIdx}
          activeSubId={activeSubId}
          maxGroupIndex={maxGroupIdx}
          maxSubIndexByGroup={maxSubIdxByGroup}
          onJumpGroup={(i) => {
            if (i > maxGroupIdx) return;
            setActiveGroupIdx(i);
          }}
          onJumpSub={(gi, sid) => {
            const g = groupSteps[gi];
            if (!g) return;
            const ids = subStepsByGroup[g.id]?.ids ?? [];
            const idx = ids.indexOf(sid);
            const cap = maxSubIdxByGroup[g.id] ?? 0;
            if (idx < 0 || idx > cap) return;
            setActiveGroupIdx(gi);
            setActiveSubByGroup((p) => ({ ...p, [g.id]: sid }));
          }}
        />
      )}

      {isStepped
        ? renderActiveSubStep()
        : renderPacked(
            visibleTopItems(tree),
            topWidth,
            renderTopItem,
            (it) => (it.kind === "field" ? it.field.id : it.id),
          )}

      <div className="flex justify-end pt-2 gap-2">
        {showDemoButton && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setValues(buildDemoValues(schema))}
          >
            Demo
          </Button>
        )}
        {isStepped && !isFinalStep ? (
          <Button
            type="button"
            size="lg"
            onClick={goNext}
            className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground kr-shadow-soft hover:kr-shadow-elevated transition-all"
          >
            Tovább <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground kr-shadow-soft hover:kr-shadow-elevated transition-all"
          >
            {submitting ? "Küldés…" : "Küldés"}
          </Button>
        )}
      </div>
    </form>
  );
}
