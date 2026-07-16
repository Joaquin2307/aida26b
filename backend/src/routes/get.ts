import { structure } from "../../../shared/src/ssot/structure";
import express from "express";
import { Pool } from "pg";

import {
  getEntityName,
  getTableAlias,
  isKnownTable,
  getDerivableFields,
  getReferencedRelations,
  tryQuery,
} from "../helpers";

import { getPkFields } from "../../../shared/src/utils/utils";

import {
  sendSuccessOperationMessage,
  sendNotFoundMessage,
  sendErrorMessage,
} from "../status_messages";

import type {
  TableKey,
  ColumnDef,
  Response as QueryResponse,
} from "../../../shared/src/types/types";

import {
  validateOnlyPk,
  sendErrorsIfInvalid,
} from "../validation/validate";

export async function getHandler(
  req: express.Request,
  res: express.Response,
  pool: Pool
) {
  const tableNameParam = req.params.tableName;

  if (!isKnownTable(tableNameParam)) {
    return sendNotFoundMessage(res, tableNameParam);
  }

  const tableName = tableNameParam as TableKey;
  const entityName = getEntityName(tableName);

  if (isListRequest(req.query)) {
    return getListOfTable(pool, res, tableName, req.query);
  }

  return getRowOfTable(pool, res, tableName, req.query, entityName);
}

/** Query builder used by list/table views. */
// Builds parameterized SQL conditions from `filter_<column>=value` query params.
// Each column is validated against `filterConfig` (the allow-list) and its value
// goes in as a placeholder, so neither the column nor the value can be injected.
// `startIndex` is the first free placeholder ($n); `nextIndex` reports the next
// free one so the caller can keep numbering its own params (LIMIT/OFFSET, ...).
export function buildFilterConditions(
  query: express.Request["query"],
  filterConfig: Record<string, ColumnDef>,
  startIndex: number
): { conditions: string[]; values: unknown[]; nextIndex: number } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = startIndex;

  for (const [key, rawValue] of Object.entries(query)) {
    if (!key.startsWith("filter_") || rawValue == null || rawValue === "") {
      continue;
    }

    const fieldName = key.slice(7);
    // Own-property lookup so inherited keys (constructor, __proto__, ...) never
    // resolve to a truthy value from Object.prototype and slip past the allow-list.
    const config = Object.prototype.hasOwnProperty.call(filterConfig, fieldName)
      ? filterConfig[fieldName]
      : undefined;

    if (!config) {
      continue;
    }

    const vals = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const v of vals) {
      const strVal = String(v);

      if (!strVal) {
        continue;
      }

      const negated = strVal.startsWith("!");
      const actualVal = negated ? strVal.slice(1) : strVal;

      if (config.options || config.foreignKey) {
        // Discrete-value columns (enums and foreign keys) match exactly, since
        // callers pick a concrete value from a dropdown.
        conditions.push(
          `"${fieldName}" ${negated ? "!=" : "="} $${paramIndex}`
        );
        values.push(actualVal);
        paramIndex++;
      } else if (config.type === "string") {
        // Free-text columns match as a case-insensitive substring.
        conditions.push(
          `"${fieldName}"::text ${negated ? "NOT " : ""}ILIKE $${paramIndex}`
        );
        values.push(`%${actualVal}%`);
        paramIndex++;
      } else if (config.type === "number") {
        const commaIdx = actualVal.indexOf(",");

        if (commaIdx >= 0) {
          const minPart = actualVal.slice(0, commaIdx);
          const maxPart = actualVal.slice(commaIdx + 1);
          const hasMin = minPart !== "";
          const hasMax = maxPart !== "";

          if (hasMin && hasMax) {
            const nMin = parseFloat(minPart);
            const nMax = parseFloat(maxPart);

            if (isNaN(nMin) || isNaN(nMax)) {
              continue;
            }

            if (negated) {
              conditions.push(
                `("${fieldName}" < $${paramIndex} OR "${fieldName}" > $${paramIndex + 1})`
              );
            } else {
              conditions.push(
                `"${fieldName}" >= $${paramIndex} AND "${fieldName}" <= $${paramIndex + 1}`
              );
            }

            values.push(nMin, nMax);
            paramIndex += 2;
          } else if (hasMin) {
            const n = parseFloat(minPart);

            if (isNaN(n)) {
              continue;
            }

            conditions.push(
              `"${fieldName}" ${negated ? "<" : ">="} $${paramIndex}`
            );
            values.push(n);
            paramIndex++;
          } else if (hasMax) {
            const n = parseFloat(maxPart);

            if (isNaN(n)) {
              continue;
            }

            conditions.push(
              `"${fieldName}" ${negated ? ">" : "<="} $${paramIndex}`
            );
            values.push(n);
            paramIndex++;
          }
        } else {
          const n = parseFloat(actualVal);

          if (isNaN(n)) {
            continue;
          }

          conditions.push(
            `"${fieldName}" ${negated ? "<" : ">="} $${paramIndex}`
          );
          values.push(n);
          paramIndex++;
        }
      }
    }
  }

  return { conditions, values, nextIndex: paramIndex };
}

