

## Implementar CRUD completo del modulo Oficinas

### Archivos a crear/modificar

1. **Crear `src/pages/admin/Branches.tsx`** -- Listado en cards con modal crear/editar (~400 lineas)
2. **Modificar `src/App.tsx`** -- Cambiar AdminStub por AdminBranches en `/admin/oficinas`

### Cambios en App.tsx

- Importar `AdminBranches` desde `./pages/admin/Branches`
- Linea 108: cambiar `AdminStub` por `AdminBranches` en la ruta `/admin/oficinas`

---

### Branches.tsx -- Componente principal

Seguir patron exacto de Extras.tsx/Discounts.tsx: mismo `writeAudit` helper, mismas importaciones shadcn, `useAdminAuth`, TanStack Query, toasts.

**Control de acceso:**
- Verificar `user.role === 'admin'` al inicio del componente
- Si no es admin, mostrar mensaje "No tienes permisos para acceder a esta seccion"

**Interfaces:**
```typescript
interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  manages_own_inventory: boolean;
  is_active: boolean;
  created_at: string;
}

interface BranchForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  manages_own_inventory: boolean;
  is_active: boolean;
}
```

**Query principal:**
```text
supabase.from("branches").select("*").order("name")
```

Sin paginacion (pocas oficinas normalmente). Carga completa.

**Queries de conteo (en paralelo):**
- Vehiculos por oficina: `supabase.from("vehicles").select("branch_id").not("branch_id", "is", null)` -- agrupar client-side por branch_id
- Usuarios por oficina: `supabase.from("internal_users").select("branch_id").not("branch_id", "is", null)` -- agrupar client-side por branch_id

Alternativamente, si la tabla vehicles no tiene branch_id, se adaptara al campo disponible.

**Layout en cards (grid responsive: 1 col mobile, 2 cols md, 3 cols lg):**

Cada card muestra:
- Nombre (titulo en negrita)
- Direccion, ciudad
- Telefono, email
- Badge verde "Activa" o rojo "Inactiva"
- Badge azul "Inventario propio" si manages_own_inventory = true
- Texto: "X vehiculos asignados"
- Texto: "X usuarios asignados"
- Botones: "Editar" (icono lapiz) y "Desactivar/Activar" (boton texto)
- NO hay boton eliminar

**Boton "Nueva oficina" arriba a la derecha.**

**Modal Crear/Editar (Dialog):**

Campos:
1. Nombre (obligatorio)
2. Direccion (address, obligatorio)
3. Ciudad (city, por defecto "Las Palmas de Gran Canaria")
4. Telefono (phone)
5. Email (email)
6. Toggle Inventario propio (manages_own_inventory) con texto explicativo debajo: "Activar solo si esta oficina gestiona su propio inventario de vehiculos de forma independiente. Por defecto la flota es global."
7. Toggle Activo/Inactivo (is_active)
8. Boton "GUARDAR"

Validaciones:
- name es obligatorio
- address es obligatorio

**Toggle Activo/Desactivar por fila:**
- Actualiza is_active en Supabase
- Registra en audit_log como update

**Audit log:**
- INSERT: action='insert', new_data
- UPDATE: action='update', old_data y new_data
- Desactivar/Activar: registrar como update

**Toasts:** exito o error en cada operacion.

### Dependencias

No se instalan paquetes nuevos. Se reutilizan: Card, Dialog, Input, Label, Switch, Badge, Button, Loader2.

