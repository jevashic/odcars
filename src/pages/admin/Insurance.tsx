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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Shield, ShieldCheck, Pencil, Loader2, Euro } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface InsurancePlan {
  id: string;
  name: string;
  description: string | null;
  plan_type: "basic" | "premium";
  price_per_reservation: number;
  eliminates_deposit: boolean;
  is_active: boolean;
}

interface PlanForm {
  name: string;
  description: string;
  price_per_reservation: number;
  eliminates_deposit: boolean;
  is_active: boolean;
}

interface VehicleCategory {
  id: string;
  name: string;
  deposit_amount_base: number;
}

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

export default function AdminInsurance() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [form, setForm] = useState<PlanForm>({
    name: "",
    description: "",
    price_per_reservation: 0,
    eliminates_deposit: false,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  /* ── Queries ─────────────────────────────────────── */

  const { data: plans = [], isLoading, error: plansError } = useQuery<InsurancePlan[]>({
    queryKey: ["admin-insurance-plans"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("*")
        .order("plan_type");
      console.log("insurance_plans data:", data);
      console.log("insurance_plans error:", error);
      if (error) throw error;
      if (!data || data.length === 0) {
        console.warn("insurance_plans returned empty or null");
      }
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery<VehicleCategory[]>({
    queryKey: ["admin-vehicle-categories-deposits"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("id, name, deposit_amount_base")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const basicPlan = plans.find((p) => p.plan_type === "basic");
  const premiumPlan = plans.find((p) => p.plan_type === "premium");

  /* ── Open edit ────────────────────────────────────── */

  const openEdit = useCallback((plan: InsurancePlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      price_per_reservation: plan.price_per_reservation,
      eliminates_deposit: plan.eliminates_deposit,
      is_active: plan.is_active,
    });
    setModalOpen(true);
  }, []);

  /* ── Save ─────────────────────────────────────────── */

  const savePlan = async () => {
    if (!form.name.trim()) {
      toast({ title: "Campo obligatorio", description: "El nombre es requerido.", variant: "destructive" });
      return;
    }
    if (!editingPlan) return;

    setSaving(true);
    const isBasic = editingPlan.plan_type === "basic";
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_per_reservation: isBasic ? 0 : form.price_per_reservation,
        eliminates_deposit: isBasic ? false : form.eliminates_deposit,
        is_active: form.is_active,
      };

      const { error } = await supabase
        .from("insurance_plans")
        .update(payload)
        .eq("id", editingPlan.id);
      if (error) throw error;

      if (user) {
        await writeAudit(user.id, "update", "insurance_plans", editingPlan.id, editingPlan, { ...payload, id: editingPlan.id, plan_type: editingPlan.plan_type });
      }

      toast({ title: "Plan de seguro actualizado" });
      qc.invalidateQueries({ queryKey: ["admin-insurance-plans"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ───────────────────────────────────────── */

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Seguros</h1>
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

  if (plansError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Seguros</h1>
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
          <p className="text-destructive font-medium mb-1">Error al cargar los planes de seguro</p>
          <p className="text-sm text-muted-foreground">{(plansError as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!isLoading && plans.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Seguros</h1>
        <div className="bg-muted rounded-xl p-6 text-center">
          <p className="text-muted-foreground">No se encontraron planes de seguro en la tabla <code>insurance_plans</code>. Verifica que existen registros y que las políticas RLS permiten la lectura.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Seguros</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona los dos planes de seguro disponibles para las reservas.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Plan Card */}
        {basicPlan && (
          <Card className={!basicPlan.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{basicPlan.name}</CardTitle>
                    {basicPlan.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{basicPlan.description}</p>
                    )}
                  </div>
                </div>
                <Badge variant={basicPlan.is_active ? "default" : "destructive"}>
                  {basicPlan.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price */}
              <div className="flex items-center gap-2 text-sm">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Incluido en el alquiler</span>
              </div>

              {/* Deposits by category */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Fianza por categoría:</p>
                {categories.length > 0 ? (
                  <div className="space-y-1">
                    {categories.map((cat) => (
                      <div key={cat.id} className="flex justify-between text-sm text-muted-foreground">
                        <span>{cat.name}</span>
                        <span className="font-medium">{cat.deposit_amount_base} €</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin categorías configuradas.</p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(basicPlan)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Plan Card */}
        {premiumPlan && (
          <Card className={!premiumPlan.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{premiumPlan.name}</CardTitle>
                    {premiumPlan.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{premiumPlan.description}</p>
                    )}
                  </div>
                </div>
                <Badge variant={premiumPlan.is_active ? "default" : "destructive"}>
                  {premiumPlan.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price supplement */}
              <div className="flex items-center gap-2 text-sm">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Suplemento: {premiumPlan.price_per_reservation} € / reserva</span>
              </div>

              {/* Deposit */}
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Fianza: 0 € — Eliminada completamente</span>
              </div>

              {/* Actions */}
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(premiumPlan)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar plan de seguro</DialogTitle>
            <DialogDescription>
              Modifica los datos del plan {editingPlan?.plan_type === "basic" ? "básico" : "premium"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Nombre *</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-desc">Descripción</Label>
              <Textarea
                id="plan-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Price per reservation */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Suplemento precio (€)</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                step={0.5}
                value={form.price_per_reservation}
                onChange={(e) => setForm({ ...form, price_per_reservation: Number(e.target.value) })}
                disabled={editingPlan?.plan_type === "basic"}
              />
            </div>

            {/* Eliminates deposit */}
            <div className="flex items-center justify-between">
              <Label htmlFor="plan-deposit">Elimina fianza</Label>
              <Switch
                id="plan-deposit"
                checked={form.eliminates_deposit}
                onCheckedChange={(v) => setForm({ ...form, eliminates_deposit: v })}
                disabled={editingPlan?.plan_type === "basic"}
              />
            </div>

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label htmlFor="plan-active">Activo</Label>
              <Switch
                id="plan-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              El seguro básico siempre está incluido en el precio por día de cada categoría. El suplemento premium se suma al total en el proceso de reserva.
            </p>

            <Button className="w-full" onClick={savePlan} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
