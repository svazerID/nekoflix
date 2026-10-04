const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const r = await fetch('https://filedon.co/dl', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://filedon.co/embed/B5oIGnD1Al' }, body: 'op=embed&file_code=B5oIGnD1Al&auto=1&referer=' });
const t = await r.text();
console.log('status', r.status, 'len', t.length, 'has sources:', /sources|file/.test(t));
console.log(t.match(/sources:\s*\[[^\]]{0,200}/)?.[0] || t.slice(0, 300));
