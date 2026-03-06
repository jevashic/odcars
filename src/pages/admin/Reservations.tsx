import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Eye, ChevronDown, CalendarDays } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ── Constants ──────────────────────────────────────── */

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "active", label: "En curso" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No presentado" },
] as const;

const CHANNEL_MAP: Record<string, { icon: string; label: string }> = {
  web: { icon: "🌐", label: "Web" },
  office_sale: { icon: "🏢", label: "Oficina" },
  office_pickup: { icon: "🚗", label: "Entrega" },
  office_dropoff: { icon: "🔑", label: "Devolución" },
  office: { icon: "🏢", label: "Oficina" },
};

const statusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Pendiente</Badge>;
    case "confirmed":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Confirmada</Badge>;
    case "active":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">En curso</Badge>;
    case "completed":
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100">Completada</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelada</Badge>;
    case "no_show":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">No presentado</Badge>;
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

export default function AdminReservations() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");

  /* ── Categories for filter ───────────────────────── */

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

  /* ── Main query ──────────────────────────────────── */

  const { data: resData, isLoading } = useQuery({
    queryKey: ["admin-reservations", page, statusFilter, channelFilter, categoryFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select(
          `id, reservation_number, status, start_date, end_date, pickup_date, return_date, total_amount, sale_channel, created_at, payment_method, customers(id, first_name, last_name, email, phone), vehicle_categories(id, name), vehicles(id, license_plate, brand, model)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (channelFilter !== "all") query = query.eq("sale_channel", channelFilter);
      if (categoryFilter !== "all") query = query.eq("category_id", categoryFilter);
      if (dateFrom) query = query.gte("pickup_date", dateFrom.toISOString());
      if (dateTo) query = query.lte("pickup_date", dateTo.toISOString());

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { reservations: data ?? [], total: count ?? 0 };
    },
  });

  const reservations = resData?.reservations ?? [];
  const totalCount = resData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ── Client-side search ──────────────────────────── */

  const filtered = search
    ? reservations.filter((r: any) => {
        const q = search.toLowerCase();
        const name = `${r.customers?.first_name ?? ""} ${r.customers?.last_name ?? ""}`.toLowerCase();
        return (
          (r.reservation_number ?? "").toLowerCase().includes(q) ||
          name.includes(q) ||
          (r.customers?.email ?? "").toLowerCase().includes(q)
        );
      })
    : reservations;

  /* ── Status change ───────────────────────────────── */

  const changeStatus = async (reservation: any, newStatus: string) => {
    if (!user) return;
    try {
      const oldStatus = reservation.status;
      const { error } = await supabase
        .from("reservations")
        .update({ status: newStatus })
        .eq("id", reservation.id);
      if (error) throw error;
      await writeAudit(user.id, "update", "reservations", reservation.id, { status: oldStatus }, { status: newStatus });
      qc.invalidateQueries({ queryKey: ["admin-reservations"] });
      toast({ title: "Estado actualizado", description: `Reserva cambiada a ${STATUS_OPTIONS.find((s) => s.value === newStatus)?.label ?? newStatus}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  /* ── Reset filters ───────────────────────────────── */

  const resetFilters = () => {
    setStatusFilter("all");
    setChannelFilter("all");
    setCategoryFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch("");
    setPage(0);
  };

  /* ── Render ──────────────────────────────────────── */

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
        <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
        <Button onClick={() => navigate("/admin/reservas/nueva")}>+ Nueva reserva</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Buscar nº, nombre o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            <SelectItem value="web">🌐 Web</SelectItem>
            <SelectItem value="office_sale">🏢 Oficina</SelectItem>
            <SelectItem value="office_pickup">🚗 Entrega</SelectItem>
            <SelectItem value="office_dropoff">🔑 Devolución</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yy") : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} locale={es} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yy") : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} locale={es} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {(statusFilter !== "all" || channelFilter !== "all" || categoryFilter !== "all" || dateFrom || dateTo || search) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar filtros</Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Reserva</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead className="text-center">Días</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No se encontraron reservas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: any) => {
                const days = r.pickup_date && r.return_date
                  ? Math.max(1, differenceInDays(parseISO(r.return_date), parseISO(r.pickup_date)))
                  : 0;
                const channel = CHANNEL_MAP[r.sale_channel] ?? { icon: "📋", label: r.sale_channel ?? "—" };

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-medium">{r.reservation_number ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.customers?.first_name} {r.customers?.last_name}</div>
                      <div className="text-xs text-muted-foreground">{r.customers?.email}</div>
                    </TableCell>
                    <TableCell>{r.vehicle_categories?.name ?? "—"}</TableCell>
                    <TableCell>{r.vehicles?.license_plate ?? <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                    <TableCell className="text-xs">
                      {r.pickup_date ? format(parseISO(r.pickup_date), "dd/MM/yy") : "—"}
                      {" → "}
                      {r.return_date ? format(parseISO(r.return_date), "dd/MM/yy") : "—"}
                    </TableCell>
                    <TableCell className="text-center">{days}</TableCell>
                    <TableCell className="text-right font-medium">{r.total_amount != null ? `${Number(r.total_amount).toFixed(2)} €` : "—"}</TableCell>
                    <TableCell>{channel.icon} {channel.label}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/reservas/${r.id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STATUS_OPTIONS.map((s) => (
                              <DropdownMenuItem
                                key={s.value}
                                disabled={r.status === s.value}
                                onClick={() => changeStatus(r, s.value)}
                              >
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          <p className="text-sm text-muted-foreground">
            {totalCount} reserva{totalCount !== 1 ? "s" : ""} · Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
