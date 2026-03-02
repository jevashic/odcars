

## Implementar CRUD completo del modulo Descuentos

### Archivos a crear/modificar

1. **Crear `src/pages/admin/Discounts.tsx`** -- Listado con filtros, busqueda, paginacion y modal crear/editar (~500 lineas)
2. **Modificar `src/App.tsx`** -- Cambiar AdminStub por el nuevo componente en `/admin/descuentos`

### Cambios en App.tsx

- Importar `AdminDiscounts` desde `./pages/admin/Discounts`
- Linea 103: cambiar `AdminStub` por `AdminDiscounts` en `/admin/descuentos`

---

### Discounts.tsx -- Componente principal

Seguir patron exacto de `Extras.tsx`: mismo `writeAudit` helper, mismas importaciones shadcn, `useAdminAuth`, TanStack Query, toasts.

**Interfaces:**
```typescript
interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_days: number | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  current_uses: number;
  restricted_to_email: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}
```

**Query principal:**
```text
supabase.from("discount_codes")
  .select("*", { count: "exact" })
  .order("created_at", { ascending: false })
  .range(from, to)
```

Paginacion de 15 en 15 con `.range()` server-side.

**Tabla con columnas:**
- Codigo (code)
- Descripcion (truncada)
- Tipo: Badge azul "%" si percentage, Badge verde "euro" si fixed_amount
- Valor (formateado con % o euro segun tipo)
- Usos/Maximo (current_uses / max_uses, o "Ilimitado" si max_uses es null)
- Valido desde (valid_from formateado)
- Valido hasta (valid_until formateado, o "Sin caducidad")
- Activo (Badge verde/rojo)
- Acciones: Editar + Desactivar

**Filtros (encima de la tabla):**
- Select: Todos / Activos / Inactivos -- filtrado server-side con `.eq("is_active", value)`
- Select: Todos / Porcentaje / Importe fijo -- filtrado server-side con `.eq("discount_type", value)`
- Input de busqueda por codigo o descripcion -- filtrado client-side

**Acciones por fila:**
- Boton "Editar" -- abre modal con datos precargados
- Boton "Desactivar/Activar" -- toggle directo de is_active con update en Supabase y registro en audit_log
- NO hay boton eliminar

**Detalle de usos (expandible o en dialogo al hacer clic en una fila):**
Al hacer clic en un codigo, abrir un Dialog que muestra:
- Query: `supabase.from("discount_code_usage").select("*, customers(first_name, last_name, email), reservations(reservation_number)").eq("discount_code_id", id)`
- Tabla con columnas: Cliente (nombre), Email, N Reserva, Fecha de uso
- Resumen: "X usos realizados de Y permitidos" (o "X usos realizados - Ilimitado")

**Modal Crear/Editar:**

Campos:
1. Codigo (code, obligatorio, `toUpperCase()` automatico en onChange)
2. Descripcion (textarea)
3. Tipo de descuento (Select: "Porcentaje %" / "Importe fijo euro", obligatorio)
4. Valor del descuento (numero, obligatorio). Mostrar sufijo "%" o "euro" segun tipo seleccionado
5. Minimo de dias para aplicar (min_days, numero)
6. Maximo de usos totales (max_uses, numero). Si vacio = ilimitado
7. Maximo de usos por cliente (max_uses_per_customer, numero)
8. Restringido a email (restricted_to_email, input email)
9. Fecha inicio validez (valid_from, date input, obligatorio)
10. Fecha fin validez (valid_until, date input). Si vacia = sin caducidad
11. Toggle Activo/Inactivo (is_active)
12. Boton "GUARDAR"

Validaciones:
- code es obligatorio y se convierte a mayusculas
- discount_type es obligatorio
- discount_value es obligatorio y mayor que 0
- valid_from es obligatorio
- Si discount_type es percentage, validar que discount_value <= 100

**Audit log:**
- INSERT: registrar action='insert' con new_data
- UPDATE: registrar action='update' con old_data y new_data
- Desactivar/Activar: registrar como update

**Toasts:** exito o error en cada operacion.

### Dependencias

No se instalan paquetes nuevos. Se reutilizan componentes shadcn existentes: Table, Dialog, AlertDialog, Select, Input, Badge, Button, Label, Textarea, Switch, Popover, Calendar.

