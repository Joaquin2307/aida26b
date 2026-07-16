# Sistema de Carga de Comprobantes

Sistema para gestionar proveedores, artículos y comprobantes (con su detalle de ítems). Todo el dominio se declara en un único **Single Source of Truth** (`shared/src/ssot/structure.ts`): a partir de esa declaración se derivan los CRUD, la validación, el frontend y los permisos, de modo que agregar una tabla no requiere escribir endpoints nuevos.

## Características

- **Proveedores**: CRUD con CUIT como identificador
- **Artículos**: CRUD con código como identificador, con precio unitario
- **Comprobantes**: la factura (FK al proveedor); su total se **deriva** del detalle, no se ingresa
- **Detalle de comprobante**: ítems de línea (relación 1→N, PK compuesta), creados atómicamente junto al comprobante
- **Reportes mensuales** genéricos, declarados en el SSOT
- **RBAC de tres niveles**: `admin` (todo), `administrativo` (ve y agrega proveedores/artículos/comprobantes, sin reportes) y `contador` (solo reportes)
- **Interfaz Web**: grillas interactivas con agregar/editar/eliminar, filtros, orden y paginación; tema claro/oscuro y ES/EN
- **API REST** genérica en Node.js + TypeScript sobre PostgreSQL

## Tecnologías Utilizadas

- **Backend**: Node.js, TypeScript, Express.js
- **Frontend**: Vanilla TypeScript, HTML5, CSS3
- **Base de Datos**: PostgreSQL
- **ORM**: SQL directo con pg library

## Estructura del Proyecto

```
/
├── backend/           # API REST
│   ├── src/
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/          # Interfaz web
│   ├── src/
│   │   └── app.ts
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json
├── database/
│   ├── bootstrap.sql       # Crea roles y base de datos (corre una vez)
│   └── migrations/         # Migraciones SQL versionadas
└── README.md
```

## Instalación y Configuración

### Prerrequisitos

- Node.js (versión 16 o superior)
- PostgreSQL (versión 12 o superior)
- npm o yarn

### Base de Datos

1. Setup inicial (una vez por entorno, como superusuario de Postgres):
   ```
   psql -U postgres -f database/bootstrap.sql
   ```
   Esto crea los roles `aida26_owner` / `aida26_user` y la base `faculty_management`.

2. Aplicar migraciones (desde `backend/`):
   ```
   npm run migrate
   ```
   Esto crea/actualiza las tablas según los archivos en `database/migrations/`.

   Las migraciones son **forward-only** y nombradas con timestamp
   (ej. `20260520_120000_initial_schema.sql`). Para cambiar el schema,
   se agrega una migración nueva — nunca se editan las ya aplicadas.

   **Para deshacer un cambio:** no se edita la migración original — se escribe
   una migración nueva que aplique el revert. Ej: si
   `20260601_120000_add_phone.sql` hizo `ALTER TABLE students ADD COLUMN phone`,
   para sacarla escribimos `20260602_090000_remove_phone.sql` con
   `ALTER TABLE students DROP COLUMN phone`. Las migraciones aplicadas son
   inmutables — modificarlas rompe la verificación de checksum.

### Backend

1. Navegar al directorio `backend`
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno en `.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=faculty_management
   DB_USER=tu_usuario
   DB_PASSWORD=tu_contraseña
   PORT=3000
   ```
