import { upsertRow } from './test_helpers';

/* Test objects for the comprobantes domain. Numeric columns come back from
   Postgres as strings ('4500.00'); assert.deepEqual (loose) handles that. */

const proveedor = {
  cuit: '30-12345678-9',
  razon_social: 'Insumos del Sur SA',
  email: 'ventas@insumos.com',
  telefono: '011-4555-1234',
  direccion: 'Av Siempreviva 742',
  condicion_iva: 'responsable_inscripto',
};

const proveedorModified = {
  ...proveedor,
  razon_social: 'Insumos del Sur SRL',
  telefono: '011-4555-9999',
  condicion_iva: 'monotributo',
};

const articulo = {
  codigo: 'ART-001',
  descripcion: 'Resma de papel A4',
  precio_unitario: 4500,
};

const articuloModified = {
  ...articulo,
  descripcion: 'Resma de papel A4 80g',
  precio_unitario: 4800,
};

const comprobante = {
  numero: 'FA-0001-00000001',
  tipo: 'factura_a',
  cuit: proveedor.cuit,
  fecha: '2026-05-10T03:00:00.000Z',
  estado: 'pagado',
};

// total is derived (SUM over the detalle); with no line items it is 0.
const comprobanteExpectedResponse = {
  numero: 'FA-0001-00000001',
  tipo: 'factura_a',
  cuit: proveedor.cuit,
  proveedor_nombre: proveedor.razon_social,
  fecha: '2026-05-10T03:00:00.000Z',
  total: 0,
  estado: 'pagado',
};

const comprobanteModified = {
  ...comprobante,
  tipo: 'factura_b',
  estado: 'pendiente',
};

const comprobanteModifiedExpectedResponse = {
  ...comprobanteExpectedResponse,
  tipo: 'factura_b',
  estado: 'pendiente',
};

const detalle = {
  numero: comprobante.numero,
  codigo: articulo.codigo,
  cantidad: 2,
};

const detalleExpectedResponse = {
  numero: comprobante.numero,
  codigo: articulo.codigo,
  articulo_descripcion: articulo.descripcion,
  precio_unitario: articulo.precio_unitario,
  cantidad: 2,
  subtotal: 9000,
};

const detalleModified = {
  ...detalle,
  cantidad: 4,
};

const detalleModifiedExpectedResponse = {
  ...detalleExpectedResponse,
  cantidad: 4,
  subtotal: 18000,
};

// Ensures the FK parents for a comprobante line item exist.
const seedProveedorArticuloComprobante = async () => {
  await upsertRow('proveedores', proveedor, false);
  await upsertRow('articulos', articulo, false);
  await upsertRow('comprobantes', comprobante, false);
};

export {
  proveedor,
  proveedorModified,
  articulo,
  articuloModified,
  comprobante,
  comprobanteExpectedResponse,
  comprobanteModified,
  comprobanteModifiedExpectedResponse,
  detalle,
  detalleExpectedResponse,
  detalleModified,
  detalleModifiedExpectedResponse,
  seedProveedorArticuloComprobante,
};
