(function () {
  function hydrate(video) {
    var s = video && video.querySelector('source[data-src]');
    if (s && !s.src) {
      s.src = s.dataset.src;
      video.load(); // keeps poster until user presses play
    }
  }

  var videos = Array.prototype.slice.call(document.querySelectorAll('video.clip'));
  if (!videos.length) return;

  // If user hits play first, ensure the source exists
  document.addEventListener('play', function (e) {
    var v = e.target;
    if (v && v.tagName === 'VIDEO') hydrate(v);
  }, true);

  // If IO unsupported, hydrate immediately
  if (!('IntersectionObserver' in window)) {
    videos.forEach(hydrate);
    return;
  }

  // Hydrate ~1000px before they enter the viewport to feel instant
  var io = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      hydrate(entry.target);
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '1000px 0px', threshold: 0.01 });

  // Observe all, and also hydrate immediately if already visible on first paint
  videos.forEach(function (v) {
    io.observe(v);
    var r = v.getBoundingClientRect();
    if (r.top < window.innerHeight + 1000 && r.bottom > -1000) {
      hydrate(v);
      io.unobserve(v);
    }
  });
})();