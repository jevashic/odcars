import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Loader2, ArrowLeft, Save, XCircle, User } from "lucide-react";
import CheckoutBlock from "@/components/admin/CheckoutBlock";
import ReturnBlock from "@/components/admin/ReturnBlock";
import VehicleAssignmentBlock from "@/components/admin/VehicleAssignmentBlock";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

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

const CHANNEL_MAP: Record<string, string> = {
  web: "🌐 Web",
  office_sale: "🏢 Oficina",
  office_pickup: "🚗 Entrega",
  office_dropoff: "🔑 Devolución",
  office: "🏢 Oficina",
};

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_log").insert({
    performed_by: userId, action, table_name: tableName, record_id: recordId,
    old_data: oldData as any, new_data: newData as any,
  });
}

/* ── Component ──────────────────────────────────────── */

export default function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  // Action state
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);

  // (Return form state removed — now in ReturnBlock component)

  // Cancel form
  const [cancelReason, setCancelReason] = useState("");

  /* ── Main query ──────────────────────────────────── */

  const { data: reservation, isLoading } = useQuery({
    queryKey: ["admin-reservation-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          *,
          customers(*),
          vehicle_categories(id, name, image_url),
          vehicles(id, plate, brand, model),
          reservation_extras(extra_name, quantity, unit_price, subtotal),
          payments(method, status, amount, payment_type)
        `)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Load notes once
  if (reservation && !notesLoaded) {
    setNotes(reservation.internal_notes ?? "");
    setNotesLoaded(true);
  }

  /* ── Extras & insurance (separate queries to avoid FK issues) ── */

  const { data: resExtras = [] } = useQuery({
    queryKey: ["admin-res-extras", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservation_extras")
        .select("*, extras(id, name, price_per_reservation)")
        .eq("reservation_id", id!);
      if (error) { console.warn("reservation_extras:", error.message); return []; }
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: resInsurance = [] } = useQuery({
    queryKey: ["admin-res-insurance", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservation_insurance")
        .select("*, insurance_plans(id, name, price_per_day)")
        .eq("reservation_id", id!);
      if (error) { console.warn("reservation_insurance:", error.message); return []; }
      return data ?? [];
    },
    enabled: !!id,
  });

  /* ── Available vehicles for assignment ───────────── */

  /* (Available vehicles query moved to CheckoutBlock) */

  /* ── Audit log ───────────────────────────────────── */

  const { data: auditLog = [] } = useQuery({
    queryKey: ["admin-audit-reservation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("record_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  /* ── Payments query ────────────────────────────────── */

  const { data: payments = [] } = useQuery({
    queryKey: ["admin-res-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("reservation_id", id!);
      if (error) { console.warn("payments:", error.message); return []; }
      return data ?? [];
    },
    enabled: !!id,
  });

  /* ── Actions ─────────────────────────────────────── */

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-reservation-detail", id] });
    qc.invalidateQueries({ queryKey: ["admin-audit-reservation", id] });
    qc.invalidateQueries({ queryKey: ["admin-reservations"] });
  };

  // (activateReservation & completeReturn moved to CheckoutBlock / ReturnBlock)

  const cancelReservation = async () => {
    if (!user || !reservation) return;
    if (!cancelReason.trim()) {
      toast({ title: "El motivo es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error: e1 } = await supabase
        .from("reservations")
        .update({ status: "cancelled", cancellation_reason: cancelReason })
        .eq("id", reservation.id);
      if (e1) throw e1;

      if (reservation.vehicle_id) {
        await supabase.from("vehicles").update({ status: "available" }).eq("id", reservation.vehicle_id);
      }

      await writeAudit(user.id, "update", "reservations", reservation.id,
        { status: reservation.status },
        { status: "cancelled", cancellation_reason: cancelReason }
      );
      invalidateAll();
      toast({ title: "Reserva cancelada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!user || !reservation) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reservations").update({ internal_notes: notes }).eq("id", reservation.id);
      if (error) throw error;
      await writeAudit(user.id, "update", "reservations", reservation.id,
        { internal_notes: reservation.internal_notes },
        { internal_notes: notes }
      );
      invalidateAll();
      toast({ title: "Nota guardada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ──────────────────────────────────────── */

  if (isLoading || !reservation) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const r = reservation as any;
  const days = r.start_date && r.end_date
    ? Math.max(1, differenceInDays(parseISO(r.end_date), parseISO(r.start_date)))
    : 0;
  const customer = r.customers;
  const pricePerDay = r.price_per_day ?? (r.total_amount && days ? r.total_amount / days : 0);
  const subtotalRent = pricePerDay * days;
  const extrasTotal = resExtras.reduce((sum: number, re: any) => sum + (re.extras?.price_per_reservation ?? 0), 0);
  const insuranceTotal = resInsurance.reduce((sum: number, ri: any) => sum + ((ri.insurance_plans?.price_per_day ?? 0) * days), 0);
  const subtotal = subtotalRent + extrasTotal + insuranceTotal;
  const igic = subtotal * 0.07;

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/reservas" onClick={(e) => { e.preventDefault(); navigate("/admin/reservas"); }}>
              Reservas
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{r.reservation_number ?? r.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/reservas")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Reserva {r.reservation_number}</h1>
        {statusBadge(r.status)}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT (2/3) ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Block 1 - Reservation data */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Datos de la reserva</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Nº Reserva:</span> <span className="font-medium">{r.reservation_number ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Canal:</span> {CHANNEL_MAP[r.sale_channel] ?? r.sale_channel ?? "—"}</div>
              <div><span className="text-muted-foreground">Recogida:</span> {r.start_date ? `${format(parseISO(r.start_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}${r.pickup_time ? ` · ${r.pickup_time}h` : ""}` : "—"}</div>
              <div><span className="text-muted-foreground">Devolución:</span> {r.end_date ? `${format(parseISO(r.end_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}${r.return_time ? ` · ${r.return_time}h` : ""}` : "—"}</div>
              <div><span className="text-muted-foreground">Días:</span> {days}</div>
              <div><span className="text-muted-foreground">Categoría:</span> {r.vehicle_categories?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">Vehículo:</span> {r.vehicles ? `${r.vehicles.brand} ${r.vehicles.model} (${r.vehicles.plate})` : <span className="text-muted-foreground">Sin asignar</span>}</div>
              <div><span className="text-muted-foreground">Entrega:</span> {r.delivery_details ? JSON.stringify(r.delivery_details) : "—"}</div>
              <div><span className="text-muted-foreground">Cargo entrega:</span> {r.delivery_charge != null ? `${Number(r.delivery_charge).toFixed(2)} €` : "—"}</div>
              {resInsurance.length > 0 && (
                <div className="col-span-2"><span className="text-muted-foreground">Seguro:</span> {resInsurance.map((ri: any) => ri.insurance_plans?.name).filter(Boolean).join(", ") || "—"}</div>
              )}
              {resExtras.length > 0 && (
                <div className="col-span-2"><span className="text-muted-foreground">Extras:</span> {resExtras.map((re: any) => re.extras?.name).filter(Boolean).join(", ") || "—"}</div>
              )}
            </CardContent>
          </Card>

          {/* Block 2 - Customer */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Datos del cliente</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{customer?.first_name} {customer?.last_name}</span></div>
              <div><span className="text-muted-foreground">Email:</span> {customer?.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Teléfono:</span> {customer?.phone ?? "—"}</div>
              <div><span className="text-muted-foreground">Nº Carnet:</span> {customer?.license_number ?? "—"}</div>
              <div><span className="text-muted-foreground">Caducidad carnet:</span> {customer?.license_expiry ? format(parseISO(customer.license_expiry), "dd/MM/yyyy") : "—"}</div>
              {customer?.id && (
                <div className="col-span-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/clientes/${customer.id}`)} className="gap-1.5">
                    <User className="h-4 w-4" /> Ver ficha cliente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Block 3 - Financial */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Desglose económico</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Precio/día:</span> <span>{pricePerDay.toFixed(2)} €</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal alquiler ({days} días):</span> <span>{subtotalRent.toFixed(2)} €</span></div>
              {resExtras.map((re: any) => (
                <div key={re.id} className="flex justify-between"><span className="text-muted-foreground">Extra: {re.extras?.name}</span> <span>{(re.extras?.price_per_reservation ?? 0).toFixed(2)} €</span></div>
              ))}
              {resInsurance.map((ri: any) => (
                <div key={ri.id} className="flex justify-between"><span className="text-muted-foreground">Seguro: {ri.insurance_plans?.name}</span> <span>{((ri.insurance_plans?.price_per_day ?? 0) * days).toFixed(2)} €</span></div>
              ))}
              {r.discount_amount != null && r.discount_amount > 0 && (
                <div className="flex justify-between text-green-700"><span>Descuento:</span> <span>-{Number(r.discount_amount).toFixed(2)} €</span></div>
              )}
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">IGIC 7%:</span> <span>{igic.toFixed(2)} €</span></div>
              <div className="flex justify-between font-bold text-base"><span>Total:</span> <span>{r.total_amount != null ? `${Number(r.total_amount).toFixed(2)} €` : `${(subtotal + igic).toFixed(2)} €`}</span></div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Forma de pago:</span>
                <div className="flex items-center gap-2">
                  <span>{r.payment_method ?? "—"}</span>
                  {payments.some((p: any) => p.payment_type === "signal")
                    ? <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Pagado online</Badge>
                    : <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">Pendiente de cobro</Badge>}
                </div>
              </div>
              {r.stripe_payment_intent_id && (
                <div className="flex justify-between"><span className="text-muted-foreground">Stripe ID:</span> <span className="font-mono text-xs">{r.stripe_payment_intent_id}</span></div>
              )}
            </CardContent>
          </Card>

          {/* Block 4 - Payments */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Historial de pagos</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payments.length === 0 ? (
                <p className="text-muted-foreground">Sin pagos registrados.</p>
              ) : (
                payments.map((p: any, idx: number) => (
                  <div key={p.id ?? idx} className="flex justify-between">
                    <span className="text-muted-foreground">{p.payment_type ?? p.method ?? "—"} ({p.status})</span>
                    <span className="font-medium">{p.amount != null ? `${Number(p.amount).toFixed(2)} €` : "—"}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT (1/3) ═══ */}
        <div className="space-y-6">
          {/* Vehicle assignment block */}
          {user && (r.status === "pending" || r.status === "confirmed" || r.status === "active") && (
            <VehicleAssignmentBlock reservation={r} userId={user.id} onComplete={invalidateAll} />
          )}

          {/* Checkout block — visible when confirmed or active (but pickup not yet done) */}
          {(r.status === "confirmed" || r.status === "active") && user && (
            <CheckoutBlock reservation={r} userId={user.id} onComplete={invalidateAll} />
          )}

          {/* Return block — visible when active */}
          {r.status === "active" && user && (
            <ReturnBlock reservation={r} userId={user.id} onComplete={invalidateAll} />
          )}

          {(r.status === "pending" || r.status === "confirmed") && (
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Cancelar reserva</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Motivo de cancelación *</Label>
                  <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="Indica el motivo…" />
                </div>
                <Button variant="destructive" className="w-full" onClick={cancelReservation} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  CANCELAR RESERVA
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Block 5 - Internal notes */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Notas internas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Notas internas de la reserva…" />
              <Button className="w-full" variant="outline" onClick={saveNotes} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> GUARDAR NOTA
              </Button>
            </CardContent>
          </Card>

          {/* Block 6 - Audit log */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Historial de cambios</CardTitle></CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {auditLog.map((entry: any) => (
                    <div key={entry.id} className="border-b pb-2 last:border-0">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{format(parseISO(entry.created_at), "dd/MM/yy HH:mm", { locale: es })}</span>
                        <span>{entry.performed_by?.slice(0, 8)}…</span>
                      </div>
                      <p className="text-sm font-medium">{entry.action}</p>
                      {entry.new_data && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {typeof entry.new_data === "object"
                            ? Object.entries(entry.new_data).map(([k, v]) => `${k}: ${v}`).join(" · ")
                            : String(entry.new_data)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
