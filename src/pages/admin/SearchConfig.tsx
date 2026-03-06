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
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Loader2, Plus, Trash2 } from "lucide-react";

const LANGS = ["es", "en", "de", "sv", "no", "fr"] as const;
const LANG_LABELS: Record<string, string> = { es: "Español", en: "English", de: "Deutsch", sv: "Svenska", no: "Norsk", fr: "Français" };

const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  office:  { label: "Oficina",    cls: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100" },
  airport: { label: "Aeropuerto", cls: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" },
  hotel:   { label: "Hotel",      cls: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100" },
  other:   { label: "Otro",       cls: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100" },
};

interface LocationForm {
  id?: string;
  name: string;
  type: string;
  description: string;
  extra_charge: number;
  sort_order: number;
  is_active: boolean;
}

const emptyLocForm: LocationForm = {
  name: "", type: "office", description: "", extra_charge: 0, sort_order: 0, is_active: true,
};

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_log").insert({ performed_by: userId, action, table_name: tableName, record_id: recordId, old_data: oldData as any, new_data: newData as any });
}

interface TransRow { id: string; key: string; section: string | null; lang: string; value: string | null; }

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

  const { data: pickupLocations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["admin-pickup-locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pickup_locations").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [locModalOpen, setLocModalOpen] = useState(false);
  const [locForm, setLocForm] = useState<LocationForm>(emptyLocForm);
  const [locSaving, setLocSaving] = useState(false);

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

      {/* Pickup locations CRUD */}
      <div className="bg-background rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Ubicaciones de recogida y devolución</h2>
              <p className="text-sm text-muted-foreground">Puntos disponibles en el buscador de la web pública.</p>
            </div>
            <Button onClick={() => { setLocForm(emptyLocForm); setLocModalOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva ubicación
            </Button>
          </div>
          {loadingLocations ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pickupLocations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay ubicaciones registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cargo extra €</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead className="text-right">Orden</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickupLocations.map((loc: any) => {
                  const t = TYPE_BADGES[loc.type] ?? TYPE_BADGES.other;
                  return (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell><Badge className={t.cls}>{t.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{loc.description || "—"}</TableCell>
                      <TableCell className="text-right">{Number(loc.extra_charge).toFixed(2)} €</TableCell>
                      <TableCell>{loc.is_active ? <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Sí</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                      <TableCell className="text-right">{loc.sort_order}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setLocForm({
                            id: loc.id, name: loc.name ?? "", type: loc.type ?? "office",
                            description: loc.description ?? "", extra_charge: loc.extra_charge ?? 0,
                            sort_order: loc.sort_order ?? 0, is_active: loc.is_active ?? true,
                          });
                          setLocModalOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          if (!user || !confirm(`¿Eliminar "${loc.name}"?`)) return;
                          try {
                            const { error } = await supabase.from("pickup_locations").delete().eq("id", loc.id);
                            if (error) throw error;
                            await writeAudit(user.id, "delete", "pickup_locations", loc.id, loc, null);
                            qc.invalidateQueries({ queryKey: ["admin-pickup-locations"] });
                            toast({ title: "Ubicación eliminada" });
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          }
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Location modal */}
      <Dialog open={locModalOpen} onOpenChange={setLocModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{locForm.id ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
            <DialogDescription>Punto de recogida o devolución del buscador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Aeropuerto de Gran Canaria" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={locForm.type} onValueChange={v => setLocForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Oficina</SelectItem>
                  <SelectItem value="airport">Aeropuerto</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={locForm.description} onChange={e => setLocForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo extra (€)</Label>
              <Input type="number" step="0.01" value={locForm.extra_charge} onChange={e => setLocForm(f => ({ ...f, extra_charge: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">0 = sin cargo adicional</p>
            </div>
            <div className="space-y-1.5">
              <Label>Orden</Label>
              <Input type="number" value={locForm.sort_order} onChange={e => setLocForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Activa</Label>
              <Switch checked={locForm.is_active} onCheckedChange={v => setLocForm(f => ({ ...f, is_active: v }))} />
            </div>
            <Button className="w-full font-bold" disabled={locSaving} onClick={async () => {
              if (!locForm.name.trim()) { toast({ title: "El nombre es obligatorio", variant: "destructive" }); return; }
              if (!user) return;
              setLocSaving(true);
              try {
                const payload: any = {
                  name: locForm.name.trim(), type: locForm.type, description: locForm.description.trim() || null,
                  extra_charge: locForm.extra_charge, sort_order: locForm.sort_order, is_active: locForm.is_active,
                };
                if (locForm.id) {
                  const old = pickupLocations.find((l: any) => l.id === locForm.id);
                  const { error } = await supabase.from("pickup_locations").update(payload).eq("id", locForm.id);
                  if (error) throw error;
                  await writeAudit(user.id, "update", "pickup_locations", locForm.id, old, payload);
                  toast({ title: "Ubicación actualizada" });
                } else {
                  const { data, error } = await supabase.from("pickup_locations").insert(payload).select("id").single();
                  if (error) throw error;
                  await writeAudit(user.id, "create", "pickup_locations", data.id, null, payload);
                  toast({ title: "Ubicación creada" });
                }
                qc.invalidateQueries({ queryKey: ["admin-pickup-locations"] });
                setLocModalOpen(false);
              } catch (err: any) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
              } finally { setLocSaving(false); }
            }}>
              {locSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
