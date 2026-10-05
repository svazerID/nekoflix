// Node-based self-check for the watch-view helpers, exercising both mirror
// kinds with a stubbed video element. Run: node scripts/watch-view.check.mjs
import { strict as assert } from 'node:assert';

// --- helper under test: stop the <video> when an embed mirror takes over ---
function attach(video, current) {
  if (!current || current.kind === 'embed') {
    video.pause();
    video.removeAttribute('src');
    video.load();
    return;
  }
  video.src = current.url;
  video.play().catch(() => {});
}

const stub = () => {
  const calls = [];
  return {
    calls,
    currentTime: 0,
    paused: false,
    removeAttribute: (a) => calls.push(['removeAttribute', a]),
    load: () => calls.push(['load']),
    pause: () => calls.push(['pause']),
    play: () => { calls.push(['play']); return Promise.resolve(); },
    set src(v) { calls.push(['src', v]); },
  };
};

const v1 = stub();
attach(v1, { kind: 'embed', url: 'https://vidhide.com/e/abc' });
assert.ok(v1.calls.some((c) => c[0] === 'pause'), 'embed must pause the video');
assert.ok(v1.calls.some((c) => c[0] === 'removeAttribute' && c[1] === 'src'), 'embed must clear src');
assert.ok(!v1.calls.some((c) => c[0] === 'play'), 'embed must not play the video');

const v2 = stub();
attach(v2, { kind: 'mp4', url: '/api/proxy?url=x.mp4' });
assert.ok(v2.calls.some((c) => c[0] === 'src'), 'direct mirror sets src');
assert.ok(v2.calls.some((c) => c[0] === 'play'), 'direct mirror plays');

console.log('watch-view.check OK');
