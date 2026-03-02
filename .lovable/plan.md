

## Implementar CRUD completo del modulo Reservas

Este modulo es el mas complejo del admin. Se divide en dos vistas: el listado con filtros y paginacion, y la ficha individual de reserva con acciones segun estado.

### Archivos a crear/modificar

1. **Crear `src/pages/admin/Reservations.tsx`** -- Listado principal (~400 lineas)
2. **Crear `src/pages/admin/ReservationDetail.tsx`** -- Ficha individual (~600 lineas)
3. **Modificar `src/App.tsx`** -- Actualizar rutas

### Cambios en App.tsx

- Importar `AdminReservations` y `AdminReservationDetail`
- Linea 92: cambiar `AdminStub` por `AdminReservations` en `/admin/reservas`
- Anadir nueva ruta: `/admin/reservas/:id` con `AdminReservationDetail`
- Mantener `/admin/reservas/nueva` (NewReservation) tal como esta

---

### Vista 1 -- Reservations.tsx (Listado)

**Query principal:**
```text
supabase.from("reservations")
  .select(`
    *,
    customers(id, first_name, last_name, email, phone),
    vehicle_categories(id, name),
    vehicles(id, license_plate),
    branches!reservations_pickup_branch_id_fkey(id, name)
  `, { count: "exact" })
  .order("created_at", { ascending: false })
  .range(from, to)
```

Paginacion de 15 en 15 con `.range()` server-side.

**Tabla con columnas:**
- N reserva (reservation_number)
- Cliente (first_name + last_name del join customers)
- Categoria (nombre del join vehicle_categories)
- Vehiculo asignado (matricula del join vehicles, o "Sin asignar")
- Fechas (pickup_date - return_date formateadas)
- Dias (calculados con differenceInDays)
- Total (total_amount formateado)
- Canal (sale_channel con icono emoji)
- Estado (status con badge coloreado)
- Acciones

**Badges de estado:**
- pending: gris "Pendiente"
- confirmed: azul "Confirmada"
- active: verde "En curso"
- completed: morado "Completada"
- cancelled: rojo "Cancelada"
- no_show: naranja "No presentado"

**Canal de venta con icono:**
- web: "Web"
- office_sale: "Oficina"
- office_pickup: "Entrega"
- office_dropoff: "Devolucion"
- (fallback al valor raw si no coincide)

**Filtros (encima de la tabla):**
- Select por estado (Todos + 6 estados)
- Select por canal de venta (Todos + 4 canales)
- Select por categoria (cargado desde vehicle_categories activas)
- Rango de fechas: dos date pickers (desde / hasta) que filtran por pickup_date
- Input de busqueda por numero de reserva, nombre o email (filtrado client-side sobre los resultados paginados)

**Acciones por fila:**
- Boton "Ver ficha" que navega a `/admin/reservas/{id}`
- Dropdown "Cambiar estado" con las 6 opciones; al seleccionar uno, actualiza directamente en Supabase y registra en audit_log

---

### Vista 2 -- ReservationDetail.tsx (Ficha)

Se carga con `useParams()` para obtener el `id`.

**Query principal:**
```text
supabase.from("reservations")
  .select(`
    *,
    customers(*),
    vehicle_categories(id, name),
    vehicles(id, license_plate, brand, model),
    branches!reservations_pickup_branch_id_fkey(id, name),
    reservation_extras(*, extras(id, name, price_per_reservation)),
    reservation_insurance(*, insurance_plans(id, name, price_per_day))
  `)
  .eq("id", reservationId)
  .single()
```

**Layout dos columnas (grid lg:grid-cols-3, izquierda 2 cols, derecha 1 col):**

#### Columna izquierda (2/3)

**Bloque 1 -- Datos de la reserva:**
- N reserva, estado con badge, canal de venta con icono
- Fechas recogida y devolucion con hora, total dias
- Categoria, vehiculo asignado (matricula o "Sin asignar")
- Oficinas de recogida y devolucion
- Seguro contratado (del join reservation_insurance)
- Extras contratados (del join reservation_extras)

