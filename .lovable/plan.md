

## Corregir bucle de login en el panel de administracion

### Causa raiz

El problema es una **race condition** entre `onAuthStateChange` y `getSession` en `AdminAuthContext.tsx`, combinada con el uso de `.single()` que lanza error si no encuentra fila.

El flujo actual:
1. Login.tsx: login exitoso -> navigate("/admin/dashboard")
2. AdminLayout monta -> AdminAuthProvider monta
3. `onAuthStateChange` dispara evento SIGNED_IN -> llama `verifyRole()`
4. `getSession()` tambien llama `verifyRole()` en paralelo
5. Mientras tanto, `onAuthStateChange` puede disparar sin sesion -> ejecuta `navigate('/admin')` (linea 64), devolviendo al usuario al login

Ademas, `.single()` lanza un error (no devuelve null) cuando no hay filas o hay mas de una, lo que hace que `internal` sea null incluso si es un problema transitorio.

### Cambios

#### 1. `src/contexts/AdminAuthContext.tsx`

- Reemplazar `.single()` por `.maybeSingle()` para manejar correctamente el caso sin resultados
- Capturar errores de la query y NO hacer signOut si es error de red/RLS (solo si realmente no tiene rol)
- Eliminar el `navigate('/admin')` dentro de `onAuthStateChange` cuando no hay sesion (no debe redirigir en el evento inicial)
- Usar un flag para evitar que `onAuthStateChange` y `getSession` ejecuten `verifyRole` concurrentemente
- Solo verificar rol una vez al montar (via `getSession`), y en `onAuthStateChange` solo reaccionar a SIGNED_OUT

#### 2. `src/pages/admin/Login.tsx`

- Eliminar `console.log` inalcanzable en linea 38 (despues de `return`)
- Usar `.maybeSingle()` en vez de `.single()`

### Detalle tecnico

```text
Flujo corregido:

Login exitoso
    |
    v
navigate("/admin/dashboard")
    |
    v
AdminAuthProvider monta
    |
    v
getSession() -> session existe -> verifyRole()
    |
    +-- Query OK, rol valido -> setUser() -> renderiza dashboard
    +-- Query OK, sin rol -> signOut() + redirect (correcto)
    +-- Query ERROR -> log error, NO signOut (puede ser transitorio)
    |
onAuthStateChange:
    +-- SIGNED_OUT -> setUser(null) (sin navigate, ya esta en /admin)
    +-- SIGNED_IN -> ignorar (ya verificado por getSession)
```

| Archivo | Cambio |
|---|---|
| `src/contexts/AdminAuthContext.tsx` | Usar `.maybeSingle()`, eliminar race condition, no redirigir en `onAuthStateChange` sin sesion, capturar errores de query |
| `src/pages/admin/Login.tsx` | Usar `.maybeSingle()`, eliminar codigo muerto |
