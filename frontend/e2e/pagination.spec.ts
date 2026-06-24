import { test, expect, type Page } from '@playwright/test';

const LIMIT = 20;

async function httpJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${method} ${url}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function seedArticulos(apiBase: string, count: number, prefix: string): Promise<string[]> {
  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const codigo = `${prefix}_${String(i).padStart(2, '0')}`;
    const payload = {
      codigo,
      descripcion: `E2E Pagination ${String(i).padStart(4, '0')}`,
      precio_unitario: 1000 + i,
      unidad: 'unidad',
      stock: i,
    };
    await httpJson('POST', `${apiBase}/articulos`, payload);
    created.push(codigo);
  }
  return created;
}

async function cleanupArticulos(apiBase: string, codigos: string[]) {
  await Promise.allSettled(
    codigos.map((codigo) =>
      httpJson('DELETE', `${apiBase}/articulos?codigo=${encodeURIComponent(codigo)}`).catch(() => undefined),
    ),
  );
}

async function ensurePkFilter(page: Page) {
  const filterContainer = page.locator('.filter-container');
  await expect(filterContainer).toBeVisible();

  const existingRows = filterContainer.locator('.filter-row');
  if ((await existingRows.count()) === 0) {
    await filterContainer.locator('button.add-btn').click();
    const selects = filterContainer.locator('select');

    // Find the visible "add column" dropdown (it has the placeholder + options list).
    const n = await selects.count();
    let addDropdownIndex = -1;
    for (let i = 0; i < n; i++) {
      const sel = selects.nth(i);
      if (!(await sel.isVisible())) continue;
      const hasPk = await sel.locator('option[value="codigo"]').count();
      if (hasPk) {
        addDropdownIndex = i;
        break;
      }
    }
    expect(addDropdownIndex, 'add-filter dropdown not found').toBeGreaterThanOrEqual(0);

    await selects.nth(addDropdownIndex).selectOption('codigo');
    await expect(filterContainer.locator('.filter-row')).toHaveCount(1);
  }

  const row = filterContainer.locator('.filter-row').first();
  const valueInput = row.locator('input, textarea').first();
  await expect(valueInput).toBeVisible();
  return valueInput;
}

async function expectArticuloRows(page: Page, expectedIds: string[]) {
  const rows = page.locator('#records-table tbody tr');

  await expect(rows).toHaveCount(expectedIds.length);

  for (const id of expectedIds) {
    await expect(
      rows.filter({
        has: page.locator('td').filter({
          hasText: new RegExp(`^${id}$`)
        })
      })
    ).toHaveCount(1);
  }
}

async function assertPagination(page: Page, expectedTotal: number, expectedPage: number, expectedPages: number) {
  const info = page.locator('.pagination-container span').first();
  await expect(info).toHaveText(`Página ${expectedPage} de ${expectedPages} (Total: ${expectedTotal})`);

  const prevBtn = page.getByRole('button', { name: 'Anterior' });
  const nextBtn = page.getByRole('button', { name: 'Siguiente' });
  if (expectedPage > 1) await expect(prevBtn).toBeEnabled();
  else await expect(prevBtn).toBeDisabled();
  if (expectedPage < expectedPages) await expect(nextBtn).toBeEnabled();
  else await expect(nextBtn).toBeDisabled();
}

async function navigateToArticulosTab(page: Page) {
  await page.goto(`/?table=articulos&page=1`);
  await page.getByRole('button', { name: /Art[íi]culos|Articles/i }).click();
}

