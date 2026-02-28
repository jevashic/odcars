

## Traducir datos dinamicos de Supabase segun el idioma

### Problema actual
Los datos que vienen de Supabase (nombres de vehiculos, tipo de combustible, transmision, etc.) se muestran siempre en espanol porque estan guardados directamente en la tabla `vehicle_categories` sin traducciones.

### Solucion: Tabla de traducciones por entidad

Ya existe un patron funcionando en el proyecto: **`tourist_place_translations`** tiene columnas `lang`, `name`, `short_description`, etc. y el frontend filtra por el idioma activo. Aplicaremos el mismo patron a los vehiculos.

---

### Paso 1 — Crear tabla `vehicle_category_translations` en Supabase

Estructura de la tabla:

```text
vehicle_category_translations
├── id (uuid, PK)
├── category_id (uuid, FK -> vehicle_categories.id)
├── lang (text: es, en, de, sv, no, fr)
├── name (text) — ej: "Fiat 500 or similar"
├── transmission_note (text) — ej: "Manual" / "Automatic"
├── energy_type (text) — ej: "Gasoline" / "Hybrid"
├── description (text, nullable)
└── UNIQUE(category_id, lang)
```

Se creara mediante una migracion SQL.

### Paso 2 — Insertar traducciones iniciales

Se insertaran filas para cada categoria existente en los 6 idiomas (es, en, de, sv, no, fr) con las traducciones de:
- Nombre del vehiculo (ej: "o similar" -> "or similar" / "oder ahnlich")
- Tipo de transmision (Manual / Automatico)
- Tipo de energia (Gasolina / Hibrido / Electrico)

### Paso 3 — Modificar las consultas del frontend

En los 4 archivos que consultan `vehicle_categories`, cambiar el `select('*')` para incluir las traducciones y filtrar por idioma:

**Archivos a modificar:**
- `src/components/home/FeaturedVehicles.tsx`
- `src/pages/Fleet.tsx`
- `src/pages/booking/SearchResults.tsx`
- `src/pages/booking/VehicleDetail.tsx`

Cambio tipico:

```typescript
// ANTES
supabase.from('vehicle_categories').select('*')

// DESPUES
supabase.from('vehicle_categories')
  .select('*, vehicle_category_translations(*)')
```

Luego al renderizar:

```typescript
const tr = cat.vehicle_category_translations?.find(
  (t: any) => t.lang === lang
) ?? cat.vehicle_category_translations?.[0];

// Usar tr?.name en vez de cat.name
// Usar tr?.transmission_note en vez de cat.transmission_note
// Usar tr?.energy_type en vez de cat.energy_type
```

Si no hay traduccion disponible, se usa el valor original de `vehicle_categories` como fallback (espanol).

### Paso 4 — Pasar `lang` como dependencia

En los `useEffect` que cargan categorias, agregar `lang` al array de dependencias para que recargue los datos al cambiar idioma:

```typescript
const { lang } = useLang();
useEffect(() => { /* fetch */ }, [lang]);
```

---

### Resumen de cambios

| Tipo | Archivo / Recurso |
|------|-------------------|
| Migracion SQL | Crear tabla `vehicle_category_translations` |
| Datos SQL | Insertar traducciones para 6 idiomas |
| Frontend | `FeaturedVehicles.tsx` — usar traducciones |
| Frontend | `Fleet.tsx` — usar traducciones |
| Frontend | `SearchResults.tsx` — usar traducciones |
| Frontend | `VehicleDetail.tsx` — usar traducciones |

Los lugares turisticos (`tourist_places`) ya funcionan con este patron — no necesitan cambios.

