

## Corregir disponibilidad, extras y pagos en Nueva Reserva

### Problema raiz

El codigo usa la columna `daily_price` en las queries a `vehicle_categories` y `extras`, pero esa columna NO existe en la base de datos. Los nombres reales son:
- `vehicle_categories` --> `base_price_per_day`
- `extras` --> `price_per_day`

Esto causa que Supabase devuelva error silencioso y las categorias/extras quedan vacios.

### Cambios en `src/pages/admin/NewReservation.tsx`

**1. Corregir interfaz Category (linea 39):**
- Cambiar `daily_price: number` a `base_price_per_day: number`

**2. Corregir interfaz Extra (linea 53):**
- Cambiar `daily_price: number` a `price_per_day: number`

**3. Corregir query de categorias (linea 175):**
- Cambiar `.select("id, name, image_url, daily_price")` a `.select("id, name, image_url, base_price_per_day")`

**4. Corregir query de extras (linea 129):**
- Cambiar `.select("id, name, daily_price")` a `.select("id, name, price_per_day")`

**5. Actualizar todas las referencias a `daily_price`:**
- `cat.daily_price` --> `cat.base_price_per_day` (lineas 421, 628, 629)
- `ext.daily_price` --> `ext.price_per_day` (lineas 553, 654)
- `selectedCategory.daily_price` --> `selectedCategory.base_price_per_day` (lineas 150, 628, 629)

**6. Actualizar opciones de pago (lineas 70-74):**
Reemplazar las tres opciones actuales por:
- `{ value: "cash", label: "Pago en efectivo" }`
- `{ value: "card", label: "Pago con tarjeta" }`
- `{ value: "bizum", label: "Bizum" }`

**7. Inicializar paymentMethod vacio (linea 116):**
- Cambiar `useState("office")` a `useState("")` para forzar seleccion explicita

**8. Agregar placeholder al Select de pago (linea 571):**
- Cambiar `<SelectValue />` a `<SelectValue placeholder="Seleccionar metodo de pago" />`

**9. Agregar paymentMethod a la validacion del boton CREAR RESERVA (linea 691):**
- Anadir `|| !paymentMethod` a la condicion `disabled`

**10. Agregar pointer-events-auto a los Calendar (lineas 365, 384):**
- Para asegurar que los calendarios sean interactivos dentro del Popover

### Detalle tecnico

- Archivo unico: `src/pages/admin/NewReservation.tsx`
- Todos los cambios son renombramientos de columnas y ajustes de logica de pago
- No se crean archivos nuevos ni se modifican otros

