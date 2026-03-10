import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ---------- helpers ----------
const fmtDate = (d: string) => {
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
};

const fmtTime = (t: string | null) => {
  if (!t) return "—";
  return t.substring(0, 5) + "h";
};

const daysUntil = (d: string) => {
  const diff = differenceInDays(parseISO(d), new Date());
  if (diff < 0) return <span className="text-destructive font-bold">Vencido ({Math.abs(diff)}d)</span>;
  if (diff === 0) return <span className="text-destructive font-bold">HOY</span>;
  if (diff === 1) return <span className="text-orange-500 font-semibold">Mañana</span>;
  return <span>{diff} días</span>;
};

// ---------- queries ----------
function useUnassigned() {
  return useQuery({
    queryKey: ["movements-unassigned"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, reservation_number, start_date, vehicle_categories(name), customers(first_name, last_name, phone)")
        .is("vehicle_id", null)
        .eq("status", "pending")
        .order("start_date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePickups(date: string) {
  return useQuery({
    queryKey: ["movements-pickups", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, reservation_number, start_date, pickup_time, vehicles(plate, brand, model), customers(first_name, last_name, phone), pickup_locations(name)")
        .eq("start_date", date)
        .in("status", ["pending", "confirmed", "active"])
        .order("pickup_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useReturns(date: string) {
  return useQuery({
    queryKey: ["movements-returns", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, reservation_number, end_date, return_time, vehicles(plate, brand, model), customers(first_name, last_name, phone), return_locations(name)")
        .eq("end_date", date)
        .in("status", ["pending", "confirmed", "active"])
        .order("return_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- search helper ----------
function filterBySearch<T extends Record<string, any>>(rows: T[], q: string): T[] {
  if (!q.trim()) return rows;
  const lower = q.toLowerCase();
  return rows.filter((r) => {
    const num = (r.reservation_number ?? "").toLowerCase();
    const c = r.customers as any;
    const name = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase() : "";
    const phone = c?.phone?.toLowerCase() ?? "";
    return num.includes(lower) || name.includes(lower) || phone.includes(lower);
  });
}

// ---------- component ----------
export default function Movements() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const unassigned = useUnassigned();
  const pickups = usePickups(dateStr);
  const returns = useReturns(dateStr);

  const [searchUnassigned, setSearchUnassigned] = useState("");
  const [searchPickups, setSearchPickups] = useState("");
  const [searchReturns, setSearchReturns] = useState("");

  const filteredUnassigned = useMemo(() => filterBySearch(unassigned.data ?? [], searchUnassigned), [unassigned.data, searchUnassigned]);
  const filteredPickups = useMemo(() => filterBySearch(pickups.data ?? [], searchPickups), [pickups.data, searchPickups]);
  const filteredReturns = useMemo(() => filterBySearch(returns.data ?? [], searchReturns), [returns.data, searchReturns]);

  const refreshAll = () => { unassigned.refetch(); pickups.refetch(); returns.refetch(); };
  const loading = unassigned.isLoading || pickups.isLoading || returns.isLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Movimientos</h1>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd 'de' MMMM yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* SECTION 1 — Unassigned */}
      <section className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">RESERVAS SIN VEHÍCULO ASIGNADO</h2>
            <Badge variant="destructive">{filteredUnassigned.length}</Badge>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar…" className="pl-9" value={searchUnassigned} onChange={(e) => setSearchUnassigned(e.target.value)} />
          </div>
        </div>
        {unassigned.isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : filteredUnassigned.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Sin reservas pendientes de asignación</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Reserva</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha Recogida</TableHead>
                  <TableHead>Días Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnassigned.map((r: any) => {
                  const c = r.customers as any;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/admin/reservas/${r.id}`} className="text-primary font-semibold hover:underline">{r.reservation_number}</Link>
                      </TableCell>
                      <TableCell>{c ? `${c.first_name} ${c.last_name}` : "—"}</TableCell>
                      <TableCell>{c?.phone ?? "—"}</TableCell>
                      <TableCell>{(r.vehicle_categories as any)?.name ?? "—"}</TableCell>
                      <TableCell>{fmtDate(r.start_date)}</TableCell>
                      <TableCell>{daysUntil(r.start_date)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* SECTION 2 — Pickups */}
      <section className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">ENTREGAS</h2>
            <span className="text-sm text-muted-foreground">{format(selectedDate, "dd/MM/yyyy")}</span>
            <Badge>{filteredPickups.length}</Badge>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar…" className="pl-9" value={searchPickups} onChange={(e) => setSearchPickups(e.target.value)} />
          </div>
        </div>
        {pickups.isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : filteredPickups.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Sin entregas para esta fecha</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Reserva</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Lugar Recogida</TableHead>
                  <TableHead>Hora Recogida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPickups.map((r: any) => {
                  const c = r.customers as any;
                  const v = r.vehicles as any;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/admin/reservas/${r.id}`} className="text-primary font-semibold hover:underline">{r.reservation_number}</Link>
                      </TableCell>
                      <TableCell>{c ? `${c.first_name} ${c.last_name}` : "—"}</TableCell>
                      <TableCell>{c?.phone ?? "—"}</TableCell>
                      <TableCell>
                        {v ? <><span className="font-semibold">{v.plate}</span> <span className="text-muted-foreground">{v.brand} {v.model}</span></> : "—"}
                      </TableCell>
                      <TableCell>{(r.pickup_locations as any)?.name ?? "—"}</TableCell>
                      <TableCell>{fmtTime(r.pickup_time)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* SECTION 3 — Returns */}
      <section className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">DEVOLUCIONES</h2>
            <span className="text-sm text-muted-foreground">{format(selectedDate, "dd/MM/yyyy")}</span>
            <Badge>{filteredReturns.length}</Badge>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar…" className="pl-9" value={searchReturns} onChange={(e) => setSearchReturns(e.target.value)} />
          </div>
        </div>
        {returns.isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : filteredReturns.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Sin devoluciones para esta fecha</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Reserva</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Lugar Devolución</TableHead>
                  <TableHead>Hora Devolución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((r: any) => {
                  const c = r.customers as any;
                  const v = r.vehicles as any;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/admin/reservas/${r.id}`} className="text-primary font-semibold hover:underline">{r.reservation_number}</Link>
                      </TableCell>
                      <TableCell>{c ? `${c.first_name} ${c.last_name}` : "—"}</TableCell>
                      <TableCell>{c?.phone ?? "—"}</TableCell>
                      <TableCell>
                        {v ? <><span className="font-semibold">{v.plate}</span> <span className="text-muted-foreground">{v.brand} {v.model}</span></> : "—"}
                      </TableCell>
                      <TableCell>{(r.return_locations as any)?.name ?? "—"}</TableCell>
                      <TableCell>{fmtTime(r.return_time)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
