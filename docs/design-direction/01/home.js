(() => {
  'use strict';
  const hero = document.querySelector('#wf-hero');
  const copies = {
    a:['若者の熱狂が、','社会を動かす。','これ、やってみたい。'],
    b:['若者と社会が','混ざる場所。','一緒にやらない？'],
    c:['声が、','次のMOVEになる。','こんな未来だったら面白い。']
  };
  document.querySelectorAll('button[data-axis]').forEach(button => button.addEventListener('click', () => {
    const axis = button.dataset.axis;
    const copy = copies[axis];
    document.querySelector('#preview-copy').replaceChildren(document.createTextNode(copy[0]),document.createElement('br'),document.createTextNode(copy[1]));
    document.querySelector('#preview-voice').textContent = copy[2];
    document.querySelector('#preview-axis-label').textContent = `AXIS ${axis.toUpperCase()} / 仮表示`;
    hero.dataset.axis = axis;
    document.querySelectorAll('button[data-axis]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.axis === axis)));
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('#motion-toggle');
  let paused = reduced.matches;
  let frame = null;
  function updateMotion() {
    frame = null;
    if (paused || reduced.matches) return;
    const shift = Math.max(-18, Math.min(18, scrollY * .035));
    hero.style.setProperty('--photo-shift',`${shift}px`);
    const join = document.querySelector('#wf-join');
    const offset = Math.max(-25,Math.min(25,(innerHeight-join.getBoundingClientRect().top)*.04));
    join.style.setProperty('--color-shift',`${offset}px`);
  }
  function applyMotionState() {
    const stopped = paused || reduced.matches;
    document.body.classList.toggle('motion-paused',stopped);
    toggle.setAttribute('aria-pressed',String(stopped));
    toggle.textContent = reduced.matches ? '動き軽減：静止表示' : stopped ? '動きを再開' : '動きを停止';
    toggle.disabled = reduced.matches;
    if (!stopped) updateMotion();
  }
  if ('IntersectionObserver' in window) {
    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }});
    },{threshold:.15});
    observer.observe(document.querySelector('#wf-voices'));
  }
  toggle.addEventListener('click',() => {paused = !paused; applyMotionState();});
  reduced.addEventListener('change',() => {paused = reduced.matches; applyMotionState();});
  addEventListener('scroll',() => {if (!frame && !paused && !reduced.matches) frame = requestAnimationFrame(updateMotion);},{passive:true});
  applyMotionState();
  const dialog = document.querySelector('#contact-dialog');
  document.querySelector('[data-contact]').addEventListener('click',() => dialog.showModal());
  dialog.querySelectorAll('.dialog-close,.dialog-done').forEach(button => button.addEventListener('click',() => dialog.close()));
  dialog.addEventListener('click',event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
})();
