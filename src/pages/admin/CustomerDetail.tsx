import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { Loader2, ArrowLeft, Pencil, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ── Helpers ────────────────────────────────────────── */

const statusBadge = (status: string) => {
  switch (status) {
    case "pending": return <Badge variant="secondary">Pendiente</Badge>;
    case "confirmed": return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Confirmada</Badge>;
    case "active": return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">En curso</Badge>;
    case "completed": return <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100">Completada</Badge>;
    case "cancelled": return <Badge variant="destructive">Cancelada</Badge>;
    case "no_show": return <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">No presentado</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_logs").insert({
    performed_by: userId, action, table_name: tableName, record_id: recordId,
    old_data: oldData as any, new_data: newData as any,
  });
}

/* ── Component ──────────────────────────────────────── */

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  /* ── Customer query ─────────────────────────────── */

  const { data: customer, isLoading } = useQuery({
    queryKey: ["admin-customer-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  /* ── Reservations query ─────────────────────────── */

  const { data: reservations = [] } = useQuery({
    queryKey: ["admin-customer-reservations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, vehicle_categories(name)")
        .eq("customer_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  /* ── Edit modal ──────────────────────────────────── */

  const openEdit = () => {
    if (!customer) return;
    setEditForm({
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      id_type: customer.id_type ?? "",
      id_number: customer.id_number ?? "",
      nationality: customer.nationality ?? "",
      license_number: customer.license_number ?? "",
      license_expiry: customer.license_expiry ?? "",
      is_company: customer.is_company ?? false,
      company_name: customer.company_name ?? "",
      company_vat: customer.company_vat ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!user || !customer) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.email.trim()) {
      toast({ title: "Nombre, apellidos y email son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        id_type: editForm.id_type || null,
        id_number: editForm.id_number.trim() || null,
        nationality: editForm.nationality.trim() || null,
        license_number: editForm.license_number.trim() || null,
        license_expiry: editForm.license_expiry || null,
        is_company: editForm.is_company,
        company_name: editForm.is_company ? editForm.company_name.trim() || null : null,
        company_vat: editForm.is_company ? editForm.company_vat.trim() || null : null,
      };

      const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
      if (error) throw error;

      const oldData: any = {};
      const newData: any = {};
      for (const key of Object.keys(payload)) {
        if ((customer as any)[key] !== payload[key]) {
          oldData[key] = (customer as any)[key];
          newData[key] = payload[key];
        }
      }

      await writeAudit(user.id, "update", "customers", customer.id, oldData, newData);
      qc.invalidateQueries({ queryKey: ["admin-customer-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast({ title: "Cliente actualizado" });
      setEditOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Stats ───────────────────────────────────────── */

  const stats = (() => {
    if (!reservations.length) return null;
    const totalSpent = reservations.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
    const dates = reservations.map((r: any) => r.created_at).filter(Boolean).sort();
    const channels = reservations.map((r: any) => r.sale_channel).filter(Boolean);
    const channelCounts: Record<string, number> = {};
    channels.forEach((ch: string) => { channelCounts[ch] = (channelCounts[ch] || 0) + 1; });
    const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const channelLabels: Record<string, string> = { web: "Web", office_sale: "Oficina", office_pickup: "Entrega", office_dropoff: "Devolución", office: "Oficina" };

    return {
      total: reservations.length,
      totalSpent,
      first: dates[0],
      last: dates[dates.length - 1],
      topChannel: channelLabels[topChannel] ?? topChannel,
    };
  })();

  /* ── License status ──────────────────────────────── */

  const licenseBadge = () => {
    if (!customer?.license_expiry) return <Badge variant="secondary">Sin fecha</Badge>;
    const exp = parseISO(customer.license_expiry);
    return exp > new Date()
      ? <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Vigente</Badge>
      : <Badge variant="destructive">Caducada</Badge>;
  };

  /* ── Render ──────────────────────────────────────── */

  if (isLoading || !customer) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const c = customer as any;

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/clientes" onClick={(e) => { e.preventDefault(); navigate("/admin/clientes"); }}>
              Clientes
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{c.first_name} {c.last_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/clientes")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{c.first_name} {c.last_name}</h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT (2/3) ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Block 1 - Personal data */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Datos personales</CardTitle>
              <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{c.first_name} {c.last_name}</span></div>
              <div><span className="text-muted-foreground">Email:</span> {c.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Teléfono:</span> {c.phone ?? "—"}</div>
              <div><span className="text-muted-foreground">Tipo documento:</span> {c.id_type ?? "—"}</div>
              <div><span className="text-muted-foreground">Nº documento:</span> {c.id_number ?? "—"}</div>
              <div><span className="text-muted-foreground">Nacionalidad:</span> {c.nationality ?? "—"}</div>
              {c.is_company && (
                <>
                  <div><span className="text-muted-foreground">Empresa:</span> {c.company_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">CIF/VAT:</span> {c.company_vat ?? "—"}</div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Block 2 - License */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Licencia de conducir</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Nº licencia:</span> {c.license_number ?? "—"}</div>
              <div>
                <span className="text-muted-foreground">Caducidad:</span>{" "}
                {c.license_expiry ? format(parseISO(c.license_expiry), "dd/MM/yyyy") : "—"}
                <span className="ml-2">{licenseBadge()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT (1/3) ═══ */}
        <div className="space-y-6">
          {/* Block 3 - Stats */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Estadísticas</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {stats ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total reservas:</span> <span className="font-medium">{stats.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total gastado:</span> <span className="font-medium">{stats.totalSpent.toFixed(2)} €</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Primera reserva:</span> <span>{stats.first ? format(parseISO(stats.first), "dd/MM/yyyy") : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Última reserva:</span> <span>{stats.last ? format(parseISO(stats.last), "dd/MM/yyyy") : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Canal más usado:</span> <span>{stats.topChannel}</span></div>
                </>
              ) : (
                <p className="text-muted-foreground">Sin reservas registradas.</p>
              )}
            </CardContent>
          </Card>

          {/* Block 4 - Reservations history */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Historial de reservas</CardTitle></CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin reservas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Fechas</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((r: any) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/reservas/${r.id}`)}
                      >
                        <TableCell className="font-mono text-xs">{r.reservation_number ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.pickup_date ? format(parseISO(r.pickup_date), "dd/MM/yy") : "—"}
                          {" → "}
                          {r.return_date ? format(parseISO(r.return_date), "dd/MM/yy") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{(r.vehicle_categories as any)?.name ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_amount != null ? `${Number(r.total_amount).toFixed(2)} €` : "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog (same as list) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={editForm.first_name ?? ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Apellidos *</Label>
                <Input value={editForm.last_name ?? ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo documento</Label>
                <Select value={editForm.id_type ?? ""} onValueChange={(v) => setEditForm({ ...editForm, id_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº documento</Label>
                <Input value={editForm.id_number ?? ""} onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Nacionalidad</Label>
              <Input value={editForm.nationality ?? ""} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº licencia conducir</Label>
                <Input value={editForm.license_number ?? ""} onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })} />
              </div>
              <div>
                <Label>Caducidad carnet</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editForm.license_expiry && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {editForm.license_expiry ? format(parseISO(editForm.license_expiry), "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editForm.license_expiry ? parseISO(editForm.license_expiry) : undefined}
                      onSelect={(d) => setEditForm({ ...editForm, license_expiry: d ? format(d, "yyyy-MM-dd") : "" })}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={editForm.is_company ?? false} onCheckedChange={(v) => setEditForm({ ...editForm, is_company: v })} />
              <Label>¿Es empresa?</Label>
            </div>
            {editForm.is_company && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre empresa</Label>
                  <Input value={editForm.company_name ?? ""} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} />
                </div>
                <div>
                  <Label>CIF/VAT</Label>
                  <Input value={editForm.company_vat ?? ""} onChange={(e) => setEditForm({ ...editForm, company_vat: e.target.value })} />
                </div>
              </div>
            )}
            <Button onClick={saveEdit} disabled={saving} className="mt-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
