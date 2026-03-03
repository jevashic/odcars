

## Modulo Usuarios - CRUD completo en /admin/usuarios

### Resumen

Crear el componente completo de gestion de usuarios internos con listado, filtros, creacion y edicion. Para crear usuarios en Supabase Auth se necesita una **edge function** que use la `service_role` key (no se puede hacer desde el frontend por seguridad).

---

### Archivos a crear/modificar

1. **Crear `supabase/functions/create-internal-user/index.ts`** -- Edge function que recibe email + password y llama a `supabase.auth.admin.createUser()` con la service_role key. Devuelve el `auth_user_id`.

2. **Actualizar `supabase/config.toml`** -- Registrar la funcion con `verify_jwt = false` (validacion manual en codigo).

3. **Crear `src/pages/admin/Users.tsx`** -- Componente completo (~450 lineas).

4. **Modificar `src/App.tsx`** -- Importar `AdminUsers` y reemplazar `AdminStub` en la ruta `/admin/usuarios`.

---

### Edge function: create-internal-user

- Recibe: `{ email, password, full_name, role, branch_id, is_active }`
- Valida que el llamante sea un admin (extraer JWT con `getClaims`, consultar `internal_users` para verificar rol admin)
- Crea usuario en Auth con `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
- Inserta registro en `internal_users` con el `auth_user_id` devuelto
- Registra en `audit_log`
- Devuelve el usuario creado

Requisito: el admin debe agregar `SUPABASE_SERVICE_ROLE_KEY` como secreto del proyecto.

---

### Users.tsx - Estructura del componente

**Control de acceso:** Solo rol `admin`. Si no es admin, mensaje "No tienes permisos".

**Queries (TanStack Query):**
- `internal_users` con columnas: id, auth_user_id, full_name, email, role, branch_id, is_active, created_at
- `branches` (activas) para el select de oficina y para mostrar nombre de oficina en la tabla

**Listado - Tabla:**

| Nombre | Email | Rol | Oficina | Activo | Fecha alta | Acciones |

- Rol con badge de color: admin=rojo, manager=azul, employee=verde
- Oficina: nombre de la branch asociada o "-"
- Activo: badge verde/gris
- Acciones: botones Editar y Desactivar

**Filtros (encima de la tabla):**
- Select por rol (todos / admin / manager / employee)
- Select por oficina (todas / lista de branches)
- Select activo/inactivo (todos / activos / inactivos)
- Input buscador por nombre o email

**Boton "Nuevo usuario"** arriba a la derecha.

**Modal Crear:**
- full_name (obligatorio)
- email (obligatorio)
- Contrasena temporal (autogenerada, editable, min 8 chars)
- Rol: select employee/manager/admin
- Oficina: select desde branches activas
- Toggle is_active (default true)
- Boton "CREAR USUARIO"
- Al crear exitosamente: mostrar dialog con la contrasena temporal para que el admin la copie

**Modal Editar:**
- full_name
- Rol: select
- Oficina: select
- Toggle is_active
- Email mostrado pero NO editable
- Boton "GUARDAR"

**Desactivar:** Update `is_active = false` + audit_log + toast.

**Audit:** Todas las operaciones (insert, update) registradas en audit_log con old_data y new_data.

---

### Detalle tecnico

- Generacion de contrasena temporal: funcion que genera 12 caracteres alfanumericos + simbolo
- La edge function usa `createClient` con `SUPABASE_SERVICE_ROLE_KEY` para tener permisos admin
- El frontend llama a la edge function via `supabase.functions.invoke('create-internal-user', { body: ... })`
- Para editar: update directo en `internal_users` desde el frontend (no requiere service role)
- Patron identico a Branches.tsx: writeAudit helper, useQuery, toast, Dialog

