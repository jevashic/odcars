import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Loader2, MapPin } from "lucide-react";

const LANGS = ["es", "en", "de", "sv", "no", "fr"] as const;
const LANG_LABELS: Record<string, string> = { es: "Español", en: "English", de: "Deutsch", sv: "Svenska", no: "Norsk", fr: "Français" };

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_log").insert({ performed_by: userId, action, table_name: tableName, record_id: recordId, old_data: oldData as any, new_data: newData as any });
}

interface TransRow { id: string; key: string; section: string | null; lang: string; value: string | null; }
interface Branch { id: string; name: string; address: string | null; is_active: boolean; }

export default function SearchConfig() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ key: string; values: Record<string, string> } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery<TransRow[]>({
    queryKey: ["admin-translations-search"],
    queryFn: async () => {
      const { data, error } = await supabase.from("translations").select("*").eq("section", "search").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery<Branch[]>({
    queryKey: ["admin-active-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name, address, is_active").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group by key
  const grouped: Record<string, { key: string; langs: Record<string, string> }> = {};
  for (const r of rows) {
    if (!grouped[r.key]) grouped[r.key] = { key: r.key, langs: {} };
    grouped[r.key].langs[r.lang] = r.value ?? "";
  }
  const entries = Object.values(grouped);

  const openEdit = (entry: typeof entries[0]) => {
    const values: Record<string, string> = {};
    for (const l of LANGS) values[l] = entry.langs[l] ?? "";
    setEditing({ key: entry.key, values });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      for (const lang of LANGS) {
        const val = editing.values[lang]?.trim() || null;
        if (val !== null) {
          await supabase.from("translations").upsert(
            { key: editing.key, lang, value: val, section: "search" },
            { onConflict: "key,lang" }
          );
        }
      }
      if (user) await writeAudit(user.id, "update", "translations", editing.key, null, editing.values);
      toast({ title: "Traducciones guardadas" });
      qc.invalidateQueries({ queryKey: ["admin-translations-search"] });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Configuración del buscador</h1>
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Configuración del buscador</h1>

      {/* Translations table */}
      <div className="bg-background rounded-xl shadow-sm border mb-8">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Textos del buscador</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay traducciones con sección "search".</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clave</TableHead>
                  <TableHead>Español</TableHead>
                  <TableHead>Inglés</TableHead>
                  <TableHead>Alemán</TableHead>
                  <TableHead>SV</TableHead>
                  <TableHead>NO</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.key}>
                    <TableCell className="font-mono text-xs">{e.key}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{e.langs.es ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{e.langs.en ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{e.langs.de ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{e.langs.sv ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{e.langs.no ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{e.langs.fr ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Active branches */}
      <div className="bg-background rounded-xl shadow-sm border">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-2">Ubicaciones disponibles</h2>
          <p className="text-sm text-muted-foreground mb-4">Oficinas activas que aparecen en el desplegable del buscador de la web.</p>
          {loadingBranches ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : branches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay oficinas activas.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((b) => (
                <div key={b.id} className="flex items-start gap-3 rounded-lg border p-4">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{b.name}</p>
                    {b.address && <p className="text-xs text-muted-foreground">{b.address}</p>}
                    <Badge className="mt-1">Activa</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar traducción</DialogTitle>
            <DialogDescription>Clave: <span className="font-mono">{editing?.key}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {LANGS.map((lang) => (
              <div key={lang} className="space-y-1.5">
                <Label>{LANG_LABELS[lang]}</Label>
                <Textarea
                  rows={2}
                  value={editing?.values[lang] ?? ""}
                  onChange={(e) => {
                    if (!editing) return;
                    setEditing({ ...editing, values: { ...editing.values, [lang]: e.target.value } });
                  }}
                />
              </div>
            ))}
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
