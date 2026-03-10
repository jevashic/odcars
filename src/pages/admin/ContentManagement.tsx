import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Plus, Loader2, Star, Search, Upload, X } from "lucide-react";

const LANGS = ["es", "en", "de", "sv", "no", "fr"] as const;
const LANG_LABELS: Record<string, string> = { es: "Español", en: "English", de: "Deutsch", sv: "Svenska", no: "Norsk", fr: "Français" };

/* ── Audit helper ─────────────────────────────────── */
async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_logs").insert({ performed_by: userId, action, table_name: tableName, record_id: recordId, old_data: oldData as any, new_data: newData as any });
}

/* ═══════════════════════════════════════════════════
   TAB 1 — HERO
   ═══════════════════════════════════════════════════ */

interface HeroRow {
  id: string; lang: string; title_line1: string | null; title_line2: string | null;
  subtitle: string | null; cta_text: string | null; media_type: string | null;
  media_url: string | null; overlay_opacity: number | null; is_active: boolean;
}

function HeroTab() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HeroRow | null>(null);
  const [form, setForm] = useState<Partial<HeroRow>>({});
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery<HeroRow[]>({
    queryKey: ["admin-hero"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hero_config").select("*").order("lang");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openEdit = (row: HeroRow) => { setEditing(row); setForm({ ...row }); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        title_line1: form.title_line1 ?? null,
        title_line2: form.title_line2 ?? null,
        subtitle: form.subtitle ?? null,
        cta_text: form.cta_text ?? null,
        media_type: form.media_type ?? "image",
        media_url: form.media_url ?? null,
        overlay_opacity: form.overlay_opacity ?? 0.5,
        is_active: form.is_active ?? true,
      };
      const { error } = await supabase.from("hero_config").update(payload).eq("id", editing.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "update", "hero_config", editing.id, editing, { ...payload, lang: editing.lang });
      toast({ title: "Hero actualizado" });
      qc.invalidateQueries({ queryKey: ["admin-hero"] });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Idioma</TableHead><TableHead>Título L1</TableHead><TableHead>Título L2</TableHead>
            <TableHead>Subtítulo</TableHead><TableHead>CTA</TableHead><TableHead>Activo</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Badge variant="secondary">{LANG_LABELS[r.lang] ?? r.lang}</Badge></TableCell>
              <TableCell className="max-w-[150px] truncate">{r.title_line1}</TableCell>
              <TableCell className="max-w-[150px] truncate">{r.title_line2}</TableCell>
              <TableCell className="max-w-[150px] truncate">{r.subtitle}</TableCell>
              <TableCell>{r.cta_text}</TableCell>
              <TableCell>{r.is_active ? <Badge>Sí</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
              <TableCell><Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Hero — {LANG_LABELS[editing?.lang ?? ""] ?? editing?.lang}</DialogTitle>
            <DialogDescription>Modifica los textos y media del hero para este idioma.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Idioma</Label><Input disabled value={LANG_LABELS[form.lang ?? ""] ?? form.lang} /></div>
            <div className="space-y-1.5"><Label>Título línea 1</Label><Input value={form.title_line1 ?? ""} onChange={(e) => setForm({ ...form, title_line1: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Título línea 2</Label><Input value={form.title_line2 ?? ""} onChange={(e) => setForm({ ...form, title_line2: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Subtítulo</Label><Textarea value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Texto botón CTA</Label><Input value={form.cta_text ?? ""} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Tipo de media</Label>
              <Select value={form.media_type ?? "image"} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="image">Imagen</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>URL de imagen/video</Label><Input value={form.media_url ?? ""} onChange={(e) => setForm({ ...form, media_url: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Opacidad overlay: {(form.overlay_opacity ?? 0.5).toFixed(2)}</Label>
              <Slider min={0} max={1} step={0.01} value={[form.overlay_opacity ?? 0.5]} onValueChange={([v]) => setForm({ ...form, overlay_opacity: v })} />
            </div>
            <div className="flex items-center justify-between"><Label>Activo</Label><Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 2 — RESEÑAS
   ═══════════════════════════════════════════════════ */

interface ReviewRow {
  id: string; author_name: string; author_avatar_url: string | null; rating: number;
  comment: string; lang: string; review_date: string | null; is_featured: boolean;
  is_active: boolean; sort_order: number | null; created_at: string;
}

const emptyReview: Omit<ReviewRow, "id" | "created_at"> = {
  author_name: "", author_avatar_url: "", rating: 5, comment: "", lang: "es",
  review_date: new Date().toISOString().slice(0, 10), is_featured: false, is_active: true, sort_order: 0,
};

function ReviewsTab() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyReview);
  const [saving, setSaving] = useState(false);
  const [filterLang, setFilterLang] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const { data: rows = [], isLoading } = useQuery<ReviewRow[]>({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = rows.filter((r) => {
    if (filterLang !== "all" && r.lang !== filterLang) return false;
    if (filterRating !== "all" && r.rating !== Number(filterRating)) return false;
    if (filterActive === "active" && !r.is_active) return false;
    if (filterActive === "inactive" && r.is_active) return false;
    return true;
  });

  const openCreate = () => { setEditingId(null); setForm({ ...emptyReview }); setModalOpen(true); };
  const openEdit = (r: ReviewRow) => {
    setEditingId(r.id);
    setForm({ author_name: r.author_name, author_avatar_url: r.author_avatar_url ?? "", rating: r.rating, comment: r.comment, lang: r.lang, review_date: r.review_date ?? "", is_featured: r.is_featured, is_active: r.is_active, sort_order: r.sort_order ?? 0 });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.author_name.trim() || !form.comment.trim()) {
      toast({ title: "Campos obligatorios", description: "Nombre y comentario son requeridos.", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        author_name: form.author_name.trim(),
        author_avatar_url: form.author_avatar_url?.trim() || null,
        rating: form.rating,
        comment: form.comment.trim(),
        lang: form.lang,
        review_date: form.review_date || null,
        is_featured: form.is_featured,
        is_active: form.is_active,
        sort_order: form.sort_order ?? 0,
      };
      if (editingId) {
        const old = rows.find((r) => r.id === editingId);
        const { error } = await supabase.from("reviews").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "reviews", editingId, old, payload);
        toast({ title: "Reseña actualizada" });
      } else {
        const { data, error } = await supabase.from("reviews").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "reviews", data.id, null, data);
        toast({ title: "Reseña creada" });
      }
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const deleteReview = async (r: ReviewRow) => {
    if (!confirm("¿Eliminar esta reseña?")) return;
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", r.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "reviews", r.id, r, null);
      toast({ title: "Reseña eliminada" });
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Idioma</Label>
          <Select value={filterLang} onValueChange={setFilterLang}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{LANGS.map((l) => <SelectItem key={l} value={l}>{LANG_LABELS[l]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valoración</Label>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{[5,4,3,2,1].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Activa</SelectItem><SelectItem value="inactive">Inactiva</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nueva reseña</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Autor</TableHead><TableHead>Valoración</TableHead><TableHead>Comentario</TableHead>
            <TableHead>Idioma</TableHead><TableHead>Destacada</TableHead><TableHead>Fecha</TableHead>
            <TableHead>Activa</TableHead><TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.author_name}</TableCell>
              <TableCell><span className="flex gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}</span></TableCell>
              <TableCell className="max-w-[200px] truncate">{r.comment}</TableCell>
              <TableCell><Badge variant="secondary">{r.lang}</Badge></TableCell>
              <TableCell>{r.is_featured ? "⭐" : "—"}</TableCell>
              <TableCell className="text-xs">{r.review_date ?? "—"}</TableCell>
              <TableCell>{r.is_active ? <Badge>Sí</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteReview(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin reseñas.</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar reseña" : "Nueva reseña"}</DialogTitle>
            <DialogDescription>{editingId ? "Modifica los datos de la reseña." : "Crea una nueva reseña."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Nombre autor *</Label><Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>URL avatar</Label><Input value={form.author_avatar_url ?? ""} onChange={(e) => setForm({ ...form, author_avatar_url: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Valoración</Label>
              <div className="flex gap-1">{[1,2,3,4,5].map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} className="p-0.5">
                  <Star className={`h-6 w-6 ${n <= form.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              ))}</div>
            </div>
            <div className="space-y-1.5"><Label>Comentario *</Label><Textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Select value={form.lang} onValueChange={(v) => setForm({ ...form, lang: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{LANG_LABELS[l]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Fecha de la reseña</Label><Input type="date" value={form.review_date ?? ""} onChange={(e) => setForm({ ...form, review_date: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Destacada</Label><Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} /></div>
            <div className="flex items-center justify-between"><Label>Activa</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
            <div className="space-y-1.5"><Label>Orden</Label><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 3 — TRADUCCIONES
   ═══════════════════════════════════════════════════ */

interface TransRow { id: string; key: string; section: string | null; lang: string; value: string | null; }

const SECTIONS = ["nav", "home", "fleet", "gc", "footer", "legal"];

function TranslationsTab() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [filterSection, setFilterSection] = useState("all");
  const [searchKey, setSearchKey] = useState("");
  const [editing, setEditing] = useState<{ key: string; section: string; values: Record<string, { id?: string; value: string }> } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery<TransRow[]>({
    queryKey: ["admin-translations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("translations").select("*").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group by key+section
  const grouped: Record<string, { key: string; section: string; langs: Record<string, { id: string; value: string }> }> = {};
  for (const r of rows) {
    const gk = `${r.section ?? ""}::${r.key}`;
    if (!grouped[gk]) grouped[gk] = { key: r.key, section: r.section ?? "", langs: {} };
    grouped[gk].langs[r.lang] = { id: r.id, value: r.value ?? "" };
  }
  let entries = Object.values(grouped);
  if (filterSection !== "all") entries = entries.filter((e) => e.section === filterSection);
  if (searchKey.trim()) entries = entries.filter((e) => e.key.toLowerCase().includes(searchKey.toLowerCase()));

  const openEdit = (entry: typeof entries[0]) => {
    const values: Record<string, { id?: string; value: string }> = {};
    for (const l of LANGS) values[l] = entry.langs[l] ? { id: entry.langs[l].id, value: entry.langs[l].value } : { value: "" };
    setEditing({ key: entry.key, section: entry.section, values });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      for (const lang of LANGS) {
        const v = editing.values[lang];
        const val = v.value.trim();
        const { error } = await supabase.from("translations").upsert(
          { key: editing.key, lang, value: val || null, section: editing.section || null },
          { onConflict: "key,lang" }
        );
        if (error) {
          console.error(`Error upserting translation [${editing.key}][${lang}]:`, error);
          throw error;
        }
      }
      if (user) await writeAudit(user.id, "update", "translations", editing.key, null, editing.values);
      toast({ title: "Traducciones guardadas" });
      qc.invalidateQueries({ queryKey: ["admin-translations"] });
      setEditing(null);
    } catch (err: any) {
      console.error("Translation save failed:", err);
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Sección</Label>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 max-w-xs">
          <Label className="text-xs">Buscar clave</Label>
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={searchKey} onChange={(e) => setSearchKey(e.target.value)} placeholder="Buscar…" /></div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clave</TableHead><TableHead>Sección</TableHead>
            <TableHead>ES</TableHead><TableHead>EN</TableHead><TableHead>DE</TableHead><TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.slice(0, 100).map((e) => (
            <TableRow key={`${e.section}::${e.key}`}>
              <TableCell className="font-mono text-xs">{e.key}</TableCell>
              <TableCell><Badge variant="secondary">{e.section || "—"}</Badge></TableCell>
              <TableCell className="max-w-[150px] truncate text-xs">{e.langs.es?.value ?? "—"}</TableCell>
              <TableCell className="max-w-[150px] truncate text-xs">{e.langs.en?.value ?? "—"}</TableCell>
              <TableCell className="max-w-[150px] truncate text-xs">{e.langs.de?.value ?? "—"}</TableCell>
              <TableCell><Button variant="outline" size="sm" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin traducciones.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar traducción</DialogTitle>
            <DialogDescription>Clave: <span className="font-mono">{editing?.key}</span> — Sección: {editing?.section || "—"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Clave</Label><Input disabled value={editing?.key ?? ""} /></div>
            <div className="space-y-1.5"><Label>Sección</Label><Input disabled value={editing?.section ?? ""} /></div>
            {LANGS.map((lang) => (
              <div key={lang} className="space-y-1.5">
                <Label>Valor {LANG_LABELS[lang]}</Label>
                <Textarea rows={2} value={editing?.values[lang]?.value ?? ""} onChange={(e) => {
                  if (!editing) return;
                  setEditing({ ...editing, values: { ...editing.values, [lang]: { ...editing.values[lang], value: e.target.value } } });
                }} />
              </div>
            ))}
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 4 — BANNERS
   ═══════════════════════════════════════════════════ */

interface BannerRow {
  id: string; name: string; image_url: string | null; link_url: string | null;
  link_target: string | null; position: string | null; valid_from: string | null;
  valid_until: string | null; sort_order: number | null; is_active: boolean; created_at: string;
}

const POSITIONS = ["home_top", "home_middle", "home_bottom", "gc_top", "gc_between", "gc_bottom", "fleet_top", "offers_top"];

const emptyBanner = { name: "", image_url: "", link_url: "", link_target: "_blank", position: "home_top", valid_from: "", valid_until: "", sort_order: 0, is_active: true };

function BannersTab() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBanner);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: rows = [], isLoading } = useQuery<BannerRow[]>({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => { setEditingId(null); setForm({ ...emptyBanner }); setModalOpen(true); };
  const openEdit = (b: BannerRow) => {
    setEditingId(b.id);
    setForm({ name: b.name, image_url: b.image_url ?? "", link_url: b.link_url ?? "", link_target: b.link_target ?? "_blank", position: b.position ?? "home_top", valid_from: b.valid_from ?? "", valid_until: b.valid_until ?? "", sort_order: b.sort_order ?? 0, is_active: b.is_active });
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("banners").getPublicUrl(path);
      setForm({ ...form, image_url: urlData.publicUrl });
      toast({ title: "Imagen subida" });
    } catch (err: any) {
      toast({ title: "Error subiendo imagen", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Campo obligatorio", description: "El nombre es requerido.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        image_url: form.image_url?.trim() || null,
        link_url: form.link_url?.trim() || null,
        link_target: form.link_target || "_blank",
        position: form.position,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        sort_order: form.sort_order ?? 0,
        is_active: form.is_active,
      };
      if (editingId) {
        const old = rows.find((b) => b.id === editingId);
        const { error } = await supabase.from("banners").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "banners", editingId, old, payload);
        toast({ title: "Banner actualizado" });
      } else {
        const { data, error } = await supabase.from("banners").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "banners", data.id, null, data);
        toast({ title: "Banner creado" });
      }
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const deleteBanner = async (b: BannerRow) => {
    if (!confirm("¿Eliminar este banner?")) return;
    try {
      const { error } = await supabase.from("banners").delete().eq("id", b.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "banners", b.id, b, null);
      toast({ title: "Banner eliminado" });
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nuevo banner</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead><TableHead>Posición</TableHead>
            <TableHead>Válido desde</TableHead><TableHead>Válido hasta</TableHead>
            <TableHead>Activo</TableHead><TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.name}</TableCell>
              <TableCell><Badge variant="secondary">{b.position}</Badge></TableCell>
              <TableCell className="text-xs">{b.valid_from ?? "—"}</TableCell>
              <TableCell className="text-xs">{b.valid_until ?? "—"}</TableCell>
              <TableCell>{b.is_active ? <Badge>Sí</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteBanner(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin banners.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar banner" : "Nuevo banner"}</DialogTitle>
            <DialogDescription>{editingId ? "Modifica los datos del banner." : "Crea un nuevo banner."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Nombre interno *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Imagen</Label>
              <div className="border-2 border-dashed border-input rounded-md p-4 text-center">
                {form.image_url && <img src={form.image_url} alt="Preview" className="max-h-32 mx-auto mb-2 rounded" />}
                <input type="file" accept="image/*" onChange={handleFileUpload} className="text-sm" />
                {uploading && <p className="text-xs text-muted-foreground mt-1">Subiendo…</p>}
              </div>
            </div>
            <div className="space-y-1.5"><Label>URL destino</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" /></div>
            <div className="space-y-1.5">
              <Label>Abrir en</Label>
              <Select value={form.link_target} onValueChange={(v) => setForm({ ...form, link_target: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="_blank">Nueva pestaña</SelectItem><SelectItem value="_self">Misma pestaña</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Posición</Label>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Fecha inicio</Label><Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fecha fin</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between"><Label>Activo</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 5 — POR QUÉ ELEGIRNOS
   ═══════════════════════════════════════════════════ */

interface WhyRow {
  id: string; icon: string | null; title: string; description: string | null;
  lang: string; sort_order: number | null; is_active: boolean;
}

const emptyWhy = { icon: "", title: "", description: "", lang: "es", sort_order: 0, is_active: true };

function WhyChooseTab() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyWhy);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery<WhyRow[]>({
    queryKey: ["admin-why-choose"],
    queryFn: async () => {
      const { data, error } = await supabase.from("why_choose_us").select("*").order("sort_order").order("lang");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => { setEditingId(null); setForm({ ...emptyWhy }); setModalOpen(true); };
  const openEdit = (r: WhyRow) => {
    setEditingId(r.id);
    setForm({ icon: r.icon ?? "", title: r.title, description: r.description ?? "", lang: r.lang, sort_order: r.sort_order ?? 0, is_active: r.is_active });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Campo obligatorio", description: "El título es requerido.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { icon: form.icon?.trim() || null, title: form.title.trim(), description: form.description?.trim() || null, lang: form.lang, sort_order: form.sort_order ?? 0, is_active: form.is_active };
      if (editingId) {
        const old = rows.find((r) => r.id === editingId);
        const { error } = await supabase.from("why_choose_us").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "why_choose_us", editingId, old, payload);
        toast({ title: "Ventaja actualizada" });
      } else {
        const { data, error } = await supabase.from("why_choose_us").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "why_choose_us", data.id, null, data);
        toast({ title: "Ventaja creada" });
      }
      qc.invalidateQueries({ queryKey: ["admin-why-choose"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const deleteRow = async (r: WhyRow) => {
    if (!confirm("¿Eliminar esta ventaja?")) return;
    try {
      const { error } = await supabase.from("why_choose_us").delete().eq("id", r.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "why_choose_us", r.id, r, null);
      toast({ title: "Ventaja eliminada" });
      qc.invalidateQueries({ queryKey: ["admin-why-choose"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Añadir ventaja</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Icono</TableHead><TableHead>Título</TableHead><TableHead>Idioma</TableHead>
            <TableHead>Orden</TableHead><TableHead>Activo</TableHead><TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.icon ?? "—"}</TableCell>
              <TableCell className="font-medium">{r.title}</TableCell>
              <TableCell><Badge variant="secondary">{r.lang}</Badge></TableCell>
              <TableCell>{r.sort_order}</TableCell>
              <TableCell>{r.is_active ? <Badge>Sí</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteRow(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin ventajas.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar ventaja" : "Nueva ventaja"}</DialogTitle>
            <DialogDescription>{editingId ? "Modifica los datos." : "Crea una nueva ventaja."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Icono (nombre lucide)</Label><Input value={form.icon ?? ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="ShieldCheck, Gauge…" /></div>
            <div className="space-y-1.5"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descripción</Label><Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Select value={form.lang} onValueChange={(v) => setForm({ ...form, lang: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{LANG_LABELS[l]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between"><Label>Activo</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 6 — OFERTAS ESPECIALES
   ═══════════════════════════════════════════════════ */

interface OfferRow {
  id: string; title: string; description: string | null; image_url: string | null;
  discount_type: string | null; discount_value: number | null; category_id: string | null;
  valid_from: string; valid_until: string | null; sort_order: number | null;
  is_active: boolean; created_at: string;
}

const emptyOffer = { title: "", description: "", image_url: "", discount_type: "percentage", discount_value: 0, category_id: "", valid_from: "", valid_until: "", sort_order: 0, is_active: true };

function OffersTab() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOffer);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rows = [], isLoading } = useQuery<OfferRow[]>({
    queryKey: ["admin-special-offers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("special_offers").select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_categories").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => { setEditingId(null); setForm({ ...emptyOffer }); setModalOpen(true); };
  const openEdit = (r: OfferRow) => {
    setEditingId(r.id);
    setForm({ title: r.title, description: r.description ?? "", image_url: r.image_url ?? "", discount_type: r.discount_type ?? "percentage", discount_value: r.discount_value ?? 0, category_id: r.category_id ?? "", valid_from: r.valid_from ?? "", valid_until: r.valid_until ?? "", sort_order: r.sort_order ?? 0, is_active: r.is_active });
    setModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("offers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("offers").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
      toast({ title: "Imagen subida" });
    } catch (err: any) {
      toast({ title: "Error subiendo imagen", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, []);

  const save = async () => {
    if (!form.title.trim() || !form.valid_from) { toast({ title: "Campos obligatorios", description: "Título y fecha inicio son requeridos.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        image_url: form.image_url?.trim() || null,
        discount_type: form.discount_type || null,
        discount_value: form.discount_value || null,
        category_id: form.category_id || null,
        valid_from: form.valid_from,
        valid_until: form.valid_until || null,
        sort_order: form.sort_order ?? 0,
        is_active: form.is_active,
      };
      if (editingId) {
        const old = rows.find((r) => r.id === editingId);
        const { error } = await supabase.from("special_offers").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "special_offers", editingId, old, payload);
        toast({ title: "Oferta actualizada" });
      } else {
        const { data, error } = await supabase.from("special_offers").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "special_offers", data.id, null, data);
        toast({ title: "Oferta creada" });
      }
      qc.invalidateQueries({ queryKey: ["admin-special-offers"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const deleteRow = async (r: OfferRow) => {
    if (!confirm("¿Eliminar esta oferta?")) return;
    try {
      const { error } = await supabase.from("special_offers").delete().eq("id", r.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "special_offers", r.id, r, null);
      toast({ title: "Oferta eliminada" });
      qc.invalidateQueries({ queryKey: ["admin-special-offers"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nueva oferta</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Imagen</TableHead><TableHead>Título</TableHead><TableHead>Descuento</TableHead>
            <TableHead>Categoría</TableHead><TableHead>Desde</TableHead><TableHead>Hasta</TableHead>
            <TableHead>Activa</TableHead><TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.image_url ? <img src={r.image_url} alt="" className="h-10 w-14 rounded object-cover" /> : "—"}</TableCell>
              <TableCell className="font-medium">{r.title}</TableCell>
              <TableCell>{r.discount_type === "percentage" ? `${r.discount_value}%` : r.discount_value ? `${r.discount_value}€` : "—"}</TableCell>
              <TableCell>{catName(r.category_id)}</TableCell>
              <TableCell className="text-xs">{r.valid_from ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.valid_until ?? "—"}</TableCell>
              <TableCell>{r.is_active ? <Badge>Sí</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteRow(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin ofertas.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar oferta" : "Nueva oferta"}</DialogTitle>
            <DialogDescription>{editingId ? "Modifica los datos de la oferta." : "Crea una nueva oferta especial."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descripción</Label><Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Imagen</Label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {form.image_url ? (
                  <div className="relative inline-block">
                    <img src={form.image_url} alt="Preview" className="max-h-32 rounded mx-auto" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); setForm({ ...form, image_url: "" }); }} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="text-muted-foreground"><Upload className="h-6 w-6 mx-auto mb-1" /><p className="text-sm">Arrastra o haz clic</p></div>
                )}
                {uploading && <p className="text-xs text-muted-foreground mt-1">Subiendo…</p>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo descuento</Label>
                <Select value={form.discount_type ?? "percentage"} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percentage">Porcentaje</SelectItem><SelectItem value="fixed">Fijo (€)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Valor descuento</Label><Input type="number" min={0} value={form.discount_value ?? 0} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.category_id || "__none__"} onValueChange={(v) => setForm({ ...form, category_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">Sin categoría</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Fecha inicio *</Label><Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fecha fin</Label><Input type="date" value={form.valid_until ?? ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between"><Label>Activa</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN — Contenido Web
   ═══════════════════════════════════════════════════ */

export default function ContentManagement() {
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Contenido Web</h1>
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Contenido Web</h1>
      <div className="bg-background rounded-xl shadow-sm border">
        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="w-full justify-start rounded-t-xl rounded-b-none border-b h-auto p-0 bg-muted/50 flex-wrap">
            <TabsTrigger value="hero" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Hero</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Reseñas</TabsTrigger>
            <TabsTrigger value="translations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Traducciones</TabsTrigger>
            <TabsTrigger value="banners" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Banners</TabsTrigger>
            <TabsTrigger value="why" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Por qué elegirnos</TabsTrigger>
            <TabsTrigger value="offers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Ofertas especiales</TabsTrigger>
          </TabsList>
          <div className="p-6">
            <TabsContent value="hero"><HeroTab /></TabsContent>
            <TabsContent value="reviews"><ReviewsTab /></TabsContent>
            <TabsContent value="translations"><TranslationsTab /></TabsContent>
            <TabsContent value="banners"><BannersTab /></TabsContent>
            <TabsContent value="why"><WhyChooseTab /></TabsContent>
            <TabsContent value="offers"><OffersTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