**Bloque 2 -- Datos del cliente:**
- Nombre completo, email, telefono
- N licencia conducir, caducidad carnet
- Boton "Ver ficha cliente" (link a /admin/clientes/:customer_id)

**Bloque 3 -- Desglose economico:**
- Precio/dia, subtotal alquiler (precio/dia x dias)
- Extras (lista con importes)
- Suplemento seguro
- Descuento aplicado (si existe campo discount_amount o similar)
- Cargos adicionales (si existen)
- IGIC 7%, Total final
- Metodo de pago, estado Stripe (stripe_payment_intent_id si existe)

#### Columna derecha (1/3)

**Bloque 4 -- Acciones disponibles (condicional segun estado):**

Si estado = `confirmed`:
- Select "Asignar vehiculo" cargado desde `vehicles WHERE category_id = reserva.category_id AND status = 'available'`
- Boton "ACTIVAR RESERVA":
  - Actualiza reservations.status a 'active'
  - Actualiza vehicles.status a 'rented' para el vehiculo asignado
  - Guarda vehicle_id en la reserva
  - Registra en audit_log

Si estado = `active`:
- Campo "Kilometraje devolucion" (numero)
- Toggle "Combustible incompleto?" con campo importe
- Toggle "Devolucion tardia?" con campo dias extra
- Toggle "Danos?" con campos importe y descripcion
- Boton "COMPLETAR DEVOLUCION":
  - Actualiza reservations.status a 'completed'
  - Actualiza vehicles.status a 'available'
  - Aplica cargos adicionales (guarda en campos de la reserva o en tabla adicional)
  - Registra en audit_log

Si estado = `pending` o `confirmed`:
- Campo "Motivo de cancelacion" (textarea, obligatorio)
- Boton "CANCELAR RESERVA":
  - Actualiza reservations.status a 'cancelled'
  - Guarda motivo en campo cancellation_reason
  - Si tenia vehiculo asignado, lo libera (vehicles.status = 'available')
  - Registra en audit_log

**Bloque 5 -- Notas internas:**
- Textarea con el contenido de internal_notes
- Boton "GUARDAR NOTA" que actualiza el campo y registra en audit_log

**Bloque 6 -- Historial de cambios:**
- Query: `supabase.from("audit_log").select("*").eq("record_id", reservationId).order("created_at", { ascending: false })`
- Listado con: fecha formateada, usuario (performed_by), accion, resumen del cambio (extraido de old_data/new_data)

---

### Patron de codigo

Se seguira el mismo patron exacto de `Extras.tsx` y `VehiclesByCategory.tsx`:
- Mismas importaciones de shadcn
- Mismo helper `writeAudit` inline
- `useQuery` + `useQueryClient` de TanStack
- `useAdminAuth` para obtener el usuario
- Toasts con `@/hooks/use-toast`

### Dependencias

No se instalan paquetes nuevos. Se reutilizan:
- shadcn: Table, Badge, Button, Select, Dialog, AlertDialog, Card, Input, Textarea, Label, Switch, Breadcrumb, Separator
- date-fns: format, differenceInDays, parseISO
- lucide-react: iconos
- Popover + Calendar para los filtros de fecha

### Notas tecnicas

- Los nombres exactos de foreign keys para el JOIN de branches dependeran de la estructura real de la tabla. Si falla `branches!reservations_pickup_branch_id_fkey`, se usara un approach alternativo con queries separadas.
- Los campos de cargos adicionales (combustible, danos, devolucion tardia) se guardaran en campos de la reserva si existen (como `additional_charges` jsonb), o se crearan como columnas simples. Si la tabla no tiene estos campos, se mostraran los controles pero se guardara todo en `internal_notes` como fallback.
- La tabla `reservation_extras` y `reservation_insurance` son tablas de relacion. Si no existen con esos nombres exactos, se adaptara el join o se usaran queries separadas.

