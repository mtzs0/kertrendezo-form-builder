import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ImageUploader } from "./ImageUploader";
import { loadVisualBackgroundLibrary } from "../editorApi";
import { cn } from "@/lib/utils";
import type { VisualBackground } from "../types";

interface Props {
  /** Stable id used for image upload paths. */
  storageId: string;
  /** Sub-key for upload filenames. */
  storageKey: string;
  /** Form id used to scope the reusable image library. */
  formId: string | null | undefined;
  value: VisualBackground | undefined;
  onChange: (next: VisualBackground | undefined) => void;
  /** Optional title shown above the block. Default: "Vizuális háttér". */
  title?: string;
  description?: string;
}

const DEFAULTS: Required<Pick<VisualBackground, "overlayColor" | "overlayOpacity">> = {
  overlayColor: "#000000",
  overlayOpacity: 0.5,
};

export function VisualBackgroundConfig({
  storageId,
  storageKey,
  formId,
  value,
  onChange,
  title = "Vizuális háttér",
  description = "Feltöltött kép és színes átfedés a kiválasztott állapot megjelenítéséhez.",
}: Props) {
  const enabled = !!value?.enabled;
  const overlayColor = value?.overlayColor ?? DEFAULTS.overlayColor;
  const overlayOpacity = value?.overlayOpacity ?? DEFAULTS.overlayOpacity;

  const [library, setLibrary] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || !formId) return;
    let cancelled = false;
    loadVisualBackgroundLibrary(formId).then((urls) => {
      if (!cancelled) setLibrary(urls);
    });
    return () => {
      cancelled = true;
    };
    // re-fetch when image url changes (after upload)
  }, [enabled, formId, value?.imageUrl]);

  const update = (patch: Partial<VisualBackground>) => {
    onChange({
      enabled,
      imageUrl: value?.imageUrl,
      overlayColor,
      overlayOpacity,
      ...patch,
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className="cursor-pointer">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            if (v) {
              onChange({
                enabled: true,
                imageUrl: value?.imageUrl,
                overlayColor: value?.overlayColor ?? DEFAULTS.overlayColor,
                overlayOpacity:
                  value?.overlayOpacity ?? DEFAULTS.overlayOpacity,
              });
            } else {
              onChange({ ...(value ?? {}), enabled: false });
            }
          }}
        />
      </div>

      {enabled && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Háttérkép</Label>
            <ImageUploader
              fieldId={storageId}
              storageKey={`visual-bg-${storageKey}`}
              url={value?.imageUrl}
              onChange={(url) => update({ imageUrl: url ?? undefined })}
              size="md"
              label="Háttérkép"
            />
            {library.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Korábban használt képek
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {library.map((url) => {
                    const selected = value?.imageUrl === url;
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => update({ imageUrl: url })}
                        className={cn(
                          "h-12 w-12 rounded-md border overflow-hidden transition-all",
                          selected
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-primary/40"
                        )}
                        title="Használd ezt a képet"
                      >
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Átfedés színe
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={overlayColor}
                  onChange={(e) => update({ overlayColor: e.target.value })}
                  className="h-9 w-12 rounded border border-border bg-background cursor-pointer"
                />
                <Input
                  value={overlayColor}
                  onChange={(e) => update({ overlayColor: e.target.value })}
                  className="h-9 flex-1 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Átfedés átlátszatlansága ({Math.round(overlayOpacity * 100)}%)
              </Label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[overlayOpacity]}
                onValueChange={(vals) =>
                  update({ overlayOpacity: vals[0] ?? DEFAULTS.overlayOpacity })
                }
                className="py-2"
              />
            </div>
          </div>

          {value?.imageUrl && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Előnézet</Label>
              <div
                className="relative h-20 rounded-md overflow-hidden border border-border"
                style={{
                  backgroundImage: `url(${value.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: overlayColor,
                    opacity: overlayOpacity,
                  }}
                />
                <div className="relative z-10 h-full flex items-center justify-center text-white text-sm font-medium">
                  Példa szöveg
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
