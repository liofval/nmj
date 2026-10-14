(() => {
  'use strict';
  const axes = {
    a: { label:'AXIS A / 仮表示', lines:['若者の熱狂が、','社会を動かす。'], voice:'これ、やってみたい。' },
    b: { label:'AXIS B / 仮表示', lines:['若者と社会が','混ざる場所。'], voice:'一緒にやらない？' },
    c: { label:'AXIS C / 仮表示', lines:['声が、','次のMOVEになる。'], voice:'こんな未来だったら面白い。' }
  };
  const preview = document.querySelector('#wf-hero');
  const axisLabel = document.querySelector('#preview-axis-label');
  axisLabel.setAttribute('role','status');
  document.querySelectorAll('button[data-axis]').forEach(button => {
    button.addEventListener('click', () => {
      const axis = button.dataset.axis;
      const content = axes[axis];
      preview.dataset.axis = axis;
      axisLabel.textContent = content.label;
      const heading = document.querySelector('#preview-copy');
      heading.replaceChildren(document.createTextNode(content.lines[0]), document.createElement('br'), document.createTextNode(content.lines[1]));
      document.querySelector('#preview-voice').textContent = content.voice;
      document.querySelectorAll('button[data-axis]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.axis === axis)));
      if (button.classList.contains('axis-select')) {
        preview.scrollIntoView({block:'start'});
        const selected = preview.querySelector(`button[data-axis="${axis}"]`);
        selected.focus({preventScroll:true});
      }
    });
  });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const demo = document.querySelector('.motion-demo');
  const play = document.querySelector('#play-motion');
  const stop = document.querySelector('#stop-motion');
  const status = document.querySelector('#motion-status');
  let timer;
  function finish(message) {
    clearTimeout(timer);
    demo.classList.remove('playing');
    demo.dataset.state = 'idle';
    stop.disabled = true;
    play.disabled = false;
    status.textContent = message;
  }
  play.addEventListener('click', () => {
    if (reduced.matches) {
      finish('モーション軽減設定のため静止表示。声 → つながり → MOVEの関係を配置で表しています。');
      return;
    }
    clearTimeout(timer);
    demo.classList.remove('playing');
    void demo.offsetWidth;
    demo.classList.add('playing');
    demo.dataset.state = 'playing';
    play.disabled = true;
    stop.disabled = false;
    status.textContent = '一つの声が、隣の声へ。つながった熱量が、MOVEになります。';
    timer = setTimeout(() => finish('再生完了。声がつながり、MOVEになる動きです。もう一度試せます。'), 1700);
  });
  stop.addEventListener('click', () => finish('停止しました。すべての要素を静止表示しています。'));
  reduced.addEventListener('change', () => {
    if (reduced.matches) finish('モーション軽減設定のため、静止表示に切り替えました。');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && demo.dataset.state === 'playing') finish('表示を離れたため停止しました。');
  });
  const original = document.querySelector('.original-wireframe');
  original.addEventListener('toggle', () => {
    const frame = original.querySelector('iframe');
    if (original.open && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
  });
})();
