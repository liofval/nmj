// docs/ticket/data.js（プロトタイプのモック DB）のルールを確かめる。実行: node --test tests/
// ルールの出典は docs/schema.prisma のコメント（10/8 定例の決定）
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../docs/ticket/data.js');

function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
const fresh = () => createDb({ storage: memStorage() });

function findEvent(db, pred) { return db.t.events.find(pred); }
function freeEvent(db) { return findEvent(db, e => e.status === 'PUBLISHED' && db.slotsOf(e.id).every(s => s.priceYen === 0) && db.slotsOf(e.id).some(s => db.slotRemaining(s.id) > 0) && db.isUpcoming(e)); }
function paidEvent(db) { return findEvent(db, e => e.status === 'PUBLISHED' && db.slotsOf(e.id).some(s => s.priceYen > 0 && db.slotRemaining(s.id) > 1) && db.isUpcoming(e)); }
function requiredAnswers(db, eventId, slotIds) {
  const a = {};
  db.questionsFor(eventId, slotIds).forEach(q => { a[q.id] = q.type === 'SELECT' ? q.options[0] : 'テスト'; });
  return a;
}
function newUser(db) { return db.createUser({ displayName: 'テスト', slug: 'test-' + db.t.users.length, email: 't' + db.t.users.length + '@example.com' }).id; }

test('seed: スキーマの主要テーブルがそろい、全イベント共通の質問（NAME/KANA/AFFILIATION）が入る', () => {
  const db = fresh();
  ['users', 'organizers', 'organizerMembers', 'follows', 'genres', 'events', 'slots', 'registrations', 'tickets', 'checkinLogs', 'questions', 'answers', 'payments', 'announcements', 'savedEvents', 'reports', 'articles', 'notifications'].forEach(t => assert.ok(Array.isArray(db.t[t]), t));
  db.t.events.forEach(e => {
    const keys = db.t.questions.filter(q => q.eventId === e.id && q.commonKey).map(q => q.commonKey).sort();
    assert.deepEqual(keys, ['AFFILIATION', 'KANA', 'NAME'], e.title);
  });
});

test('Figma の残数を再現する（渋谷ハロウィンは残り12枚）', () => {
  const db = fresh();
  const e = findEvent(db, x => x.title.startsWith('渋谷ハロウィン'));
  assert.equal(db.eventRemaining(e.id), 12);
});

test('無料枠だけの申込は即 CONFIRMED になり、QR チケットが1枚発行される', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = freeEvent(db); const slot = db.slotsOf(e.id).find(s => db.slotRemaining(s.id) > 0);
  const before = db.slotRemaining(slot.id);
  const r = db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id]));
  assert.equal(r.kind, 'confirmed');
  assert.equal(db.slotRemaining(slot.id), before - 1);
  const tickets = db.t.tickets.filter(t => t.userId === uid && t.eventId === e.id);
  assert.equal(tickets.length, 1);
  assert.ok(tickets[0].token.length >= 16);
});

test('有料枠は Payment PENDING で席を確保し、支払い完了で初めて CONFIRMED の行ができる', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = paidEvent(db); const slot = db.slotsOf(e.id).find(s => s.priceYen > 0 && db.slotRemaining(s.id) > 1);
  const before = db.slotRemaining(slot.id);
  const r = db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id]));
  assert.equal(r.kind, 'payment');
  assert.equal(db.t.registrations.filter(x => x.userId === uid).length, 0, '支払い前は申込の行を作らない');
  assert.equal(db.slotRemaining(slot.id), before - 1, '確保中は定員に数える');
  db.completePayment(r.paymentId, true);
  assert.equal(db.paymentById(r.paymentId).status, 'PAID');
  assert.equal(db.t.registrations.filter(x => x.userId === uid && x.status === 'CONFIRMED').length, 1);
  assert.equal(db.slotRemaining(slot.id), before - 1);
});

