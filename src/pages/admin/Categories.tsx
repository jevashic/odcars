import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, X, Loader2 } from "lucide-react";

const ENERGY_TYPES = [
  { value: "gasoline", label: "Gasolina" },
  { value: "diesel", label: "Diésel" },
  { value: "hybrid", label: "Híbrido" },
  { value: "electric", label: "Eléctrico" },
] as const;

/* ── Types ──────────────────────────────────────────── */

interface Category {
  id: string;
  name: string;
  code: string;
  description: string | null;
  energy_type: string;
  price_per_day: number;
  deposit_amount_base: number | null;
  transmission_note: string | null;
  seats_min: number | null;
  seats_max: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface SeasonWithPrice {
  pricing_rule_id: string;
  season_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price_per_day_with_tax: number;
  is_active: boolean;
}

interface PricingRuleForm {
  name: string;
  start_date: string;
  end_date: string;
  price_per_day_with_tax: number;
  is_active: boolean;
}

type CategoryForm = Omit<Category, "id" | "created_at">;

const emptyCategoryForm: CategoryForm = {
  name: "",
  code: "",
  description: "",
  energy_type: "gasoline",
  price_per_day: 0,
  deposit_amount_base: null,
  transmission_note: "",
  seats_min: null,
  seats_max: null,
  image_url: null,
  is_active: true,
};

const emptyPricingRuleForm: PricingRuleForm = {
  name: "",
  start_date: "",
  end_date: "",
  price_per_day_with_tax: 0,
  is_active: true,
};

/* ── Audit helper ───────────────────────────────────── */

async function writeAudit(
  userId: string,
  action: string,
  tableName: string,
  recordId: string,
  oldData: unknown,
  newData: unknown
) {
  await supabase.from("audit_log").insert({
    performed_by: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData as any,
    new_data: newData as any,
  });
}

/* ── Main Component ─────────────────────────────────── */

export default function AdminCategories() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  // Category modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyCategoryForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // Pricing rule state
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prEditingRow, setPrEditingRow] = useState<SeasonWithPrice | null>(null);
  const [prForm, setPrForm] = useState<PricingRuleForm>(emptyPricingRuleForm);
  const [prDeleteTarget, setPrDeleteTarget] = useState<SeasonWithPrice | null>(null);
  const [prSaving, setPrSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Queries ──────────────────────────────────────── */

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pricingRules = [] } = useQuery<SeasonWithPrice[]>({
    queryKey: ["admin-pricing-rules", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("id, season_id, price_per_day_with_tax, is_active, seasons(id, name, start_date, end_date, is_active)")
        .eq("category_id", editingId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        pricing_rule_id: r.id,
        season_id: r.season_id,
        name: r.seasons?.name ?? "",
        start_date: r.seasons?.start_date ?? "",
        end_date: r.seasons?.end_date ?? "",
        price_per_day_with_tax: r.price_per_day_with_tax,
        is_active: r.is_active,
      })).sort((a: SeasonWithPrice, b: SeasonWithPrice) => a.start_date.localeCompare(b.start_date));
    },
  });

  /* ── Image handling ───────────────────────────────── */

  const handleImageSelect = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Formato no soportado", description: "Solo JPG, PNG o WEBP", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (categoryId: string): Promise<string | null> => {
    if (!imageFile) return form.image_url;
    const ext = imageFile.name.split(".").pop();
    const path = `${categoryId}.${ext}`;
    const { error } = await supabase.storage
      .from("category-images")
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("category-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  /* ── Open modal helpers ───────────────────────────── */

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyCategoryForm);
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      code: cat.code,
      description: cat.description ?? "",
      energy_type: cat.energy_type ?? "gasoline",
      price_per_day: cat.price_per_day,
      deposit_amount_base: cat.deposit_amount_base,
      transmission_note: cat.transmission_note ?? "",
      seats_min: cat.seats_min,
      seats_max: cat.seats_max,
      image_url: cat.image_url,
      is_active: cat.is_active,
    });
    setImageFile(null);
    setImagePreview(cat.image_url);
    setModalOpen(true);
  };

  /* ── Save category ────────────────────────────────── */

  const saveCategory = async () => {
    if (!form.name || !form.code || !form.price_per_day || !form.energy_type) {
      toast({ title: "Campos obligatorios", description: "Nombre, código, tipo de energía y precio base son requeridos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // UPDATE
        const oldCat = categories.find((c) => c.id === editingId);
        const imageUrl = await uploadImage(editingId);
        const payload = { ...form, image_url: imageUrl };
        const { error } = await supabase.from("vehicle_categories").update(payload).eq("id", editingId);
        if (error) throw error;
        await writeAudit(user!.id, "update", "vehicle_categories", editingId, oldCat, payload);
        toast({ title: "Categoría actualizada" });
      } else {
        // INSERT
        const { data: inserted, error } = await supabase
          .from("vehicle_categories")
          .insert({ ...form, image_url: null })
          .select()
          .single();
        if (error) throw error;
        // Upload image with new id
        const imageUrl = await uploadImage(inserted.id);
        if (imageUrl) {
          await supabase.from("vehicle_categories").update({ image_url: imageUrl }).eq("id", inserted.id);
        }
        await writeAudit(user!.id, "insert", "vehicle_categories", inserted.id, null, { ...form, image_url: imageUrl });
        toast({ title: "Categoría creada" });
      }
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setModalOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete category ──────────────────────────────── */

  const deleteCategory = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("vehicle_categories").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await writeAudit(user!.id, "delete", "vehicle_categories", deleteTarget.id, deleteTarget, null);
      toast({ title: "Categoría eliminada" });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ── Pricing rule CRUD ────────────────────────────── */

  const openPrCreate = () => {
    setPrEditingRow(null);
    setPrForm(emptyPricingRuleForm);
    setPrModalOpen(true);
  };

  const openPrEdit = (row: SeasonWithPrice) => {
    setPrEditingRow(row);
    setPrForm({
      name: row.name,
      start_date: row.start_date,
      end_date: row.end_date,
      price_per_day_with_tax: row.price_per_day_with_tax,
      is_active: row.is_active,
    });
    setPrModalOpen(true);
  };

  const savePricingRule = async () => {
    if (!prForm.name || !prForm.start_date || !prForm.end_date || !prForm.price_per_day_with_tax) {
      toast({ title: "Campos obligatorios", description: "Nombre, fechas y precio son requeridos", variant: "destructive" });
      return;
    }
    setPrSaving(true);
    try {
      if (prEditingRow) {
        // Update season
        const { error: sErr } = await supabase.from("seasons").update({
          name: prForm.name,
          start_date: prForm.start_date,
          end_date: prForm.end_date,
          is_active: prForm.is_active,
        }).eq("id", prEditingRow.season_id);
        if (sErr) throw sErr;
        // Update pricing rule
        const { error: pErr } = await supabase.from("pricing_rules").update({
          price_per_day_with_tax: prForm.price_per_day_with_tax,
          is_active: prForm.is_active,
        }).eq("id", prEditingRow.pricing_rule_id);
        if (pErr) throw pErr;
        await writeAudit(user!.id, "update", "seasons", prEditingRow.season_id, prEditingRow, prForm);
        toast({ title: "Temporada actualizada" });
      } else {
        // Insert season first
        const { data: newSeason, error: sErr } = await supabase
          .from("seasons")
          .insert({
            name: prForm.name,
            start_date: prForm.start_date,
            end_date: prForm.end_date,
            is_active: prForm.is_active,
            type: "custom",
          })
          .select()
          .single();
        if (sErr) throw sErr;
        // Insert pricing rule
        const { data: newRule, error: pErr } = await supabase
          .from("pricing_rules")
          .insert({
            category_id: editingId!,
            season_id: newSeason.id,
            price_per_day_with_tax: prForm.price_per_day_with_tax,
            is_active: prForm.is_active,
          })
          .select()
          .single();
        if (pErr) throw pErr;
        await writeAudit(user!.id, "insert", "pricing_rules", newRule.id, null, { season_id: newSeason.id, category_id: editingId });
        toast({ title: "Temporada creada" });
      }
      qc.invalidateQueries({ queryKey: ["admin-pricing-rules", editingId] });
      setPrModalOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPrSaving(false);
    }
  };

  const deletePricingRule = async () => {
    if (!prDeleteTarget) return;
    try {
      // Delete pricing rule first, then season
      const { error: pErr } = await supabase.from("pricing_rules").delete().eq("id", prDeleteTarget.pricing_rule_id);
      if (pErr) throw pErr;
      const { error: sErr } = await supabase.from("seasons").delete().eq("id", prDeleteTarget.season_id);
      if (sErr) throw sErr;
      await writeAudit(user!.id, "delete", "pricing_rules", prDeleteTarget.pricing_rule_id, prDeleteTarget, null);
      toast({ title: "Temporada eliminada" });
      qc.invalidateQueries({ queryKey: ["admin-pricing-rules", editingId] });
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    } finally {
      setPrDeleteTarget(null);
    }
  };

  /* ── Drag & drop ──────────────────────────────────── */

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ── Render ───────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Categorías</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-background border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {cat.image_url ? (
              <img
                src={cat.image_url}
                alt={cat.name}
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                Sin imagen
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <Badge variant={cat.is_active ? "default" : "secondary"}>
                  {cat.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>Código: <span className="font-medium text-foreground">{cat.code}</span></p>
                <p>Precio base: <span className="font-medium text-foreground">{cat.price_per_day} €/día</span></p>
                {cat.transmission_note && <p>Transmisión: {cat.transmission_note}</p>}
                {(cat.seats_min || cat.seats_max) && (
                  <p>Plazas: {cat.seats_min ?? "–"}–{cat.seats_max ?? "–"}</p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(cat)} className="gap-1.5 flex-1">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(cat)} className="gap-1.5 flex-1">
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No hay categorías registradas.</p>
      )}

      {/* ── Delete confirmation ──────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La categoría y sus datos asociados serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Category modal ──────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos de esta categoría." : "Rellena los campos para crear una nueva categoría."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">Datos generales</TabsTrigger>
              {editingId && (
                <TabsTrigger value="pricing" className="flex-1">Temporadas y precios</TabsTrigger>
              )}
            </TabsList>

            {/* ── Tab 1: General ─────────────────────── */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name">Nombre *</Label>
                  <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-code">Código *</Label>
                  <Input id="cat-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ECO, STD, PRE…" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de energía *</Label>
                <Select value={form.energy_type} onValueChange={(v) => setForm({ ...form, energy_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                  <SelectContent>
                    {ENERGY_TYPES.map((et) => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">Descripción</Label>
                <Textarea id="cat-desc" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-price">Precio base/día (€) *</Label>
                  <Input id="cat-price" type="number" min={0} step={0.01} value={form.price_per_day} onChange={(e) => setForm({ ...form, price_per_day: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-deposit">Fianza base (€)</Label>
                  <Input id="cat-deposit" type="number" min={0} step={0.01} value={form.deposit_amount_base ?? ""} onChange={(e) => setForm({ ...form, deposit_amount_base: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-trans">Nota transmisión</Label>
                <Input id="cat-trans" value={form.transmission_note ?? ""} onChange={(e) => setForm({ ...form, transmission_note: e.target.value })} placeholder="Manual o similar" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-seats-min">Plazas mínimas</Label>
                  <Input id="cat-seats-min" type="number" min={1} value={form.seats_min ?? ""} onChange={(e) => setForm({ ...form, seats_min: e.target.value ? parseInt(e.target.value) : null })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-seats-max">Plazas máximas</Label>
                  <Input id="cat-seats-max" type="number" min={1} value={form.seats_max ?? ""} onChange={(e) => setForm({ ...form, seats_max: e.target.value ? parseInt(e.target.value) : null })} />
                </div>
              </div>

              {/* Image drag-and-drop */}
              <div className="space-y-1.5">
                <Label>Foto representativa</Label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Preview" className="max-h-40 rounded-lg mx-auto" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFile(null);
                          setImagePreview(null);
                          setForm({ ...form, image_url: null });
                        }}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Arrastra una imagen o haz clic para seleccionar</p>
                      <p className="text-xs mt-1">JPG, PNG o WEBP</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} id="cat-active" />
                <Label htmlFor="cat-active">Activa</Label>
              </div>

              <Button onClick={saveCategory} disabled={saving} className="w-full gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                GUARDAR
              </Button>
            </TabsContent>

            {/* ── Tab 2: Pricing rules ───────────────── */}
            {editingId && (
              <TabsContent value="pricing" className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Temporadas y precios</h3>
                  <Button size="sm" onClick={openPrCreate} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Añadir temporada
                  </Button>
                </div>

                {pricingRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay temporadas configuradas para esta categoría.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>€/día (IVA incl.)</TableHead>
                        <TableHead>Activo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricingRules.map((pr) => (
                        <TableRow key={pr.id}>
                          <TableCell className="font-medium">{pr.name}</TableCell>
                          <TableCell>{pr.start_date}</TableCell>
                          <TableCell>{pr.end_date}</TableCell>
                          <TableCell>{pr.price_per_day_with_tax} €</TableCell>
                          <TableCell>
                            <Badge variant={pr.is_active ? "default" : "secondary"}>
                              {pr.is_active ? "Sí" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openPrEdit(pr)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setPrDeleteTarget(pr)} className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Pricing rule modal */}
                <Dialog open={prModalOpen} onOpenChange={setPrModalOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{prEditId ? "Editar temporada" : "Nueva temporada"}</DialogTitle>
                      <DialogDescription>
                        {prEditId ? "Modifica los datos de esta temporada." : "Configura una nueva temporada de precios."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="space-y-1.5">
                        <Label>Nombre *</Label>
                        <Input value={prForm.name} onChange={(e) => setPrForm({ ...prForm, name: e.target.value })} placeholder="Temporada Alta" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Fecha inicio *</Label>
                          <Input type="date" value={prForm.start_date} onChange={(e) => setPrForm({ ...prForm, start_date: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Fecha fin *</Label>
                          <Input type="date" value={prForm.end_date} onChange={(e) => setPrForm({ ...prForm, end_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Precio por día con IVA (€) *</Label>
                        <Input type="number" min={0} step={0.01} value={prForm.price_per_day_with_tax} onChange={(e) => setPrForm({ ...prForm, price_per_day_with_tax: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={prForm.is_active} onCheckedChange={(v) => setPrForm({ ...prForm, is_active: v })} />
                        <Label>Activa</Label>
                      </div>
                      <Button onClick={savePricingRule} disabled={prSaving} className="w-full gap-2">
                        {prSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        GUARDAR
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Pricing rule delete confirmation */}
                <AlertDialog open={!!prDeleteTarget} onOpenChange={(o) => !o && setPrDeleteTarget(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar temporada "{prDeleteTarget?.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={deletePricingRule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
