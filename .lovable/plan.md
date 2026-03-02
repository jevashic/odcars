

## Corregir modulo Categorias para que funcione con datos reales

### Problema

El archivo `src/pages/admin/Categories.tsx` ya tiene un CRUD completo implementado, pero usa la columna `base_price_per_day` que no existe en la tabla `vehicle_categories`. La columna real es `price_per_day` (confirmado por `FeaturedVehicles.tsx` que consulta la misma tabla con exito). Esto causa que las queries fallen silenciosamente y no se muestren datos.

### Cambios en `src/pages/admin/Categories.tsx`

**1. Interfaz Category (linea 47):**
Cambiar `base_price_per_day: number` a `price_per_day: number`

**2. emptyCategoryForm (linea 74):**
Cambiar `base_price_per_day: 0` a `price_per_day: 0`

**3. openEdit (linea 204):**
Cambiar `base_price_per_day: cat.base_price_per_day` a `price_per_day: cat.price_per_day`

**4. saveCategory validacion (linea 220):**
Cambiar `!form.base_price_per_day` a `!form.price_per_day`

**5. Card display (linea 403):**
Cambiar `cat.base_price_per_day` a `cat.price_per_day`

**6. Input del formulario (linea 483):**
Cambiar `value={form.base_price_per_day}` y `base_price_per_day: parseFloat(...)` a `price_per_day`

Son 6 cambios puntuales de renombrado en un solo archivo. Todo lo demas (estructura CRUD, audit_log, imagen drag-and-drop, temporadas/pricing_rules) ya esta correctamente implementado.

### Archivo a modificar
- `src/pages/admin/Categories.tsx`

