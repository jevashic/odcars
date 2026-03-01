

## Corregir el bucle de login en AdminAuthContext

### Problema

El archivo `AdminAuthContext.tsx` tiene dos fallos que causan el bucle:

1. `onAuthStateChange` se dispara al montar el componente. Si en ese momento aun no hay sesion (porque `getSession` no ha resuelto), ejecuta `navigate("/admin")` y te devuelve al login.
2. Ambos (`onAuthStateChange` y `getSession`) llaman a `verifyRole()` en paralelo, causando resultados impredecibles.

### Solucion

Reescribir la logica de `useEffect` en `AdminAuthContext.tsx`:

- **Verificar solo via `getSession()`** al montar el componente (una sola vez).
- **`onAuthStateChange`** solo debe reaccionar al evento `SIGNED_OUT` para limpiar el estado. No debe llamar a `verifyRole` ni redirigir en otros eventos.
- **No redirigir a `/admin` dentro del listener** cuando no hay sesion (puede ser el estado inicial).
- Capturar errores de la query a `internal_users` y NO hacer `signOut` si es error de red/RLS.

### Cambios tecnicos

**Archivo: `src/contexts/AdminAuthContext.tsx`**

Reemplazar el `useEffect` (lineas 56-80) con esta logica:

```text
useEffect:
  1. Registrar onAuthStateChange:
     - Si evento es SIGNED_OUT -> setUser(null), setLoading(false)
     - Cualquier otro evento -> ignorar (no llamar verifyRole)

  2. Llamar getSession():
     - Si hay sesion -> verifyRole()
     - Si no hay sesion -> setLoading(false) (sin navigate, sin signOut)

  3. return: unsubscribe
```

Tambien modificar `verifyRole`:
- Capturar el `error` de la query (actualmente se ignora con destructuring)
- Si hay error de query, hacer console.error y NO hacer signOut
- Solo hacer signOut si la query fue exitosa pero no hay rol valido

### Flujo corregido

```text
Login exitoso -> navigate("/admin/dashboard")
    |
    v
AdminAuthProvider monta
    |
    v
getSession() -> sesion existe -> verifyRole()
    |
    +-- Query OK, rol valido -> setUser() -> renderiza dashboard
    +-- Query OK, sin rol -> signOut() + redirect
    +-- Query ERROR -> log error, NO signOut (evita bucle)
    |
onAuthStateChange:
    +-- SIGNED_OUT -> setUser(null), setLoading(false)
    +-- Otros eventos -> ignorar
```

| Archivo | Cambio |
|---|---|
| `src/contexts/AdminAuthContext.tsx` | Reescribir useEffect para eliminar race condition; capturar errores en verifyRole |

