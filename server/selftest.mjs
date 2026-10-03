// Self-check for the pure scraping logic (no network): run `node server/index.mjs --selftest`
import { parseCards, parseSeries, jsonVar, base64Scripts } from './index.mjs';
import { parseOdSearch, parseOdHome, parseOdSeries, parseOdMirrors } from './otakudesu.mjs';

const homeHtml = `<article class="animeseries post-1"><div class="sera">
<a href="https://s13.nontonanimeid.boats/anime/test-anime/"><div class="limit">
<span class="types episodes"><span class="dashicons dashicons-plus-alt"></span>12 - Tamat</span>
<img src="https://i0.wp.com/x.jpg?h=210" alt="Test Anime">
<h3 class="title less nlat entry-title"><span data-title-default="Test Anime">Test Anime</span></h3>
</div></a></div></article>`;

const cards = parseCards(homeHtml);
console.assert(cards.length === 1, 'cards length');
console.assert(cards[0].id === 'test-anime', 'card slug');
console.assert(cards[0].title === 'Test Anime', 'card title');

const seriesHtml = `<h1>Nonton <span data-title-default="Test Anime" data-title-jp="Tes Anime">Test Anime</span></h1>
<div class="anime-card__quick-info v4"><span class="info-item status-finish">Finished Airing</span>
<span class="info-item">12 Episodes</span><span class="info-item">23 min per ep</span>
<span class="info-item season"><a href="/premiereds/summer-2026/" rel="tag">Summer 2026</a></span></div>
<div class="as-quick-info"><span class="as-rating"><span class="icon">⭐</span> 7.78</span></div>
<p class="as-synopsis">Sinopsis tes.</p>
<a href="/tag/action/" rel="tag">Action</a>
<a href="https://s13.nontonanimeid.boats/test-anime-episode-2/" class="episode-item"><span class="ep-title">Episode 2</span></a>
<a href="https://s13.nontonanimeid.boats/test-anime-episode-1/" class="episode-item"><span class="ep-title">Episode 1</span></a>`;

const s = parseSeries(seriesHtml, 'test-anime');
console.assert(s.title === 'Test Anime', 'series title');
console.assert(s.japaneseTitle === 'Tes Anime', 'series jp');
console.assert(s.status === 'Tamat', 'series status');
console.assert(s.rating === '7.78', 'series rating');
console.assert(s.totalEpisodes === '12', 'series eps');
console.assert(s.duration === '23 min', 'series duration');
console.assert(s.season === 'Summer 2026', 'series season');
console.assert(s.genres.includes('Action'), 'series genre');
console.assert(s.episodes.length === 2 && s.episodes[0].number === 1, 'episodes sorted asc');

const b64 = base64Scripts(`<script src="data:text/javascript;base64,${btoa('var kotakajax={"url":"https://x/wp-admin/admin-ajax.php","nonce":"abc123"}')}"></script>`);
const ajax = jsonVar(b64.kotakajax, 'kotakajax');
console.assert(ajax?.nonce === 'abc123', 'kotakajax nonce');

// ---- otakudesu parsers ----
const odSearch = parseOdSearch(`<ul class="chivsrc"><li style='list-style:none;'>
<h2><a href="https://otakudesu.blog/anime/test-sub-indo/">Test Subtitle Indonesia</a></h2>
<img src="https://otakudesu.blog/x.jpg" alt="Test">
<div class="set"><b>Genres</b> : <a href="g" rel="tag">Action</a></div></li></ul>`);
console.assert(odSearch.length === 1 && odSearch[0].slug === 'test-sub-indo', 'od search slug');

const odSeries = parseOdSeries(`<h1>Test Anime Subtitle Indonesia</h1>
<div class='fotoanime'><img src="https://otakudesu.blog/p.jpg">
<div class="infozingle"><p><span><b>Judul</b>: Test Anime</span></p>
<p><span><b>Japanese</b>: テスト</span></p><p><span><b>Skor</b>: 7.10</span></p>
<p><span><b>Status</b>: Ongoing</span></p><p><span><b>Genre</b>: <a>Action</a>, <a>Drama</a></span></p></div></div>
<div class="episodelist"><div class="smokelister"><span class="monktit">Test Anime Episode List <span>(x)</span></span></div>
<ul><li><span><a href="https://otakudesu.blog/episode/test-episode-2-sub-indo/">Test Anime Episode 2 Subtitle Indonesia</a></span></li>
<li><span><a href="https://otakudesu.blog/episode/test-episode-1-sub-indo/">Test Anime Episode 1 Subtitle Indonesia</a></span></li></ul></div>`, 'test-sub-indo');
console.assert(odSeries.title === 'Test Anime', 'od series title');
console.assert(odSeries.rating === '7.10', 'od series rating');
console.assert(odSeries.episodes.length === 2 && odSeries.episodes[0].number === 1, 'od episodes sorted asc');

const odMirror = parseOdMirrors(`<ul class="m480p"><span>480p</span>
<li><a href="#" data-content="${btoa(JSON.stringify({ id: 42, i: 1, q: '480p' }))}">odcdn</a></li></ul>`);
console.assert(odMirror.length === 1 && odMirror[0].serverName === 'odcdn' && odMirror[0].id === 42, 'od mirror decode');

console.log('selftest OK');
