

## Corregir topbar + Crear pagina Nueva Reserva Presencial

### PARTE 1 -- Topbar (AdminLayout.tsx)

Cambios en el archivo existente `src/pages/admin/AdminLayout.tsx`:

**1. Invertir orden de botones en el header (lineas 209-222):**
- Primero (izquierda): CONSULTAR RESERVA (outline, estilo actual)
- Segundo (derecha): NUEVA RESERVA con clases `bg-cta text-cta-foreground hover:bg-cta/90`

**2. Cambiar logica de busqueda del modal:**
- Placeholder: "Numero de reserva" con ejemplo OD-2026-0001
- Descripcion: "Busca por numero de reserva"
- Query: `reservations` WHERE `reservation_number` = valor exacto (eq, no ilike)
- Mensaje error: "No se encontro ninguna reserva con ese numero"

### PARTE 2 -- Nueva pagina `/admin/reservas/nueva`

Crear archivo `src/pages/admin/NewReservation.tsx` con layout a dos columnas:

**Columna izquierda -- Formulario por pasos:**

- **Paso 1 - Fechas y oficina:** Selects de branches (pickup/return), datepickers con hora, boton "VER DISPONIBILIDAD". Al pulsar carga `vehicle_categories` activas, cuenta vehiculos disponibles por categoria, muestra cards con badges de disponibilidad. Al seleccionar categoria muestra tabla de vehiculos fisicos (matricula, marca, color, km) con opcion "Asignacion automatica".

- **Paso 2 - Datos del cliente:** Campo busqueda en `customers` por email/telefono con debounce. Si encuentra, precarga campos. Si no, formulario vacio. Campos: nombre, apellidos, email, telefono, num licencia, fecha caducidad carnet.

- **Paso 3 - Extras:** Checkboxes desde tabla `extras` WHERE is_active = true, mostrando nombre y precio.

- **Paso 4 - Pago:** Select con opciones "Pago en oficina" / "Tarjeta cobrada" / "Pago online previo". Textarea para notas internas.

**Columna derecha -- Resumen en tiempo real:**

Panel sticky que se actualiza automaticamente con: fechas, dias, categoria, vehiculo, extras con precios, subtotal, IGIC 7%, total, metodo de pago. Boton "CREAR RESERVA" (bg-primary) que llama a `supabase.functions.invoke('create_reservation')` con `sale_channel: "office"`. Exito navega a `/admin/reservas/:id` con toast. Error muestra mensaje.

### PARTE 3 -- Ruta en App.tsx

Agregar ruta `/admin/reservas/nueva` antes de `/admin/reservas` apuntando al nuevo componente `NewReservation`.

---

### Detalle tecnico

**Archivos a modificar:**
- `src/pages/admin/AdminLayout.tsx` -- topbar y modal
- `src/App.tsx` -- nueva ruta

**Archivos a crear:**
- `src/pages/admin/NewReservation.tsx` -- pagina completa

**Tablas Supabase utilizadas:**
- `branches` (oficinas)
- `vehicle_categories` (categorias activas)
- `vehicles` (disponibilidad y asignacion)
- `customers` (busqueda/creacion cliente)
- `extras` (extras activos)
- `reservations` (busqueda en modal)
- Edge function `create_reservation` (crear reserva)

**Componentes UI reutilizados:**
- Select, Input, Button, Calendar/Popover (datepicker), Dialog, Checkbox, Badge, Card, Tabs (si necesario)
- Toast para feedback

