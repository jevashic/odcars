

## Implementar CRUD del modulo Extras en /admin/extras

### Archivos a modificar
1. **Crear `src/pages/admin/Extras.tsx`** -- Nuevo componente CRUD completo
2. **Modificar `src/App.tsx`** -- Cambiar la ruta `/admin/extras` de AdminStub a AdminExtras

### Estructura de `Extras.tsx`

Seguir el patron exacto de `Categories.tsx`: mismas importaciones, mismo helper `writeAudit`, mismo estilo visual.

**Interfaz Extra:**
- `id`, `name`, `description`, `price_per_reservation` (number), `is_tax_exempt` (boolean), `is_active` (boolean), `created_at`

**Query principal:**
- `supabase.from("extras").select("*").order("name")`

**Seed automatico al montar:**
- Si la query devuelve 0 extras, insertar GPS (10 euros) y Silla de bebe (15 euros) con `is_tax_exempt: false`, `is_active: true`
- Registrar ambos inserts en audit_log

**Listado (tabla, no cards):**
- Columnas: Nombre, Descripcion, Precio final (IGIC incl.), Exento IGIC, Activo, Acciones
- Boton "Anadir extra" arriba a la derecha
- Botones Editar/Eliminar por fila

**Eliminar:**
- AlertDialog de confirmacion (mismo patron que Categories)
- Registrar en audit_log con action='delete'

**Modal Crear/Editar:**
- Nombre (obligatorio)
- Descripcion (textarea)
- Precio final con IGIC incluido (price_per_reservation, obligatorio)
  - Debajo en gris: "Base imponible: X euros - IGIC 7%: X euros" calculado en tiempo real
- Toggle "Exento de IGIC" (is_tax_exempt) -- si activo, ocultar desglose
- Toggle Activo/Inactivo
- Boton GUARDAR

**Calculo IGIC (solo visual, no se guarda):**
- Base imponible = precio / 1.07
- IGIC = precio - base imponible

**Audit log en UPDATE:**
- Registrar old_data y new_data con action='update'

**Toasts:**
- Exito o error en cada operacion (crear, editar, eliminar)

### Cambio en App.tsx

Linea 93: cambiar `AdminStub` por el nuevo componente `AdminExtras`, importandolo arriba.

### Dependencias
No se instalan paquetes nuevos. Se reutilizan los mismos componentes UI de shadcn ya usados en Categories.tsx.

