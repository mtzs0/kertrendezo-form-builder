import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { FormView } from "./FormView";
import type { FormSchema } from "./types";

interface Props {
  schema: FormSchema;
  onExit: () => void;
}

/**
 * Placeholder editor shell — Foundation pass.
 * Real drag-and-drop "Form" tab, "Field" editor, and "Condition editor"
 * will land in the next iteration.
 */
export function EditorPlaceholder({ schema, onExit }: Props) {
  return (
    <main className="min-h-screen kr-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Kilépés
            </Button>
            <h1 className="text-xl md:text-2xl font-semibold">Szerkesztő nézet</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Alap váz – a teljes szerkesztő következő körben
          </span>
        </div>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList>
            <TabsTrigger value="preview">Előnézet</TabsTrigger>
            <TabsTrigger value="form">Űrlap</TabsTrigger>
            <TabsTrigger value="field">Mező</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
              <FormView schema={schema} layout="horizontal" />
            </div>
          </TabsContent>

          <TabsContent value="form" className="mt-4">
            <div className="rounded-2xl bg-card border border-border p-8 text-center text-muted-foreground">
              Az űrlap-szerkesztő (drag &amp; drop a csoportok, al-csoportok és mezők
              elrendezéséhez) a következő iterációban érkezik.
            </div>
          </TabsContent>

          <TabsContent value="field" className="mt-4">
            <div className="rounded-2xl bg-card border border-border p-8 text-center text-muted-foreground">
              A mező-szerkesztő és a feltétel-szerkesztő a következő iterációban
              érkezik.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
