

## Corrección definitiva de AdminAuthContext.tsx

El menú lateral (`AdminLayout.tsx`) ya tiene la estructura correcta con los roles bien asignados. El problema es que `AdminAuthContext.tsx` **nunca fue actualizado** y sigue bloqueando el renderizado del dashboard.

### Problemas actuales en `AdminAuthContext.tsx`

1. **Linea 96**: `if (!user) return null` -- despues de cargar, si no hay usuario valido, renderiza NADA (pantalla blanca permanente en vez de redirigir al login)
2. **Race condition**: `onAuthStateChange` (linea 60-67) y `getSession` (linea 71-76) ambos llaman a `verifyRole` simultaneamente
3. **Sin manejo de errores**: la query a `internal_users` no captura errores de BD

### Cambios a realizar en `src/contexts/AdminAuthContext.tsx`

**A) Funcion `verifyRole`** -- Capturar error de BD y garantizar `setLoading(false)` en todas las ramas:

- Desestructurar `error` de la query
- Si hay error de BD: log del error + `setLoading(false)` + return (sin cerrar sesion)
- Si no hay rol valido: signOut + setUser(null) + `setLoading(false)` + return
- Si todo OK: setUser + `setLoading(false)`

**B) `onAuthStateChange`** -- Solo reaccionar a SIGNED_OUT:

```
onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    setUser(null);
  }
})
```

No llama a verifyRole, no navega, no toca loading.

**C) `getSession`** -- Unica fuente de verificacion inicial:

```
getSession().then(({ data: { session } }) => {
  if (session?.user) {
    verifyRole(session.user.id, session.user.email ?? "");
  } else {
    setLoading(false);
  }
});
```

Sin `setLoading(false)` fuera del else (lo maneja verifyRole internamente).

**D) Linea 96** -- Redirigir en vez de pantalla blanca:

Cambiar `if (!user) return null` por:

```typescript
if (!user) {
  navigate("/admin", { replace: true });
  return null;
}
```

### Archivo a modificar

- `src/contexts/AdminAuthContext.tsx`

### Resultado esperado

- El dashboard carga correctamente y muestra el menu lateral segun el rol del usuario
- Si falla la verificacion, redirige al login en vez de quedarse en blanco
- No hay race condition entre listener y getSession
