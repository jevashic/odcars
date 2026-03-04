import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Upload, X } from "lucide-react";

/* ── Types ──────────────────────────────────── */

interface TouristPlace {
  id: string;
  slug: string;
  google_maps_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  tourist_place_translations: { name: string }[];
  tourist_place_photos: { id: string; photo_url: string; field_name: string }[];
}

interface PlaceForm {
  slug: string;
  google_maps_url: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
}

interface TranslationForm {
  name: string;
  short_description: string;
  long_description: string;
}

const LANGS = ["es", "en", "de", "sv", "no", "fr"] as const;
const LANG_LABELS: Record<string, string> = {
  es: "Español", en: "English", de: "Deutsch",
  sv: "Svenska", no: "Norsk", fr: "Français",
};

const emptyPlaceForm: PlaceForm = {
  slug: "", google_maps_url: "", is_featured: false, is_active: true, sort_order: 0,
};

/* ── Audit helper ───────────────────────────── */

async function writeAudit(
  userId: string, action: string, tableName: string,
  recordId: string, oldData: unknown, newData: unknown,
) {
  await supabase.from("audit_log").insert({
    performed_by: userId, action, table_name: tableName,
    record_id: recordId, old_data: oldData as any, new_data: newData as any,
  });
}

/* ── Component ──────────────────────────────── */