test('支払い失敗で席を解放し、申込の行は作らない', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = paidEvent(db); const slot = db.slotsOf(e.id).find(s => s.priceYen > 0 && db.slotRemaining(s.id) > 1);
  const before = db.slotRemaining(slot.id);
  const r = db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id]));
  db.completePayment(r.paymentId, false);
  assert.equal(db.paymentById(r.paymentId).status, 'FAILED');
  assert.equal(db.slotRemaining(slot.id), before);
  assert.equal(db.t.registrations.filter(x => x.userId === uid).length, 0);
});

test('確保の期限を過ぎた PENDING は EXPIRED になり席を解放する', () => {
  let now = Date.parse('2026-10-29T10:00:00+09:00');
  const db = createDb({ storage: memStorage(), clock: () => now });
  const uid = newUser(db); db.login(uid);
  const e = paidEvent(db); const slot = db.slotsOf(e.id).find(s => s.priceYen > 0 && db.slotRemaining(s.id) > 1);
  const before = db.slotRemaining(slot.id);
  const r = db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id]));
  now += 31 * 60 * 1000;
  assert.equal(db.slotRemaining(slot.id), before);
  assert.equal(db.paymentById(r.paymentId).status, 'EXPIRED');
  assert.throws(() => db.completePayment(r.paymentId, true), /期限/);
});

test('同じ枠に有効な申込は1件だけ', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = freeEvent(db); const slot = db.slotsOf(e.id).find(s => db.slotRemaining(s.id) > 0);
  db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id]));
  assert.throws(() => db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id])), /申込済み/);
});

test('満員の枠と、全体上限に達したイベントには申し込めない', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const full = db.t.slots.find(s => db.slotRemaining(s.id) === 0 && db.isUpcoming(db.eventById(s.eventId)));
  assert.ok(full, 'seed に満員の枠がある');
  assert.throws(() => db.apply(full.eventId, [full.id], requiredAnswers(db, full.eventId, [full.id])), /満員/);
});

test('必須の質問に答えないと申し込めない', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = freeEvent(db); const slot = db.slotsOf(e.id).find(s => db.slotRemaining(s.id) > 0);
  assert.throws(() => db.apply(e.id, [slot.id], {}), /必須/);
});

test('チケットは1人1イベント1枚（複数枠でも1枚）。全枠キャンセルで無効化', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = findEvent(db, x => db.isUpcoming(x) && x.status === 'PUBLISHED' && db.slotsOf(x.id).filter(s => s.priceYen === 0 && db.slotRemaining(s.id) > 0).length >= 1 && db.slotsOf(x.id).filter(s => db.slotRemaining(s.id) > 0).length >= 2);
  assert.ok(e, 'seed に空きのある枠が2つ以上のイベントがある');
  const slots = db.slotsOf(e.id).filter(s => db.slotRemaining(s.id) > 0).slice(0, 2).map(s => s.id);
  let r = db.apply(e.id, slots, requiredAnswers(db, e.id, slots));
  if (r.kind === 'payment') db.completePayment(r.paymentId, true);
  const tks = db.t.tickets.filter(t => t.userId === uid && t.eventId === e.id);
  assert.equal(tks.length, 1);
  db.registrationsOfTicket(tks[0].id).forEach(reg => db.cancelRegistration(reg.id));
  assert.ok(db.ticketById(tks[0].id).revokedAt);
});

test('受付は 未受付→受付済→欠席→未受付 といつでも戻せ、変えるたびに CheckinLog が残る', () => {
  const db = fresh();
  const owner = db.t.users.find(u => u.id === 'u-yamada'); db.login(owner.id);
  const t = db.t.tickets.find(x => !x.revokedAt && db.eventById(x.eventId).organizerId === 'o-keio');
  const logs0 = db.t.checkinLogs.length;
  db.setCheckin(t.id, 'CHECKED_IN', 'MANUAL');
  db.setCheckin(t.id, 'ABSENT', 'MANUAL');
  db.setCheckin(t.id, 'NOT_CHECKED_IN', 'MANUAL');
  assert.equal(db.ticketById(t.id).checkinStatus, 'NOT_CHECKED_IN');
  assert.equal(db.t.checkinLogs.length, logs0 + 3);
  const res = db.checkinByToken(t.token);
  assert.equal(res.ticket.checkinStatus, 'CHECKED_IN');
  assert.equal(db.t.checkinLogs.at(-1).method, 'QR');
});

