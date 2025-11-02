import { exec } from 'child_process';
import { promisify } from 'util';
import { gunzipSync } from 'zlib';

const execAsync = promisify(exec);

export interface BrowserResult {
  text: string;
  html: string;
  url: string;
}

export class Browser {
  /**
   * Fetch a URL using links and return both dump and source
   */
  async fetch(url: string): Promise<BrowserResult> {
    // Get text dump (increased buffer for large pages)
    const { stdout: text } = await execAsync(`links -dump "${url}"`, {
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    // Get HTML source (may be gzipped)
    const { stdout: rawHtml } = await execAsync(`links -source "${url}"`, {
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    // Try to decompress if it's gzipped
    let html: string;
    try {
      const buffer = Buffer.from(rawHtml);
      html = gunzipSync(buffer).toString('utf-8');
    } catch {
      // Not gzipped or decompression failed, use as-is
      html = rawHtml.toString('utf-8');
    }

    return {
      text: text.trim(),
      html,
      url
    };
  }

  /**
   * Check if links is installed
   */
  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync('which links');
      return true;
    } catch {
      return false;
    }
  }
}

export const browser = new Browser();
