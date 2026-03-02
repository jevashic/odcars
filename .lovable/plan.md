

## Implementar modulo Facturacion completo

### Archivos a crear/modificar

1. **Crear `src/pages/admin/Invoices.tsx`** -- Listado con filtros, paginacion, modal crear factura (~550 lineas)
2. **Crear `src/pages/admin/InvoiceDetail.tsx`** -- Ficha individual con acciones segun estado (~500 lineas)
3. **Modificar `src/App.tsx`** -- Sustituir AdminStub por los nuevos componentes

### Cambios en App.tsx

- Importar `AdminInvoices` y `AdminInvoiceDetail`
- Cambiar la ruta `/admin/facturacion` de `AdminStub` a `AdminInvoices`
- Anadir ruta `/admin/facturacion/:id` con `AdminInvoiceDetail`

---

### Vista 1 -- Invoices.tsx (Listado)

Seguir patron exacto de Discounts.tsx: mismo writeAudit, mismas importaciones shadcn, useAdminAuth, TanStack Query, toasts.

**Query principal:**
```text
supabase.from("invoices")
  .select(`
    *,
    reservations(reservation_number),
    customers(id, first_name, last_name, email)
  `, { count: "exact" })
  .order("created_at", { ascending: false })
  .range(from, to)
```

Paginacion de 15 en 15 con `.range()` server-side.

**Tabla con columnas:**
- N Factura (invoice_number)
- Cliente (first_name + last_name del join customers)
- N Reserva (reservation_number del join reservations)
- Fecha emision (issued_at o created_at formateado)
- Total (total_amount formateado con euro)
- Estado (badge coloreado)
- Acciones

**Badges de estado:**
- draft: gris "Borrador"
- issued: azul "Emitida"
- sent: verde "Enviada"
- void: rojo "Anulada"

**Filtros (encima de la tabla):**
- Select por estado: Todos / Borrador / Emitida / Enviada / Anulada -- server-side `.eq("status", value)`
- Rango de fechas: dos date pickers (desde/hasta) que filtran por created_at con `.gte()` y `.lte()`
- Input de busqueda por n factura, n reserva o email cliente -- filtrado client-side

**Acciones por fila:**
- Boton "Ver factura" que navega a `/admin/facturacion/{id}`
- Boton "Imprimir PDF" que genera una ventana de impresion con `window.print()` sobre un layout formateado
- Boton "Anular" (solo si status = issued o sent): abre AlertDialog con textarea motivo obligatorio, actualiza status a void, registra en audit_log

**Modal "Nueva factura":**
- Input buscador de reserva por numero de reserva
- Query: `supabase.from("reservations").select("*, customers(*), vehicle_categories(name), reservation_extras(*, extras(name, price_per_reservation)), reservation_insurance(*, insurance_plans(name, price_per_day))").ilike("reservation_number", search)`
- Al seleccionar una reserva, precarga automaticamente todos los datos
- Genera invoice_number automatico con formato FAC-YYYY-XXXX (ano actual + secuencial)
- Construye line_items jsonb a partir de los datos de la reserva:
  - Linea de alquiler (precio/dia x dias)
  - Lineas de extras
  - Linea de seguro
  - Lineas de cargos adicionales si existen
- Calcula subtotal gravable, subtotal exento, IGIC 7%, descuento, total
- Boton "CREAR BORRADOR" que inserta en invoices con status=draft
- Registra en audit_log con action='insert'

---

### Vista 2 -- InvoiceDetail.tsx (Ficha)

Se carga con `useParams()` para obtener el `id`.

**Query principal:**
```text
supabase.from("invoices")
  .select(`
    *,
    reservations(reservation_number, pickup_date, return_date),
    customers(*)
  `)
  .eq("id", invoiceId)
  .single()
```

**Query de accounting_config:**
```text
supabase.from("accounting_config").select("*").single()
```
Si la tabla no existe, usar valores por defecto hardcoded para la empresa.

**Layout dos columnas (grid lg:grid-cols-3, izquierda 2 cols, derecha 1 col):**

#### Columna izquierda (2/3)

**Cabecera empresa (Card):**
- Logo Ocean Drive (desde assets)
- Razon social, CIF, direccion, n IGIC (desde accounting_config o defaults)

**Datos cliente (Card):**
- Nombre completo, email, n documento, direccion
- Si is_company: nombre empresa y CIF

**Datos factura (Card):**
- N factura (invoice_number)
- Fecha de emision (issued_at)
- N reserva vinculada (link a /admin/reservas/:id)

**Lineas de factura (Table):**
- Parsear line_items jsonb
- Columnas: Concepto, Tipo (alquiler/extra/seguro/cargo), Base imponible, IGIC 7%, Total
- Tipos con badge de color distinto
- Al final de la tabla:
  - Subtotal gravable
  - Subtotal exento (si hay)
  - IGIC 7%
  - Descuento aplicado (si existe)
  - TOTAL en negrita grande

**Pie de factura:**
- Metodo de pago y fecha de pago
- invoice_footer_note desde accounting_config o texto por defecto

#### Columna derecha (1/3)

**Bloque Acciones (Card, condicional segun estado):**

Si status = `draft`:
- Boton "EMITIR FACTURA":
  - Actualiza status a 'issued', registra issued_at = now()
  - Intenta llamar a `supabase.functions.invoke('issue_invoice', { body: { invoice_id } })`
  - Si la edge function no existe, solo actualiza el estado y muestra toast informativo
  - Registra en audit_log

Si status = `issued` o `sent`:
- Boton "DESCARGAR PDF": abre ventana de impresion con layout formateado
- Boton "REENVIAR AL CLIENTE": llama a `supabase.functions.invoke('issue_invoice', { body: { invoice_id, resend: true } })`
- Boton "ANULAR": AlertDialog con textarea motivo obligatorio, actualiza status a void, registra en audit_log

Si status = `void`:
- Solo muestra badge "Anulada" con motivo de anulacion

**Bloque Historial (Card):**
- Query: `supabase.from("audit_log").select("*").eq("record_id", invoiceId).order("created_at", { ascending: false })`
- Listado con: fecha, usuario, accion, resumen

---

### Patron de codigo

- Mismo helper `writeAudit` inline
- `useQuery` + `useQueryClient` de TanStack
- `useAdminAuth` para usuario
- Toasts con `@/hooks/use-toast`
- Breadcrumb en la ficha: "Facturacion > FAC-XXXX"
- Boton "Volver" en la ficha

### Generacion PDF

Se usa `window.print()` con un div oculto que contiene el layout de factura formateado con estilos de impresion (`@media print`). Es la solucion mas simple sin instalar dependencias adicionales.

### Notas tecnicas

- Si la tabla `invoices` no tiene todos los campos esperados (como `line_items`, `void_reason`, `issued_at`), se adaptaran los queries y se usaran los campos disponibles.
- Si `accounting_config` no existe como tabla, se usaran valores por defecto hardcoded para la informacion de la empresa.
- La llamada a `supabase.functions.invoke('issue_invoice')` se hace con try/catch; si la edge function no esta desplegada, se muestra un toast informativo sin bloquear la operacion.
- NO se elimina ninguna factura, solo se anula.

### Dependencias

No se instalan paquetes nuevos. Se reutilizan componentes shadcn existentes.

