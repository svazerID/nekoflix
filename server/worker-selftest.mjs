// Runs the Worker's default export handler against real upstreams using Node's
// fetch/Request/Response globals (same API workerd exposes). env.ASSETS stubbed.
import handler from '../worker.mjs';

const env = { ASSETS: { fetch: async (req) => new Response('ASSETS-STUB ' + new URL(req.url).pathname) } };
const call = (path) => handler.fetch(new Request('https://w.test' + path), env);

let fails = 0;
async function check(path, test) {
  try {
    const r = await call(path);
    const ok = await test(r);
    if (!ok) { fails++; console.log('FAIL', path, r.status); }
    else console.log('ok  ', path, r.status);
    return r;
  } catch (e) {
    fails++;
    console.log('ERR ', path, e.message);
    return null;
  }
}

// static passthrough
await check('/', async (r) => (await r.text()).includes('ASSETS-STUB /'));

// od/home
let firstSlug = null;
await check('/api/od/home', async (r) => {
  const d = await r.json();
  firstSlug = d.cards?.[0]?.slug;
  return r.status === 200 && d.cards?.length > 0 && !!firstSlug;
});

// od/search
await check('/api/od/search?q=one%20piece', async (r) => {
  const d = await r.json();
  return r.status === 200 && d.cards?.length > 0;
});

// od/anime/:slug
const epUrl = await check(`/api/od/anime/${firstSlug}`, async (r) => {
  const d = await r.json();
  if (r.status !== 200 || !d.episodes?.length) return false;
  globalThis.__ep = d.episodes.at(-1).url;
  return true;
}).then(() => globalThis.__ep);

// od/watch -> stream resolved
const mp4 = await check(`/api/od/watch/x?url=${encodeURIComponent(epUrl)}`, async (r) => {
  const d = await r.json();
  if (r.status !== 200) return false;
  const s = (d.streams || []).find((s) => s.directStream);
  globalThis.__mp4 = s?.directStream;
  return !!s;
}).then(() => globalThis.__mp4);

// media proxy
if (mp4) {
  await check(`/api/proxy?url=${encodeURIComponent(mp4)}`, async (r) => {
    const ct = r.headers.get('content-type') || '';
    await r.arrayBuffer();
    return ct.includes('video');
  });
}

// bad proxy host rejected
await check('/api/proxy?url=https%3A%2F%2Fevil.example.com%2Fx.mp4', (r) => r.status === 403);

// unknown api 404
await check('/api/nope', (r) => r.status === 404);

console.log(fails ? `SELFTEST FAILED (${fails})` : 'worker selftest OK');
process.exit(fails ? 1 : 0);
