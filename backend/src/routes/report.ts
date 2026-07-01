import express from 'express';
import { Pool } from 'pg';

import { structure } from '../../../shared/src/ssot/structure';
import type { TableKey } from '../../../shared/src/types/types';

import { getBaseSelectQuery, getListFilterConfig, buildFilterConditions } from './get';
import {
  sendErrorMessage,
  sendInvalidInstanceMessage,
  sendNotFoundMessage,
} from '../status_messages';

function isKnownTable(tableName: string): tableName is TableKey {
  return Object.prototype.hasOwnProperty.call(structure.tables, tableName);
}

// GET /api/reports/:tableName/monthly
//   ?year=YYYY&month=MM&groupBy=col[,col]&dateField=col[&measure=col]
//
// Generic monthly aggregation over any SSOT table: keep the rows whose
// `dateField` falls in the requested month, group them by the `groupBy`
// column(s), and return the row count plus (optionally) the sum of a numeric
// `measure`. It is driven entirely by the SSOT column metadata, so it works for
// any table (e.g. the monthly providers report is comprobantes grouped by cuit).
export async function getMonthlyReportHandler(
  req: express.Request,
  res: express.Response,
  pool: Pool
) {
  const tableNameParam = req.params.tableName;

  if (!isKnownTable(tableNameParam)) {
    return sendNotFoundMessage(res, tableNameParam);
  }

  const tableName = tableNameParam as TableKey;

  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return sendInvalidInstanceMessage(res, 'A valid year (2000-2100) is required');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return sendInvalidInstanceMessage(res, 'A valid month (1-12) is required');
  }

  // Valid column names for this table (base columns + derived ones). Used as an
  // allow-list so the column names interpolated below can never be injected.
  const filterConfig = getListFilterConfig(tableName);
  const validColumns = Object.keys(filterConfig);

  const groupBy = String(req.query.groupBy ?? '')
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);

  const dateField = String(req.query.dateField ?? '');
  const measure = String(req.query.measure ?? '');

  if (groupBy.length === 0 || !groupBy.every((column) => validColumns.includes(column))) {
    return sendInvalidInstanceMessage(res, 'groupBy must be one or more valid columns');
  }

  if (!validColumns.includes(dateField)) {
    return sendInvalidInstanceMessage(res, 'dateField must be a valid column');
  }

  if (measure && !validColumns.includes(measure)) {
    return sendInvalidInstanceMessage(res, 'measure must be a valid column');
  }

  const groupColumns = groupBy.map((column) => `base."${column}"`).join(', ');
  const measureSelect = measure ? `, COALESCE(SUM(base."${measure}"), 0) AS total` : '';
  const orderBy = measure ? 'total DESC' : 'record_count DESC';

  // Optional filters via the shared `filter_<column>` convention. Like the list
  // endpoint, any valid column of the table may be filtered (the ReportDef
  // `filters` array only controls which dropdowns the frontend renders).
  // Placeholders start at $3 because $1/$2 are the year/month range above.
  const { conditions, values: filterValues } = buildFilterConditions(req.query, filterConfig, 3);
  const filterClause = conditions.length > 0 ? `AND (${conditions.join(' AND ')})` : '';

  const query = `
    SELECT ${groupColumns}, COUNT(*)::int AS record_count${measureSelect}
    FROM (${getBaseSelectQuery(tableName)}) AS base
    WHERE base."${dateField}" >= make_date($1, $2, 1)
      AND base."${dateField}" < (make_date($1, $2, 1) + interval '1 month')
      ${filterClause}
    GROUP BY ${groupColumns}
    ORDER BY ${orderBy}
  `;

  try {
    const result = await pool.query(query, [year, month, ...filterValues]);

    return res.json({
      success: true,
      data: {
        table: tableName,
        year,
        month,
        groupBy,
        measure: measure || null,
        rows: result.rows,
      },
      message: 'Monthly report generated successfully',
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    return sendErrorMessage(res, 'Internal server error');
  }
}
