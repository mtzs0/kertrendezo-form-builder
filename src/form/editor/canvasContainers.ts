// Pure helpers for resolving which canvas frame (group / sub-group) a
// field-box belongs to based on geometry.

import type { FormGroup, FormSubGroup } from "@/form/types";
import { frameKey, type FramesMap, type FrameRect } from "./groupFramesStore";

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ContainerResult {
  groupId?: string;
  subGroupId?: string;
}

const center = (r: BoxRect) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2 });

const contains = (frame: FrameRect, cx: number, cy: number) =>
  cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h;

const area = (f: FrameRect) => f.w * f.h;

/**
 * Returns the deepest container the given box's center sits inside.
 * - If a sub-group frame contains it → returns { groupId: parent, subGroupId }.
 * - Otherwise if a group frame contains it → returns { groupId }.
 * - Otherwise → empty (top-level).
 *
 * When several frames overlap, the smallest (deepest) wins.
 */
export function resolveContainerFor(
  box: BoxRect,
  frames: FramesMap,
  groups: FormGroup[],
  subGroups: FormSubGroup[]
): ContainerResult {
  const { cx, cy } = center(box);

  // Sub-groups first (deepest).
  let bestSub: { sg: FormSubGroup; frame: FrameRect } | null = null;
  for (const sg of subGroups) {
    const f = frames[frameKey("subgroup", sg.id)];
    if (!f) continue;
    if (!contains(f, cx, cy)) continue;
    if (!bestSub || area(f) < area(bestSub.frame)) bestSub = { sg, frame: f };
  }
  if (bestSub) {
    return { groupId: bestSub.sg.groupId, subGroupId: bestSub.sg.id };
  }

  // Then groups.
  let bestG: { g: FormGroup; frame: FrameRect } | null = null;
  for (const g of groups) {
    const f = frames[frameKey("group", g.id)];
    if (!f) continue;
    if (!contains(f, cx, cy)) continue;
    if (!bestG || area(f) < area(bestG.frame)) bestG = { g, frame: f };
  }
  if (bestG) return { groupId: bestG.g.id };

  return {};
}

/** Bounding rect of a list of boxes, padded. Returns null if list is empty. */
export function boundingRect(
  boxes: BoxRect[],
  padding = 24
): FrameRect | null {
  if (boxes.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return {
    x: minX - padding,
    y: minY - padding - 28, // extra room for title bar
    w: maxX - minX + padding * 2,
    h: maxY - minY + padding * 2 + 28,
  };
}
