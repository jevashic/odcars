

## Implementar CRUD completo del modulo Clientes

### Archivos a crear/modificar

1. **Crear `src/pages/admin/Customers.tsx`** -- Listado con filtros, busqueda y paginacion (~350 lineas)
2. **Crear `src/pages/admin/CustomerDetail.tsx`** -- Ficha individual con historial (~400 lineas)
3. **Modificar `src/App.tsx`** -- Actualizar rutas

### Cambios en App.tsx

- Importar `AdminCustomers` y `AdminCustomerDetail`
- Linea 102: cambiar `AdminStub` por `AdminCustomers` en `/admin/clientes`
- Anadir ruta: `/admin/clientes/:id` con `AdminCustomerDetail`

---

### Vista 1 -- Customers.tsx (Listado)

Seguir patron exacto de Extras.tsx / Reservations.tsx: mismo writeAudit, mismas importaciones, useAdminAuth, TanStack Query.

**Query principal:**
```text
supabase.from("customers")
  .select("*", { count: "exact" })
  .order("created_at", { ascending: false })
  .range(from, to)
```

Paginacion de 15 en 15 con `.range()` server-side.

**Tabla con columnas:**
- Nombre completo (first_name + last_name)
- Email
- Telefono (phone)
- N licencia (license_number)
- Empresa (mostrar company_name si is_company=true, sino "-")
- Fecha registro (created_at formateado)
- Acciones: "Ver ficha" y "Editar"

**NO hay boton eliminar.** Un cliente nunca se elimina.

**Filtros:**
- Select: Todos / Particulares (is_company=false) / Empresas (is_company=true) -- aplicado server-side con `.eq("is_company", value)`
- Rango de fechas de registro: dos date pickers (desde/hasta) que filtran por created_at con `.gte()` y `.lte()`
- Input de busqueda por nombre, apellidos, email, telefono o n licencia -- filtrado client-side sobre resultados paginados

**Modal Editar:**

Campos:
1. Nombre (first_name, obligatorio)
2. Apellidos (last_name, obligatorio)
3. Email (obligatorio)
4. Telefono (phone)
5. Tipo documento (id_type): Select "DNI" / "Pasaporte" / "NIE" / "Otro"
6. N documento (id_number)
7. Nacionalidad (nationality)
8. N licencia conducir (license_number)
9. Fecha caducidad carnet (license_expiry): date picker
10. Toggle "Es empresa?" (is_company)
    - Si activo, mostrar campos adicionales:
      - Nombre empresa (company_name)
      - CIF/VAT empresa (company_vat)
11. Boton "GUARDAR"

Al guardar: UPDATE en customers, registrar en audit_log con action='update', old_data y new_data. Toast de exito/error.

---

### Vista 2 -- CustomerDetail.tsx (Ficha)

Se carga con `useParams()` para obtener el `id`.

**Query principal:**
```text
supabase.from("customers")
  .select("*")
  .eq("id", customerId)
  .single()
```

**Query de reservas del cliente:**
```text
supabase.from("reservations")
  .select("*, vehicle_categories(name)")
  .eq("customer_id", customerId)
  .order("created_at", { ascending: false })
```

**Layout dos columnas (grid lg:grid-cols-3, izquierda 2 cols, derecha 1 col):**

#### Columna izquierda (2/3)

**Bloque 1 -- Datos personales (Card):**
- Nombre completo, email, telefono
- Tipo y numero de documento
- Nacionalidad
- Si es empresa: nombre empresa y CIF/VAT
- Boton "Editar" que abre el mismo modal de edicion

**Bloque 2 -- Licencia de conducir (Card):**
- N licencia, fecha caducidad
- Badge verde "Vigente" si license_expiry > fecha actual
- Badge rojo "Caducada" si license_expiry <= fecha actual
- Si no tiene license_expiry, Badge gris "Sin fecha"

#### Columna derecha (1/3)

**Bloque 3 -- Estadisticas del cliente (Card):**
Calculadas en el cliente a partir del array de reservas:
- Total reservas realizadas (length)
- Total gastado (suma de total_amount)
- Primera reserva (min de created_at)
- Ultima reserva (max de created_at)
- Canal mas usado (mode de sale_channel)

**Bloque 4 -- Historial de reservas (Card):**
Tabla compacta con columnas:
- N reserva (reservation_number)
- Fechas (pickup_date - return_date)
- Categoria (del join vehicle_categories)
- Total (total_amount)
- Estado (badge coloreado, reutilizar statusBadge helper)
- Cada fila enlaza a `/admin/reservas/:id`

---

### Patron de codigo

- Mismo helper `writeAudit` inline
- `useQuery` + `useQueryClient` de TanStack
- `useAdminAuth` para usuario
- Toasts con `@/hooks/use-toast`
- Breadcrumb en la ficha: "Clientes > {nombre}"
- Boton "Volver" en la ficha

### Dependencias

No se instalan paquetes nuevos. Se reutilizan componentes shadcn existentes: Table, Dialog, Select, Input, Badge, Button, Label, Textarea, Card, Breadcrumb, Separator, Switch, Popover, Calendar.

