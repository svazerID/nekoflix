import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import TITLES from './fixtures/crunchy-new-titles.mjs';

const extractCrunchyTitles = (html) => [...new Set([...html.matchAll(/(?:### )?\[([^\]]+)\]\(https:\/\/www\.crunchyroll\.com\/id\/series\//g)].map((m) => m[1].replace(/\\\\#/g, '#').trim()))].slice(0, 20);
const html = await readFile(new URL('./fixtures/crunchy-new.md', import.meta.url), 'utf8');
const titles = extractCrunchyTitles(html);
assert.equal(titles.length, 20);
assert.deepEqual(titles, TITLES);
console.log(`Crunchyroll new parser OK (${titles.length} titles)`);
