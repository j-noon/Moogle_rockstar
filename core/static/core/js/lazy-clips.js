(function() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('video.clip source[data-src]').forEach(function(s){ s.src = s.dataset.src; });
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const vid = e.target;
      const src = vid.querySelector('source[data-src]');
      if (src && !src.src) {
        src.src = src.dataset.src;
        vid.load();
      }
      obs.unobserve(vid);
    });
  }, { rootMargin: '200px' });
  document.querySelectorAll('video.clip').forEach(v => io.observe(v));
})();