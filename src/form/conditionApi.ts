// Persistence helpers for per-field display conditions.
//
// Conditions are stored in the `form_field_conditions` table:
//   field_id  uuid (unique)
//   combinator text ('and' | 'or')
//   rules     jsonb (the raw rules array — leaf conditions reference field
//             ids directly so renames / label changes never break them)
//
// We store ONE row per field with a condition; absence of a row = no
// condition. Saving an empty/undefined condition deletes the row.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ConditionGroup, FieldCondition } from "./types";

type Json = Database["public"]["Tables"]["form_field_conditions"]["Insert"]["rules"];

interface ConditionRow {
  field_id: string;
  combinator: string;
  rules: unknown;
}

/** Load all conditions for fields belonging to the given form. */
export async function loadConditions(
  formId: string
): Promise<Map<string, ConditionGroup>> {
  const { data, error } = await supabase
    .from("form_field_conditions")
    .select("field_id, combinator, rules, form_fields!inner(form_id)")
    .eq("form_fields.form_id", formId);
  if (error) throw error;
  const map = new Map<string, ConditionGroup>();
  for (const r of (data ?? []) as unknown as ConditionRow[]) {
    map.set(r.field_id, {
      combinator: (r.combinator === "or" ? "or" : "and") as "and" | "or",
      rules: Array.isArray(r.rules)
        ? (r.rules as Array<FieldCondition | ConditionGroup>)
        : [],
    });
  }
  return map;
}

/** Upsert a condition for a single field, or delete it when undefined/empty. */
export async function saveFieldCondition(
  fieldId: string,
  group: ConditionGroup | undefined
): Promise<void> {
  if (!group || !group.rules.length) {
    const { error } = await supabase
      .from("form_field_conditions")
      .delete()
      .eq("field_id", fieldId);
    if (error) throw error;
    return;
  }
  const payload = {
    field_id: fieldId,
    combinator: group.combinator,
    rules: group.rules as unknown as Json,
  };
  // Try update first; if no row exists, insert.
  const { data: existing, error: selErr } = await supabase
    .from("form_field_conditions")
    .select("id")
    .eq("field_id", fieldId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    const { error } = await supabase
      .from("form_field_conditions")
      .update({ combinator: payload.combinator, rules: payload.rules })
      .eq("field_id", fieldId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("form_field_conditions")
      .insert(payload);
    if (error) throw error;
  }
}
