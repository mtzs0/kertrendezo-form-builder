// Visual condition canvas (demo).
//
// A freeform canvas where the user can:
//   - Drag fields from a left palette onto the canvas as boxes.
//   - Draw connector lines from a source field's BOTTOM handle into a
//     target field's TOP handle.
//   - Configure each line's operator + value (filtered by source type).
//   - Toggle the AND/OR combinator on the target box (applies to all
//     incoming lines on that target).
//
// Persistence:
//   - Conditions: saved through the existing `setFieldCondition(fieldId,
//     ConditionGroup)` API. Each target's incoming lines become a flat
//     ConditionGroup with rules referencing the source field ids.
//   - Box positions: localStorage, keyed by form id. Demo-only.
//
// Limitations (demo): nested condition groups are not supported in the
// canvas. If a field already has a nested condition, it's rendered
// read-only with a hint to edit it on the Mező tab.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  X,
  Plus,
  MousePointer2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ConditionGroup,
  FieldCondition,
  FormField,
} from "@/form/types";
import {
  OPERATOR_LABELS,
  ValueInput,
  operatorsForField,
} from "./conditionInputs";

interface Props {
  fields: FormField[];
  formId: string | null | undefined;
  onSetCondition: (
    fieldId: string,
    condition: ConditionGroup | undefined
  ) => Promise<void> | void;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  fieldConfigPanel: React.ReactNode;
}

interface BoxPos {
  x: number;
  y: number;
}

const BOX_W = 220;
const BOX_H = 88;

interface Edge {
  /** target field id (the field whose visibility is conditional) */
  targetId: string;
  /** index within the target's flattened condition rules */
  ruleIndex: number;
  /** source field id (referenced by the rule) */
  sourceId: string;
  rule: FieldCondition;
}

/** Returns true if the group is "flat" — every rule is a leaf condition. */
function isFlatGroup(g: ConditionGroup | undefined): boolean {
  if (!g) return true;
  return g.rules.every((r) => !("combinator" in r));
}

function lsKey(formId: string | null | undefined) {
  return `condition-canvas-positions:${formId ?? "default"}`;
}

