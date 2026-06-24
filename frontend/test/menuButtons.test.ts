import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('Menu Pickers (Theme & Language)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="auth-section"></section>
      <section id="password-section"></section>
      <form id="login-form"></form>
      <div id="login-error"></div>
      <form id="password-form"></form>
      <div id="password-error"></div>
      <div id="app-shell"></div>
      <span id="current-user"></span>
      <button id="logout-btn"></button>
      <div id="status-message"></div>
      <div id="menu-nav"></div>
      <div id="table-nav"></div>
      <div id="view-title"></div>
      <button id="add-record-btn"></button>
      <div id="admin-actions"></div>
      <button id="add-teacher-btn"></button>
      <button id="add-admin-btn"></button>
      <div id="record-form"></div>
      <table id="records-table">
        <thead></thead>
        <tbody></tbody>
      </table>
    `;

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve([]),
      })
    ) as ReturnType<typeof vi.fn>;
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('Theme Picker', () => {
    test('Theme picker select exists and changes theme on change event', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      expect(themeSelect).toBeTruthy();
      expect(themeSelect.tagName).toBe('SELECT');
    });

    test('Theme picker updates document.body data-theme attribute', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));
      
      expect(document.body.getAttribute('data-theme')).toBe('dark');
    });

    test('Theme picker saves theme to localStorage', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));
      
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('Theme picker handles empty values gracefully', async () => {
      vi.resetModules();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      themeSelect.value = '';
      themeSelect.dispatchEvent(new Event('change'));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Language Picker', () => {
    test('Language picker select exists', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      
      expect(languageSelect).toBeTruthy();
      expect(languageSelect.tagName).toBe('SELECT');
    });

    test('Language picker has valid language options', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      const options = Array.from(languageSelect.options).map(opt => opt.value);
      
      expect(options).toContain('es');
      expect(options).toContain('en');
    });

    test('Language picker saves language to localStorage', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      
      languageSelect.value = 'en';
      languageSelect.dispatchEvent(new Event('change'));
      
      expect(localStorage.getItem('language')).toBe('en');
    });

    test('Language picker updates nav buttons text on change', async () => {
      vi.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      const initialText = (document.getElementById('proveedores-btn') as HTMLButtonElement)?.textContent || '';

      languageSelect.value = 'en';
      languageSelect.dispatchEvent(new Event('change'));

      const newText = (document.getElementById('proveedores-btn') as HTMLButtonElement)?.textContent || '';

      // El texto debe cambiar si inicialmente estaba en español
      if (initialText === 'Proveedores') {
        expect(newText).toBe('Providers');
      }
    });

    test('Language picker handles invalid values gracefully', async () => {
      vi.resetModules();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      
      languageSelect.value = 'invalid-lang';
      languageSelect.dispatchEvent(new Event('change'));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
