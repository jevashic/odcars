import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, Search, History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const MODULE_LABELS: Record<string, string> = {
  vehicle_categories: "Categorías",
  vehicles: "Flota",
  extras: "Extras",
  discount_codes: "Descuentos",
  insurance_plans: "Seguros",
  branches: "Oficinas",
  internal_users: "Usuarios",
  customers: "Clientes",
  reservations: "Reservas",
  invoices: "Facturación",
  brand_config: "Branding",
  tourist_places: "Conoce Gran Canaria",
  newsletter_subscribers: "Newsletter",
};

const ACTION_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Creado", variant: "default" },
  update: { label: "Modificado", variant: "secondary" },
  delete: { label: "Eliminado", variant: "destructive" },
};

interface AuditRow {
  id: string;
  performed_by: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_name?: string;
}

interface InternalUser {
  id: string;
  full_name: string | null;
}

export default function AuditHistory() {
  const { user } = useAdminAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<InternalUser[]>([]);

  // Filters
  const [filterAction, setFilterAction] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterRecordId, setFilterRecordId] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Detail modal
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    supabase
      .from("internal_users")
      .select("id, full_name")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setUsers(data);
      });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filterAction !== "all") q = q.eq("action", filterAction);
    if (filterModule !== "all") q = q.eq("table_name", filterModule);
    if (filterUser !== "all") q = q.eq("performed_by", filterUser);
    if (filterRecordId.trim()) q = q.eq("record_id", filterRecordId.trim());
    if (dateFrom) q = q.gte("created_at", dateFrom.toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }

    const { data, error, count } = await q;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Map user names
    const enriched = (data ?? []).map((r) => {
      const u = users.find((u) => u.id === r.performed_by);
      return { ...r, user_name: u?.full_name ?? r.performed_by ?? "—" } as AuditRow;
    });

    setRows(enriched);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (users.length > 0 || page > 0) fetchData();
  }, [page, users]);

  useEffect(() => {
    setPage(0);
    fetchData();
  }, [filterAction, filterModule, filterUser, filterRecordId, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const moduleOptions = useMemo(() => {
    return Object.entries(MODULE_LABELS).map(([k, v]) => ({ value: k, label: v }));
  }, []);

  const exportCSV = () => {
    if (!rows.length) return;
    const header = "fecha,usuario,accion,modulo,record_id";
    const csvRows = rows.map((r) =>
      [
        r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "",
        `"${(r.user_name ?? "").replace(/"/g, '""')}"`,
        r.action,
        MODULE_LABELS[r.table_name] ?? r.table_name,
        r.record_id ?? "",
      ].join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ActionBadge = ({ action }: { action: string }) => {
    const cfg = ACTION_CONFIG[action] ?? { label: action, variant: "outline" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Historial de Cambios</h1>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            <SelectItem value="create">Crear</SelectItem>
            <SelectItem value="update">Modificar</SelectItem>
            <SelectItem value="delete">Eliminar</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los módulos</SelectItem>
            {moduleOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID registro"
            value={filterRecordId}
            onChange={(e) => setFilterRecordId(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>ID registro</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No se encontraron registros.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.user_name}</TableCell>
                  <TableCell><ActionBadge action={r.action} /></TableCell>
                  <TableCell className="text-sm">{MODULE_LABELS[r.table_name] ?? r.table_name}</TableCell>
                  <TableCell className="text-xs font-mono max-w-[120px] truncate">{r.record_id ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {r.new_data ? JSON.stringify(r.new_data).slice(0, 80) + "…" : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {total} registros · Página {page + 1} de {totalPages}
          </span>
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

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle del cambio
              {selected && <ActionBadge action={selected.action} />}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Fecha y hora</p>
                  <p className="font-medium">
                    {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium">{selected.user_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Módulo</p>
                  <p className="font-medium">{MODULE_LABELS[selected.table_name] ?? selected.table_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ID del registro</p>
                  <p className="font-mono text-xs">{selected.record_id ?? "—"}</p>
                </div>
              </div>

              {selected.old_data && (
                <div>
                  <p className="text-muted-foreground mb-1">Datos anteriores</p>
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selected.new_data && (
                <div>
                  <p className="text-muted-foreground mb-1">Datos nuevos</p>
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
