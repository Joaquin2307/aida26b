# Entrega Grupo 4 - Taller ARI

Integrantes: 
- Ezequiel Salgado Salevsky - 650/20
- Joaquín Paris Puebla - 1311/23

Partimos de aida26b, una app de gestion de alumnos, y la adaptamos a un sistema con proveedores, artículos y comprobantes. 
La app de la cátedra ya segúia la idea de SSOT, el structure.ts se encarga de esto, declara las tablas, columnas, relaciones y permisos, y a partir de eso tenemos los CRUDs, la validación y el frontend. Entendemos que esto era parte de la consigna pero lo aclaramos para que se entienda que el espíritu del trabajo de la entrega era expandir este modelo ssot pero adaptado a otro modelo.

## Modelo de dominio

Modelamos 4 tablas:

- proveedores: emisores del comprobante (PK: cuit)
- articulos: ítems facturables (PK: codigo, con precio_unitario).
- comprobantes:la factura (PK: numero, FK a proveedores.cuit)
- detalle_comprobante: ítems de línea, relación 1→N: un comprobante contiene muchos artículos con su cantidad' (PK compuesta por numero + codigo, ON DELETE CASCADE).

Como partimos del proyecto de alumnos, las tablas viejas (students, subjects, enrollments) quedaban en la base aunque el ssot ya no las declara. Las dropeamos con una migracion que además saca la FK muerta de auth.users a students. El esquema final queda solo con el dominio nuevo:

![diagram](diagram.png)

## Flujo de creacion de un comprobante

El caso de uso que guió el diseño fue el de dar de alta un comprobante a partir de un proveedor y sus artículos:

1. Elegir proveedor: El comprobante referencia por FK a 'proveedores.cuit', la db garantiza que no se pueda facturar a un proveedor inexistente.

2. Elegir artículos y cantidades: Cada línea del detalle referencia a 'articulos.codigo' con una 'cantidad' (CHECK (cantidad > 0)).

3. Crear todo en una sola operación atómica: El endpoint /api/comprobantes/with-items inserta el comprobante y todas sus líneas dentro de una única transacción. Si una línea falla, se revierte todo y así nunca queda un comprobante huerfano sin detalle. 
Es genérico —lo maneja la relación `detailOf` del SSOT—, así que sirve para cualquier par padre/detalle, no solo comprobantes.

4. El total no se ingresa: se deriva. Eliminamos la columna 'total' guardada. Ahora se calcula como 'SUM(cantidad * precio_unitario)' sobre el detalle. Como la fóRmula vive en el ssot, el total es siempre coheremte.

## Features que agregamos

La idea general es que solo agregamos SQL donde el motor genérico no llega: todo lo demás lo sigue generando el SSOT. Las migraciones nuevas son porque el esquema físico del dominio es lo único que no se puede derivar
del ssot y hay que crearlo; cada una lleva un comentario de una línea con su motivo.

### 1. Creación atómica padre + detalle 
Ver: with_items.ts. Da de alta el comprobante y todas sus líneas de detalle 
en una sola operación. Lo hacemos así para que nunca quede un comprobante huérfano sin detalle: si falla una línea, se revierte todo. 
Es genérico (lo maneja la relación detailOf del ssot), así que sirve para cualquier par padre/detalle, no solo comprobantes.
Los INSERT van dentro de una transacción explícita (BEGIn/COMMIT/ROLLBACK), porque el motor genérico inserta una fila por request 
y acá necesitamos atomicidad entre varias. Ver migración 'detalle_comprobante' (relación 1:N con ON DELETE CASCADE).

### 2. Reportes mensuales genéricos  
Ver: report.ts. Agrega datos por mes sobre cualquier tabla: agrupa por una o más columnas, cuenta las filas de cada grupo y, si se le pasa una columna numérica, la suma (x ejemplo el total de los comprobantes). Lo hicimos genérico y manejado por la metadata del ssot, en lugar de un endpoint hardcodeado por reporte, para poder sumar reportes nuevos solo declarándolos.
Acá escribimos a mano una query que agrupa y suma, porque el CRUD sabe listar filas pero no totalizarlas. Los nombres de columna que llegan por parámetro solo se aceptan si están en la whitelist de columnas reales de la tabla (sale del ssot); cualquier otra cosa se rechaza, así no se cuela un nombre inventado dentro del SQL. Los filtros los reusa del helper filter_ de get.ts, que arma los WHERE según lo que elige el usuario

