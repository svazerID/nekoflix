import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const extractCrunchyTitles = (html) => [...new Set([...html.matchAll(/(?:### )?\[([^\]]+)\]\(https:\/\/www\.crunchyroll\.com\/id\/series\//g)].map((m) => m[1].replace(/\\\\#/g, '#').trim()))].slice(0, 20);
const html = await readFile(new URL('./fixtures/crunchy-new.md', import.meta.url), 'utf8');
const titles = extractCrunchyTitles(html);
assert(titles.length >= 10);
assert.equal(titles[0], 'Magic Repo Man: Dumped by My Party, I’ll Cash In With a Cute Support Fairy to Become the Strongest!');
assert(!titles.includes('Anime Baru Ditambahkan'));
console.log(`Crunchyroll new parser OK (${titles.length} titles)`);
