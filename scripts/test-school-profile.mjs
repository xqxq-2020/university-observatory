import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['app/api/profile/route.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const { GET } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const realFetch = globalThis.fetch;
const requests = [];
const schoolUrl = 'https://www.caa.edu.cn';
const html = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const query = id => GET(new Request('https://test.invalid/api/profile?school=' + encodeURIComponent(id)));

try {
  globalThis.fetch = async address => {
    const url = new URL(address);
    requests.push(url.href);
    if (url.hostname === 'www.zju.edu.cn' && url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /');
    }
    assert.equal(url.origin, schoolUrl, 'request must remain on the configured university');
    switch (url.pathname) {
      case '/robots.txt': return new Response('User-agent: *\nDisallow: /private/');
      case '/': return html([
        '<nav><a href="https://example.test/leadership">现任领导</a>',
        '<a href="/leaders/">校领导</a><a href="/about/">学校概况</a><a href="/identify/">学校标识</a>',
        '<a href="/history/">历史沿革</a><a href="/alumni/">知名校友</a></nav>',
      ].join(''));
      case '/leaders/': return html([
        '<ul><li><strong>校 长</strong><span>朱　晓明</span></li>',
        '<li><strong>副校长</strong><span>王小小</span></li>',
        '<li><strong>校长助理</strong><span>林小小</span></li></ul>',
      ].join(''));
      case '/about/': return html('<p>学校前身一所书院创立于1928年。学校公布了展览和研究计划。</p>');
      case '/identify/': return html('<p>校训：笃学求实</p><img alt="校徽" src="/media/crest.png" />');
      case '/history/': return html('<p>1993年，学校定名为现名。</p><p>学校于2019年举行校庆。</p>');
      case '/alumni/': return html('<a href="/info/1456/10234.htm">王宁</a><a href="https://example.test/info/10234.htm">李华</a>');
      default: throw new Error('Unexpected request: ' + address);
    }
  };

  assert.equal((await query('https://example.test')).status, 400);
  assert.deepEqual(requests, []);

  const blocked = await (await query('u080')).json();
  assert.equal(blocked.status, 'unavailable');
  assert.equal(blocked.profile.crest.src, '/university-crests/u080.png');
  assert.ok(blocked.profile.president.text);
  assert.deepEqual(requests, ['https://www.zju.edu.cn/robots.txt']);

  const scraped = await (await query('u081')).json();
  assert.equal(scraped.status, 'updated');
  assert.equal(scraped.pagesRead, 6);
  assert.equal(scraped.profile.president.text, '朱晓明');
  assert.equal(scraped.profile.president.url, schoolUrl + '/leaders/');
  assert.equal(scraped.profile.motto.text, '笃学求实');
  assert.equal(scraped.profile.founded.text, '1928 年');
  assert.equal(scraped.profile.crest.src, schoolUrl + '/media/crest.png');
  assert.equal(scraped.profile.timeline[0].year, '1993');
  assert.deepEqual(scraped.profile.alumni.map(person => person.name), ['王宁']);
  assert.ok(!requests.some(url => url.includes('example.test')));
  assert.equal(requests.filter(url => url === schoolUrl + '/robots.txt').length, 1);

  const before = requests.length;
  const cached = await (await query('u081')).json();
  assert.equal(cached.cached, true);
  assert.equal(requests.length, before);
  console.log('PASS: official source discovery, principal extraction, field citations, robots fallback, and cache.');
} finally {
  globalThis.fetch = realFetch;
}
