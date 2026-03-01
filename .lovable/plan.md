

## Reestructurar menu lateral admin - VERSION DEFINITIVA

### Archivo: `src/pages/admin/AdminLayout.tsx`

### Estructura por rol

```text
employee:            manager:                 admin:
- Reservas           - Reservas               - Reservas
- Flota              - Flota                  - Flota
- Clientes           - Clientes               - Clientes
                     - Categorias             - Categorias
                     - Precios                - Precios
                     - Extras                 - Extras
                     - Descuentos             - Descuentos
                     - Facturacion            - Facturacion
                     - Informes               - Informes
                                              - Oficinas
                                              - Seguros
                                              - Informes completos
                                              --------------------
                                              [Config. Avanzada v]
                                                - Usuarios
                                                - Contenido web
                                                - Conoce Gran Canaria
                                                - Banners
                                                - Chat
                                                - Newsletter
                                                - Branding
```

### Cambios concretos

**1. Redefinir `mainLinks`** con 12 items y roles correctos:

| Item | Roles |
|------|-------|
| Reservas | employee, manager, admin |
| Flota | employee, manager, admin |
| Clientes | employee, manager, admin |
| Categorias | manager, admin |
| Precios | manager, admin |
| Extras | manager, admin |
| Descuentos | manager, admin |
| Facturacion | manager, admin |
| Informes | manager, admin |
| Oficinas | admin |
| Seguros | admin |
| Informes completos | admin |

**2. Redefinir `configLinks`** con solo 7 items (todos admin only):
- Usuarios, Contenido web, Conoce Gran Canaria, Banners, Chat, Newsletter, Branding

**3. Cambiar texto del boton colapsable** de "Configuracion" a "Configuracion Avanzada" y anadir emoji de engranaje en el texto (no como icono separado).

**4. Sin cambios en logica de estados, animaciones ni filtrado por rol** -- se reutiliza todo lo existente.

### Archivo a modificar
- `src/pages/admin/AdminLayout.tsx`

