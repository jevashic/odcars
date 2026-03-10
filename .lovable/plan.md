

## Diagnóstico: Búsqueda móvil vs escritorio

### 1. Qué valor tiene `startDate` / `endDate` cuando se llama a `check_availability`

En `SearchResults.tsx` líneas 36-37, las fechas se extraen de los query params:
```
const rawSd = searchParams.get('pickupDate');  // ej: "2026-03-15"
const rawEd = searchParams.get('returnDate');  // ej: "2026-03-18"
```

Luego en líneas 49-54 se validan con regex `/^\d{4}-\d{2}-\d{2}$/`. Si ya son `YYYY-MM-DD` (que lo son, porque `SearchBar` usa `fmtLocal`), se usan tal cual. Estas `sd` y `ed` son las que van a `check_availability` en líneas 75-76.

**En teoría, el valor debería ser idéntico en móvil y escritorio**, porque `SearchBar.tsx` ya formatea con `fmtLocal()` (líneas 75-80) que usa métodos locales (`getFullYear`, `getMonth`, `getDate`).

### 2. Posibles diferencias móvil vs escritorio

El código de formateo es correcto en ambos sitios. **No hay diferencia de código entre móvil y escritorio**. Las posibles causas reales son:

- **RLS (Row Level Security)**: Si el móvil no tiene sesión autenticada y el escritorio sí (o viceversa), las consultas a `vehicles` o `vehicle_categories` podrían devolver datos distintos. Esto es lo más probable.
- **Caché del navegador**: El móvil podría estar cargando una versión anterior del JS (antes de los fixes de `fmtLocal`). Solución: borrar caché o forzar hard refresh.
- **`check_availability` devuelve formato diferente**: Si en un entorno devuelve `boolean` y en otro un objeto `{available: true}`, el parsing en línea 79 debería cubrirlo, pero podría fallar si devuelve algo inesperado.

### 3. Cambios recientes en estos archivos

**`SearchBar.tsx`:**
- Se añadió la función `fmtLocal()` para formatear fechas como `YYYY-MM-DD` usando métodos locales en vez de `toISOString()` (que causaba desfase UTC).
- Se aplicó `fmtLocal(pickupDate!)` y `fmtLocal(returnDate!)` en los `URLSearchParams`.

**`SearchResults.tsx`:**
- Se añadió la validación regex + reconstrucción manual de fechas (líneas 49-54) como doble seguridad.
- Se quitó `.eq('status', 'available')` y luego se volvió a poner (línea 98).
- Se añadió `console.log('Fechas enviadas:', sd, ed)` en línea 55.

### Recomendación para confirmar el diagnóstico

**Sin tocar código**, necesitas ver los logs del móvil. Abre `chrome://inspect` en Chrome escritorio con el Samsung conectado por USB, o usa el console.log que ya existe en línea 55. Los datos clave a verificar:

1. `Fechas enviadas: XXXX-XX-XX XXXX-XX-XX` — ¿formato correcto?
2. `PASO 1 check_availability cat=... : ` — ¿qué devuelve? ¿`true`/`false` o un objeto?
3. `PASO 1 RESULT: category_ids disponibles:` — ¿array vacío?
4. `PASO 2: Vehículos encontrados:` — ¿llega a este punto?

**La causa más probable es caché**: el móvil ejecuta JS antiguo (sin `fmtLocal`) y envía fechas con desfase UTC. Pide al usuario que borre caché del navegador en el móvil y vuelva a probar.

