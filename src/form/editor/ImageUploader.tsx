import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { uploadOptionImage } from "@/form/editorApi";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  fieldId: string;
  /** Sub-key used to disambiguate filenames (e.g. option dataName, "placeholder"). */
  storageKey: string;
  url: string | undefined;
  onChange: (url: string | null) => void;
  size?: "sm" | "md";
  label?: string;
}

/**
 * Square image uploader with preview. Uploads to the public
 * `form-option-images` bucket and returns the public URL.
 */
export function ImageUploader({
  fieldId,
  storageKey,
  url,
  onChange,
  size = "md",
  label = "Kép",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const publicUrl = await uploadOptionImage(file, { fieldId, key: storageKey });
      onChange(publicUrl);
    } catch (e) {
      console.error(e);
      toast.error("Kép feltöltése sikertelen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const dim = size === "sm" ? "h-16 w-16" : "h-24 w-24";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "shrink-0 rounded-lg border border-dashed border-border bg-secondary/40 overflow-hidden flex items-center justify-center text-muted-foreground hover:border-primary/40 transition-colors",
          dim
        )}
        aria-label={`${label} feltöltés`}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5" />
        )}
      </button>
      <div className="flex flex-col gap-1.5 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {url ? "Csere" : `${label} feltöltése`}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 justify-start px-2"
            onClick={() => onChange(null)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Eltávolítás
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
