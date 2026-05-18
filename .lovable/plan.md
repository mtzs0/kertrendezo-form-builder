## Goal

Pre-emptively add explicit `GRANT` statements for every existing `public` table so that when Supabase enforces the new default on **October 30, 2026**, nothing in the app breaks. Also establish the grant pattern as the standard for all future migrations.

## What will be done

### 1. One-time "safety net" migration

A single SQL migration that, for each existing table in the `public` schema:

- Grants the appropriate Data API access to the three Supabase roles (`anon`, `authenticated`, `service_role`).
- Leaves existing RLS policies untouched — grants are the table-level gate; RLS still controls *which rows* each role can see.

Tables covered (all currently in `public`):

- `forms`
- `form_fields`
- `form_field_options`
- `form_field_conditions`
- `form_field_canvas_positions`
- `form_groups`
- `form_group_canvas_frames`
- `form_layouts`
- `form_submissions`

### 2. Per-table grant strategy

Grants mirror what the app already does today through RLS, so behavior is identical before and after:

| Table | anon | authenticated | service_role |
|---|---|---|---|
| `forms` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_fields` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_field_options` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_field_conditions` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_field_canvas_positions` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_groups` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_group_canvas_frames` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_layouts` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ALL |
| `form_submissions` | INSERT | INSERT | ALL |

Why anon gets broad access on the editor tables: the project currently has `TEMP anyone can …` RLS policies on every editor table (no auth implemented yet), so the anon role already needs those operations. When auth is added later, those temp policies — not the grants — are what should be tightened.

`form_submissions` is the only locked-down table today (anon can insert into published forms, can't read), so its grants stay minimal.

### 3. Convention for future migrations

From now on, every new `public` table I create will include in the same migration:

```sql
grant select, insert, update, delete on public.<new_table> to anon, authenticated;
grant all on public.<new_table> to service_role;
alter table public.<new_table> enable row level security;
-- + RLS policies
```

This way the project stays compatible whether or not the Oct 30, 2026 enforcement sweep touches existing projects.

## Out of scope

- **No RLS policy changes.** Existing access rules are preserved exactly.
- **No code changes.** `supabase-js` calls in `src/form/*` keep working identically.
- **No auth rollout.** Tightening the `TEMP anyone can …` policies is a separate future task (recommended once auth is added), not part of this safety net.

## Risk

Very low. `GRANT` is additive on tables that already have those grants implicitly — re-granting is a no-op. RLS continues to be the real access gate.
