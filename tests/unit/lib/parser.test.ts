import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { HTMLParser } from '../../../src/lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('HTMLParser', () => {
  const parser = new HTMLParser();
  const fixturesPath = join(__dirname, '../../fixtures/html');

  describe('parse - links', () => {
    it('should extract navigation links', () => {
      const html = readFileSync(join(fixturesPath, 'simple-page.html'), 'utf-8');
      const result = parser.parse(html, '', 'https://example.com');

      const linkVerbs = result.verbs.filter(v => v.type === 'navigate');
      expect(linkVerbs.length).toBeGreaterThan(0);

      const aboutVerb = linkVerbs.find(v => v.name === 'about');
      expect(aboutVerb).toBeDefined();
      expect(aboutVerb?.target).toBe('https://example.com/about');
      expect(aboutVerb?.description).toContain('About');
    });

    it('should resolve relative URLs', () => {
      const html = '<a href="/relative">Link</a>';
      const result = parser.parse(html, '', 'https://example.com/page');

      const verb = result.verbs[0];
      expect(verb.target).toBe('https://example.com/relative');
    });

    it('should keep absolute URLs unchanged', () => {
      const html = '<a href="https://external.com/page">External</a>';
      const result = parser.parse(html, '', 'https://example.com');

      const verb = result.verbs[0];
      expect(verb.target).toBe('https://external.com/page');
    });

    it('should filter out links with text too short', () => {
      const html = '<a href="/short">AB</a>';
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBe(0);
    });

    it('should filter out links with text too long', () => {
      const longText = 'A'.repeat(101);
      const html = `<a href="/long">${longText}</a>`;
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBe(0);
    });

    it('should sanitize verb names to kebab-case', () => {
      const html = '<a href="/page">About Us & Contact!</a>';
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs[0].name).toBe('about-us-contact');
    });

    it('should handle protocol-relative URLs', () => {
      const html = '<a href="//cdn.example.com/page">CDN Link</a>';
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs[0].target).toBe('https://cdn.example.com/page');
    });
  });

  describe('parse - forms', () => {
    it('should extract forms with fields', () => {
      const html = readFileSync(join(fixturesPath, 'simple-page.html'), 'utf-8');
      const result = parser.parse(html, '', 'https://example.com');

      const formVerbs = result.verbs.filter(v => v.type === 'form');
      expect(formVerbs.length).toBeGreaterThan(0);

      const searchForm = formVerbs.find(v => v.name === 'search');
      expect(searchForm).toBeDefined();
      expect(searchForm?.params).toContain('q');
      expect(searchForm?.target).toBe('https://example.com/search');
    });

    it('should use submit button text for form name', () => {
      const html = `
        <form action="/submit">
          <input type="text" name="field1">
          <input type="submit" value="Submit Form">
        </form>
      `;
      const result = parser.parse(html, '', 'https://example.com');

      const formVerb = result.verbs.find(v => v.type === 'form');
      expect(formVerb?.name).toBe('submit-form');
    });

    it('should extract all input fields as params', () => {
      const html = `
        <form action="/form">
          <input type="text" name="username">
          <input type="email" name="email">
          <textarea name="message"></textarea>
          <select name="country"></select>
          <input type="submit" value="Send">
        </form>
      `;
      const result = parser.parse(html, '', 'https://example.com');

      const formVerb = result.verbs.find(v => v.type === 'form');
      expect(formVerb?.params).toEqual(['username', 'email', 'message', 'country']);
    });

    it('should skip submit and button inputs as params', () => {
      const html = `
        <form action="/form">
          <input type="text" name="field1">
          <input type="submit" name="submit">
          <input type="button" name="button">
          <input type="submit" value="Submit">
        </form>
      `;
      const result = parser.parse(html, '', 'https://example.com');

      const formVerb = result.verbs.find(v => v.type === 'form');
      expect(formVerb?.params).toEqual(['field1']);
    });

    it('should resolve form action URLs', () => {
      const html = '<form action="/api/submit"><input type="submit" value="Go"></form>';
      const result = parser.parse(html, '', 'https://example.com');

      const formVerb = result.verbs.find(v => v.type === 'form');
      expect(formVerb?.target).toBe('https://example.com/api/submit');
    });
  });

  describe('parse - buttons', () => {
    it('should extract buttons with onclick', () => {
      const html = '<button onclick="submitForm()">Submit</button>';
      const result = parser.parse(html, '', 'https://example.com');

      const buttonVerb = result.verbs.find(v => v.type === 'action');
      expect(buttonVerb).toBeDefined();
      expect(buttonVerb?.name).toBe('submit');
      expect(buttonVerb?.target).toBe('submitForm()');
    });

    it('should extract buttons with data-action', () => {
      const html = '<button data-action="delete">Delete</button>';
      const result = parser.parse(html, '', 'https://example.com');

      const buttonVerb = result.verbs.find(v => v.type === 'action');
      expect(buttonVerb).toBeDefined();
      expect(buttonVerb?.target).toBe('delete');
    });

    it('should skip buttons without onclick or data-action', () => {
      const html = '<button>Plain Button</button>';
      const result = parser.parse(html, '', 'https://example.com');

      const buttonVerbs = result.verbs.filter(v => v.type === 'action');
      expect(buttonVerbs.length).toBe(0);
    });

    it('should extract link-styled buttons', () => {
      const html = '<a class="button" data-action="save">Save</a>';
      const result = parser.parse(html, '', 'https://example.com');

      const buttonVerb = result.verbs.find(v => v.type === 'action' && v.name === 'save');
      expect(buttonVerb).toBeDefined();
    });

    it('should skip buttons with too short text', () => {
      const html = '<button onclick="fn()">A</button>';
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBe(0);
    });

    it('should not extract form buttons as action buttons', () => {
      const html = `
        <form>
          <button onclick="validate()">Validate</button>
        </form>
      `;
      const result = parser.parse(html, '', 'https://example.com');

      const actionVerbs = result.verbs.filter(v => v.type === 'action');
      expect(actionVerbs.length).toBe(0);
    });
  });

  describe('parse - deduplication and limits', () => {
    it('should deduplicate verbs by name', () => {
      const html = `
        <a href="/page1">Home</a>
        <a href="/page2">Home</a>
        <a href="/page3">Home</a>
      `;
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBe(1);
      expect(result.verbs[0].target).toBe('https://example.com/page1');
    });

    it('should limit to 20 verbs', () => {
      let html = '';
      for (let i = 0; i < 30; i++) {
        html += `<a href="/page${i}">Link ${i}</a>`;
      }
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBe(20);
    });
  });

  describe('parse - complex pages', () => {
    it('should parse Amazon-like search results', () => {
      const html = readFileSync(join(fixturesPath, 'amazon-search.html'), 'utf-8');
      const result = parser.parse(html, '', 'https://amazon.com/s?k=keyboard');

      expect(result.verbs.length).toBeGreaterThan(0);

      const productLinks = result.verbs.filter(v =>
        v.name.includes('keyboard') && v.type === 'navigate'
      );
      expect(productLinks.length).toBeGreaterThan(0);

      const paginationLinks = result.verbs.filter(v =>
        v.target?.includes('page=')
      );
      expect(paginationLinks.length).toBeGreaterThan(0);
    });
  });

  describe('parse - edge cases', () => {
    it('should handle empty HTML', () => {
      const result = parser.parse('', '', 'https://example.com');
      expect(result.verbs).toEqual([]);
    });

    it('should handle malformed HTML', () => {
      const html = '<a href="/page">Unclosed link';
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBeGreaterThan(0);
      expect(result.verbs[0].name).toBe('unclosed-link');
    });

    it('should handle links without href', () => {
      const html = '<a>No HREF</a>';
      const result = parser.parse(html, '', 'https://example.com');

      expect(result.verbs.length).toBe(0);
    });

    it('should handle malformed URLs gracefully', () => {
      const html = '<a href="ht!tp://bad-url">Link</a>';
      const result = parser.parse(html, '', 'https://example.com');

      // Should still create verb but with malformed URL as-is
      expect(result.verbs.length).toBeGreaterThan(0);
    });

    it('should preserve text in result', () => {
      const testText = 'Some page text content';
      const result = parser.parse('<a href="/link">Link</a>', testText, 'https://example.com');

      expect(result.text).toBe(testText);
    });
  });
});