test.describe('Pagination', () => {
  let createdIds: string[] = [];

  test.afterAll(async ({ baseURL }) => {
    if (!baseURL) return;
    await cleanupArticulos(`${baseURL}/api`, createdIds);
  });

  test.afterEach(async ({ baseURL }) => {
    if (!baseURL) return;
    await cleanupArticulos(`${baseURL}/api`, createdIds);
    createdIds = [];
  });

  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('Missing baseURL');
    const shortTimestamp = Date.now().toString().slice(-5);
    const prefix = `e2e_${shortTimestamp}_${testInfo.parallelIndex}`;

    await navigateToArticulosTab(page);

    // Ensure filter row and scope results to our prefix.
    await ensureFilterRowTriggers(page, prefix); // triggers change handler

    // Store prefix on the page for the test to use.
    await page.evaluate((p) => ((window as any).__e2ePrefix = p), prefix);
  });

  async function getPrefix(page: Page): Promise<string> {
    return page.evaluate(() => (window as any).__e2ePrefix as string);
  }

  async function setupRecords(page: Page, baseURL: string | undefined, count: number) {
    if (!baseURL) throw new Error('Missing baseURL');
    const prefix = await getPrefix(page);
    const ids = await seedArticulos(`${baseURL}/api`, count, prefix);
    createdIds.push(...ids);
    await page.reload();
  }

  test('displays 1 page when records are fewer than limit', async ({ page, baseURL }) => {
    await setupRecords(page, baseURL, 5);
    await assertPagination(page, 5, 1, 1);
  });

  test('displays 1 page when records exactly equal limit', async ({ page, baseURL }) => {
    await setupRecords(page, baseURL, LIMIT);
    await assertPagination(page, LIMIT, 1, 1);
  });

  test('displays 2 pages when records exceed limit by one', async ({ page, baseURL }) => {
    await setupRecords(page, baseURL, LIMIT + 1);
    await assertPagination(page, LIMIT + 1, 1, 2);
  });

  test('navigates to next page correctly', async ({ page, baseURL }) => {
    await setupRecords(page, baseURL, LIMIT + 1);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await assertPagination(page, LIMIT + 1, 2, 2);
  });

  test('navigates to previous page correctly', async ({ page, baseURL }) => {
    await setupRecords(page, baseURL, LIMIT + 1);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Anterior' }).click();
    await assertPagination(page, LIMIT + 1, 1, 2);
  });

  test('navigates to last page in a large dataset', async ({ page, baseURL }) => {
    const total = 85;
    await setupRecords(page, baseURL, total);
    // Go to page 5
    for (let p = 2; p <= 5; p++) {
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await assertPagination(page, total, 5, 5);
  });

  test('filters correctly by codigo matches', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('Missing baseURL');
    const prefix = await getPrefix(page);
    const target = `${prefix}_MATCH`;

    const exactId = target;
    const prefixId = `${target}_S`;
    const postfixId = `P_${target}`;

    for (const [idx, codigo] of [exactId, prefixId, postfixId].entries()) {
      await httpJson('POST', `${baseURL}/api/articulos`, {
        codigo,
        descripcion: 'E2E Filter Contains',
        precio_unitario: 1000 + idx,
        unidad: 'unidad',
        stock: idx,
      });
    }
    createdIds.push(exactId, prefixId, postfixId);

    const pk = await ensurePkFilter(page);
    await pk.fill(target);
    await pk.press('Enter');

    await page.reload();
    await expectArticuloRows(page, [exactId, prefixId, postfixId]);
  });
});

test('rejects a provider with an invalid CUIT', async ({ baseURL }) => {
  if (!baseURL) throw new Error('Missing baseURL');

  const res = await fetch(`${baseURL}/api/proveedores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cuit: 'not-a-cuit',
      razon_social: 'Invalid CUIT SA',
      email: 'invalid@example.test',
      telefono: '111',
      direccion: 'Calle 1',
      condicion_iva: 'monotributo',
    }),
  });

  expect(res.ok).toBeFalsy();
  expect(res.status).toBe(400);

  const body = await res.json();
  expect(body.error).toMatch(/cuit/i);
});

async function ensureFilterRowTriggers(page: Page, prefix: string) {
  const pk = await ensurePkFilter(page);
  await pk.fill(prefix);
  await pk.press('Enter');
}
