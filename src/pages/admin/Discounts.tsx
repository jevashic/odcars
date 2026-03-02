import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Loader2, CalendarIcon, Search, Eye } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_days: number | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  current_uses: number;
  restricted_to_email: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface DiscountForm {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed_amount" | "";
  discount_value: number;
  min_days: string;
  max_uses: string;
  max_uses_per_customer: string;
  restricted_to_email: string;
  valid_from: Date | undefined;
  valid_until: Date | undefined;
  is_active: boolean;
}

const emptyForm: DiscountForm = {
  code: "",
  description: "",
  discount_type: "",
  discount_value: 0,
  min_days: "",
  max_uses: "",
  max_uses_per_customer: "",
  restricted_to_email: "",
  valid_from: undefined,
  valid_until: undefined,
  is_active: true,
};

interface UsageRow {
  id: string;
  used_at: string;
  customers: { first_name: string; last_name: string; email: string } | null;
  reservations: { reservation_number: string } | null;
}

const PAGE_SIZE = 15;

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

export default function AdminDiscounts() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Usage dialog
  const [usageTarget, setUsageTarget] = useState<DiscountCode | null>(null);

  /* ── Query ────────────────────────────────────────── */

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-discounts", page, statusFilter, typeFilter],
    queryFn: async () => {
      let q = supabase
        .from("discount_codes")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (statusFilter === "active") q = q.eq("is_active", true);
      if (statusFilter === "inactive") q = q.eq("is_active", false);
      if (typeFilter === "percentage") q = q.eq("discount_type", "percentage");
      if (typeFilter === "fixed_amount") q = q.eq("discount_type", "fixed_amount");

      q = q.range(from, to);
      const { data: rows, count, error } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as DiscountCode[], count: count ?? 0 };
    },
  });

  const discounts = data?.rows ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return discounts;
    const s = search.toLowerCase();
    return discounts.filter(
      (d) =>
        d.code.toLowerCase().includes(s) ||
        (d.description ?? "").toLowerCase().includes(s)
    );
  }, [discounts, search]);

  /* ── Usage query ──────────────────────────────────── */

  const { data: usageRows = [], isLoading: usageLoading } = useQuery<UsageRow[]>({
    queryKey: ["discount-usage", usageTarget?.id],
    enabled: !!usageTarget,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_code_usage")
        .select("id, used_at, customers(first_name, last_name, email), reservations(reservation_number)")
        .eq("discount_code_id", usageTarget!.id)
        .order("used_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UsageRow[];
    },
  });

  /* ── Open modals ──────────────────────────────────── */

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((d: DiscountCode) => {
    setEditingId(d.id);
    setForm({
      code: d.code,
      description: d.description ?? "",
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      min_days: d.min_days != null ? String(d.min_days) : "",
      max_uses: d.max_uses != null ? String(d.max_uses) : "",
      max_uses_per_customer: d.max_uses_per_customer != null ? String(d.max_uses_per_customer) : "",
      restricted_to_email: d.restricted_to_email ?? "",
      valid_from: d.valid_from ? new Date(d.valid_from) : undefined,
      valid_until: d.valid_until ? new Date(d.valid_until) : undefined,
      is_active: d.is_active,
    });
    setModalOpen(true);
  }, []);

  /* ── Save ─────────────────────────────────────────── */

  const saveDiscount = async () => {
    if (!form.code.trim()) {
      toast({ title: "Código obligatorio", variant: "destructive" });
      return;
    }
    if (!form.discount_type) {
      toast({ title: "Tipo de descuento obligatorio", variant: "destructive" });
      return;
    }
    if (!form.discount_value || form.discount_value <= 0) {
      toast({ title: "Valor del descuento obligatorio y mayor que 0", variant: "destructive" });
      return;
    }
    if (form.discount_type === "percentage" && form.discount_value > 100) {
      toast({ title: "El porcentaje no puede superar 100", variant: "destructive" });
      return;
    }
    if (!form.valid_from) {
      toast({ title: "Fecha inicio obligatoria", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.toUpperCase().trim(),
        description: form.description || null,
        discount_type: form.discount_type as "percentage" | "fixed_amount",
        discount_value: form.discount_value,
        min_days: form.min_days ? parseInt(form.min_days) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        max_uses_per_customer: form.max_uses_per_customer ? parseInt(form.max_uses_per_customer) : null,
        restricted_to_email: form.restricted_to_email || null,
        valid_from: format(form.valid_from, "yyyy-MM-dd"),
        valid_until: form.valid_until ? format(form.valid_until, "yyyy-MM-dd") : null,
        is_active: form.is_active,
      };

      if (editingId) {
        const oldDiscount = discounts.find((d) => d.id === editingId);
        const { error } = await supabase.from("discount_codes").update(payload).eq("id", editingId);
        if (error) throw error;
        if (user) await writeAudit(user.id, "update", "discount_codes", editingId, oldDiscount, { ...payload, id: editingId });
        toast({ title: "Descuento actualizado" });
      } else {
        const { data: created, error } = await supabase.from("discount_codes").insert(payload).select().single();
        if (error) throw error;
        if (user) await writeAudit(user.id, "insert", "discount_codes", created.id, null, created);
        toast({ title: "Descuento creado" });
      }

      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle active ────────────────────────────────── */

  const toggleActive = async (d: DiscountCode) => {
    try {
      const newVal = !d.is_active;
      const { error } = await supabase.from("discount_codes").update({ is_active: newVal }).eq("id", d.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "update", "discount_codes", d.id, { is_active: d.is_active }, { is_active: newVal });
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      toast({ title: newVal ? "Descuento activado" : "Descuento desactivado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  /* ── Render ───────────────────────────────────────── */

  if (isLoading && page === 0) {
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
        <h1 className="text-2xl font-bold text-primary">Códigos de descuento</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Crear descuento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="percentage">Porcentaje %</SelectItem>
            <SelectItem value="fixed_amount">Importe fijo €</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Usos</TableHead>
              <TableHead>Válido desde</TableHead>
              <TableHead>Válido hasta</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No hay códigos de descuento.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <button
                      className="font-mono font-semibold text-primary hover:underline cursor-pointer"
                      onClick={() => setUsageTarget(d)}
                    >
                      {d.code}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[180px] truncate">
                    {d.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    {d.discount_type === "percentage" ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">%</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">€</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {d.discount_type === "percentage" ? `${d.discount_value}%` : `${d.discount_value.toFixed(2)} €`}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.current_uses} / {d.max_uses ?? "∞"}
                  </TableCell>
                  <TableCell>{format(new Date(d.valid_from), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {d.valid_until ? format(new Date(d.valid_until), "dd/MM/yyyy") : "Sin caducidad"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={d.is_active ? "default" : "destructive"}>
                      {d.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setUsageTarget(d)} title="Ver usos">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(d)}
                        className={d.is_active ? "text-destructive" : "text-green-600"}
                      >
                        {d.is_active ? "Desactivar" : "Activar"}
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
          <p className="text-sm text-muted-foreground">
            {totalCount} resultado{totalCount !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span className="flex items-center text-sm px-2">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ─────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar descuento" : "Nuevo descuento"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos del código de descuento." : "Rellena los datos del nuevo código."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Code */}
            <div className="space-y-1.5">
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ej: VERANO2026"
                className="font-mono"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Tipo de descuento *</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v) => setForm({ ...form, discount_type: v as "percentage" | "fixed_amount" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentaje %</SelectItem>
                  <SelectItem value="fixed_amount">Importe fijo €</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <Label>Valor del descuento *</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={form.discount_type === "percentage" ? 1 : 0.01}
                  value={form.discount_value || ""}
                  onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                  className="pr-8"
                />
                {form.discount_type && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                    {form.discount_type === "percentage" ? "%" : "€"}
                  </span>
                )}
              </div>
            </div>

            {/* Min days */}
            <div className="space-y-1.5">
              <Label>Mínimo de días para aplicar</Label>
              <Input
                type="number"
                min={0}
                value={form.min_days}
                onChange={(e) => setForm({ ...form, min_days: e.target.value })}
                placeholder="Sin mínimo"
              />
            </div>

            {/* Max uses */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Máx. usos totales</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Máx. usos/cliente</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_uses_per_customer}
                  onChange={(e) => setForm({ ...form, max_uses_per_customer: e.target.value })}
                  placeholder="Ilimitado"
                />
              </div>
            </div>

            {/* Restricted email */}
            <div className="space-y-1.5">
              <Label>Restringido a email</Label>
              <Input
                type="email"
                value={form.restricted_to_email}
                onChange={(e) => setForm({ ...form, restricted_to_email: e.target.value })}
                placeholder="Solo este email podrá usarlo"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Válido desde *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !form.valid_from && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.valid_from ? format(form.valid_from, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.valid_from}
                      onSelect={(d) => setForm({ ...form, valid_from: d })}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Válido hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !form.valid_until && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.valid_until ? format(form.valid_until, "dd/MM/yyyy") : "Sin caducidad"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.valid_until}
                      onSelect={(d) => setForm({ ...form, valid_until: d })}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label>Activo</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>

            <Button className="w-full" onClick={saveDiscount} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Usage Detail Dialog ───────────────────────── */}
      <Dialog open={!!usageTarget} onOpenChange={(o) => !o && setUsageTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usos del código: {usageTarget?.code}</DialogTitle>
            <DialogDescription>
              {usageTarget && (
                <>
                  {usageTarget.current_uses} uso{usageTarget.current_uses !== 1 ? "s" : ""} realizado{usageTarget.current_uses !== 1 ? "s" : ""}
                  {usageTarget.max_uses ? ` de ${usageTarget.max_uses} permitidos` : " — Ilimitado"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {usageLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : usageRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Este código aún no se ha utilizado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nº Reserva</TableHead>
                  <TableHead>Fecha de uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.customers ? `${u.customers.first_name} ${u.customers.last_name}` : "—"}
                    </TableCell>
                    <TableCell>{u.customers?.email ?? "—"}</TableCell>
                    <TableCell className="font-mono">{u.reservations?.reservation_number ?? "—"}</TableCell>
                    <TableCell>{format(new Date(u.used_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
