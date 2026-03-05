import { useState } from "react";
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
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  office:  { label: "Oficina",     cls: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100" },
  airport: { label: "Aeropuerto",  cls: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" },
  hotel:   { label: "Hotel",       cls: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100" },
  other:   { label: "Otro",        cls: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100" },
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

const emptyForm: LocationForm = {
  name: "", type: "office", description: "", extra_charge: 0, sort_order: 0, is_active: true,
};

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_log").insert({
    performed_by: userId, action, table_name: tableName, record_id: recordId,
    old_data: oldData as any, new_data: newData as any,
  });
}

export default function PickupLocations() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["admin-pickup-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_locations")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => { setForm(emptyForm); setModalOpen(true); };
  const openEdit = (loc: any) => {
    setForm({
      id: loc.id,
      name: loc.name ?? "",
      type: loc.type ?? "office",
      description: loc.description ?? "",
      extra_charge: loc.extra_charge ?? 0,
      sort_order: loc.sort_order ?? 0,
      is_active: loc.is_active ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        extra_charge: form.extra_charge,
        sort_order: form.sort_order,
        is_active: form.is_active,
        updated_by: user.id,
      };

      if (form.id) {
        const old = locations.find((l: any) => l.id === form.id);
        const { error } = await supabase.from("pickup_locations").update(payload).eq("id", form.id);
        if (error) throw error;
        await writeAudit(user.id, "update", "pickup_locations", form.id, old, payload);
        toast({ title: "Ubicación actualizada" });
      } else {
        const { data, error } = await supabase.from("pickup_locations").insert(payload).select("id").single();
        if (error) throw error;
        await writeAudit(user.id, "create", "pickup_locations", data.id, null, payload);
        toast({ title: "Ubicación creada" });
      }
      qc.invalidateQueries({ queryKey: ["admin-pickup-locations"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc: any) => {
    if (!user) return;
    if (!confirm(`¿Eliminar "${loc.name}"?`)) return;
    try {
      const { error } = await supabase.from("pickup_locations").delete().eq("id", loc.id);
      if (error) throw error;
      await writeAudit(user.id, "delete", "pickup_locations", loc.id, loc, null);
      qc.invalidateQueries({ queryKey: ["admin-pickup-locations"] });
      toast({ title: "Ubicación eliminada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ubicaciones de recogida</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva ubicación
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-border overflow-hidden">
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
            {locations.map((loc: any) => {
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
                    <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(loc)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {locations.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay ubicaciones registradas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Aeropuerto de Gran Canaria" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
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
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo extra (€)</Label>
              <Input type="number" step="0.01" value={form.extra_charge} onChange={e => setForm(f => ({ ...f, extra_charge: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">0 = sin cargo adicional</p>
            </div>
            <div className="space-y-1.5">
              <Label>Orden</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Activa</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
            <Button className="w-full font-bold" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
