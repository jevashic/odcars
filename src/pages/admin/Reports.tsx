import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfQuarter, startOfYear } from "date-fns";
import { es } from "date-fns/locale";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CalendarIcon, Download, FileText, TrendingUp, Car, Wrench, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--cta))",
  "hsl(var(--secondary))",
  "hsl(var(--destructive))",
  "hsl(200, 60%, 50%)",
  "hsl(280, 50%, 50%)",
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  confirmed: { label: "Confirmada", variant: "default" },
  pending: { label: "Pendiente", variant: "outline" },
  active: { label: "Activa", variant: "default" },
  completed: { label: "Completada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  no_show: { label: "No show", variant: "destructive" },
};

export default function AdminReports() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const canDetailed = user?.role === "admin" || user?.role === "manager";

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Informes</h1>
      <Tabs defaultValue="operativo">
        <TabsList className="mb-6">
          <TabsTrigger value="operativo">Resumen Operativo</TabsTrigger>
          {canDetailed && <TabsTrigger value="detallado">Informes Detallados</TabsTrigger>}
        </TabsList>
        <TabsContent value="operativo">
          <OperativeSummary />
        </TabsContent>
        {canDetailed && (
          <TabsContent value="detallado">
            <DetailedReports />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ─── PESTAÑA 1: RESUMEN OPERATIVO ─── */

function OperativeSummary() {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd");

  const { data: todayKpis } = useQuery({
    queryKey: ["report_active_today"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_active_today").select("*").single();
      if (error) throw error;
      return data;
    },
  });

  const { data: salesByDay } = useQuery({
    queryKey: ["report_sales_by_day", thirtyDaysAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sales_by_day")
        .select("*")
        .gte("day", thirtyDaysAgo)
        .order("day");
      if (error) throw error;
      return data ?? [];
    },
  });

  const monthlyKpis = useMemo(() => {
    if (!salesByDay) return { reservations: 0, revenue: 0 };
    const monthData = salesByDay.filter((d: any) => d.day >= monthStart && d.day <= monthEnd);
    return {
      reservations: monthData.reduce((s: number, d: any) => s + (Number(d.reservation_count) || 0), 0),
      revenue: monthData.reduce((s: number, d: any) => s + (Number(d.revenue) || 0), 0),
    };
  }, [salesByDay, monthStart, monthEnd]);

  const { data: cancelledCount } = useQuery({
    queryKey: ["cancelled_count", monthStart, monthEnd],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd + "T23:59:59");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: noShowCount } = useQuery({
    queryKey: ["no_show_count", monthStart, monthEnd],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "no_show")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd + "T23:59:59");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["report_upcoming_reservations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_upcoming_reservations").select("*").limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const chartConfig = {
    revenue: { label: "Ingresos (€)", color: "hsl(var(--primary))" },
    reservation_count: { label: "Reservas", color: "hsl(var(--cta))" },
  };

  return (
    <div className="space-y-6">
      {/* KPIs del día */}
      <div>
        <h2 className="text-lg font-semibold text-primary mb-3">Hoy</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard icon={Activity} title="Reservas activas" value={todayKpis?.active_reservations ?? "–"} />
          <KpiCard icon={Car} title="Vehículos disponibles" value={todayKpis?.available_vehicles ?? "–"} />
          <KpiCard icon={Wrench} title="En taller" value={todayKpis?.vehicles_in_workshop ?? "–"} />
          <KpiCard icon={ArrowUpRight} title="Entregas hoy" value={todayKpis?.pending_pickups ?? "–"} />
          <KpiCard icon={ArrowDownRight} title="Devoluciones hoy" value={todayKpis?.pending_returns ?? "–"} />
        </div>
      </div>

      {/* KPIs del mes */}
      <div>
        <h2 className="text-lg font-semibold text-primary mb-3">Este mes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={FileText} title="Reservas del mes" value={monthlyKpis.reservations} />
          <KpiCard icon={TrendingUp} title="Ingresos del mes" value={`${monthlyKpis.revenue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`} />
          <KpiCard icon={ArrowDownRight} title="Canceladas" value={cancelledCount ?? "–"} color="destructive" />
          <KpiCard icon={ArrowDownRight} title="No show" value={noShowCount ?? "–"} color="destructive" />
        </div>
      </div>

      {/* Gráfico ventas por día */}
      <Card>
        <CardHeader><CardTitle>Ventas últimos 30 días</CardTitle></CardHeader>
        <CardContent>
          {salesByDay && salesByDay.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ComposedChart data={salesByDay} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tickFormatter={(v) => format(new Date(v), "dd/MM")} className="text-xs" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}€`} />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="reservation_count" stroke="hsl(var(--cta))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">Sin datos disponibles</p>
          )}
        </CardContent>
      </Card>

      {/* Próximas reservas */}
      <Card>
        <CardHeader><CardTitle>Próximas reservas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Reserva</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha recogida</TableHead>
                <TableHead>Oficina</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming && upcoming.length > 0 ? upcoming.map((r: any) => (
                <TableRow key={r.reservation_number || r.id}>
                  <TableCell className="font-mono">{r.reservation_number}</TableCell>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell>{r.category_name}</TableCell>
                  <TableCell>{r.pickup_date ? format(new Date(r.pickup_date), "dd/MM/yyyy") : "–"}</TableCell>
                  <TableCell>{r.branch_name ?? r.pickup_branch ?? "–"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_MAP[r.status]?.variant ?? "outline"}>
                      {STATUS_MAP[r.status]?.label ?? r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin reservas próximas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, color }: { icon: any; title: string; value: any; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-2", color === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── PESTAÑA 2: INFORMES DETALLADOS ─── */

function DetailedReports() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("current_month");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();

  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "previous_month": {
        const pm = subMonths(now, 1);
        return { dateFrom: format(startOfMonth(pm), "yyyy-MM-dd"), dateTo: format(endOfMonth(pm), "yyyy-MM-dd") };
      }
      case "current_quarter":
        return { dateFrom: format(startOfQuarter(now), "yyyy-MM-dd"), dateTo: format(now, "yyyy-MM-dd") };
      case "current_year":
        return { dateFrom: format(startOfYear(now), "yyyy-MM-dd"), dateTo: format(now, "yyyy-MM-dd") };
      case "custom":
        return {
          dateFrom: customFrom ? format(customFrom, "yyyy-MM-dd") : format(startOfMonth(now), "yyyy-MM-dd"),
          dateTo: customTo ? format(customTo, "yyyy-MM-dd") : format(now, "yyyy-MM-dd"),
        };
      default:
        return { dateFrom: format(startOfMonth(now), "yyyy-MM-dd"), dateTo: format(endOfMonth(now), "yyyy-MM-dd") };
    }
  }, [period, customFrom, customTo]);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Período</label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mes actual</SelectItem>
              <SelectItem value="previous_month">Mes anterior</SelectItem>
              <SelectItem value="current_quarter">Trimestre actual</SelectItem>
              <SelectItem value="current_year">Año actual</SelectItem>
              <SelectItem value="custom">Rango personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <DatePick label="Desde" date={customFrom} setDate={setCustomFrom} />
            <DatePick label="Hasta" date={customTo} setDate={setCustomTo} />
          </>
        )}
      </div>

      <SalesByChannel dateFrom={dateFrom} dateTo={dateTo} />
      <SalesByBranch dateFrom={dateFrom} dateTo={dateTo} />
      <SalesByPaymentMethod dateFrom={dateFrom} dateTo={dateTo} />
      <MonthlyAccounting />
    </div>
  );
}

function DatePick({ label, date, setDate }: { label: string; date?: Date; setDate: (d?: Date) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-muted-foreground mb-1 block">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy") : "Seleccionar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ─── Ventas por canal ─── */

function SalesByChannel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data } = useQuery({
    queryKey: ["report_sales_by_channel", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sales_by_channel")
        .select("*")
        .gte("day", dateFrom)
        .lte("day", dateTo);
      if (error) throw error;
      return data ?? [];
    },
  });

  const aggregated = useMemo(() => {
    if (!data?.length) return [];
    const map: Record<string, { channel: string; reservations: number; revenue: number }> = {};
    data.forEach((r: any) => {
      const ch = r.channel || r.booking_channel || "Directo";
      if (!map[ch]) map[ch] = { channel: ch, reservations: 0, revenue: 0 };
      map[ch].reservations += Number(r.reservation_count || r.reservations || 0);
      map[ch].revenue += Number(r.revenue || r.total_revenue || 0);
    });
    return Object.values(map);
  }, [data]);

  const totalRev = aggregated.reduce((s, d) => s + d.revenue, 0);

  const chartConfig = aggregated.reduce((acc, d, i) => {
    acc[d.channel] = { label: d.channel, color: PIE_COLORS[i % PIE_COLORS.length] };
    return acc;
  }, {} as any);

  return (
    <Card>
      <CardHeader><CardTitle>Ventas por canal</CardTitle></CardHeader>
      <CardContent>
        {aggregated.length > 0 ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Reservas</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Ticket medio</TableHead>
                  <TableHead className="text-right">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((d) => (
                  <TableRow key={d.channel}>
                    <TableCell>{d.channel}</TableCell>
                    <TableCell className="text-right">{d.reservations}</TableCell>
                    <TableCell className="text-right">{d.revenue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</TableCell>
                    <TableCell className="text-right">{d.reservations > 0 ? (d.revenue / d.reservations).toFixed(2) : "–"} €</TableCell>
                    <TableCell className="text-right">{totalRev > 0 ? ((d.revenue / totalRev) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <PieChart>
                <Pie data={aggregated} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={100} label>
                  {aggregated.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">Sin datos para el período seleccionado</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Ventas por oficina ─── */

function SalesByBranch({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data } = useQuery({
    queryKey: ["report_sales_by_branch", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sales_by_branch")
        .select("*")
        .gte("day", dateFrom)
        .lte("day", dateTo);
      if (error) throw error;
      return data ?? [];
    },
  });

  const aggregated = useMemo(() => {
    if (!data?.length) return [];
    const map: Record<string, { branch: string; reservations: number; revenue: number }> = {};
    data.forEach((r: any) => {
      const b = r.branch_name || r.branch || "Sin oficina";
      if (!map[b]) map[b] = { branch: b, reservations: 0, revenue: 0 };
      map[b].reservations += Number(r.reservation_count || r.reservations || 0);
      map[b].revenue += Number(r.revenue || r.total_revenue || 0);
    });
    return Object.values(map);
  }, [data]);

  const chartConfig = {
    revenue: { label: "Ingresos (€)", color: "hsl(var(--primary))" },
  };

  return (
    <Card>
      <CardHeader><CardTitle>Ventas por oficina</CardTitle></CardHeader>
      <CardContent>
        {aggregated.length > 0 ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oficina</TableHead>
                  <TableHead className="text-right">Reservas</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Ticket medio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((d) => (
                  <TableRow key={d.branch}>
                    <TableCell>{d.branch}</TableCell>
                    <TableCell className="text-right">{d.reservations}</TableCell>
                    <TableCell className="text-right">{d.revenue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</TableCell>
                    <TableCell className="text-right">{d.reservations > 0 ? (d.revenue / d.reservations).toFixed(2) : "–"} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={aggregated} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `${v}€`} />
                <YAxis type="category" dataKey="branch" width={80} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">Sin datos para el período seleccionado</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Ventas por método de pago ─── */

function SalesByPaymentMethod({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data } = useQuery({
    queryKey: ["report_sales_by_payment_method", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sales_by_payment_method")
        .select("*")
        .gte("day", dateFrom)
        .lte("day", dateTo);
      if (error) throw error;
      return data ?? [];
    },
  });

  const aggregated = useMemo(() => {
    if (!data?.length) return [];
    const map: Record<string, { method: string; reservations: number; total: number }> = {};
    data.forEach((r: any) => {
      const m = r.payment_method || r.method || "Otro";
      if (!map[m]) map[m] = { method: m, reservations: 0, total: 0 };
      map[m].reservations += Number(r.reservation_count || r.reservations || 0);
      map[m].total += Number(r.revenue || r.total || r.total_amount || 0);
    });
    return Object.values(map);
  }, [data]);

  return (
    <Card>
      <CardHeader><CardTitle>Ventas por método de pago</CardTitle></CardHeader>
      <CardContent>
        {aggregated.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Nº Reservas</TableHead>
                <TableHead className="text-right">Total cobrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregated.map((d) => (
                <TableRow key={d.method}>
                  <TableCell>{d.method}</TableCell>
                  <TableCell className="text-right">{d.reservations}</TableCell>
                  <TableCell className="text-right">{d.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-6">Sin datos para el período seleccionado</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Contabilidad mensual ─── */

function MonthlyAccounting() {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [accountingData, setAccountingData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("report_monthly_accounting", {
        p_year: Number(year),
        p_month: Number(month),
      });
      if (error) throw error;
      setAccountingData(data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!accountingData?.length) return;
    const headers = Object.keys(accountingData[0]);
    const rows = accountingData.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contabilidad_${year}_${month.padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Contabilidad mensual</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Año</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Mes</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={loading}>
            <FileText className="h-4 w-4 mr-2" />
            {loading ? "Generando..." : "GENERAR INFORME"}
          </Button>
          {accountingData && accountingData.length > 0 && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              EXPORTAR CSV
            </Button>
          )}
        </div>

        {accountingData && accountingData.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {Object.keys(accountingData[0]).map((h) => (
                  <TableHead key={h} className="capitalize">{h.replace(/_/g, " ")}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountingData.map((row, i) => (
                <TableRow key={i}>
                  {Object.values(row).map((v: any, j) => (
                    <TableCell key={j}>{typeof v === "number" ? v.toLocaleString("es-ES", { minimumFractionDigits: 2 }) : String(v ?? "–")}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {accountingData && accountingData.length === 0 && (
          <p className="text-muted-foreground text-center py-6">Sin datos contables para el período seleccionado</p>
        )}
      </CardContent>
    </Card>
  );
}
