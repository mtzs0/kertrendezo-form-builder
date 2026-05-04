import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface StepGroup {
  id: string;
  label: string;
  /** Sub-step ids belonging to this group, in order. May be empty. */
  subIds: string[];
  subLabels: Record<string, string>;
}

interface Props {
  groups: StepGroup[];
  /** Index of the active top-level group. */
  activeGroupIndex: number;
  /** Active sub-group id within the active group, or null when group has no sub-groups (or "group-level" pseudo step). */
  activeSubId: string | null;
  /** Highest group index the user has unlocked (reached). */
  maxGroupIndex: number;
  /** Per-group: highest sub-group index unlocked so far. */
  maxSubIndexByGroup: Record<string, number>;
  onJumpGroup: (index: number) => void;
  onJumpSub: (groupIndex: number, subId: string) => void;
}

/**
 * Two-tier sticky step navigator inspired by curved tabbed wizards.
 * - Row 1: top-level groups as pill tabs. Active one is filled with primary.
 * - Row 2: sub-group pills for the active group. Locked entries can't be
 *   clicked (forward navigation is gated until the user advances).
 */
export function StepNavigator({
  groups,
  activeGroupIndex,
  activeSubId,
  maxGroupIndex,
  maxSubIndexByGroup,
  onJumpGroup,
  onJumpSub,
}: Props) {
  if (groups.length === 0) return null;
  const activeGroup = groups[activeGroupIndex];
  const subs = activeGroup?.subIds ?? [];
  const maxSubIdx = maxSubIndexByGroup[activeGroup?.id] ?? 0;

  return (
    <div className="sticky top-0 z-30 -mx-5 md:-mx-8 -mt-5 md:-mt-8 mb-2">
      <div className="bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border rounded-t-2xl overflow-hidden">
        {/* Row 1: top-level groups */}
        <div className="flex items-stretch gap-1 px-3 md:px-4 pt-3 overflow-x-auto">
          {groups.map((g, i) => {
            const isActive = i === activeGroupIndex;
            const isUnlocked = i <= maxGroupIndex;
            const isDone = i < maxGroupIndex;
            return (
              <button
                key={g.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => isUnlocked && onJumpGroup(i)}
                className={cn(
                  "relative flex items-center gap-2 px-4 md:px-5 py-3 text-sm md:text-[0.95rem] font-medium whitespace-nowrap rounded-t-xl transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isUnlocked
                      ? "text-foreground/80 hover:bg-secondary/80 cursor-pointer"
                      : "text-muted-foreground/60 cursor-not-allowed",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="max-w-[12rem] truncate">{g.label}</span>
                {!isUnlocked && <Lock className="h-3 w-3 opacity-60" aria-hidden />}
              </button>
            );
          })}
        </div>

        {/* Curved separator + Row 2: sub-groups */}
        {subs.length > 0 && (
          <div className="relative">
            {/* curved primary band */}
            <div
              className="h-14 md:h-16 bg-primary"
              style={{
                clipPath:
                  "path('M0,0 L100%,0 L100%,100% Q70%,40% 35%,75% Q15%,90% 0,55% Z')",
              }}
              aria-hidden
            />
            <div className="absolute inset-0 flex items-end px-3 md:px-6 pb-3 gap-2 overflow-x-auto">
              {subs.map((subId, idx) => {
                const isActive = subId === activeSubId;
                const isUnlocked = idx <= maxSubIdx;
                const label = activeGroup.subLabels[subId] ?? "—";
                return (
                  <button
                    key={subId}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() =>
                      isUnlocked && onJumpSub(activeGroupIndex, subId)
                    }
                    className={cn(
                      "px-4 md:px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                      isActive
                        ? "bg-card text-primary border-transparent shadow-md"
                        : isUnlocked
                          ? "bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10"
                          : "bg-transparent text-primary-foreground/50 border-dashed border-primary-foreground/30 cursor-not-allowed",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
