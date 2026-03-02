import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, CalendarIcon, Search, Eye, Printer, Ban } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface Invoice {
  id: string;
  invoice_number: string;
  status: "draft" | "issued" | "sent" | "void";
  total_amount: number;
  issued_at: string | null;
  created_at: string;
  void_reason: string | null;
  reservation_id: string | null;
  customer_id: string | null;
  line_items: any[] | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  reservations: { reservation_number: string } | null;
  customers: { id: string; first_name: string; last_name: string; email: string } | null;
}

const PAGE_SIZE = 15;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  issued: { label: "Emitida", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  sent: { label: "Enviada", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  void: { label: "Anulada", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

/* ── Audit helper ───────────────────────────────────── */

async function writeAudit(
  userId: string, action: string, tableName: string,
  recordId: string, oldData: unknown, newData: unknown
) {
  await supabase.from("audit_log").insert({
    performed_by: userId, action, table_name: tableName,
    record_id: recordId, old_data: oldData as any, new_data: newData as any,
  });
}

/* ── Main Component ─────────────────────────────────── */

export default function AdminInvoices() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // New invoice modal
  const [newOpen, setNewOpen] = useState(false);
  const [resSearch, setResSearch] = useState("");
  const [searchingRes, setSearchingRes] = useState(false);
  const [resResults, setResResults] = useState<any[]>([]);
  const [selectedRes, setSelectedRes] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  // Void dialog
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  /* ── Query ────────────────────────────────────────── */

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-invoices", page, statusFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select(`*, reservations(reservation_number), customers(id, first_name, last_name, email)`, { count: "exact" })
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (dateFrom) q = q.gte("created_at", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("created_at", format(dateTo, "yyyy-MM-dd") + "T23:59:59");

      q = q.range(from, to);
      const { data: rows, count, error } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as Invoice[], count: count ?? 0 };
    },
  });

  const invoices = data?.rows ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const s = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(s) ||
        inv.reservations?.reservation_number?.toLowerCase().includes(s) ||
        inv.customers?.email?.toLowerCase().includes(s)
    );
  }, [invoices, search]);

  /* ── Search reservations ──────────────────────────── */

  const searchReservations = useCallback(async () => {
    if (!resSearch.trim()) return;
    setSearchingRes(true);
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select(`*, customers(*), vehicle_categories(name), reservation_extras(*, extras(name, price_per_reservation)), reservation_insurance(*, insurance_plans(name, price_per_day))`)
        .ilike("reservation_number", `%${resSearch.trim()}%`)
        .limit(10);
      if (error) throw error;
      setResResults(data ?? []);
    } catch (err: any) {
      toast({ title: "Error buscando reservas", description: err.message, variant: "destructive" });
    } finally {
      setSearchingRes(false);
    }
  }, [resSearch]);

  /* ── Create invoice ───────────────────────────────── */

  const createInvoice = async () => {
    if (!selectedRes) return;
    setCreating(true);
    try {
      const res = selectedRes;
      const days = Math.max(1, differenceInDays(new Date(res.return_date), new Date(res.pickup_date)));
      const lineItems: any[] = [];

      // Rental line
      const rentalBase = res.total_price ?? (res.price_per_day ?? 0) * days;
      lineItems.push({
        concept: `Alquiler ${res.vehicle_categories?.name ?? "vehículo"} — ${days} día(s)`,
        type: "alquiler",
        base: rentalBase,
        igic: +(rentalBase * 0.07).toFixed(2),
        total: +(rentalBase * 1.07).toFixed(2),
      });

      // Extras
      if (res.reservation_extras?.length) {
        for (const re of res.reservation_extras) {
          const price = re.extras?.price_per_reservation ?? re.price ?? 0;
          lineItems.push({
            concept: re.extras?.name ?? "Extra",
            type: "extra",
            base: price,
            igic: +(price * 0.07).toFixed(2),
            total: +(price * 1.07).toFixed(2),
          });
        }
      }

      // Insurance
      if (res.reservation_insurance?.length) {
        for (const ri of res.reservation_insurance) {
          const price = (ri.insurance_plans?.price_per_day ?? 0) * days;
          lineItems.push({
            concept: ri.insurance_plans?.name ?? "Seguro",
            type: "seguro",
            base: price,
            igic: +(price * 0.07).toFixed(2),
            total: +(price * 1.07).toFixed(2),
          });
        }
      }

      const subtotal = lineItems.reduce((s, l) => s + l.base, 0);
      const taxAmount = lineItems.reduce((s, l) => s + l.igic, 0);
      const discountAmount = res.discount_amount ?? 0;
      const totalAmount = +(subtotal + taxAmount - discountAmount).toFixed(2);

      // Generate invoice number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .ilike("invoice_number", `FAC-${year}-%`);
      const seq = String((count ?? 0) + 1).padStart(4, "0");
      const invoiceNumber = `FAC-${year}-${seq}`;

      const payload: any = {
        invoice_number: invoiceNumber,
        status: "draft",
        reservation_id: res.id,
        customer_id: res.customer_id ?? res.customers?.id,
        line_items: lineItems,
        subtotal,
        tax_amount: +taxAmount.toFixed(2),
        discount_amount: discountAmount,
        total_amount: totalAmount,
      };

      const { data: created, error } = await supabase.from("invoices").insert(payload).select().single();
      if (error) throw error;
      if (user) await writeAudit(user.id, "insert", "invoices", created.id, null, created);

      toast({ title: "Factura creada como borrador" });
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      setNewOpen(false);
      setSelectedRes(null);
      setResSearch("");
      setResResults([]);
    } catch (err: any) {
      toast({ title: "Error al crear factura", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  /* ── Void invoice ─────────────────────────────────── */

  const voidInvoice = async () => {
    if (!voidTarget || !voidReason.trim()) {
      toast({ title: "Motivo de anulación obligatorio", variant: "destructive" });
      return;
    }
    setVoiding(true);
    try {
      const { error } = await supabase.from("invoices").update({ status: "void", void_reason: voidReason.trim() }).eq("id", voidTarget.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "update", "invoices", voidTarget.id, { status: voidTarget.status }, { status: "void", void_reason: voidReason.trim() });
      toast({ title: "Factura anulada" });
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      setVoidTarget(null);
      setVoidReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVoiding(false);
    }
  };

  /* ── Print ────────────────────────────────────────── */

  const handlePrint = (inv: Invoice) => {
    navigate(`/admin/facturacion/${inv.id}`);
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
        <h1 className="text-2xl font-bold text-primary">Facturación</h1>
        <Button onClick={() => { setNewOpen(true); setSelectedRes(null); setResSearch(""); setResResults([]); }}>
          <Plus className="h-4 w-4 mr-2" /> Nueva factura
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
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="issued">Emitida</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="void">Anulada</SelectItem>
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {dateFrom || dateTo ? (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setPage(0); }}>
            Limpiar fechas
          </Button>
        ) : null}

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº factura, nº reserva o email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Factura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Nº Reserva</TableHead>
              <TableHead>Fecha emisión</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay facturas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const badge = STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-semibold">{inv.invoice_number}</TableCell>
                    <TableCell>
                      {inv.customers ? `${inv.customers.first_name} ${inv.customers.last_name}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono">{inv.reservations?.reservation_number ?? "—"}</TableCell>
                    <TableCell>
                      {inv.issued_at ? format(new Date(inv.issued_at), "dd/MM/yyyy") : format(new Date(inv.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{inv.total_amount?.toFixed(2)} €</TableCell>
                    <TableCell className="text-center">
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/facturacion/${inv.id}`)} title="Ver factura">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(inv)} title="Imprimir PDF">
                          <Printer className="h-4 w-4" />
                        </Button>
                        {(inv.status === "issued" || inv.status === "sent") && (
                          <Button variant="ghost" size="icon" onClick={() => { setVoidTarget(inv); setVoidReason(""); }} title="Anular" className="text-destructive">
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">{totalCount} resultado{totalCount !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="flex items-center text-sm px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* ── New Invoice Modal ─────────────────────────── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva factura desde reserva</DialogTitle>
            <DialogDescription>Busca una reserva por su número para crear una factura.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <Input
                placeholder="Nº reserva…"
                value={resSearch}
                onChange={(e) => setResSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchReservations()}
                className="font-mono"
              />
              <Button onClick={searchReservations} disabled={searchingRes}>
                {searchingRes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {resResults.length > 0 && !selectedRes && (
              <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                {resResults.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedRes(r)}
                  >
                    <span className="font-mono font-semibold">{r.reservation_number}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {r.customers ? `${r.customers.first_name} ${r.customers.last_name}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedRes && (
              <div className="border rounded-md p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono font-semibold">{selectedRes.reservation_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRes.customers ? `${selectedRes.customers.first_name} ${selectedRes.customers.last_name} — ${selectedRes.customers.email}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRes(null)}>Cambiar</Button>
                </div>
                <p className="text-sm">
                  {selectedRes.pickup_date && selectedRes.return_date
                    ? `${format(new Date(selectedRes.pickup_date), "dd/MM/yyyy")} → ${format(new Date(selectedRes.return_date), "dd/MM/yyyy")}`
                    : ""}
                </p>
                <p className="text-sm">Categoría: {selectedRes.vehicle_categories?.name ?? "—"}</p>
                <p className="text-sm font-medium">Total reserva: {selectedRes.total_price?.toFixed(2) ?? "—"} €</p>

                <Button className="w-full mt-2" onClick={createInvoice} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  CREAR BORRADOR
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Void AlertDialog ──────────────────────────── */}
      <AlertDialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular factura {voidTarget?.invoice_number}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Introduce un motivo de anulación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo de anulación (obligatorio)…"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={voidInvoice} disabled={voiding || !voidReason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {voiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Anular factura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
