

## Reemplazar modulo Seguros con CRUD de insurance_plans

### Archivo a modificar

1. **Reescribir `src/pages/admin/Insurance.tsx`** -- Reemplazar completamente con nuevo componente (~300 lineas)

No se necesitan cambios en App.tsx ya que la ruta `/admin/seguros` ya apunta a `AdminInsurance`.

---

### Insurance.tsx -- Componente completo

Seguir patron exacto de Branches.tsx: mismo `writeAudit` helper, mismas importaciones shadcn, `useAdminAuth`, TanStack Query, toasts.

**Control de acceso:**
- Verificar `user.role === 'admin'`
- Si no es admin, mostrar mensaje "No tienes permisos para acceder a esta seccion"

**Interfaces:**
```text
interface InsurancePlan {
  id: string;
  name: string;
  description: string | null;
  plan_type: "basic" | "premium";
  price_per_reservation: number;
  eliminates_deposit: boolean;
  is_active: boolean;
}

interface PlanForm {
  name: string;
  description: string;
  price_per_reservation: number;
  eliminates_deposit: boolean;
  is_active: boolean;
}
```

**Query principal:**
```text
supabase.from("insurance_plans").select("*").order("plan_type")
```

**Query adicional para fianzas por categoria:**
```text
supabase.from("vehicle_categories").select("id, name, deposit_amount_base")
```
Se muestra en la card del plan basico la fianza de cada categoria.

**Layout:**

Cabecera: "Seguros" + subtitulo descriptivo. NO hay boton "Nuevo" (solo existen 2 planes fijos).

Dos cards grandes en grid 2 columnas:

**Card BASICO (plan_type = 'basic'):**
- Icono Shield + nombre + descripcion
- Precio: "Incluido en el alquiler" (texto fijo)
- Fianza: listado de fianzas por categoria (nombre categoria: X euros) cargado de vehicle_categories.deposit_amount_base
- Badge Activo/Inactivo
- Boton "Editar"

**Card PREMIUM (plan_type = 'premium'):**
- Icono ShieldCheck + nombre + descripcion
- Suplemento: price_per_reservation formateado en euros
- Fianza: "0 euros -- Eliminada completamente" (texto fijo)
- Badge Activo/Inactivo
- Boton "Editar"

**Modal Editar (Dialog):**

Campos:
1. Nombre (obligatorio)
2. Descripcion (textarea)
3. Suplemento precio en euros (price_per_reservation) -- si plan_type='basic', input deshabilitado con valor 0
4. Toggle Elimina fianza (eliminates_deposit) -- si plan_type='basic', switch deshabilitado con valor false
5. Toggle Activo/Inactivo (is_active)
6. Boton "GUARDAR"

Texto informativo debajo del formulario:
"El seguro basico siempre esta incluido en el precio por dia de cada categoria. El suplemento premium se suma al total en el proceso de reserva."

**Save:**
- Update en insurance_plans por id
- writeAudit con action='update', old_data (plan original), new_data (plan actualizado)
- Toast exito/error
- Invalidar query

### Dependencias

No se instalan paquetes nuevos. Se reutilizan: Card, Dialog, Input, Label, Switch, Badge, Button, Textarea, Loader2, iconos Shield/ShieldCheck de lucide.

