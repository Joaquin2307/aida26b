import type { TableKey, Response, ColumnDef }  from '../../shared/src/types/types';
import      { structure } from '../../shared/src/ssot/structure';
import type { Pool }      from 'pg';

// User-facing entity name (used in status messages), taken from the SSOT uiName.
function getEntityName(table: TableKey): string {
  return String(structure.tables[table].uiName.en);
}

// Stable SQL alias for a table. Derived from the table name (already a valid SQL
// identifier), never from uiName — a bilingual UI label must not double as a SQL
// identifier. Used to alias FROM/JOIN targets and to resolve derivable-column
// placeholders ({{self}} / {{origin}}).
function getTableAlias(table: TableKey): string {
  return String(table);
}

// Whether `tableName` is a table declared in the SSOT. Shared by every route so
// the check lives in one place instead of being copied per handler.
function isKnownTable(tableName: string): tableName is TableKey {
  return Object.prototype.hasOwnProperty.call(structure.tables, tableName);
}

async function tryQuery(pool: Pool, queryStatement: string, queryArguments?: any): Promise<Response>{
  try {
    return {success: true , data: await pool.query(queryStatement, queryArguments), message: ''};
  } catch (error) {
    console.error(error);
    return {success: false, data: error, message: 'Internal server error'};
  }
}

function columnNamesEqualsNumber(columnsNames: string[], from: number = 1, separator: string = ','): string{
  let res: string = '';
  let i: number   = from;
  columnsNames.forEach(columnName => {
    res += `${columnName} = $${i++}` + separator;
  })
  return res.slice(0, -separator.length);
}

function getDerivableFields(tableName: TableKey): [string, ColumnDef][]{
  return Object.entries(structure.tables[tableName].columns).filter(([columnName, column]) => column.derivable);
}

function getNotDerivableFields(table: TableKey): string[]{
  const columns: [string, ColumnDef][] = Object.entries(structure.tables[table].columns as Record<string, ColumnDef>);
  const notDerivableEntries = columns.filter(([fieldName, columnDef]) => !columnDef.derivable);
  return notDerivableEntries.map(([fieldName, column]) => fieldName);
}

// Tables this one references, derived from the columns themselves (their
// foreignKey.table and derivable.originTable) so it stays in sync with the SSOT
// instead of being maintained by hand. Self-references are excluded; order is
// first-seen so the generated JOINs are deterministic.
function getReferencedRelations(tableName: TableKey): TableKey[]{
  const columns = Object.values(structure.tables[tableName].columns as Record<string, ColumnDef>);
  const related: TableKey[] = [];

  for (const column of columns) {
    for (const table of [column.foreignKey?.table, column.derivable?.originTable]) {
      if (table && table !== tableName && !related.includes(table as TableKey)) {
        related.push(table as TableKey);
      }
    }
  }

  return related;
}

function formatTableColumnsForQuery(fieldsNames: string[], from: number = 1): string[]{
  let tupleWithReplaceParameters = '';
  for (let columnsCount = from; columnsCount <= fieldsNames.length; columnsCount++){
    tupleWithReplaceParameters += `$${columnsCount} `;
  }  
  tupleWithReplaceParameters = '(' + tupleWithReplaceParameters.split(' ').join(',').slice(0,-1) + ')';
  let tupleContent: string = '(' + fieldsNames.join(',') + ')';
  return [tupleContent, tupleWithReplaceParameters];
}

export { getEntityName, getTableAlias, isKnownTable, tryQuery, columnNamesEqualsNumber, getNotDerivableFields, formatTableColumnsForQuery, getReferencedRelations, getDerivableFields };