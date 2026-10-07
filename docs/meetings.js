// 定例ミーティングの一覧（アジェンダのヘッダーの日付選択に使う）
// アジェンダを作ったら href を足す。href が無い回は「準備中」として選べない状態で表示する
window.NMJ_MEETINGS = [
  { date: '2026-10-08', title: 'HP 構成・メディアのワイヤー fix', href: './agenda-20261008.html' },
  { date: '2026-10-15', title: 'デザインの方向性決定' },
  { date: '2026-10-22', title: 'HP 素材の締切・Stripe 申請' },
  { date: '2026-10-29', title: 'メディア 主要画面のデザイン承認' },
  { date: '2026-11-05', title: 'HP デザイン承認' },
  { date: '2026-11-12', title: '進捗確認' },
  { date: '2026-11-19', title: 'メディア 全画面のデザイン承認' },
  { date: '2026-11-26', title: 'HP 公開・規約類の確定' },
];

(function () {
  var sel = document.getElementById('meetingSelect');
  if (!sel) return;
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var here = location.pathname.split('/').pop();
  NMJ_MEETINGS.forEach(function (m) {
    var d = new Date(m.date + 'T00:00:00');
    var o = document.createElement('option');
    o.value = m.href || '';
    o.textContent = (d.getMonth() + 1) + '/' + d.getDate() + '（' + WD[d.getDay()] + '）' + m.title + (m.href ? '' : '（準備中）');
    if (!m.href) o.disabled = true;
    if (m.href && m.href.replace('./', '') === here) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', function () { if (sel.value) location.href = sel.value; });
})();