export function buildListQuery(
  tableNameOrCTE: string,
  query: express.Request["query"],
  filterConfig: Record<string, ColumnDef>,
  defaultSort: string | string[]
) {
  const allowedColumns = Object.keys(filterConfig);
  const { conditions, values, nextIndex: paramIndex } = buildFilterConditions(
    query,
    filterConfig,
    1
  );

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const defaultSortColumns = Array.isArray(defaultSort)
    ? defaultSort
    : [defaultSort];

  const requestedSort = Array.isArray(query.sort)
    ? query.sort[0]
    : query.sort;

  const requestedDir = Array.isArray(query.dir)
    ? query.dir[0]
    : query.dir;

  const sortDir = requestedDir === "desc" ? "DESC" : "ASC";

  const sortCol =
    typeof requestedSort === "string" && allowedColumns.includes(requestedSort)
      ? requestedSort
      : undefined;

  const orderColumns = sortCol
    ? [`"${sortCol}" ${sortDir}`]
    : defaultSortColumns
        .filter((column) => allowedColumns.includes(column))
        .map((column) => `"${column}" ${sortDir}`);

  const orderClause =
    orderColumns.length > 0 ? `ORDER BY ${orderColumns.join(", ")}` : "";

  const requestedPage = Array.isArray(query.page)
    ? query.page[0]
    : query.page;

  const page = Math.max(
    1,
    Math.min(parseInt(String(requestedPage || "1"), 10) || 1, 1000)
  );

  const limit = 20;
  const offset = (page - 1) * limit;

  const fromClause = tableNameOrCTE.includes(" ")
    ? `FROM (${tableNameOrCTE}) AS base`
    : `FROM ${tableNameOrCTE}`;

  const dataQuery = `
    SELECT *
    ${fromClause}
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex}
    OFFSET $${paramIndex + 1}
  `;

  const dataValues = [...values, limit, offset];

  const countQuery = `
    SELECT COUNT(*)
    ${fromClause}
    ${whereClause}
  `;

  return {
    dataQuery,
    dataValues,
    countQuery,
    countValues: [...values],
  };
}

/** Helpers */
function isListRequest(query: express.Request["query"]): boolean {
  const queryKeys = Object.keys(query);

  if (queryKeys.length === 0) {
    return true;
  }

  return queryKeys.every(
    (key) =>
      key === "page" ||
      key === "sort" ||
      key === "dir" ||
      key.startsWith("filter_")
  );
}

function getJoinsStatements(
  queryTable: TableKey,
  referencedRelations: TableKey[]
): string {
  let joinsStatement = "";
  const selfAlias = getTableAlias(queryTable);
  const columns = structure.tables[queryTable].columns as Record<string, ColumnDef>;

  referencedRelations.forEach((tableName) => {
    const referencedAlias = getTableAlias(tableName);

    joinsStatement += ` JOIN ${tableName} ${referencedAlias} ON `;

    // Join on the declared foreign-key columns (self.<fkColumn> = ref.<valueField>),
    // so a FK whose column name differs from the referenced PK still joins
    // correctly. Fall back to the same-name PK convention only when the table is
    // referenced without a FK column (e.g. solely through a derivable column).
    const fkConditions = Object.entries(columns)
      .filter(([, column]) => column.foreignKey?.table === tableName)
      .map(
        ([columnName, column]) =>
          `${selfAlias}.${columnName} = ${referencedAlias}.${column.foreignKey!.valueField}`
      );

    const conditions =
      fkConditions.length > 0
        ? fkConditions
        : getPkFields(tableName).map(
            (pk) => `${selfAlias}.${pk} = ${referencedAlias}.${pk}`
          );

    joinsStatement += conditions.join(" AND ");
  });

  return joinsStatement;
}

