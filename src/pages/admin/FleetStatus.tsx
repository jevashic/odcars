import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { RefreshCw, Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { es } from "date-fns/locale";

type VehicleStatus = "available" | "rented" | "maintenance" | "inactive";

interface FleetVehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  status: VehicleStatus;
  mileage: number;
  category_id: string;
  vehicle_categories: { name: string } | null;
  reservations: {
    id?: string;
    reservation_number: string;
    status: string;
    start_date: string;
    end_date: string;
    customer_id: string;
    customers: { first_name: string; last_name: string; phone: string } | null;
  }[];
}

const STATUS_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  available: { label: "Disponible", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  rented: { label: "Alquilado", className: "bg-[#0D3B5E]/10 text-[#0D3B5E] hover:bg-[#0D3B5E]/10" },
  maintenance: { label: "Mantenimiento", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  inactive: { label: "Inactivo", className: "bg-gray-100 text-gray-500 hover:bg-gray-100" },
};

const FILTERS: { key: VehicleStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "available", label: "Disponibles" },
  { key: "rented", label: "Alquilados" },
  { key: "maintenance", label: "Mantenimiento" },
  { key: "inactive", label: "Inactivos" },
];

function getReturnDateDisplay(dateStr: string | undefined) {
  if (!dateStr) return <span className="text-muted-foreground">—</span>;
  const d = parseISO(dateStr);
  if (isToday(d)) return <span className="text-destructive font-bold">HOY</span>;
  if (isTomorrow(d)) return <span className="text-orange-600">MAÑANA</span>;
  if (isPast(d)) return <span className="text-destructive font-bold">VENCIDO</span>;
  return <span>{format(d, "dd/MM/yyyy", { locale: es })}</span>;
}

export default function FleetStatus() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VehicleStatus | "all">("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id, plate, brand, model, year, color,
          status, mileage, category_id,
          vehicle_categories(name),
          reservations(
            id, reservation_number, status,
            start_date, end_date, customer_id,
            customers(first_name, last_name, phone)
          )
        `)
        .order("status");

      if (error) throw error;

      // Filter reservations client-side to only active ones
      const processed = (data || []).map((v: any) => ({
        ...v,
        reservations: (v.reservations || []).filter((r: any) =>
          ["pending", "confirmed", "active"].includes(r.status)
        ),
      })) as FleetVehicle[];

      setVehicles(processed);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const counts = {
    all: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    rented: vehicles.filter((v) => v.status === "rented").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    inactive: vehicles.filter((v) => v.status === "inactive").length,
  };

  const filtered = filter === "all" ? vehicles : vehicles.filter((v) => v.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Estado de la Flota</h1>
        <Button onClick={fetchData} variant="outline" disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          ACTUALIZAR
        </Button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="bg-white rounded-lg px-4 py-2 shadow-sm text-sm font-medium">
          Total: <span className="font-bold">{counts.all}</span>
        </div>
        <div className="bg-emerald-50 rounded-lg px-4 py-2 shadow-sm text-sm font-medium text-emerald-700">
          Disponibles: <span className="font-bold">{counts.available}</span>
        </div>
        <div className="bg-[#0D3B5E]/5 rounded-lg px-4 py-2 shadow-sm text-sm font-medium text-[#0D3B5E]">
          Alquilados: <span className="font-bold">{counts.rented}</span>
        </div>
        <div className="bg-orange-50 rounded-lg px-4 py-2 shadow-sm text-sm font-medium text-orange-700">
          Mantenimiento: <span className="font-bold">{counts.maintenance}</span>
        </div>
        <div className="bg-gray-100 rounded-lg px-4 py-2 shadow-sm text-sm font-medium text-gray-500">
          Inactivos: <span className="font-bold">{counts.inactive}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matrícula</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Km</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Devolución</TableHead>
              <TableHead>Nº Reserva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No hay vehículos en esta categoría
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((v) => {
                const activeRes = v.reservations?.[0];
                const customer = activeRes?.customers;
                const statusCfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.inactive;

                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-bold">{v.plate}</TableCell>
                    <TableCell>{v.brand} {v.model} {v.year}</TableCell>
                    <TableCell>{v.vehicle_categories?.name || "—"}</TableCell>
                    <TableCell>{v.color || "—"}</TableCell>
                    <TableCell>{v.mileage?.toLocaleString() ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {customer ? (
                        <div>
                          <p className="text-sm">{customer.first_name} {customer.last_name}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.status === "rented" && activeRes
                        ? getReturnDateDisplay(activeRes.end_date)
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {activeRes ? (
                        <Link
                          to={`/admin/reservas/${activeRes.id || activeRes.reservation_number}`}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          {activeRes.reservation_number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
