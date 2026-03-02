

## Reestructurar modulo Flota en dos niveles de navegacion

### Archivos a crear/modificar

1. **Crear `src/pages/admin/VehicleCategories.tsx`** -- Nivel 1: vista de cards por categoria
2. **Crear `src/pages/admin/VehiclesByCategory.tsx`** -- Nivel 2: tabla CRUD de vehiculos filtrada por categoria
3. **Modificar `src/App.tsx`** -- Actualizar rutas

### Cambios en App.tsx

- Importar `AdminVehicleCategories` y `AdminVehiclesByCategory`
- Linea 91: cambiar `AdminStub` por `AdminVehicleCategories` en `/admin/vehiculos`
- Anadir nueva ruta: `/admin/vehiculos/:categoryId` con `AdminVehiclesByCategory`

### Nivel 1 -- VehicleCategories.tsx (~120 lineas)

Seguir patron visual de Categories.tsx (cards en grid).

**Query:**
```
supabase.from("vehicle_categories")
  .select("*, vehicles(id, status)")
  .eq("is_active", true)
  .order("name")
```

Esto trae cada categoria con su array de vehiculos (solo id y status). En el cliente se calculan los conteos:
- Total: `vehicles.length`
- Disponibles: filtrar `status === 'available'`
- En taller: filtrar `status === 'maintenance'`
- Alquilados: filtrar `status === 'rented'`

**Render:**
- Titulo "Flota" arriba a la izquierda
- Grid de 3 cards (1 col mobile, 3 cols desktop)
- Cada card muestra:
  - Imagen de la categoria (image_url) o placeholder "Sin imagen"
  - Nombre de la categoria
  - 4 badges: total (gris), disponibles (verde), en taller (naranja), alquilados (azul)
  - Boton "Ver vehiculos" que navega a `/admin/vehiculos/{category_id}` usando `useNavigate`

### Nivel 2 -- VehiclesByCategory.tsx (~550 lineas)

Seguir patron de Extras.tsx y Categories.tsx: mismo helper `writeAudit`, mismas importaciones UI.

**Interfaces:**
```typescript
interface Vehicle {
  id: string;
  category_id: string;
  branch_id: string | null;
  brand: string;
  model: string;
  year: number;
  license_plate: string;
  color: string | null;
  seats: number;
  transmission: string;
  status: string;
  mileage: number | null;
  external_reference: string | null;
  notes: string | null;
  images: string[] | null;
  created_at: string;
  branches?: { id: string; name: string } | null;
}

interface VehicleForm { ... } // campos editables
```

**Parametros:**
- Leer `categoryId` de `useParams()`
- Query de la categoria para obtener nombre (para breadcrumb)
- Query de vehiculos filtrada por `category_id`

**Header:**
- Breadcrumb: "Flota > {nombre categoria}" con link a `/admin/vehiculos`
- Boton "Volver" a la izquierda (navega a `/admin/vehiculos`)
- Boton "Anadir vehiculo" a la derecha

**Tabla:**
Columnas: Foto (primera del array images), Matricula, Marca/Modelo, Ano, Color, Transmision, Kilometraje, Oficina (nombre del join con branches), Estado (badge coloreado), Acciones (Editar/Eliminar)

**Badges de estado:**
- `available` -- variant default con clase verde, texto "Disponible"
- `rented` -- clase azul, texto "Alquilado"
- `maintenance` -- clase naranja, texto "En taller"
- `retired` -- variant secondary, texto "Retirado"

**Filtros (encima de la tabla):**
- Input de busqueda por matricula o modelo (filtrado client-side)
- Select por estado (Todos / available / rented / maintenance / retired)

**Paginacion:**
- 10 registros por pagina
- Usar `.range(from, to)` de Supabase con count: 'exact'
- Botones Anterior / Siguiente con texto "Pagina X de Y"

**Eliminar:**
- AlertDialog de confirmacion
- Registrar en audit_log con action='delete'

**Modal Crear/Editar:**

Campos:
1. Categoria -- Select desde vehicle_categories activas, preseleccionado con categoryId actual, deshabilitado si se viene del nivel 2
2. Marca -- Input texto (obligatorio)
3. Modelo -- Input texto (obligatorio)
4. Ano -- Input numero (obligatorio)
5. Matricula -- Input texto (obligatorio)
6. Color -- Input texto
7. Plazas (seats) -- Input numero (obligatorio)
8. Transmision -- Select "manual" / "automatic" (obligatorio)
9. Oficina -- Select desde branches
10. Estado -- Select con 4 opciones
11. Kilometraje -- Input numero
12. Referencia externa -- Input texto
13. Notas -- Textarea
14. Fotos -- Zona drag-and-drop multiple (jpg/png/webp), preview de todas las imagenes, boton X para eliminar individualmente. Subir a bucket "vehicle-photos" con path `{vehicleId}/{index}.{ext}`. Guardar array de URLs publicas en campo `images` (jsonb).

Boton GUARDAR al final.

**Audit log:**
- INSERT: registrar action='insert'
- UPDATE: registrar action='update' con old_data y new_data
- DELETE: registrar action='delete' con old_data

**Toasts:** exito o error en cada operacion.

### Queries auxiliares (dentro de VehiclesByCategory)

- Categorias activas para el select del modal: `supabase.from("vehicle_categories").select("id, name").eq("is_active", true)`
- Branches para el select del modal: `supabase.from("branches").select("id, name").order("name")`

### Dependencias

No se instalan paquetes nuevos. Se reutilizan componentes shadcn existentes: Table, Dialog, AlertDialog, Select, Input, Badge, Switch, Button, Label, Textarea, Breadcrumb.

