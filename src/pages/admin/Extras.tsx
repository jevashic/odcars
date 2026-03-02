import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface Extra {
  id: string;
  name: string;
  description: string | null;
  price_per_reservation: number;
  is_tax_exempt: boolean;
  is_active: boolean;
  created_at: string;
}

type ExtraForm = Omit<Extra, "id" | "created_at">;

const emptyForm: ExtraForm = {
  name: "",
  description: "",
  price_per_reservation: 0,
  is_tax_exempt: false,
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

/* ── Seed defaults ──────────────────────────────────── */

const SEED_EXTRAS = [
  { name: "GPS", description: "Navegador GPS portátil", price_per_reservation: 10, is_tax_exempt: false, is_active: true },
  { name: "Silla de bebé", description: "Silla de seguridad infantil", price_per_reservation: 15, is_tax_exempt: false, is_active: true },
];

/* ── Main Component ─────────────────────────────────── */

export default function AdminExtras() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExtraForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Extra | null>(null);
  const [seeded, setSeeded] = useState(false);

  /* ── Query ────────────────────────────────────────── */

  const { data: extras = [], isLoading } = useQuery<Extra[]>({
    queryKey: ["admin-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extras")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ── Seed if empty ────────────────────────────────── */

  useEffect(() => {
    if (seeded || isLoading || extras.length > 0 || !user) return;
    setSeeded(true);

    (async () => {
      const { data, error } = await supabase
        .from("extras")
        .insert(SEED_EXTRAS)
        .select();
      if (error) {
        console.error("Seed extras error:", error);
        return;
      }
      for (const row of data ?? []) {
        await writeAudit(user.id, "insert", "extras", row.id, null, row);
      }
      qc.invalidateQueries({ queryKey: ["admin-extras"] });
      toast({ title: "Extras iniciales creados", description: "GPS y Silla de bebé añadidos automáticamente." });
    })();
  }, [seeded, isLoading, extras.length, user, qc]);

  /* ── Open modals ──────────────────────────────────── */

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((ext: Extra) => {
    setEditingId(ext.id);
    setForm({
      name: ext.name,
      description: ext.description ?? "",
      price_per_reservation: ext.price_per_reservation,
      is_tax_exempt: ext.is_tax_exempt,
      is_active: ext.is_active,
    });
    setModalOpen(true);
  }, []);

  /* ── Save ─────────────────────────────────────────── */

  const saveExtra = async () => {
    if (!form.name || !form.price_per_reservation) {
      toast({ title: "Campos obligatorios", description: "Nombre y precio son requeridos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price_per_reservation: form.price_per_reservation,
        is_tax_exempt: form.is_tax_exempt,
        is_active: form.is_active,
      };

      if (editingId) {
        const oldExtra = extras.find((e) => e.id === editingId);
        const { error } = await supabase.from("extras").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "extras", editingId, oldExtra, { ...payload, id: editingId });
        toast({ title: "Extra actualizado" });
      } else {
        const { data, error } = await supabase.from("extras").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "extras", data.id, null, data);
        toast({ title: "Extra creado" });
      }

      qc.invalidateQueries({ queryKey: ["admin-extras"] });
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
      const { error } = await supabase.from("extras").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await writeAudit(user.id, "delete", "extras", deleteTarget.id, deleteTarget, null);
      qc.invalidateQueries({ queryKey: ["admin-extras"] });
      toast({ title: "Extra eliminado" });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ── IGIC helpers ─────────────────────────────────── */

  const base = form.price_per_reservation / 1.07;
  const igic = form.price_per_reservation - base;

  /* ── Render ───────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Extras</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Añadir extra
        </Button>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Precio final (IGIC incl.)</TableHead>
              <TableHead className="text-center">Exento IGIC</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {extras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay extras registrados.
                </TableCell>
              </TableRow>
            ) : (
              extras.map((ext) => (
                <TableRow key={ext.id}>
                  <TableCell className="font-medium">{ext.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {ext.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{ext.price_per_reservation.toFixed(2)} €</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={ext.is_tax_exempt ? "secondary" : "outline"}>
                      {ext.is_tax_exempt ? "Sí" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={ext.is_active ? "default" : "destructive"}>
                      {ext.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ext)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(ext)}>
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

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar extra" : "Nuevo extra"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos del extra." : "Rellena los datos del nuevo extra."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-name">Nombre *</Label>
              <Input
                id="ext-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: GPS, Silla de bebé…"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-desc">Descripción</Label>
              <Textarea
                id="ext-desc"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-price">Precio final con IGIC incluido (€) *</Label>
              <Input
                id="ext-price"
                type="number"
                min={0}
                step={0.01}
                value={form.price_per_reservation}
                onChange={(e) => setForm({ ...form, price_per_reservation: parseFloat(e.target.value) || 0 })}
              />
              {!form.is_tax_exempt && form.price_per_reservation > 0 && (
                <p className="text-xs text-muted-foreground">
                  Base imponible: {base.toFixed(2)} € · IGIC 7%: {igic.toFixed(2)} €
                </p>
              )}
            </div>

            {/* Tax exempt toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="ext-tax">Exento de IGIC</Label>
              <Switch
                id="ext-tax"
                checked={form.is_tax_exempt}
                onCheckedChange={(v) => setForm({ ...form, is_tax_exempt: v })}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="ext-active">Activo</Label>
              <Switch
                id="ext-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <Button className="w-full" onClick={saveExtra} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar extra?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
