import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_DISCLAIMER,
  DASHBOARD_LABEL,
  displaySource,
  findUnsupportedClaims,
  renderOutreachEmail,
  renderOutreachHtml,
  renderOutreachText,
  sanitizeSubject,
  splitParagraphs,
  validateOutreachContent,
  type OutreachEmailContent,
} from './outreachEmail';

function makeContent(
  overrides: Partial<OutreachEmailContent> = {},
): OutreachEmailContent {
  return {
    subject: 'A thought on the Acme contact page',
    opening:
      'Hi Acme team,\n\nI noticed your contact page only offers a phone number.\n\nA short web form could capture after-hours inquiries.',
    findings: [
      {
        text: 'The contact page lists a phone number but no form.',
        sourceUrl: 'https://www.acme.test/contact',
      },
    ],
    workflow: [
      { name: 'Capture', description: 'A short inquiry form on every page.' },
      { name: 'Acknowledge', description: 'An automatic confirmation email.' },
    ],
    dashboard: {
      title: 'Lead response overview',
      metrics: [
        { label: 'New inquiries', description: 'Form and call leads.' },
        { label: 'Awaiting reply', description: 'Leads not yet answered.' },
      ],
      stages: ['New', 'Contacted', 'Booked'],
    },
    closing: 'Would a rough sketch of this be useful?',
    signature: 'Sam Rivera\nRivera Automation',
    ...overrides,
  };
}

describe('renderOutreachHtml', () => {
  it('escapes model and user content instead of emitting markup', () => {
    const html = renderOutreachHtml(
      makeContent({
        opening: 'Hi <script>alert(1)</script> & "team"',
        findings: [
          {
            text: '<img src=x onerror=alert(1)>',
            sourceUrl: 'https://acme.test/<b>',
          },
        ],
        closing: '<a href="https://evil.test">Click?</a>',
        signature: "O'Brien <b>bold</b>",
      }),
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&amp; &quot;team&quot;');
    expect(html).toContain('O&#39;Brien &lt;b&gt;bold&lt;/b&gt;');
  });

  it('emits no links, images, or remote resources of its own', () => {
    const html = renderOutreachHtml(makeContent());
    expect(html).not.toMatch(/<a\s|<img|<script|<link|src=|href=/i);
  });

  it('labels the dashboard as an illustrative example with blank values', () => {
    const html = renderOutreachHtml(makeContent());
    expect(html).toContain(DASHBOARD_LABEL);
    expect(html).toContain(DASHBOARD_DISCLAIMER);
    expect(html).toContain('&mdash;');
    const visibleText = html.replace(/<[^>]*>/g, ' ');
    expect(visibleText).not.toMatch(/\d+\s?%/);
  });
});

describe('renderOutreachText', () => {
  it('conveys the same findings, workflow, dashboard, and question as HTML', () => {
    const content = makeContent();
    const text = renderOutreachText(content);
    expect(text).toContain('I noticed your contact page only offers');
    expect(text).toContain(
      'The contact page lists a phone number but no form. (seen on acme.test/contact)',
    );
    expect(text).toContain('1. Capture: A short inquiry form on every page.');
    expect(text).toContain(DASHBOARD_LABEL.toUpperCase());
    expect(text).toContain(DASHBOARD_DISCLAIMER);
    expect(text).toContain('Example lead stages: New -> Contacted -> Booked');
    expect(text).toContain('- New inquiries: [ - ]');
    expect(text).toContain('Would a rough sketch of this be useful?');
    expect(text).toContain('Sam Rivera\nRivera Automation');
    expect(text).not.toContain('<');
    // The opening introduces the mockup, so the dashboard follows it directly.
    expect(text.indexOf(DASHBOARD_LABEL.toUpperCase())).toBeLessThan(
      text.indexOf('WHAT I NOTICED ON YOUR SITE'),
    );
  });
});

describe('renderOutreachEmail', () => {
  it('flattens the subject to one header-safe line', () => {
    const rendered = renderOutreachEmail(
      makeContent({ subject: 'Hello\r\nBcc: victim@example.test' }),
    );
    expect(rendered.subject).toBe('Hello Bcc: victim@example.test');
  });
});

describe('validateOutreachContent', () => {
  it('accepts complete content', () => {
    expect(validateOutreachContent(makeContent())).toEqual([]);
  });

  it('requires a subject, opening, question, and dashboard metrics', () => {
    const issues = validateOutreachContent(
      makeContent({
        subject: '  ',
        opening: '',
        closing: 'Thanks.',
        dashboard: { title: 'x', metrics: [], stages: [] },
      }),
    );
    expect(issues).toEqual([
      'Subject is empty.',
      'Opening paragraphs are empty.',
      'Closing must include a conversation-starting question.',
      'Dashboard concept has no metrics.',
    ]);
  });
});

describe('findUnsupportedClaims', () => {
  it('flags invented percentages, money, response times, and loss claims', () => {
    const claims = findUnsupportedClaims(
      'You could see a 35% lift worth $12k. Replies take 4 hours today, so you are losing leads every week.',
      'Call us today. Open Monday to Friday.',
    );
    expect(claims).toEqual(
      expect.arrayContaining([
        '35%',
        '$12k',
        '4 hours',
        'you are losing leads every week',
      ]),
    );
  });

  it('flags unhedged claims about processes a web page cannot show', () => {
    expect(
      findUnsupportedClaims(
        'However, it seems that there is no immediate acknowledgment system for inquiries. Slow responses hurt.',
        '',
      ),
    ).toEqual(['there is no immediate acknowledgment', 'Slow responses']);
  });

  it('allows the same topics when framed as a question or hypothesis', () => {
    expect(
      findUnsupportedClaims(
        'It may be worth checking whether there is no follow-up after a form is sent. Do new inquiries get an automatic acknowledgment, or is there no acknowledgment yet?',
        '',
      ),
    ).toEqual([]);
  });

  it('allows figures that appear verbatim on the retrieved site', () => {
    expect(
      findUnsupportedClaims(
        'Your site promises a reply within 24 hours.',
        'We reply within 24 hours of every request.',
      ),
    ).toEqual([]);
  });
});

describe('helpers', () => {
  it('splits paragraphs on blank lines and normalizes CRLF', () => {
    expect(splitParagraphs('a\r\n\r\n b \n\n\n')).toEqual(['a', 'b']);
  });

  it('shows host and path for sources', () => {
    expect(displaySource('https://www.acme.test/')).toBe('acme.test');
    expect(displaySource('not a url')).toBe('not a url');
  });

  it('sanitizes subjects', () => {
    expect(sanitizeSubject(' a\n\tb  ')).toBe('a b');
  });
});