// Resolves a derivable column's SQL, replacing the SSOT placeholders with stable
// table-name aliases: {{self}} is the queried table, {{origin}} is the declared
// origin table. Aliases come from the table name, never from a UI label.
function resolveDerivableExpression(
  tableName: TableKey,
  column: ColumnDef
): string {
  const originTable = column.derivable?.originTable as TableKey;

  return (column.derivable?.sqlGenerationStatement ?? "")
    .replace(/\{\{\s*self\s*\}\}/g, getTableAlias(tableName))
    .replace(/\{\{\s*origin\s*\}\}/g, getTableAlias(originTable));
}

function getSelectStatement(tableName: TableKey): string {
  const selectFields = [`${getTableAlias(tableName)}.*`];

  const derivedFields: [string, ColumnDef][] = getDerivableFields(tableName);

  selectFields.push(
    ...derivedFields.map(
      ([fieldName, column]) =>
        `${resolveDerivableExpression(tableName, column)} AS ${fieldName}`
    )
  );

  return `SELECT ${selectFields.join(", ")}`;
}

export function getBaseSelectQuery(tableName: TableKey): string {
  const referencedRelations = getReferencedRelations(tableName);

  // Always select through getSelectStatement so a table's derivable columns are
  // materialized whether or not it declares any JOINs (a derivable can reference
  // only {{self}}); the JOINs are added only when there are referenced tables.
  return `
    ${getSelectStatement(tableName)}
    FROM ${tableName} ${getTableAlias(tableName)}
    ${referencedRelations.length > 0 ? getJoinsStatements(tableName, referencedRelations) : ""}
  `;
}

export function getListFilterConfig(tableName: TableKey): Record<string, ColumnDef> {
  const baseColumns = structure.tables[tableName].columns as Record<
    string,
    ColumnDef
  >;

  const derivedColumns = Object.fromEntries(getDerivableFields(tableName));

  return {
    ...baseColumns,
    ...derivedColumns,
  };
}

async function getListOfTable(
  pool: Pool,
  res: express.Response,
  tableName: TableKey,
  query: express.Request["query"]
) {
  try {
    const defaultSort = getPkFields(tableName);

    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery(
      getBaseSelectQuery(tableName),
      query,
      getListFilterConfig(tableName),
      defaultSort
    );

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues),
    ]);

    return res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getRowByPKs(
  pool: Pool,
  tableName: TableKey,
  pkValues: unknown[]
) {
  // Reuse the list query (with derived columns) as a subquery so a single-row
  // fetch returns the same shape as the list endpoint, filtering by PK on the
  // wrapping alias.
  const whereArguments = getPkFields(tableName)
    .map((pk, index) => `base."${pk}" = $${index + 1}`)
    .join(" AND ");

  const queryStatement = `
    SELECT *
    FROM (${getBaseSelectQuery(tableName)}) AS base
    WHERE ${whereArguments}
  `;

  return tryQuery(pool, queryStatement, pkValues);
}

async function getRowOfTable(
  pool: Pool,
  res: express.Response,
  tableName: TableKey,
  query: express.Request["query"],
  entityName: string
) {
  const pk = validateOnlyPk(tableName, query);

  if (sendErrorsIfInvalid(res, pk)) {
    return;
  }

  const pkFields = getPkFields(tableName);

  const pkValues = pkFields.map(
    (pkField) => (pk.data as Record<string, unknown>)[pkField]
  );

  const responseQuery: QueryResponse = await getRowByPKs(
    pool,
    tableName,
    pkValues
  );

  if (!responseQuery.success) {
    return sendErrorMessage(res, responseQuery.message);
  }

  if (responseQuery.data.rowCount === 0) {
    return sendNotFoundMessage(res, entityName);
  }

  return sendSuccessOperationMessage(
    res,
    entityName,
    responseQuery.data.rows[0],
    "fetched",
    200
  );
}