export default function TouristPlaces() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  // Listing state
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterFeatured, setFilterFeatured] = useState<string>("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlaceForm>(emptyPlaceForm);
  const [translations, setTranslations] = useState<Record<string, TranslationForm>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({}); // field_name -> url
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTranslations, setSavingTranslations] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<TouristPlace | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Query ─────────────────────────────────── */

  const { data: places = [], isLoading, error: queryError } = useQuery<TouristPlace[]>({
    queryKey: ["admin-tourist-places"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tourist_places")
        .select(`
          id,
          slug,
          is_active,
          is_featured,
          sort_order,
          google_maps_url,
          tourist_place_translations!inner(
            name,
            short_description,
            lang
          ),
          tourist_place_photos(
            photo_url,
            field_name
          )
        `)
        .eq("tourist_place_translations.lang", "es")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as TouristPlace[];
    },
  });

  /* ── Filtered list ─────────────────────────── */

  const filtered = places.filter((p) => {
    if (filterActive === "active" && !p.is_active) return false;
    if (filterActive === "inactive" && p.is_active) return false;
    if (filterFeatured === "featured" && !p.is_featured) return false;
    if (filterFeatured === "not_featured" && p.is_featured) return false;
    return true;
  });

  /* ── Open create ───────────────────────────── */

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyPlaceForm);
    setTranslations(Object.fromEntries(LANGS.map((l) => [l, { name: "", short_description: "", long_description: "" }])));
    setPhotos({});
    setModalOpen(true);
  }, []);

  /* ── Open edit ─────────────────────────────── */

  const openEdit = useCallback(async (place: TouristPlace) => {
    setEditingId(place.id);
    setForm({
      slug: place.slug,
      google_maps_url: place.google_maps_url ?? "",
      is_featured: place.is_featured,
      is_active: place.is_active,
      sort_order: place.sort_order,
    });

    // Load all translations
    const { data: tRows } = await supabase
      .from("tourist_place_translations")
      .select("lang, name, short_description, long_description")
      .eq("place_id", place.id);

    const tMap: Record<string, TranslationForm> = {};
    for (const l of LANGS) {
      const row = tRows?.find((r: any) => r.lang === l);
      tMap[l] = {
        name: row?.name ?? "",
        short_description: row?.short_description ?? "",
        long_description: row?.long_description ?? "",
      };
    }
    setTranslations(tMap);

    // Photos
    const pMap: Record<string, string> = {};
    for (const ph of place.tourist_place_photos) {
      pMap[ph.field_name] = ph.photo_url;
    }
    setPhotos(pMap);

    setModalOpen(true);
  }, []);

  /* ── Upload photo ──────────────────────────── */

  const handlePhotoUpload = async (fieldName: string, file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast({ title: "Formato no válido", description: "Solo JPG, PNG o WebP.", variant: "destructive" });
      return;
    }
    setUploading(fieldName);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${fieldName}.${ext}`;
      const { error } = await supabase.storage.from("tourist-places").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("tourist-places").getPublicUrl(path);
      setPhotos((prev) => ({ ...prev, [fieldName]: urlData.publicUrl }));
    } catch (err: any) {
      toast({ title: "Error subiendo imagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  /* ── Save general ──────────────────────────── */

  const saveGeneral = async () => {
    const slug = form.slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) {
      toast({ title: "Slug obligatorio", variant: "destructive" });
      return;
    }
    if (/[^a-z0-9-]/.test(slug)) {
      toast({ title: "Slug inválido", description: "Solo letras minúsculas, números y guiones.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        slug,
        google_maps_url: form.google_maps_url.trim() || null,
        is_featured: form.is_featured,
        is_active: form.is_active,
        sort_order: form.sort_order,
      };

      let placeId = editingId;

      if (editingId) {
        const old = places.find((p) => p.id === editingId);
        const { error } = await supabase.from("tourist_places").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "tourist_places", editingId, old, payload);
      } else {
        const { data, error } = await supabase.from("tourist_places").insert(payload).select("id").single();
        if (error) throw error;
        placeId = data.id;
        setEditingId(placeId);
        if (user) await writeAudit(user.id, "insert", "tourist_places", placeId, null, payload);
      }

      // Save photos
      if (placeId) {
        // Delete existing photos
        await supabase.from("tourist_place_photos").delete().eq("place_id", placeId);
        // Insert current
        const photoRows = Object.entries(photos)
          .filter(([, url]) => url)
          .map(([field_name, photo_url]) => ({ place_id: placeId!, field_name, photo_url }));
        if (photoRows.length > 0) {
          const { error: phError } = await supabase.from("tourist_place_photos").insert(photoRows);
          if (phError) throw phError;
        }
      }

      toast({ title: editingId ? "Lugar actualizado" : "Lugar creado" });
      qc.invalidateQueries({ queryKey: ["admin-tourist-places"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Save translations ─────────────────────── */

  const saveTranslations = async () => {
    if (!editingId) {
      toast({ title: "Guarda primero la configuración general", variant: "destructive" });
      return;
    }
    const esName = translations.es?.name?.trim();
    if (!esName) {
      toast({ title: "Nombre en español obligatorio", variant: "destructive" });
      return;
    }

    setSavingTranslations(true);
    try {
      for (const lang of LANGS) {
        const t = translations[lang];
        if (!t) continue;
        const payload = {
          place_id: editingId,
          lang,
          name: t.name.trim() || null,
          short_description: t.short_description.trim() || null,
          long_description: t.long_description.trim() || null,
        };

        // Check if exists
        const { data: existing } = await supabase
          .from("tourist_place_translations")
          .select("id")
          .eq("place_id", editingId)
          .eq("lang", lang)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase.from("tourist_place_translations").update(payload).eq("id", existing.id);
          if (error) throw error;
          if (user) await writeAudit(user.id, "update", "tourist_place_translations", existing.id, null, payload);
        } else if (t.name.trim()) {
          const { data: ins, error } = await supabase.from("tourist_place_translations").insert(payload).select("id").single();
          if (error) throw error;
          if (user) await writeAudit(user.id, "insert", "tourist_place_translations", ins.id, null, payload);
        }
      }

      toast({ title: "Traducciones guardadas" });
      qc.invalidateQueries({ queryKey: ["admin-tourist-places"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingTranslations(false);
    }
  };

  /* ── Delete ────────────────────────────────── */

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from("tourist_place_photos").delete().eq("place_id", deleteTarget.id);
      await supabase.from("tourist_place_translations").delete().eq("place_id", deleteTarget.id);
      const { error } = await supabase.from("tourist_places").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "tourist_places", deleteTarget.id, deleteTarget, null);
      toast({ title: "Lugar eliminado" });
      qc.invalidateQueries({ queryKey: ["admin-tourist-places"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  /* ── Render ────────────────────────────────── */

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Conoce Gran Canaria</h1>
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (queryError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Conoce Gran Canaria</h1>
        <div className="bg-destructive/10 rounded-xl p-8 shadow-sm border border-destructive text-center">
          <p className="text-destructive font-medium">Error al cargar lugares: {queryError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Conoce Gran Canaria</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo lugar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFeatured} onValueChange={setFilterFeatured}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Destacado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="featured">Destacados</SelectItem>
            <SelectItem value="not_featured">No destacados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No hay lugares turísticos.</p>
        </div>
      ) : (
        <div className="bg-background rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Nombre (ES)</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Destacado</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((place) => {
                const name = place.tourist_place_translations?.[0]?.name ?? "—";
                const cover = place.tourist_place_photos?.find((p) => p.field_name === "photo_1")?.photo_url;
                return (
                  <TableRow key={place.id}>
                    <TableCell>
                      {cover ? (
                        <img src={cover} alt={name} className="h-10 w-14 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-14 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{place.slug}</TableCell>
                    <TableCell>
                      {place.is_featured ? <Badge>Destacado</Badge> : <Badge variant="outline">No</Badge>}
                    </TableCell>
                    <TableCell>{place.sort_order}</TableCell>
                    <TableCell>
                      <Badge variant={place.is_active ? "default" : "destructive"}>
                        {place.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(place)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(place)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar lugar" : "Nuevo lugar"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos del lugar turístico." : "Completa los datos del nuevo lugar."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">Configuración general</TabsTrigger>
              <TabsTrigger value="translations" className="flex-1">Traducciones</TabsTrigger>
            </TabsList>

            {/* Tab 1 - General */}
            <TabsContent value="general" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="dunas-maspalomas"
                />
                <p className="text-xs text-muted-foreground">Minúsculas, sin espacios. Ej: dunas-maspalomas</p>
              </div>

              <div className="space-y-1.5">
                <Label>URL Google Maps</Label>
                <Input
                  value={form.google_maps_url}
                  onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>Destacado</Label>
                  <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Activo</Label>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Orden de aparición</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <Label>Fotos (hasta 3)</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(["photo_1", "photo_2", "photo_3"] as const).map((fieldName) => (
                    <div key={fieldName} className="relative">
                      {photos[fieldName] ? (
                        <div className="relative group">
                          <img src={photos[fieldName]} alt={fieldName} className="h-24 w-full rounded-md object-cover border" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setPhotos((prev) => { const n = { ...prev }; delete n[fieldName]; return n; })}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="h-24 w-full rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 transition-colors"
                          onClick={() => fileInputRefs.current[fieldName]?.click()}
                          disabled={uploading === fieldName}
                        >
                          {uploading === fieldName ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-5 w-5" />
                              <span className="text-xs">Subir</span>
                            </>
                          )}
                        </button>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[fieldName] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(fieldName, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={saveGeneral} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                GUARDAR
              </Button>
            </TabsContent>

            {/* Tab 2 - Translations */}
            <TabsContent value="translations" className="space-y-6 pt-2">
              {LANGS.map((lang) => (
                <div key={lang} className="space-y-3 border rounded-lg p-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {LANG_LABELS[lang]}
                    {lang === "es" && <Badge variant="secondary" className="text-xs">Obligatorio</Badge>}
                  </h3>

                  <div className="space-y-1.5">
                    <Label>Nombre {lang === "es" ? "*" : ""}</Label>
                    <Input
                      value={translations[lang]?.name ?? ""}
                      onChange={(e) =>
                        setTranslations((prev) => ({
                          ...prev,
                          [lang]: { ...prev[lang], name: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Descripción corta</Label>
                    <Textarea
                      rows={2}
                      value={translations[lang]?.short_description ?? ""}
                      onChange={(e) =>
                        setTranslations((prev) => ({
                          ...prev,
                          [lang]: { ...prev[lang], short_description: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Descripción larga</Label>
                    <Textarea
                      rows={4}
                      value={translations[lang]?.long_description ?? ""}
                      onChange={(e) =>
                        setTranslations((prev) => ({
                          ...prev,
                          [lang]: { ...prev[lang], long_description: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}

              <Button className="w-full" onClick={saveTranslations} disabled={savingTranslations || !editingId}>
                {savingTranslations && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                GUARDAR TRADUCCIONES
              </Button>
              {!editingId && (
                <p className="text-xs text-muted-foreground text-center">
                  Guarda primero la pestaña "Configuración general" para habilitar traducciones.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lugar?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todas las traducciones y fotos asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