4. Compilar solo backend: `npm run build`
5. Ejecutar: `npm start` (servirá en http://localhost:3000 y también servirá `frontend/dist`)

### Frontend

1. Navegar al directorio `frontend`
2. Instalar dependencias: `npm install`
3. Compilar assets de producción: `npm run build`
4. Ejecutar el servidor de desarrollo con proxy API: `npm run dev` (servirá en http://localhost:8080)

### Comandos desde la raíz

1. Instalar frontend y backend: `npm run install:all`
2. Compilar frontend y backend: `npm run build`
3. Ejecutar backend compilado: `npm start`
4. Ejecutar backend en desarrollo: `npm run dev:backend`
5. Ejecutar frontend en desarrollo: `npm run dev:frontend`
6. Ejecutar tests unitarios frontend+backend: `npm test`
7. Ejecutar tests de integración con base de datos: `npm run test:db`
8. Ejecutar tests E2E Playwright: `npm run test:e2e`

## Uso

1. Ejecutar el backend: `npm start` en la raíz o en el directorio backend (servirá en http://localhost:3000)
2. Abrir el navegador en http://localhost:3000 e iniciar sesión
3. Según el rol, navegar entre Proveedores, Artículos y Comprobantes, o la vista de Reportes
4. Usar los botones "Agregar" para crear registros (los comprobantes se cargan junto a su detalle de ítems)
5. Usar "Editar" y "Eliminar" en cada fila de las grillas

## API Endpoints

La API es **genérica y guiada por el SSOT**: hay una ruta por operación parametrizada por `:tableName` (una de `proveedores`, `articulos`, `comprobantes`, `detalle_comprobante`), no un set de endpoints por tabla. La clave primaria va por query params.

### CRUD genérico
- `GET /api/:tableName` — listar (soporta `?page=`, `?sort=`, `?dir=`, `?filter_<col>=`)
- `GET /api/:tableName?<pk>=<valor>` — obtener un registro (PK compuesta: varios params)
- `POST /api/:tableName` — crear
- `PUT /api/:tableName?<pk>=<valor>` — actualizar
- `DELETE /api/:tableName?<pk>=<valor>` — eliminar

### Compuestos y reportes
- `POST /api/:tableName/with-items` — crea un padre y su detalle en una transacción atómica (ej. comprobante + ítems)
- `GET /api/reports/:tableName/monthly?report=<key>&view=<key>&year=&month=` — reporte mensual declarado en el SSOT

### Autenticación
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- `POST /api/admin/users`, `POST /api/admin/users/:id/reset-password` (solo `admin`)

Todas las rutas de negocio exigen sesión y aplican RBAC según el rol declarado en el SSOT.

## Roles

- **admin**: acceso total (CRUD de todas las tablas + reportes).
- **administrativo**: ve y agrega proveedores, artículos y comprobantes (read + create); no edita/borra ni genera reportes.
- **contador**: solo genera reportes; sin acceso a las tablas.

## Desarrollo Futuro

- Búsqueda de texto completo y reportes adicionales
- Exportación de comprobantes/reportes (PDF/CSV)
- 2FA en la autenticación

## Testing de Paginación (Frontend + TypeScript)

La paginación del frontend usa el parámetro `page` y el backend pagina con un `limit` fijo de **20** registros por página.
El UI muestra el estado como: `Página X de Y (Total: N)` y ofrece botones `Anterior` / `Siguiente`.

### Prerrequisitos

- Backend y base de datos corriendo (la suite crea y borra registros de `students` vía API)
- Frontend servido en el mismo host/puerto que el backend (por defecto `http://localhost:3000`)
- Node.js 18+

### Ejecutar los tests

1. Instalar dependencias del frontend:
   - `cd frontend`
   - `npm install`
   - `npx playwright install`
2. (Opcional) Configurar URL base (por defecto `http://localhost:3000`):
   - `set E2E_BASE_URL=http://localhost:3000`
3. Ejecutar (desde `frontend/`):
   - `npm run test:e2e`

Por defecto corre en modo headless. Para ver el navegador:

- `set E2E_HEADLESS=0`

### Casos cubiertos

- Contenido menor a una página (ej: 5 items → 1/1)
- Contenido exactamente una página (20 items → 1/1)
- Contenido mayor a una página (21 items → 1/2, navegación prev/next)
- Muchas páginas (85 items → 1/5 ... 5/5)

## Contribución

Este proyecto es parte del sistema académico de la Facultad de Ciencias Exactas. Para contribuciones, por favor contactar al equipo de desarrollo.

## Licencia

Este proyecto es propiedad de la Universidad de Buenos Aires - Facultad de Ciencias Exactas.
