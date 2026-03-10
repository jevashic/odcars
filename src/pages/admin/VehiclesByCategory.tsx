import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Upload, X } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface Vehicle {
  id: string;
  category_id: string;
  branch_id: string | null;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string | null;
  seats: number;
  transmission: string;
  status: string;
  mileage: number | null;
  external_reference: string | null;
  notes: string | null;
  images: string[] | null;
  created_at: string;
  branches?: { id: string; name: string } | null;
}

interface VehicleForm {
  category_id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  seats: number;
  transmission: string;
  branch_id: string;
  status: string;
  mileage: number;
  external_reference: string;
  notes: string;
}

const emptyForm = (categoryId: string): VehicleForm => ({
  category_id: categoryId,
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  plate: "",
  color: "",
  seats: 5,
  transmission: "manual",
  branch_id: "",
  status: "available",
  mileage: 0,
  external_reference: "",
  notes: "",
});

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible" },
  { value: "rented", label: "Alquilado" },
  { value: "maintenance", label: "En taller" },
  { value: "retired", label: "Retirado" },
] as const;

const statusBadge = (status: string) => {
  switch (status) {
    case "available":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Disponible</Badge>;
    case "rented":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Alquilado</Badge>;
    case "maintenance":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">En taller</Badge>;
    case "retired":
      return <Badge variant="secondary">Retirado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
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
  await supabase.from("audit_logs").insert({
    performed_by: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData as any,
    new_data: newData as any,
  });
}

const PAGE_SIZE = 10;

/* ── Main Component ─────────────────────────────────── */

export default function VehiclesByCategory() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  // State
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm(categoryId ?? ""));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  // Image state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Queries ──────────────────────────────────────── */

  const { data: category } = useQuery({
    queryKey: ["admin-category-name", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("id, name")
        .eq("id", categoryId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ["admin-vehicles", categoryId, page, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("vehicles")
        .select("*, branches(id, name)", { count: "exact" })
        .eq("category_id", categoryId!)
        .order("brand")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { vehicles: (data ?? []) as Vehicle[], total: count ?? 0 };
    },
    enabled: !!categoryId,
  });

  const vehicles = vehiclesData?.vehicles ?? [];
  const totalCount = vehiclesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Client-side search filter
  const filtered = search
    ? vehicles.filter(
        (v) =>
          v.plate.toLowerCase().includes(search.toLowerCase()) ||
          v.model.toLowerCase().includes(search.toLowerCase()) ||
          v.brand.toLowerCase().includes(search.toLowerCase())
      )
    : vehicles;

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-active-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ── Image handling ───────────────────────────────── */

  const handleImageFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );
    if (accepted.length === 0) {
      toast({ title: "Formato no soportado", description: "Solo JPG, PNG o WEBP", variant: "destructive" });
      return;
    }
    setImageFiles((prev) => [...prev, ...accepted]);
    const newPreviews = accepted.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeNewImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExistingImage = (idx: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadImages = async (vehicleId: string): Promise<string[]> => {
    const urls = [...existingImages];
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const ext = file.name.split(".").pop();
      const path = `${vehicleId}/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage
        .from("vehicle-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  /* ── Open modals ──────────────────────────────────── */

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(categoryId ?? ""));
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      category_id: v.category_id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      plate: v.plate,
      color: v.color ?? "",
      seats: v.seats,
      transmission: v.transmission,
      branch_id: v.branch_id ?? "",
      status: v.status,
      mileage: v.mileage ?? 0,
      external_reference: v.external_reference ?? "",
      notes: v.notes ?? "",
    });
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages(v.images ?? []);
    setModalOpen(true);
  };

  /* ── Save ─────────────────────────────────────────── */

  const saveVehicle = async () => {
    if (!form.brand || !form.model || !form.year || !form.plate || !form.seats || !form.transmission || !form.category_id) {
      toast({ title: "Campos obligatorios", description: "Revisa los campos marcados con *", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        category_id: form.category_id,
        brand: form.brand,
        model: form.model,
        year: form.year,
        plate: form.plate,
        color: form.color || null,
        seats: form.seats,
        transmission: form.transmission,
        branch_id: form.branch_id || null,
        status: form.status,
        mileage: form.mileage || 0,
        external_reference: form.external_reference || null,
        notes: form.notes || null,
      };

      if (editingId) {
        const oldVehicle = vehicles.find((v) => v.id === editingId);
        const imgs = await uploadImages(editingId);
        payload.images = imgs.length ? imgs : null;
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "vehicles", editingId, oldVehicle, payload);
        toast({ title: "Vehículo actualizado" });
      } else {
        payload.images = null;
        const { data: inserted, error } = await supabase
          .from("vehicles")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        // Upload images with new id
        const imgs = await uploadImages(inserted.id);
        if (imgs.length) {
          await supabase.from("vehicles").update({ images: imgs }).eq("id", inserted.id);
        }
        if (user) await writeAudit(user.id, "insert", "vehicles", inserted.id, null, { ...payload, images: imgs });
        toast({ title: "Vehículo creado" });
      }

      qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
      qc.invalidateQueries({ queryKey: ["admin-vehicle-categories-overview"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ───────────────────────────────────────── */

  const confirmDelete = async () => {
    if (!deleteTarget || !user) return;
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await writeAudit(user.id, "delete", "vehicles", deleteTarget.id, deleteTarget, null);
      qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
      qc.invalidateQueries({ queryKey: ["admin-vehicle-categories-overview"] });
      toast({ title: "Vehículo eliminado" });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

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
      {/* Breadcrumb + Header */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/vehiculos" onClick={(e) => { e.preventDefault(); navigate("/admin/vehiculos"); }}>
              Flota
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category?.name ?? "..."}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/vehiculos")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{category?.name ?? "Vehículos"}</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Añadir vehículo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar matrícula o modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Marca / Modelo</TableHead>
              <TableHead>Año</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Transmisión</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No hay vehículos en esta categoría.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    {v.images && v.images.length > 0 ? (
                      <img src={v.images[0]} alt={v.brand} className="h-10 w-14 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-14 bg-muted rounded flex items-center justify-center text-[10px] text-muted-foreground">
                        —
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-medium">{v.plate}</TableCell>
                  <TableCell className="font-medium">{v.brand} {v.model}</TableCell>
                  <TableCell>{v.year}</TableCell>
                  <TableCell>{v.color ?? "—"}</TableCell>
                  <TableCell>{v.transmission === "automatic" ? "Automático" : "Manual"}</TableCell>
                  <TableCell className="text-right">{v.mileage?.toLocaleString() ?? "—"}</TableCell>
                  <TableCell>{v.branches?.name ?? "—"}</TableCell>
                  <TableCell>{statusBadge(v.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(v)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* ── Delete Confirmation ──────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deleteTarget?.brand} {deleteTarget?.model}</strong> ({deleteTarget?.plate}). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create/Edit Modal ────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos del vehículo." : "Rellena los datos del nuevo vehículo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Category (disabled) */}
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Marca *</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Año *</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Matrícula *</Label>
                <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plazas *</Label>
                <Input type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Transmisión *</Label>
                <Select value={form.transmission} onValueChange={(v) => setForm({ ...form, transmission: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automatic">Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Oficina asignada</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kilometraje</Label>
                <Input type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Referencia externa</Label>
                <Input value={form.external_reference} onChange={(e) => setForm({ ...form, external_reference: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas internas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <Label>Fotos</Label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Arrastra imágenes o haz clic para seleccionar</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleImageFiles(e.target.files)}
              />

              {/* Preview existing */}
              {(existingImages.length > 0 || imagePreviews.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingImages.map((url, i) => (
                    <div key={`existing-${i}`} className="relative group">
                      <img src={url} alt="" className="h-20 w-28 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(i)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.map((url, i) => (
                    <div key={`new-${i}`} className="relative group">
                      <img src={url} alt="" className="h-20 w-28 object-cover rounded border-2 border-primary/30" />
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button className="w-full" onClick={saveVehicle} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
