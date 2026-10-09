import { describe, expect, it } from 'vitest';
import { htmlToText, parsePostingUrl, postingKey, tidyText, titleizeSlug } from './postings.js';

const U = '6ed76ce8-4156-4b60-b120-403538bd66cd';

describe('parsePostingUrl', () => {
  it.each([
    ['https://boards.greenhouse.io/stripe/jobs/8172487', { source: 'greenhouse', board: 'stripe', id: '8172487' }],
    ['job-boards.greenhouse.io/figma/jobs/5551234?gh_src=x', { source: 'greenhouse', board: 'figma', id: '5551234' }],
    ['https://boards.greenhouse.io/embed/job_app?for=airbnb&token=777', { source: 'greenhouse', board: 'airbnb', id: '777' }],
    [`https://jobs.lever.co/palantir/${U}`, { source: 'lever', board: 'palantir', id: U }],
    [`https://jobs.lever.co/palantir/${U.toUpperCase()}/apply`, { source: 'lever', board: 'palantir', id: U }],
    [`https://jobs.eu.lever.co/acme/${U}`, { source: 'lever', board: 'acme', id: U, region: 'eu' }],
    [`https://jobs.ashbyhq.com/ashby/${U}/application`, { source: 'ashby', board: 'ashby', id: U }],
  ])('%s', (url, ref) => {
    expect(parsePostingUrl(url)).toEqual(ref);
  });

  it.each([
    'https://stripe.com/jobs/search?gh_jid=8172487', // company site: board unknown
    'https://www.linkedin.com/jobs/view/123',
    'https://boards.greenhouse.io/stripe', // no job id
    'https://boards.greenhouse.io/stripe/jobs/abc',
    'https://jobs.lever.co/palantir/not-a-uuid',
    'https://evil.example.com/boards.greenhouse.io/stripe/jobs/1',
    'https://boards.greenhouse.io.evil.com/stripe/jobs/1',
    'javascript:alert(1)',
    'https://boards.greenhouse.io/..%2F..%2Fadmin/jobs/1',
    '',
    null,
  ])('rejects %s', (url) => {
    expect(parsePostingUrl(url)).toBeNull();
  });

  it('builds stable keys and readable company names', () => {
    expect(postingKey(parsePostingUrl(`jobs.lever.co/Palantir/${U}`)!)).toBe(`lever:palantir:${U}`);
    expect(titleizeSlug('acme-robotics')).toBe('Acme Robotics');
  });
});

describe('htmlToText', () => {
  it('turns HTML into readable text with bullets', () => {
    const html = '<h2>About</h2><p>We build <strong>things</strong>&nbsp;&amp; stuff.</p><ul><li>Go</li><li>TypeScript</li></ul>';
    expect(htmlToText(html)).toBe('About\n\nWe build things & stuff.\n\n• Go\n• TypeScript');
  });

  it("handles Greenhouse's escaped HTML", () => {
    expect(htmlToText('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;p&gt;Bye&lt;/p&gt;')).toBe('Hello & welcome\n\nBye');
  });

  it('drops scripts and decodes numeric entities', () => {
    expect(htmlToText('<script>alert(1)</script><p>It&#8217;s 5&#x25;</p>')).toBe('It’s 5%');
  });

  it('does not treat <link> as a list item', () => {
    expect(htmlToText('<link rel="x"><p>Hi</p>')).toBe('Hi');
  });

  it('caps very long descriptions', () => {
    expect(htmlToText('<p>' + 'x'.repeat(200_000) + '</p>').length).toBe(100_000);
  });
});

describe('tidyText', () => {
  it('keeps angle brackets in plain text and tidies whitespace', () => {
    expect(tidyText('  Use C++ when a < b and b > c  \r\n\n\n\nThanks ')).toBe('Use C++ when a < b and b > c\n\nThanks');
  });
});
