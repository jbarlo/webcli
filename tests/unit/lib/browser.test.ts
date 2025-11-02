import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gzipSync } from 'zlib';

// Create shared mock that can be accessed from tests
const mockExecAsync = vi.fn();

// Mock util to return our mock execAsync
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync)
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Import after mocks are set up
const { Browser } = await import('../../../src/lib/browser.js');

describe('Browser', () => {
  let browser: Browser;

  beforeEach(() => {
    browser = new Browser();
    mockExecAsync.mockReset();
  });

  describe('fetch', () => {
    it('should fetch text dump and HTML source', async () => {
      const mockText = 'Page text content';
      const mockHtml = '<html><body>Page content</body></html>';

      // Mock text dump call (first call)
      mockExecAsync.mockResolvedValueOnce({ stdout: mockText, stderr: '' });

      // Mock HTML source call (second call)
      mockExecAsync.mockResolvedValueOnce({ stdout: Buffer.from(mockHtml), stderr: '' });

      const result = await browser.fetch('https://example.com');

      expect(result.text).toBe(mockText);
      expect(result.html).toBe(mockHtml);
      expect(result.url).toBe('https://example.com');
    });

    it('should decompress gzipped HTML', async () => {
      const mockText = 'Page text';
      const mockHtml = '<html><body>Compressed content</body></html>';
      const gzippedHtml = gzipSync(Buffer.from(mockHtml));

      mockExecAsync.mockResolvedValueOnce({ stdout: mockText, stderr: '' });
      mockExecAsync.mockResolvedValueOnce({ stdout: gzippedHtml, stderr: '' });

      const result = await browser.fetch('https://example.com');

      expect(result.html).toBe(mockHtml);
      expect(result.text).toBe(mockText);
    });

    it('should handle non-gzipped HTML gracefully', async () => {
      const mockText = 'Page text';
      const mockHtml = '<html><body>Plain content</body></html>';

      mockExecAsync.mockResolvedValueOnce({ stdout: mockText, stderr: '' });
      mockExecAsync.mockResolvedValueOnce({ stdout: Buffer.from(mockHtml), stderr: '' });

      const result = await browser.fetch('https://example.com');

      expect(result.html).toBe(mockHtml);
    });

    it('should trim text output', async () => {
      const mockText = '  \n Page text \n  ';
      const mockHtml = '<html></html>';

      mockExecAsync.mockResolvedValueOnce({ stdout: mockText, stderr: '' });
      mockExecAsync.mockResolvedValueOnce({ stdout: Buffer.from(mockHtml), stderr: '' });

      const result = await browser.fetch('https://example.com');

      expect(result.text).toBe('Page text');
    });

    it('should handle fetch errors', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Network error'));

      await expect(browser.fetch('https://example.com')).rejects.toThrow('Network error');
    });

    it('should pass URL to links command', async () => {
      const testUrl = 'https://test.com/page';

      mockExecAsync.mockResolvedValue({ stdout: 'text', stderr: '' });

      await browser.fetch(testUrl);

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining(testUrl)
      );
    });
  });

  describe('checkInstalled', () => {
    it('should return true when links is installed', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/bin/links', stderr: '' });

      const result = await browser.checkInstalled();

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('which links');
    });

    it('should return false when links is not installed', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not found'));

      const result = await browser.checkInstalled();

      expect(result).toBe(false);
    });
  });
});
