import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Loader2, MapPin, Phone, Mail, Car, Users, Trash2 } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  manages_own_inventory: boolean;
  is_active: boolean;
  created_at: string;
}

interface BranchForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  manages_own_inventory: boolean;
  is_active: boolean;
}

const emptyForm: BranchForm = {
  name: "",
  address: "",
  city: "Las Palmas de Gran Canaria",
  phone: "",
  email: "",
  manages_own_inventory: false,
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

export default function AdminBranches() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const isAdmin = user?.role === "admin";

  /* ── Queries ─────────────────────────────────────── */

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["admin-branches"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vehicleCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["admin-branches-vehicle-counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("branch_id")
        .not("branch_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.branch_id) {
          counts[row.branch_id] = (counts[row.branch_id] || 0) + 1;
        }
      }
      return counts;
    },
  });

  const { data: userCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["admin-branches-user-counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_users")
        .select("branch_id")
        .not("branch_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.branch_id) {
          counts[row.branch_id] = (counts[row.branch_id] || 0) + 1;
        }
      }
      return counts;
    },
  });

  /* ── Open modals ──────────────────────────────────── */

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((branch: Branch) => {
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      address: branch.address ?? "",
      city: branch.city ?? "Las Palmas de Gran Canaria",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      manages_own_inventory: branch.manages_own_inventory,
      is_active: branch.is_active,
    });
    setModalOpen(true);
  }, []);

  /* ── Save ─────────────────────────────────────────── */

  const saveBranch = async () => {
    if (!form.name.trim()) {
      toast({ title: "Campo obligatorio", description: "El nombre es requerido.", variant: "destructive" });
      return;
    }
    if (!form.address.trim()) {
      toast({ title: "Campo obligatorio", description: "La dirección es requerida.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        manages_own_inventory: form.manages_own_inventory,
        is_active: form.is_active,
      };

      if (editingId) {
        const oldBranch = branches.find((b) => b.id === editingId);
        const { error } = await supabase.from("branches").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "branches", editingId, oldBranch, { ...payload, id: editingId });
        toast({ title: "Oficina actualizada" });
      } else {
        const { data, error } = await supabase.from("branches").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "branches", data.id, null, data);
        toast({ title: "Oficina creada" });
      }

      qc.invalidateQueries({ queryKey: ["admin-branches"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle active ────────────────────────────────── */

  const toggleActive = async (branch: Branch) => {
    try {
      const newActive = !branch.is_active;
      const { error } = await supabase
        .from("branches")
        .update({ is_active: newActive })
        .eq("id", branch.id);
      if (error) throw error;
      if (user) {
        await writeAudit(user.id, "update", "branches", branch.id, branch, { ...branch, is_active: newActive });
      }
      qc.invalidateQueries({ queryKey: ["admin-branches"] });
      toast({ title: newActive ? "Oficina activada" : "Oficina desactivada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  /* ── Delete ───────────────────────────────────────── */

  const deleteBranch = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("branches").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "branches", deleteTarget.id, deleteTarget, null);
      qc.invalidateQueries({ queryKey: ["admin-branches"] });
      toast({ title: "Oficina eliminada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ── Render ───────────────────────────────────────── */

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Oficinas</h1>
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Oficinas</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nueva oficina
        </Button>
      </div>

      {/* Cards grid */}
      {branches.length === 0 ? (
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No hay oficinas registradas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <Card key={branch.id} className={!branch.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{branch.name}</CardTitle>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Badge variant={branch.is_active ? "default" : "destructive"}>
                      {branch.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    {branch.manages_own_inventory && (
                      <Badge variant="secondary">Inventario propio</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Address */}
                {(branch.address || branch.city) && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {branch.address}
                      {branch.address && branch.city ? ", " : ""}
                      {branch.city}
                    </span>
                  </div>
                )}

                {/* Phone */}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{branch.phone}</span>
                  </div>
                )}

                {/* Email */}
                {branch.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span>{branch.email}</span>
                  </div>
                )}

                {/* Counts */}
                <div className="flex gap-4 pt-1 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Car className="h-4 w-4" />
                    <span>{vehicleCounts[branch.id] ?? 0} vehículos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{userCounts[branch.id] ?? 0} usuarios</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(branch)}
                  >
                    {branch.is_active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(branch)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar oficina" : "Nueva oficina"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos de la oficina." : "Rellena los datos de la nueva oficina."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Nombre *</Label>
              <Input
                id="branch-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Oficina Aeropuerto"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-address">Dirección *</Label>
              <Input
                id="branch-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Calle, número…"
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-city">Ciudad</Label>
              <Input
                id="branch-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-phone">Teléfono</Label>
              <Input
                id="branch-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+34 928 000 000"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-email">Email</Label>
              <Input
                id="branch-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="oficina@empresa.com"
              />
            </div>

            {/* Manages own inventory */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="branch-inventory">Inventario propio</Label>
                <Switch
                  id="branch-inventory"
                  checked={form.manages_own_inventory}
                  onCheckedChange={(v) => setForm({ ...form, manages_own_inventory: v })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Activar solo si esta oficina gestiona su propio inventario de vehículos de forma independiente. Por defecto la flota es global.
              </p>
            </div>

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label htmlFor="branch-active">Activa</Label>
              <Switch
                id="branch-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <Button className="w-full" onClick={saveBranch} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar oficina?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBranch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
