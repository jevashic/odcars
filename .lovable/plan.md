

## Corregir disponibilidad y extras en Nueva Reserva

### Problema 1 -- VER DISPONIBILIDAD no muestra nada

La query actual pide `base_price_per_day` pero la columna real en `vehicle_categories` es `price_per_day` (confirmado en las respuestas de red). Ademas, la disponibilidad se calcula con queries separadas por categoria cuando se puede hacer en una sola query con join.

**Cambios:**
- Interfaz `Category` (linea 39): cambiar `base_price_per_day` a `price_per_day`
- Query de categorias (linea 173-176): cambiar a `.select("id, name, image_url, price_per_day, vehicles(id, status)")` y contar vehiculos disponibles filtrando `v.status === "available"` en el resultado, eliminando las queries individuales por categoria
- Actualizar todas las referencias: `cat.base_price_per_day` y `selectedCategory.base_price_per_day` a `price_per_day` (lineas 150, 421, 628, 629)

### Problema 2 -- Extras no cargan

La query pide `price_per_day` pero la columna real es `price_per_reservation`.

**Cambios:**
- Interfaz `Extra` (linea 53): cambiar `price_per_day` a `price_per_reservation`
- Query de extras (linea 129): cambiar select a `"id, name, description, price_per_reservation"`
- Actualizar referencias en el render: `ext.price_per_day` a `ext.price_per_reservation` (lineas 553, 654)
- Actualizar calculo del subtotal (linea 153): cambiar `e.price_per_day * days` a `e.price_per_reservation` (precio por reserva, no por dia)
- Mostrar descripcion del extra junto al nombre si existe

### Detalle tecnico

Archivo unico: `src/pages/admin/NewReservation.tsx`

Cambios puntuales:
1. Renombrar `base_price_per_day` a `price_per_day` en interfaz, query y todas las referencias
2. Simplificar `handleCheckAvailability` para hacer una sola query con join a vehicles en vez de N+1 queries
3. Renombrar `price_per_day` a `price_per_reservation` en interfaz Extra, query y referencias
4. Ajustar calculo de extras en subtotal (precio fijo por reserva, no multiplicado por dias)
5. Agregar `console.error` en los catch blocks para facilitar depuracion futura

