

## Corregir error "Failed to fetch" en la llamada a create_reservation

### Causa raiz

La Anon Key almacenada en `createReservation.ts` y en `client.ts` es `sb_publishable_BqU8oLRueee_zMv1ayiJSw_5nr1VwxB`, que no es una Supabase Anon Key valida. Las Anon Keys de Supabase son tokens JWT que comienzan con `eyJ...`.

El valor actual parece ser un placeholder o una clave de otro servicio. Cuando la Edge Function recibe esta clave invalida, rechaza la peticion o falla en la validacion, lo que causa el error "Failed to fetch" (tipicamente un problema de CORS cuando el servidor no responde correctamente).

### Solucion

1. **Obtener la Anon Key correcta** de tu proyecto Supabase:
   - Ve a https://supabase.com/dashboard → tu proyecto → Settings → API
   - Copia la clave `anon` / `public` (empieza con `eyJhbGciOi...`)

2. **Actualizar `src/integrations/supabase/client.ts`** — reemplazar `SUPABASE_ANON_KEY` con la clave correcta

3. **Actualizar `src/integrations/supabase/createReservation.ts`** — reemplazar `ANON_KEY` con la misma clave correcta

4. **Centralizar la clave** — en vez de duplicar la key en dos archivos, importar la key desde `client.ts` en `createReservation.ts` para evitar inconsistencias futuras

### Cambios tecnicos

| Archivo | Cambio |
|---------|--------|
| `src/integrations/supabase/client.ts` | Actualizar `SUPABASE_ANON_KEY` con la clave real |
| `src/integrations/supabase/createReservation.ts` | Importar la key desde `client.ts` en vez de duplicarla |

### Nota importante

Necesitare que me proporciones la Anon Key correcta de tu proyecto Supabase (la que empieza con `eyJ...`). Sin ella, la Edge Function seguira rechazando las peticiones.

