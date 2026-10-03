import { parseOdSearch, parseOdSeries } from './otakudesu.mjs';

const searchHtml = `<ul class="chivsrc"><li><h2><a href="https://otakudesu.blog/anime/sousou-frieren-s2-sub-indo/">Sousou no Frieren Season 2</a></h2><img src="poster.jpg"></li></ul>`;
const cards = parseOdSearch(searchHtml);
if (cards.length !== 1 || cards[0].slug !== 'sousou-frieren-s2-sub-indo') throw new Error('popular title lookup failed');
const detailHtml = `<div class="infozingle"><b>Judul</b>: Sousou no Frieren Season 2<br><b>Status</b>: Ongoing</div>`;
if (parseOdSeries(detailHtml, cards[0].slug).status !== 'Ongoing') throw new Error('Ongoing mapping failed');
console.log('popular selftest OK');