test('受付を変えられるのはそのイベントの団体の owner だけ', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const t = db.t.tickets.find(x => db.eventById(x.eventId).organizerId === 'o-keio');
  assert.throws(() => db.setCheckin(t.id, 'CHECKED_IN', 'MANUAL'), /権限/);
});

test('フォローできるのは団体だけ。保存は付け外しできる', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  assert.equal(db.toggleFollow('o-keio'), true);
  assert.equal(db.isFollowing('o-keio'), true);
  assert.equal(db.toggleFollow('o-keio'), false);
  const personal = db.t.organizers.find(o => o.type === 'USER');
  assert.throws(() => db.toggleFollow(personal.id), /団体/);
  const e = db.t.events[0];
  assert.equal(db.toggleSave(e.id), true);
  assert.equal(db.isSaved(e.id), true);
  assert.equal(db.toggleSave(e.id), false);
});

test('告知は参加予定の人・保存した人（未申込）へ届き、配信数が記録される', () => {
  const db = fresh(); db.login('u-yamada');
  const e = findEvent(db, x => x.organizerId === 'o-keio' && x.status === 'PUBLISHED' && db.isUpcoming(x));
  const a = db.sendAnnouncement(e.id, { subject: '集合場所の変更', body: '本文', audiences: ['ATTENDEES', 'SAVED'] });
  assert.ok(a.recipientCount > 0);
  assert.equal(db.t.notifications.filter(n => n.announcementId === a.id).length, a.recipientCount);
});

test('通報は理由が必須。運営が対応済みにできる', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = db.t.events[0];
  assert.throws(() => db.report('EVENT', e.id, '', ''), /理由/);
  const r = db.report('EVENT', e.id, 'FRAUD', '');
  assert.throws(() => db.resolveReport(r.id, 'RESOLVED', 'x'), /権限/);
  db.login('u-admin');
  db.resolveReport(r.id, 'RESOLVED', '主催者に確認済み');
  assert.equal(db.t.reports.find(x => x.id === r.id).status, 'RESOLVED');
});

test('イベントの作成→公開。個人情報の質問があれば利用目的が必須', () => {
  const db = fresh(); db.login('u-yamada');
  const e = db.createEvent('o-keio', { title: '新歓ミーティング', genreId: 'g-music', area: '東京都', startAt: '2026-12-05T18:00:00+09:00', endAt: '2026-12-05T20:00:00+09:00', venueType: 'OFFLINE', venueName: '三田キャンパス', body: '説明' });
  assert.equal(e.status, 'DRAFT');
  assert.throws(() => db.publishEvent(e.id), /枠/);
  db.addSlot(e.id, { kind: 'STUDENT', name: '学生枠', capacity: 40, priceYen: 0 });
  db.addQuestion(e.id, { label: '電話番号', type: 'TEL', required: true, isPersonalData: true });
  assert.throws(() => db.publishEvent(e.id), /利用目的/);
  db.updateEvent(e.id, { dataUsePurpose: '当日の緊急連絡のため' });
  db.publishEvent(e.id);
  assert.equal(db.eventById(e.id).status, 'PUBLISHED');
});

test('移管は organizerId の付け替えだけ。移管先の owner でなければできない', () => {
  const db = fresh(); db.login('u-yamada');
  const e = findEvent(db, x => x.organizerId === 'o-keio' && !db.t.payments.some(p => p.eventId === x.id && p.status === 'PAID'));
  const personal = db.t.organizers.find(o => o.type === 'USER' && o.userId === 'u-yamada');
  db.transferEvent(e.id, personal.id);
  assert.equal(db.eventById(e.id).organizerId, personal.id);
  assert.throws(() => db.transferEvent(e.id, 'o-uthack'), /権限/);
});

test('状態は storage に保存され、reset で seed に戻る', () => {
  const storage = memStorage();
  const db = createDb({ storage }); db.login('u-yamada');
  db.toggleSave(db.t.events[0].id);
  const db2 = createDb({ storage });
  assert.equal(db2.currentUser().id, 'u-yamada');
  assert.equal(db2.isSaved(db.t.events[0].id), true);
  db2.reset();
  assert.equal(createDb({ storage }).t.savedEvents.length, fresh().t.savedEvents.length);
});

