import { TableStructure, Role, TableAction, ReportDef } from '../types/types';

type LocalizedText = {
  es: string;
  en: string;
};

function getCurrentLanguage(): keyof LocalizedText {
  return globalThis.localStorage?.getItem('language') === 'en' ? 'en' : 'es';
}

function localizeText(text: LocalizedText): string {
  return text[getCurrentLanguage()] ?? text.es;
}

export const structure = {
  tables: {
    proveedores: {
      // Only admins manage providers; editors and readers can view them.
      access: { create: ['admin'], update: ['admin'], delete: ['admin'] },
      columns: {
        cuit: {
          type: 'string',
          label: { es: 'CUIT', en: 'Tax ID' },
          readonlyOnEdit: true,
          validator: {
            required: true,
            pattern: '^\\d{2}-\\d{8}-\\d$',
            patternMessage: 'must match pattern NN-NNNNNNNN-N',
          },
        },

        razon_social: {
          type: 'string',
          label: { es: 'Razón Social', en: 'Business Name' },
          validator: {
            required: true,
          },
        },

        email: {
          type: 'string',
          label: { es: 'Email', en: 'Email' },
          input: 'email',
          validator: {
            nullable: true,
            pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
            patternMessage: 'must be a valid email address',
          },
        },

        telefono: {
          type: 'string',
          label: { es: 'Teléfono', en: 'Phone' },
          validator: {
            nullable: true,
          },
        },

        direccion: {
          type: 'string',
          label: { es: 'Dirección', en: 'Address' },
          validator: {
            nullable: true,
          },
        },

        condicion_iva: {
          type: 'string',
          label: { es: 'Condición IVA', en: 'Tax Status' },
          input: 'select',
          validator: {
            nullable: true,
          },
          options: [
            {
              value: 'responsable_inscripto',
              label: { es: 'Responsable Inscripto', en: 'Registered' },
            },
            {
              value: 'monotributo',
              label: { es: 'Monotributo', en: 'Monotax' },
            },
            { value: 'exento', label: { es: 'Exento', en: 'Exempt' } },
            {
              value: 'consumidor_final',
              label: { es: 'Consumidor Final', en: 'Final Consumer' },
            },
          ],
        },
      },
      pk: 'cuit',
      uiName: { es: 'Proveedor', en: 'Provider' },
      title: { es: 'Proveedores', en: 'Providers' },
      addButtonLabel: { es: 'Agregar Proveedor', en: 'Add Provider' },
    } satisfies TableStructure,

    articulos: {
      // Only admins manage articles; editors and readers can view them.
      access: { create: ['admin'], update: ['admin'], delete: ['admin'] },
      columns: {
        codigo: {
          type: 'string',
          label: { es: 'Código', en: 'Code' },
          readonlyOnEdit: true,
          validator: {
            required: true,
          },
        },

        descripcion: {
          type: 'string',
          label: { es: 'Descripción', en: 'Description' },
          validator: {
            required: true,
          },
        },

        precio_unitario: {
          type: 'number',
          label: { es: 'Precio Unitario', en: 'Unit Price' },
          input: 'number',
          validator: {
            required: true,
            minValue: 0,
          },
        },
      },
      pk: 'codigo',
      uiName: { es: 'Artículo', en: 'Article' },
      title: { es: 'Artículos', en: 'Articles' },
      addButtonLabel: { es: 'Agregar Artículo', en: 'Add Article' },
    } satisfies TableStructure,

    comprobantes: {
      pk: 'numero',
      // Editors can create vouchers; only admins may edit or delete them.
      access: { create: ['admin', 'editor'], update: ['admin'], delete: ['admin'] },
      uiName: { es: 'Comprobante', en: 'Voucher' },
      columns: {
        numero: {
          type: 'string',
          label: { es: 'Número', en: 'Number' },
          readonlyOnEdit: true,
          validator: {
            required: true,
          },
        },

        tipo: {
          type: 'string',
          label: { es: 'Tipo', en: 'Type' },
          input: 'select',
          validator: {
            required: true,
          },
          options: [
            { value: 'factura_a', label: { es: 'Factura A', en: 'Invoice A' } },
            { value: 'factura_b', label: { es: 'Factura B', en: 'Invoice B' } },
            { value: 'factura_c', label: { es: 'Factura C', en: 'Invoice C' } },
          ],
        },

        cuit: {
          type: 'string',
          label: { es: 'Proveedor', en: 'Provider' },
          readonlyOnEdit: true,
          input: 'select',
          foreignKey: {
            table: 'proveedores',
            valueField: 'cuit',
            labelField: 'razon_social',
          },
          validator: {
            required: true,
            pattern: '^\\d{2}-\\d{8}-\\d$',
            patternMessage: 'must match pattern NN-NNNNNNNN-N',
          },
        },

        proveedor_nombre: {
          type: 'string',
          label: { es: 'Nombre del Proveedor', en: 'Provider Name' },
          editable: false,
          derivable: {
            originTable: 'proveedores',
            sqlGenerationStatement: `entityName.razon_social`,
          },
        },

        fecha: {
          type: 'string',
          label: { es: 'Fecha', en: 'Date' },
          input: 'date',
          validator: {
            required: true,
            minDate: '2000-01-01',
            maxDayOffset: 0,
          },
        },

        total: {
          type: 'number',
          label: { es: 'Total', en: 'Total' },
          editable: false,
          derivable: {
            originTable: 'comprobantes',
            sqlGenerationStatement: `(SELECT COALESCE(SUM(dc.cantidad * art.precio_unitario), 0) FROM detalle_comprobante dc JOIN articulos art ON art.codigo = dc.codigo WHERE dc.numero = entityName.numero)`,
          },
        },

        estado: {
          type: 'string',
          label: { es: 'Estado', en: 'Status' },
          input: 'select',
          validator: {
            nullable: true,
          },
          options: [
            { value: 'pendiente', label: { es: 'Pendiente', en: 'Pending' } },
            { value: 'pagado', label: { es: 'Pagado', en: 'Paid' } },
            { value: 'anulado', label: { es: 'Anulado', en: 'Voided' } },
          ],
        },
      },
      title: { es: 'Comprobantes', en: 'Vouchers' },
      addButtonLabel: { es: 'Agregar Comprobante', en: 'Add Voucher' },
      referencedTables: ['proveedores'],
    } satisfies TableStructure,

    detalle_comprobante: {
      pk: ['numero', 'codigo'],
      // Line items follow the voucher policy: editors create, admins edit/delete.
      access: { create: ['admin', 'editor'], update: ['admin'], delete: ['admin'] },
      uiName: { es: 'Detalle', en: 'Item' },
      columns: {
        numero: {
          type: 'string',
          label: { es: 'Comprobante', en: 'Voucher' },
          readonlyOnEdit: true,
          input: 'select',
          foreignKey: {
            table: 'comprobantes',
            valueField: 'numero',
            labelField: 'numero',
          },
          validator: {
            required: true,
          },
        },

        codigo: {
          type: 'string',
          label: { es: 'Artículo', en: 'Article' },
          readonlyOnEdit: true,
          input: 'select',
          foreignKey: {
            table: 'articulos',
            valueField: 'codigo',
            labelField: 'descripcion',
          },
          validator: {
            required: true,
          },
        },

        articulo_descripcion: {
          type: 'string',
          label: { es: 'Descripción', en: 'Description' },
          editable: false,
          derivable: {
            originTable: 'articulos',
            sqlGenerationStatement: `entityName.descripcion`,
          },
        },

        precio_unitario: {
          type: 'number',
          label: { es: 'Precio Unitario', en: 'Unit Price' },
          editable: false,
          derivable: {
            originTable: 'articulos',
            sqlGenerationStatement: `entityName.precio_unitario`,
          },
        },

        cantidad: {
          type: 'number',
          label: { es: 'Cantidad', en: 'Quantity' },
          input: 'number',
          validator: {
            required: true,
            integer: true,
            minValue: 1,
          },
        },

        subtotal: {
          type: 'number',
          label: { es: 'Subtotal', en: 'Subtotal' },
          editable: false,
          derivable: {
            originTable: 'articulos',
            sqlGenerationStatement: `entityName.precio_unitario * Item.cantidad`,
          },
        },
      },
      title: { es: 'Detalle de Comprobantes', en: 'Voucher Items' },
      addButtonLabel: { es: 'Agregar Ítem', en: 'Add Item' },
      referencedTables: ['comprobantes', 'articulos'],
      detailOf: 'comprobantes',
    } satisfies TableStructure,
  },

  menu: {
    theme: {
      title: { es: 'Tema', en: 'Theme' },
      id: 'theme-picker',
      handler: (value: string) => {
        try {
          if (!value) throw new Error('Theme value is required');

          document.body.setAttribute('data-theme', value);
          localStorage.setItem('theme', value);
        } catch (err) {
          console.error('Error changing theme:', err);
          alert(localizeText(structure.commonText.themeChangeError));
        }
      },
      options: [
        { value: 'light', label: { es: 'Claro', en: 'Light' } },
        { value: 'dark', label: { es: 'Oscuro', en: 'Dark' } },
      ],
      initial: () => localStorage.getItem('theme') || 'light',
    },

    language: {
      title: { es: 'Idioma', en: 'Language' },
      id: 'language-picker',
      handler: (value: string) => {
        try {
          if (value !== 'es' && value !== 'en') {
            throw new Error('Invalid language value');
          }

          localStorage.setItem('language', value);

          window.dispatchEvent(
            new CustomEvent('languagechange', {
              detail: { language: value },
            })
          );
        } catch (err) {
          console.error('Error changing language:', err);
          alert(localizeText(structure.commonText.languageChangeError));
        }
      },
      options: [
        { value: 'es', label: { es: 'Español', en: 'Spanish' } },
        { value: 'en', label: { es: 'Inglés', en: 'English' } },
      ],
      initial: () => localStorage.getItem('language') || 'es',
    },
  },

  commonText: {
    actions: { es: 'Acciones', en: 'Actions' },
    add: { es: 'Agregar', en: 'Add' },
    appTitle: {
      es: 'Sistema de Carga de Comprobantes',
      en: 'Voucher Management System',
    },
    cancel: { es: 'Cancelar', en: 'Cancel' },
    delete: { es: 'Eliminar', en: 'Delete' },
    edit: { es: 'Editar', en: 'Edit' },
    detail: { es: 'Detalle', en: 'Details' },
    backToList: { es: '← Volver', en: '← Back' },
    detailTitle: { es: 'Detalle del comprobante', en: 'Voucher details' },
    update: { es: 'Actualizar', en: 'Update' },
    login: { es: 'Ingresar', en: 'Login' },
    password: { es: 'Contraseña', en: 'Password' },
    changePassword: { es: 'Cambiar contraseña', en: 'Change Password' },
    currentPassword: { es: 'Contraseña actual', en: 'Current Password' },
    newPassword: { es: 'Nueva contraseña', en: 'New Password' },
    logout: { es: 'Salir', en: 'Logout' },
    addProfessor: { es: 'Agregar Profesor', en: 'Add Professor' },
    addAdmin: { es: 'Agregar Admin', en: 'Add Admin' },
    added: { es: 'agregado', en: 'added' },

    // Auth / session messages
    sessionExpired: { es: 'La sesión expiró', en: 'Session expired' },
    passwordChangeRequired: { es: 'Hay que cambiar la contraseña', en: 'Password change required' },
    noPermission: { es: 'No tenés permiso para esa acción', en: 'You do not have permission for that action' },
    invalidCredentials: { es: 'Credenciales inválidas', en: 'Invalid credentials' },
    loginError: { es: 'Error ingresando', en: 'Login error' },
    passwordChangeFailed: { es: 'No se pudo cambiar la contraseña', en: 'Password change failed' },
    passwordChangeError: { es: 'Error cambiando contraseña', en: 'Password change error' },
    themeChangeError: { es: 'Error al cambiar el tema', en: 'Error changing theme' },
    languageChangeError: { es: 'Error al cambiar el idioma', en: 'Error changing language' },

    // Data / record messages
    errorLoadingData: { es: 'Error cargando datos', en: 'Error loading data' },
    errorSaving: { es: 'Error guardando', en: 'Error saving' },
    atLeastOneItem: {
      es: 'Agregá al menos un artículo',
      en: 'Add at least one article',
    },
    invalidQuantity: {
      es: 'Revisá la cantidad de los artículos (debe ser un número ≥ 1)',
      en: 'Check article quantities (must be a number ≥ 1)',
    },
    itemSaveFailed: {
      es: 'No se pudo crear el comprobante: falló el artículo',
      en: 'Could not create the voucher: failed on article',
    },
    errorDeleting: { es: 'Error eliminando', en: 'Error deleting' },
    errorLoadingRecord: { es: 'Error cargando registro', en: 'Error loading record' },

    // User management
    onlyAdminCanCreateUsers: { es: 'Solo admin puede crear usuarios', en: 'Only admin can create users' },
    errorCreatingUser: { es: 'Error creando usuario', en: 'Error creating user' },
    noEditPermission: { es: 'No tenés permiso para editar', en: 'You do not have edit permission' },
    studentAndUserCreated: { es: 'Alumno y usuario creados', en: 'Student and user created' },
    userAdded: { es: 'Usuario agregado', en: 'User added' },

    // Form labels
    initialPassword: { es: 'Contraseña inicial', en: 'Initial Password' },
    usernameLabel: { es: 'Usuario', en: 'Username' },
    emailLabel: { es: 'Email', en: 'Email' },
    professorRole: { es: 'Profesor', en: 'Professor' },
    adminRole: { es: 'Admin', en: 'Admin' },
    addUser: { es: 'Agregar usuario', en: 'Add user' },

    // Filters / pagination
    addFilter: { es: 'Agregar Filtro', en: 'Add Filter' },
    selectColumn: { es: 'Seleccionar columna', en: 'Select column' },
    pageInfo: { es: 'Página', en: 'Page' },
    pageOf: { es: 'de', en: 'of' },
    total: { es: 'Total', en: 'Total' },
    previous: { es: 'Anterior', en: 'Previous' },
    next: { es: 'Siguiente', en: 'Next' },
    filterPlaceholder: { es: 'Filtrar...', en: 'Filter...' },

    // Reports
    month: { es: 'Mes', en: 'Month' },
    year: { es: 'Año', en: 'Year' },
    generateReport: { es: 'Generar reporte', en: 'Generate report' },
    noReportData: {
      es: 'Sin datos para el período seleccionado',
      en: 'No data for the selected period',
    },

    // Delete confirmation
    deleteConfirm: {
      es: '¿Está seguro de que desea eliminar este',
      en: 'Are you sure you want to delete this',
    },
  } satisfies Record<string, LocalizedText>,

  // Declarative monthly reports, rendered generically by the frontend and served
  // by GET /api/reports/:table/monthly.
  reports: {
    proveedores_mensual: {
      title: { es: 'Reporte mensual de proveedores', en: 'Monthly providers report' },
      table: 'comprobantes',
      groupBy: ['cuit', 'proveedor_nombre'],
      dateField: 'fecha',
      measure: 'total',
      columns: {
        cuit: { es: 'CUIT', en: 'Tax ID' },
        proveedor_nombre: { es: 'Proveedor', en: 'Provider' },
        record_count: { es: 'Comprobantes', en: 'Vouchers' },
        total: { es: 'Total', en: 'Total' },
      },
    },
  } satisfies Record<string, ReportDef>,
};

// -----------------------------------------------------------------------------
// Role-based access control (single source of truth, shared by backend + frontend)
// -----------------------------------------------------------------------------

// Behavior for tables (or actions) that do not declare their own `access`.
const DEFAULT_ACCESS: Record<TableAction, Role[]> = {
  read: ['admin', 'editor', 'reader'],
  create: ['admin', 'editor'],
  update: ['admin', 'editor'],
  delete: ['admin', 'editor'],
};

// Roles allowed to perform `action` on `tableKey`, falling back to defaults.
export function rolesForTableAction(tableKey: string, action: TableAction): Role[] {
  const tables = structure.tables as Record<string, TableStructure>;
  return tables[tableKey]?.access?.[action] ?? DEFAULT_ACCESS[action];
}

// Whether `role` may perform `action` on `tableKey`.
export function canRoleDo(role: Role, tableKey: string, action: TableAction): boolean {
  return rolesForTableAction(tableKey, action).includes(role);
}