### 3. Columnas derivadas
Ver: sqlGenerationStatement en structure.ts. Valores calculados por SQL que se declaran en el ssot, como el total del comprobante (SUM(cantidad * precio_unitario)) o el subtotal de cada línea. Lo resolvimos así para que el total no se pueda desincronizar de las líneas: no es un campo que se ingresa, es una fórmula.
El subquery del total no es SQL suelto, vive declarado como fórmula de la columna en el ssot. Y como el total dejó de guardarse, la migración 'comprobante_total_derived' hace el DROP COLUMN total.

### 4. RBAC con tres niveles de privilegio
Ver: access en structure.ts (canRoleDo) y access por reporte (canRoleRunReport). Cada tabla declara en el ssot quién puede hacer read/create/update/delete, y cada reporte declara quién puede correrlo; esas mismas declaraciones las usan el backend (middlewares) y el frontend (para mostrar/ocultar tabs, botones y formularios), así que hay una única fuente de permisos sin reglas duplicadas.

Definimos **tres niveles de privilegio** pensados en los roles reales de una gestión de comprobantes:

- **admin**: puede todo — CRUD completo de las cuatro tablas y todos los reportes.
- **administrativo**: es quien carga la operatoria diaria. Ve y **agrega** proveedores, artículos y comprobantes (read + create), pero **no** edita ni borra (eso queda para el admin) y **no** accede a los reportes.
- **contador**: **solo** genera reportes. No tiene acceso a ninguna tabla: no ve las grillas ni puede leer/modificar datos, solo la vista de reportes.

La decisión de diseño clave fue **desacoplar el acceso a reportes del `read` de las tablas**. Con el modelo original "ver reportes = poder leer la tabla" no se podían expresar estos roles: el administrativo necesita leer comprobantes para cargarlos pero no debe ver reportes, y el contador debe ver reportes sin entrar a las tablas. Por eso agregamos un `access` propio a nivel de reporte en el ssot (`canRoleRunReport`), separado del access de tabla. Como refuerzo, el endpoint de reporte "ad-hoc" (agrupación libre por parámetros) quedó reservado al admin, para que un rol de solo-reportes no pueda reconstruir filas agrupando por la clave primaria.

Acá no tocamos SQL: todo el RBAC se resuelve en la capa de aplicación a partir del ssot. La migración `roles_administrativo_contador` solo ajusta el CHECK de `auth.users` y convierte los usuarios existentes.

### 5. Validación compartida front + back
Ver: shared/validation/validate.ts. Las reglas de cada columna (tipo, required, regex, min/max, fecha) se declaran una sola vez en el ssot y las usan los dos lados: el backend valida siempre antes de tocar la db, y el frontend da el mismo feedback en vivo con la misma función. Así una regla nueva no se puede desincronizar entre front y back.

### 6. Migraciones forward-only e inmutables
Ver: migrate.ts. El schema se versiona con migraciones nombradas por timestamp que corren en orden. Una vez aplicada, una migración es inmutable: guardamos su checksum y el runner aborta si alguien la edita. Para revertir se escribe una migración nueva, nunca se toca la vieja; agregar/cambiar tablas o columnas es siempre una migración más.

### 7. Testing
Tres niveles: unit (vitest) para la lógica de auth/RBAC y los pickers del menú; integración contra una db real (test:db) que ejercita el CRUD genérico de las cuatro tablas, incluidas las columnas derivadas; y e2e con Playwright para paginación y filtros desde el navegador.

El SQL del CRUD base (post/put/delete y el SELECT/JOIN de get) no se modificó: lo sigue generando el motor a partir del ssot. La UI además es bilingüe (ES/EN) y tiene tema claro/oscuro, todo declarado en el ssot.