test('支払い済みの申込があるイベントは移管できない（wireframes 20b）', () => {
  const db = fresh(); db.login('u-yamada');
  const g = db.createGroup({ displayName: '移管先テスト', slug: 'move-target' });
  const paid = findEvent(db, x => x.organizerId === 'o-keio' && db.t.payments.some(p => p.eventId === x.id && p.status === 'PAID'));
  assert.throws(() => db.transferEvent(paid.id, g.id), /支払い済み/);
  assert.equal(db.canTransfer(paid.id).ok, false);
});

test('回答の保存期間（終了日＋answerRetentionDays）を過ぎたら参加者リストに回答を出さない', () => {
  const db = fresh(); db.login('u-yamada');
  const old = db.eventById('e-gasshuku'); // 2026-02-22 終了・30日
  assert.equal(db.answersExpired(old.id), true);
  assert.ok(db.attendees(old.id).every(a => Object.keys(a.answers).length === 0));
  const live = db.eventById('e-bandbattle');
  assert.equal(db.answersExpired(live.id), false);
  assert.ok(db.attendees(live.id).some(a => Object.keys(a.answers).length > 0));
});

test('受付は NMJ 運営もできる。受付の記録はイベントごとに引ける', () => {
  const db = fresh(); db.login('u-admin');
  const t = db.t.tickets.find(x => x.eventId === 'e-bandbattle' && !x.revokedAt);
  db.setCheckin(t.id, 'CHECKED_IN', 'QR');
  assert.equal(db.checkinLogsOf('e-bandbattle').at(0).ticketId, t.id);
  assert.ok(db.reports({ status: 'OPEN' }).every(r => r.status === 'OPEN'));
});

test('seed: 名前のある利用者の回答は固有の氏名になる', () => {
  const db = fresh();
  const reg = db.t.registrations.find(r => r.userId === 'u-mio');
  const name = db.t.answers.find(a => a.registrationId === reg.id && db.t.questions.find(q => q.id === a.questionId).commonKey === 'NAME');
  assert.equal(name.value, '三田 澪');
});

test('UC-1 一本線: 団体作成 → イベント作成・公開 → 参加者が無料＋有料枠に申込 → 決済 → QR で受付', () => {
  const db = fresh();
  db.login('u-p150');
  const g = db.createGroup({ displayName: 'UC1 サークル', slug: 'uc1-circle' });
  const e = db.createEvent(g.id, { title: '新歓ミーティング', genreId: 'g-music', startAt: '2026-12-05T18:00:00+09:00', endAt: '2026-12-05T20:00:00+09:00', venueName: '三田キャンパス', dataUsePurpose: '受付のため' });
  const free = db.addSlot(e.id, { kind: 'STUDENT', name: '学生枠', capacity: 40, priceYen: 0 });
  const party = db.addSlot(e.id, { kind: 'PARTY', name: '懇親会枠', capacity: 20, priceYen: 1500 });
  db.updateEvent(e.id, { capacity: 60 });
  const allergy = db.addQuestion(e.id, { label: 'アレルギー', type: 'TEXT', slotIds: [party.id] });
  db.publishEvent(e.id);
  db.login('u-p151');
  const ans = requiredAnswers(db, e.id, [free.id, party.id]); ans[allergy.id] = 'なし';
  const r = db.apply(e.id, [free.id, party.id], ans);
  assert.equal(r.kind, 'payment');
  assert.equal(db.paymentById(r.paymentId).amountYen, 1500);
  const done = db.completePayment(r.paymentId, true);
  const tk = db.ticketById(done.ticketId);
  assert.equal(db.registrationsOfTicket(tk.id).length, 2);
  db.login('u-p150');
  assert.equal(db.checkinByToken(tk.token, e.id).ticket.checkinStatus, 'CHECKED_IN');
  assert.equal(db.attendees(e.id)[0].answers[allergy.id], 'なし');
});