function loadPositions(formId: string | null | undefined): Record<string, BoxPos> {
  try {
    const raw = localStorage.getItem(lsKey(formId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function savePositions(
  formId: string | null | undefined,
  positions: Record<string, BoxPos>
) {
  try {
    localStorage.setItem(lsKey(formId), JSON.stringify(positions));
  } catch {
    // ignore quota / serialization errors
  }
}

export function ConditionCanvas({
  fields,
  formId,
  onSetCondition,
  selectedFieldId,
  onSelectField,
  fieldConfigPanel,
}: Props) {
  const fieldById = useMemo(() => {
    const m = new Map<string, FormField>();
    for (const f of fields) m.set(f.id, f);
    return m;
  }, [fields]);

  // Box positions — which fields are "on the canvas".
  const [positions, setPositions] = useState<Record<string, BoxPos>>(() =>
    loadPositions(formId)
  );

  // Re-load positions whenever the form changes.
  useEffect(() => {
    setPositions(loadPositions(formId));
  }, [formId]);

  // Auto-place any field that already has a condition (so the user sees
  // existing conditions when first opening the tab).
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      let changed = false;
      const placedCount = Object.keys(next).length;
      let nextIndex = placedCount;
      const placeAt = (i: number): BoxPos => {
        const cols = 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { x: 80 + col * (BOX_W + 80), y: 80 + row * (BOX_H + 80) };
      };
      for (const f of fields) {
        if (next[f.id]) continue;
        if (f.condition && f.condition.rules.length > 0) {
          next[f.id] = placeAt(nextIndex++);
          changed = true;
          // Also place referenced source fields if missing.
          for (const r of f.condition.rules) {
            if ("combinator" in r) continue;
            if (!next[r.fieldId] && fieldById.has(r.fieldId)) {
              next[r.fieldId] = placeAt(nextIndex++);
            }
          }
        }
      }
      if (!changed) return prev;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Persist positions whenever they change.
  useEffect(() => {
    savePositions(formId, positions);
  }, [formId, positions]);

  const placedFieldIds = useMemo(
    () => Object.keys(positions).filter((id) => fieldById.has(id)),
    [positions, fieldById]
  );

  const paletteFields = useMemo(
    () => fields.filter((f) => !positions[f.id]),
    [fields, positions]
  );

  // Build edges from current condition data.
  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const targetId of placedFieldIds) {
      const f = fieldById.get(targetId);
      if (!f?.condition || !isFlatGroup(f.condition)) continue;
      f.condition.rules.forEach((r, i) => {
        if ("combinator" in r) return;
        if (!positions[r.fieldId]) return;
        out.push({ targetId, ruleIndex: i, sourceId: r.fieldId, rule: r });
      });
    }
    return out;
  }, [placedFieldIds, fieldById, positions]);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ------- Zoom (ctrl+wheel) + Pan -------
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Convert a clientX/Y into world (canvas) coordinates.
  const toWorld = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const z = zoomRef.current;
    const p = panRef.current;
    return {
      x: (clientX - r.left - p.x) / z,
      y: (clientY - r.top - p.y) / z,
    };
  };

  // Native wheel handler so we can call preventDefault (React's onWheel is passive).
  // ctrl/meta+wheel = zoom (focused on cursor). Plain wheel = pan vertically;
  // shift+wheel = pan horizontally.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const oldZoom = zoomRef.current;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.25, Math.min(2.5, oldZoom * factor));
        if (newZoom === oldZoom) return;
        // Zoom anchored at the cursor: keep world point under cursor stable.
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const p = panRef.current;
        const wx = (cx - p.x) / oldZoom;
        const wy = (cy - p.y) / oldZoom;
        setZoom(newZoom);
        setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      } else {
        e.preventDefault();
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ------- Pan via dragging empty canvas -------
  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only pan when clicking on the empty background (not a box / handle / svg path).
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { ...panRef.current };
    const move = (ev: PointerEvent) => {
      setPan({
        x: startPan.x + (ev.clientX - startX),
        y: startPan.y + (ev.clientY - startY),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    onSelectField(null);
    setSelectedEdge(null);
  };

  // ------- Drag-from-palette / drag-existing-box -------
  const onPaletteDragStart = (e: React.DragEvent, fieldId: string) => {
    e.dataTransfer.setData("application/x-field-id", fieldId);
    e.dataTransfer.effectAllowed = "copy";
  };

  const onCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fieldId = e.dataTransfer.getData("application/x-field-id");
    if (!fieldId || !fieldById.has(fieldId)) return;
    const w = toWorld(e.clientX, e.clientY);
    setPositions((prev) => ({
      ...prev,
      [fieldId]: { x: w.x - BOX_W / 2, y: w.y - BOX_H / 2 },
    }));
  };

  // ------- Drag existing boxes around -------
  const onBoxPointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    fieldId: string
  ) => {
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.preventDefault();
    const pos = positions[fieldId];
    if (!pos) return;
    const start = toWorld(e.clientX, e.clientY);
    const offsetX = start.x - pos.x;
    const offsetY = start.y - pos.y;
    let moved = false;

    const move = (ev: PointerEvent) => {
      moved = true;
      const w = toWorld(ev.clientX, ev.clientY);
      setPositions((prev) => ({
        ...prev,
        [fieldId]: { x: w.x - offsetX, y: w.y - offsetY },
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) {
        // Treat as click → select field for the right-side panel.
        onSelectField(fieldId);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ------- Drawing a new connector -------
  const [drawing, setDrawing] = useState<{
    sourceId: string;
    cursor: { x: number; y: number };
  } | null>(null);

  const onSourceHandlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    sourceId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const updateCursor = (ev: PointerEvent) => {
      setDrawing({ sourceId, cursor: toWorld(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", updateCursor);
      window.removeEventListener("pointerup", up);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const targetEl = el?.closest("[data-target-id]") as HTMLElement | null;
      const targetId = targetEl?.dataset.targetId;
      setDrawing(null);
      if (!targetId || targetId === sourceId) return;
      addConditionEdge(targetId, sourceId);
    };
    setDrawing({ sourceId, cursor: toWorld(e.clientX, e.clientY) });
    window.addEventListener("pointermove", updateCursor);
    window.addEventListener("pointerup", up);
  };

  // ------- Condition mutation helpers -------
  const addConditionEdge = useCallback(
    (targetId: string, sourceId: string) => {
      const target = fieldById.get(targetId);
      if (!target) return;
      const source = fieldById.get(sourceId);
      if (!source) return;
      const existing = target.condition;
      if (existing && !isFlatGroup(existing)) return; // safety
      const ops = operatorsForField(source);
      const newRule: FieldCondition = {
        fieldId: sourceId,
        operator: ops[0] ?? "equals",
        value: "",
      };
      const next: ConditionGroup = existing
        ? { ...existing, rules: [...existing.rules, newRule] }
        : { combinator: "and", rules: [newRule] };
      void onSetCondition(targetId, next);
    },
    [fieldById, onSetCondition]
  );

  const updateRule = useCallback(
    (
      targetId: string,
      ruleIndex: number,
      patch: Partial<FieldCondition>
    ) => {
      const target = fieldById.get(targetId);
      const cond = target?.condition;
      if (!cond || !isFlatGroup(cond)) return;
      const rules = cond.rules.slice();
      const current = rules[ruleIndex];
      if (!current || "combinator" in current) return;
      rules[ruleIndex] = { ...current, ...patch };
      void onSetCondition(targetId, { ...cond, rules });
    },
    [fieldById, onSetCondition]
  );

  const removeRule = useCallback(
    (targetId: string, ruleIndex: number) => {
      const target = fieldById.get(targetId);
      const cond = target?.condition;
      if (!cond || !isFlatGroup(cond)) return;
      const rules = cond.rules.slice();
      rules.splice(ruleIndex, 1);
      if (rules.length === 0) {
        void onSetCondition(targetId, undefined);
      } else {
        void onSetCondition(targetId, { ...cond, rules });
      }
    },
    [fieldById, onSetCondition]
  );

  const toggleCombinator = useCallback(
    (targetId: string) => {
      const target = fieldById.get(targetId);
      const cond = target?.condition;
      if (!cond || cond.rules.length < 2) return;
      void onSetCondition(targetId, {
        ...cond,
        combinator: cond.combinator === "and" ? "or" : "and",
      });
    },
    [fieldById, onSetCondition]
  );

  // ------- Remove a box from the canvas -------
  const removeBox = (fieldId: string) => {
    setPositions((prev) => {
      const { [fieldId]: _, ...rest } = prev;
      return rest;
    });
    // We don't touch the field's condition — the user may want to keep it.
  };

  // ------- Selected edge (for the bottom inspector) -------
  const [selectedEdge, setSelectedEdge] = useState<
    { targetId: string; ruleIndex: number } | null
  >(null);

  // Clear selection if the edge no longer exists.
  useEffect(() => {
    if (!selectedEdge) return;
    const found = edges.find(
      (e) =>
        e.targetId === selectedEdge.targetId &&
        e.ruleIndex === selectedEdge.ruleIndex
    );
    if (!found) setSelectedEdge(null);
  }, [edges, selectedEdge]);

  const selectedEdgeData = selectedEdge
    ? edges.find(
        (e) =>
          e.targetId === selectedEdge.targetId &&
          e.ruleIndex === selectedEdge.ruleIndex
      )
    : null;

  // ------- Handle anchor coordinates -------
  const topAnchor = (id: string) => {
    const p = positions[id];
    return p ? { x: p.x + BOX_W / 2, y: p.y } : null;
  };
  const bottomAnchor = (id: string) => {
    const p = positions[id];
    return p ? { x: p.x + BOX_W / 2, y: p.y + BOX_H } : null;
  };

  // Bezier path between two points (vertical S-curve).
  const pathBetween = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => {
    const dy = Math.max(40, Math.abs(b.y - a.y) / 2);
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_360px] gap-4">
      {/* Palette */}
      <aside className="rounded-2xl border border-border bg-card kr-shadow-soft p-3 self-start max-h-[calc(100vh-12rem)] overflow-auto">
        <div className="px-1 pb-2">
          <h3 className="text-sm font-semibold">Mezők</h3>
          <p className="text-[11px] text-muted-foreground">
            Húzd a vászonra a kívánt mezőket, majd kösd össze őket.
          </p>
        </div>
        <div className="space-y-1.5">
          {paletteFields.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1 py-2">
              Minden mező a vásznon van.
            </p>
          )}
          {paletteFields.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => onPaletteDragStart(e, f.id)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing hover:border-primary hover:bg-accent transition-colors"
              title={`${f.label || f.internalName} (${f.type})`}
            >
              <div className="font-medium truncate">
                {f.label || f.internalName}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {f.internalName} · {f.type}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Canvas */}
      <div className="space-y-3 min-w-0">
        {/* Selected edge inspector — always rendered to avoid layout shift */}
        <div>
          {selectedEdgeData ? (
            <EdgeInspector
              targetField={fieldById.get(selectedEdgeData.targetId)!}
              sourceField={fieldById.get(selectedEdgeData.sourceId)!}
              rule={selectedEdgeData.rule}
              onChange={(patch) =>
                updateRule(
                  selectedEdgeData.targetId,
                  selectedEdgeData.ruleIndex,
                  patch
                )
              }
              onRemove={() =>
                removeRule(selectedEdgeData.targetId, selectedEdgeData.ruleIndex)
              }
              onClose={() => setSelectedEdge(null)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-xs text-muted-foreground flex items-center justify-center min-h-[124px]">
              Válassz egy összekötő vonalat a vásznon a feltétel szerkesztéséhez.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Húzd a forrásmező alsó pontjából a célmező felső pontjába a feltétel létrehozásához. Ctrl + görgő a nagyításhoz.
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.25, z * 0.9))}
              className="text-xs h-7 w-7 p-0"
              title="Kicsinyítés"
            >
              −
            </Button>
            <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.min(2.5, z * 1.1))}
              className="text-xs h-7 w-7 p-0"
              title="Nagyítás"
            >
              +
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoom(1)}
              className="text-xs h-7"
              title="Visszaállítás"
            >
              100%
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  placedFieldIds.length > 0 &&
                  window.confirm("Biztosan eltávolítod az összes mezőt a vászonról? A feltételek megmaradnak.")
                ) {
                  setPositions({});
                  setSelectedEdge(null);
                }
              }}
              className="text-xs"
            >
              Vászon ürítése
            </Button>
          </div>
        </div>

        <div
          ref={canvasRef}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
          onPointerDown={onCanvasPointerDown}
          className="relative rounded-2xl border border-border bg-muted/20 overflow-hidden kr-shadow-soft w-full cursor-grab active:cursor-grabbing"
          style={{
            height: "calc(100vh - 24rem)",
            backgroundImage:
              "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* World layer: panned + scaled. Children use world coords. */}
          <div
            className="absolute top-0 left-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: 1,
              height: 1,
            }}
          >
            {/* SVG overlay — large enough to fit any practical layout. */}
            <svg
              width={20000}
              height={20000}
              viewBox="-10000 -10000 20000 20000"
              style={{
                position: "absolute",
                left: -10000,
                top: -10000,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,10 L10,5 z" fill="hsl(var(--primary))" />
                </marker>
                <marker
                  id="arrowhead-muted"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,10 L10,5 z" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>

              {edges.map((edge) => {
                const a = bottomAnchor(edge.sourceId);
                const b = topAnchor(edge.targetId);
                if (!a || !b) return null;
                const isSel =
                  selectedEdge &&
                  selectedEdge.targetId === edge.targetId &&
                  selectedEdge.ruleIndex === edge.ruleIndex;
                return (
                  <g key={`${edge.targetId}-${edge.ruleIndex}`}>
                    {/* Wide invisible hit-line */}
                    <path
                      d={pathBetween(a, b)}
                      stroke="transparent"
                      strokeWidth={16}
                      fill="none"
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() =>
                        setSelectedEdge({
                          targetId: edge.targetId,
                          ruleIndex: edge.ruleIndex,
                        })
                      }
                    />
                    <path
                      d={pathBetween(a, b)}
                      stroke={
                        isSel
                          ? "hsl(var(--primary))"
                          : "hsl(var(--muted-foreground))"
                      }
                      strokeWidth={isSel ? 2.5 : 1.75}
                      fill="none"
                      markerEnd={
                        isSel ? "url(#arrowhead)" : "url(#arrowhead-muted)"
                      }
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                );
              })}

              {/* In-progress connector (while dragging) */}
              {drawing &&
                (() => {
                  const a = bottomAnchor(drawing.sourceId);
                  if (!a) return null;
                  return (
                    <path
                      d={pathBetween(a, drawing.cursor)}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fill="none"
                    />
                  );
                })()}
            </svg>

            {/* Boxes */}
            {placedFieldIds.map((id) => {
              const f = fieldById.get(id)!;
              const pos = positions[id];
              const cond = f.condition;
              const flat = isFlatGroup(cond);
              const incomingCount =
                cond && flat
                  ? cond.rules.filter((r) => !("combinator" in r)).length
                  : 0;
              const style: CSSProperties = {
                left: pos.x,
                top: pos.y,
                width: BOX_W,
                height: BOX_H,
              };
              return (
                <div
                  key={id}
                  data-target-id={id}
                  onPointerDown={(e) => onBoxPointerDown(e, id)}
                  className="absolute rounded-lg border border-border bg-card kr-shadow-soft select-none cursor-move group"
                  style={style}
                >
                  {/* Top handle (incoming) */}
                  <div
                    data-handle
                    className="absolute left-1/2 -top-2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-primary bg-background"
                    title="Bejövő feltételek"
                  />

                  {/* Body */}
                  <div className="px-3 py-2 h-full flex flex-col justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {f.label || f.internalName}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {f.internalName} · {f.type}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {incomingCount >= 2 ? (
                        <button
                          type="button"
                          data-no-drag
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCombinator(id);
                          }}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border transition-colors",
                            cond?.combinator === "and"
                              ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                              : "bg-accent border-border text-foreground hover:bg-accent/80"
                          )}
                          title="Kattints az ÉS / VAGY váltáshoz"
                        >
                          {cond?.combinator === "and" ? "ÉS" : "VAGY"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {incomingCount === 0
                            ? "nincs feltétel"
                            : "1 feltétel"}
                        </span>
                      )}
                      <button
                        type="button"
                        data-no-drag
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Mező eltávolítása a vászonról"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom handle (outgoing — drag from here) */}
                  <button
                    type="button"
                    data-handle
                    onPointerDown={(e) => onSourceHandlePointerDown(e, id)}
                    className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-primary bg-primary hover:scale-125 transition-transform cursor-crosshair"
                    title="Húzd egy másik mező felső pontjába"
                  />

                  {/* Non-flat condition warning */}
                  {cond && !flat && (
                    <div className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5">
                      komplex
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {placedFieldIds.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-sm text-muted-foreground">
                <MousePointer2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                Húzz ide mezőket a bal oldali listából.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Edge inspector ----------

interface EdgeInspectorProps {
  targetField: FormField;
  sourceField: FormField;
  rule: FieldCondition;
  onChange: (patch: Partial<FieldCondition>) => void;
  onRemove: () => void;
  onClose: () => void;
}

function EdgeInspector({
  targetField,
  sourceField,
  rule,
  onChange,
  onRemove,
  onClose,
}: EdgeInspectorProps) {
  const operators = operatorsForField(sourceField);
  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Kiválasztott feltétel
          </p>
          <p className="text-sm font-semibold truncate">
            <span className="text-muted-foreground">
              {targetField.label || targetField.internalName}
            </span>{" "}
            ← {sourceField.label || sourceField.internalName}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 px-2"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Feltétel típusa
          </Label>
          <Select
            value={rule.operator}
            onValueChange={(v) =>
              onChange({ operator: v as FieldCondition["operator"] })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Érték
          </Label>
          <ValueInput
            field={sourceField}
            value={rule.value}
            onChange={(v) => onChange({ value: v })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label="Feltétel törlése"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
