import express from 'express';
import { Pool } from 'pg';

import { structure } from '../../../shared/src/ssot/structure';
import type { TableKey, ReportDef } from '../../../shared/src/types/types';

import { isKnownTable } from '../helpers';
import { getBaseSelectQuery, getListFilterConfig, buildFilterConditions } from './get';
import {
  sendErrorMessage,
  sendInvalidInstanceMessage,
  sendNotFoundMessage,
} from '../status_messages';

const reports = structure.reports as Record<string, ReportDef>;

// GET /api/reports/:tableName/monthly
//   ?report=<key>&view=<key>            (SSOT-driven: preferred)
//   ?year=YYYY&month=MM&groupBy=col[,col]&dateField=col[&measure=col]  (explicit)
//
// Generic monthly aggregation over any SSOT table: keep the rows whose
// `dateField` falls in the requested month, group them by the `groupBy`
// column(s), and return the row count plus (optionally) the sum of a numeric
// `measure`. When `report`/`view` are given, the grouping/date/measure are
// resolved from the declared ReportDef so the SSOT — not the client — is the
// source of truth; the column allow-list is still enforced either way.
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

  // Prefer the declared report/view (the SSOT is the source of truth); fall back
  // to explicit groupBy/dateField/measure query params for ad-hoc aggregation.
  const reportKey = String(req.query.report ?? '');
  let groupBy: string[];
  let dateField: string;
  let measure: string;

  if (reportKey) {
    const reportDef = reports[reportKey];

    if (!reportDef || reportDef.table !== tableName) {
      return sendInvalidInstanceMessage(res, 'report must be a report declared for this table');
    }

    const viewKey = String(
      req.query.view ?? reportDef.defaultView ?? Object.keys(reportDef.views)[0]
    );
    const view = reportDef.views[viewKey];

    if (!view) {
      return sendInvalidInstanceMessage(res, 'view must be a view declared by the report');
    }

    groupBy = view.groupBy;
    dateField = reportDef.dateField;
    measure = reportDef.measure ?? '';
  } else {
    groupBy = String(req.query.groupBy ?? '')
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean);
    dateField = String(req.query.dateField ?? '');
    measure = String(req.query.measure ?? '');
  }

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
