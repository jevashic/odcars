

## Implementar modulo Informes en /admin/informes

### Archivos a crear/modificar

1. **Crear `src/pages/admin/Reports.tsx`** -- Modulo completo con dos pestanas (~600 lineas)
2. **Modificar `src/App.tsx`** -- Cambiar AdminStub por AdminReports en `/admin/informes`

### Cambios en App.tsx

- Importar `AdminReports` desde `./pages/admin/Reports`
- Linea 117: cambiar `AdminStub` por `AdminReports` en `/admin/informes`

---

### Estructura general

Componente con Tabs de shadcn (dos pestanas):
- "Resumen Operativo" (visible para todos los roles)
- "Informes Detallados" (visible solo si `user.role === 'admin' || user.role === 'manager'`)

---

### Pestana 1 -- Resumen Operativo

Accesible para employee, manager y admin.

**Panel KPIs del dia (cards en grid 5 columnas):**

Query: `supabase.from("report_active_today").select("*").single()`

Cards:
- Reservas activas ahora mismo
- Vehiculos disponibles
- Vehiculos en taller
- Entregas pendientes hoy
- Devoluciones pendientes hoy

**Panel KPIs del mes (cards en grid 4 columnas):**

Query: `supabase.from("report_sales_by_day").select("*")` filtrado por mes actual, y agregar client-side:
- Total reservas del mes (sum de reservation_count)
- Ingresos del mes en euros (sum de revenue)
- Reservas canceladas (del campo cancelled si existe, o query adicional a reservations con status='cancelled' y rango de fechas del mes)
- Reservas no_show (igual, status='no_show')

Para canceladas y no_show, query directa:
```text
supabase.from("reservations")
  .select("id", { count: "exact", head: true })
  .eq("status", "cancelled")
  .gte("created_at", startOfMonth)
  .lte("created_at", endOfMonth)
```

**Grafico de barras -- Ventas por dia (ultimos 30 dias):**

Query: `supabase.from("report_sales_by_day").select("*").gte("day", hace30dias).order("day")`

Usar recharts BarChart con:
- Eje X: fecha (day)
- Eje Y izquierdo: ingresos (revenue) -- barras color primary
- Eje Y derecho: n reservas (reservation_count) -- linea color cta
- Usar ChartContainer y ChartTooltip del sistema existente en chart.tsx

Colores: `hsl(var(--primary))` y `hsl(var(--cta))`

**Tabla -- Proximas reservas:**

Query: `supabase.from("report_upcoming_reservations").select("*").limit(20)`

Columnas: N reserva, Cliente, Categoria, Fecha recogida, Oficina, Estado (badge coloreado)

---

### Pestana 2 -- Informes Detallados

Solo visible si `user.role` es `admin` o `manager`. Comprobar con `useAdminAuth()`.

**Selector de periodo (encima de todos los informes):**

Select con opciones:
- Mes actual
- Mes anterior
- Trimestre actual
- Ano actual
- Rango personalizado

Si "Rango personalizado": mostrar dos date pickers (fecha inicio / fecha fin).

Cada opcion calcula `dateFrom` y `dateTo` que se pasan como filtro a las queries.

**Informe 1 -- Ventas por canal:**

Query: `supabase.from("report_sales_by_channel").select("*").gte("day", dateFrom).lte("day", dateTo)` (o la estructura que tenga la vista, agrupando client-side si es por dia)

Si la vista ya devuelve datos agregados por canal directamente, usar tal cual. Si devuelve por dia, agregar client-side por canal.

Tabla: Canal, N reservas, Ingresos totales, Ticket medio (ingresos/reservas), % del total
Grafico de tarta (PieChart de recharts) con colores del sistema de diseno.

**Informe 2 -- Ventas por oficina:**

Query: `supabase.from("report_sales_by_branch").select("*")` con filtro de periodo

Tabla: Oficina, N reservas, Ingresos, Ticket medio
Grafico de barras horizontales (BarChart layout="vertical")

**Informe 3 -- Ventas por metodo de pago:**

Query: `supabase.from("report_sales_by_payment_method").select("*")` con filtro de periodo

Tabla: Metodo, N reservas, Total cobrado

**Informe 4 -- Contabilidad mensual:**

Selector de mes y ano (dos selects).

Boton "GENERAR INFORME" que ejecuta:
```text
supabase.rpc("report_monthly_accounting", { p_year: year, p_month: month })
```

Tabla con todas las lineas contables devueltas: concepto, importe, desglose IGIC.

Boton "EXPORTAR CSV" que convierte los datos a CSV y dispara descarga con `URL.createObjectURL(blob)` + `a.click()`.

---

### Patron de codigo

- `useAdminAuth` para obtener usuario y rol
- `useQuery` de TanStack para cada seccion de datos
- Recharts con ChartContainer de `@/components/ui/chart` para tooltips consistentes
- Tabs de `@/components/ui/tabs`
- Cards de `@/components/ui/card`
- Toasts con `@/hooks/use-toast` para errores
- Colores graficos: `hsl(var(--primary))` para barras principales, `hsl(var(--cta))` para acentos, palette generada para pie chart

### Dependencias

No se instalan paquetes nuevos. Se reutilizan recharts, shadcn Tabs, Card, Table, Select, Badge, Button, Calendar, Popover, y el sistema de charts existente.

