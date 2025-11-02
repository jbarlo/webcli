import * as cheerio from 'cheerio';
import { Verb } from '../types/index.js';

export interface ParsedPage {
  verbs: Verb[];
  text: string;
}

export class HTMLParser {
  /**
   * Extract verbs from HTML using cheerio
   */
  parse(html: string, text: string, currentUrl: string): ParsedPage {
    const $ = cheerio.load(html);
    const verbs: Verb[] = [];

    // Extract links
    $('a[href]').each((i, elem) => {
      const $elem = $(elem);
      const href = $elem.attr('href');
      const linkText = $elem.text().trim();

      if (!href || !linkText) return;

      // Skip navigation/menu items, focus on content
      if (linkText.length < 3 || linkText.length > 100) return;

      // Resolve relative URLs
      const absoluteUrl = this.resolveUrl(href, currentUrl);

      // Create a verb name from the link text
      const verbName = this.sanitizeVerbName(linkText);

      verbs.push({
        name: verbName,
        description: `Navigate to: ${linkText}`,
        type: 'navigate',
        params: [],
        target: absoluteUrl
      });
    });

    // Extract forms
    $('form').each((i, elem) => {
      const $form = $(elem);
      const action = $form.attr('action') || '';
      const method = ($form.attr('method') || 'get').toLowerCase();

      // Look for submit buttons to name the form action
      const submitButton = $form.find('button[type="submit"], input[type="submit"]').first();
      const formName = submitButton.text().trim() || submitButton.attr('value') || `form-${i}`;

      const verbName = this.sanitizeVerbName(formName);

      // Extract form fields
      const fields: string[] = [];
      $form.find('input, textarea, select').each((j, input) => {
        const $input = $(input);
        const name = $input.attr('name');
        if (name && !['submit', 'button'].includes($input.attr('type') || '')) {
          fields.push(name);
        }
      });

      verbs.push({
        name: verbName,
        description: `Submit form: ${formName}` + (fields.length > 0 ? ` (fields: ${fields.join(', ')})` : ''),
        type: 'form',
        params: fields,
        target: this.resolveUrl(action, currentUrl)
      });
    });

    // Extract buttons (that aren't in forms)
    $('button:not(form button), a.button, a.btn').each((i, elem) => {
      const $elem = $(elem);
      const buttonText = $elem.text().trim();

      if (!buttonText || buttonText.length < 2) return;

      const verbName = this.sanitizeVerbName(buttonText);

      // Check if it has an onclick or data attribute
      const onclick = $elem.attr('onclick');
      const dataAction = $elem.attr('data-action');

      if (onclick || dataAction) {
        verbs.push({
          name: verbName,
          description: `Click button: ${buttonText}`,
          type: 'action',
          params: [],
          target: onclick || dataAction || ''
        });
      }
    });

    // Deduplicate verbs by name (keep first occurrence)
    const seenNames = new Set<string>();
    const uniqueVerbs = verbs.filter(verb => {
      if (seenNames.has(verb.name)) return false;
      seenNames.add(verb.name);
      return true;
    });

    // Limit to top 20 verbs to avoid overwhelming output
    return {
      verbs: uniqueVerbs.slice(0, 20),
      text
    };
  }

  /**
   * Convert link/button text to a valid verb name
   */
  private sanitizeVerbName(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')         // Spaces to hyphens
      .replace(/-+/g, '-')          // Multiple hyphens to single
      .replace(/^-|-$/g, '')        // Trim hyphens
      .substring(0, 50);            // Limit length
  }

  /**
   * Resolve relative URLs to absolute
   */
  private resolveUrl(href: string, baseUrl: string): string {
    try {
      const base = new URL(baseUrl);
      const resolved = new URL(href, base);
      return resolved.toString();
    } catch {
      // If URL parsing fails, return as-is
      return href;
    }
  }
}

export const htmlParser = new HTMLParser();
