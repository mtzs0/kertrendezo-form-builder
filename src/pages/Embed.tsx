import { useEffect, useRef } from "react";
import { FormView } from "@/form/FormView";
import { useIsMobile } from "@/form/hooks";
import { usePublishedForm } from "@/form/usePublishedForm";

/**
 * Stripped-chrome version of the form for iframe embedding.
 * - Transparent background (host page shows through)
 * - No title/description header, no editor hint
 * - Posts document height to the parent on resize/mutation so the parent
 *   can size the <iframe> and avoid nested scrollbars.
 */
const Embed = () => {
  const isMobile = useIsMobile();
  const { schema, formId, form, loading } = usePublishedForm("default");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Make the page background white while mounted.
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "#ffffff";
    document.body.style.background = "#ffffff";
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);

  // Auto-resize: notify parent of height changes.
  useEffect(() => {
    const post = () => {
      const h = Math.ceil(
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          rootRef.current?.scrollHeight ?? 0,
        ),
      );
      window.parent?.postMessage({ type: "kr-form-height", height: h }, "*");
    };
    post();
    const ro = new ResizeObserver(() => post());
    if (rootRef.current) ro.observe(rootRef.current);
    ro.observe(document.body);
    const mo = new MutationObserver(() => post());
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener("resize", post);
    const interval = window.setInterval(post, 1000);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", post);
      window.clearInterval(interval);
    };
  }, [loading]);

  return (
    <main ref={rootRef} className="min-h-0 bg-transparent">
      <div className="w-full px-3 md:px-4 py-3 md:py-4">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Betöltés…</div>
        ) : (
          <FormView
            schema={schema}
            layout={isMobile ? "vertical" : "horizontal"}
            formId={formId}
            thankYouText={form?.thank_you_text ?? null}
          />
        )}
      </div>
    </main>
  );
};

export default Embed;
