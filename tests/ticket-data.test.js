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

// ---- R1 レビュー指摘の再発防止 ----
function paidSetup(db) {
  const e = paidEvent(db); const slot = db.slotsOf(e.id).find(s => s.priceYen > 0 && db.slotRemaining(s.id) > 1);
  return { e, slot, ans: requiredAnswers(db, e.id, [slot.id]) };
}

test('F1 別タブ（同じ storage の別インスタンス）の古い状態で上書きしない', () => {
  const storage = memStorage();
  const a = createDb({ storage }); const b = createDb({ storage });
  a.login('u-p160');
  const e = freeEvent(a); const slot = a.slotsOf(e.id).find(s => a.slotRemaining(s.id) > 0);
  const r = a.apply(e.id, [slot.id], requiredAnswers(a, e.id, [slot.id]));
  b.login('u-p161'); b.toggleSave(e.id);
  const c = createDb({ storage });
  assert.ok(c.ticketById(r.ticketId), 'A のチケットが残る');
  assert.ok(c.t.savedEvents.some(s => s.userId === 'u-p161' && s.eventId === e.id), 'B の保存も残る');
});

test('F2 中止したイベントの確保中の決済は完了できず、中止で確保を解放する', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const { e, slot, ans } = paidSetup(db);
  const r = db.apply(e.id, [slot.id], ans);
  db.login(db.membersOf(e.organizerId)[0].userId);
  db.cancelEvent(e.id, '会場の都合');
  db.login(uid);
  assert.notEqual(db.paymentById(r.paymentId).status, 'PENDING');
  assert.throws(() => db.completePayment(r.paymentId, true));
  assert.equal(db.t.registrations.filter(x => x.userId === uid && db.slotById(x.slotId).eventId === e.id).length, 0);
});

test('F3 中止したイベントのチケットは無効になり、受付できない', () => {
  const db = fresh(); db.login('u-yamada');
  const e = db.eventById('e-bandbattle');
  const tk = db.t.tickets.find(x => x.eventId === e.id && !x.revokedAt);
  db.cancelEvent(e.id, '中止');
  assert.ok(db.ticketById(tk.id).revokedAt);
  assert.throws(() => db.checkinByToken(tk.token, e.id), /キャンセル|中止/);
});

test('F4 枠の定員・全体上限は 参加予定＋確保中 を下回れない', () => {
  const db = fresh(); db.login('u-p163');
  const { e, slot, ans } = paidSetup(db);
  db.apply(e.id, [slot.id], ans);
  db.login(db.membersOf(e.organizerId)[0].userId);
  assert.throws(() => db.updateSlot(slot.id, { capacity: db.slotTaken(slot.id) - 1 }), /下回|少なく/);
  assert.throws(() => db.updateEvent(e.id, { capacity: 1 }), /下回|少なく/);
});

test('F5 保存期間を過ぎた回答は削除される（本人の申込内容からも消える）', () => {
  const db = fresh();
  const regIds = new Set(db.t.registrations.filter(r => db.slotById(r.slotId).eventId === 'e-gasshuku').map(r => r.id));
  assert.equal(db.t.answers.filter(a => regIds.has(a.registrationId)).length, 0);
});

test('F6 他人の決済はやり直し・取り消しできない', () => {
  const db = fresh(); db.login('u-p164');
  const { e, slot, ans } = paidSetup(db);
  const r = db.apply(e.id, [slot.id], ans);
  db.completePayment(r.paymentId, false);
  db.login('u-p165');
  assert.throws(() => db.retryPayment(r.paymentId), /権限/);
  db.login('u-p164');
  const r2 = db.retryPayment(r.paymentId);
  db.logout();
  assert.throws(() => db.cancelPayment(r2.paymentId));
  db.login('u-p165');
  assert.throws(() => db.cancelPayment(r2.paymentId), /権限/);
});

test('F7 CSV の先頭が = + - @ のセルは数式にならないようにする', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  db.updateProfile({ displayName: '=1+1' });
  const e = db.eventById('e-intern');
  const slot = db.slotsOf(e.id)[0];
  db.apply(e.id, [slot.id], requiredAnswers(db, e.id, [slot.id]));
  db.login('u-p003');
  const csv = db.exportCsv(e.id, false);
  assert.ok(!/(^|,)=1\+1/m.test(csv));
  assert.ok(csv.includes("'=1+1"));
});

test('F8 一部の枠だけ取り消しても、残った申込に共通の回答が残る', () => {
  const db = fresh(); db.login('u-p167');
  const e = db.eventById('e-clean');
  const slots = db.slotsOf(e.id).filter(s => s.kind !== 'ADULT').map(s => s.id); // 学生＋芋煮
  let r = db.apply(e.id, slots, requiredAnswers(db, e.id, slots));
  if (r.kind === 'payment') r = db.completePayment(r.paymentId, true);
  const regs = db.registrationsOfTicket(r.ticketId);
  db.cancelRegistration(regs[0].id);
  const rest = db.registrationsOfTicket(r.ticketId);
  const nameQ = db.questionsOf(e.id).find(q => q.commonKey === 'NAME');
  assert.ok(rest.some(x => db.answersOf(x.id).some(a => a.questionId === nameQ.id)));
});

test('F9 F10 F11 価格・定員の検証、同じ枠の重複指定、同じイベントの確保中は1件', () => {
  const db = fresh(); db.login('u-yamada');
  const e = db.eventById('e-winter');
  assert.throws(() => db.addSlot(e.id, { name: 'x', capacity: 10, priceYen: -100 }), /価格/);
  assert.throws(() => db.updateSlot('e-winter-s1', { priceYen: -1 }), /価格/);
  db.login('u-p168');
  const f = freeEvent(db); const s = db.slotsOf(f.id).find(x => db.slotRemaining(x.id) > 0);
  assert.throws(() => db.apply(f.id, [s.id, s.id], requiredAnswers(db, f.id, [s.id])), /重複/);
  const bb = db.eventById('e-clean');
  db.login('u-p169');
  const potato = db.slotsOf(bb.id).find(x => x.priceYen > 0);
  db.apply(bb.id, [potato.id], requiredAnswers(db, bb.id, [potato.id]));
  const other = db.slotsOf(bb.id).find(x => x.priceYen === 0);
  assert.throws(() => db.apply(bb.id, [other.id], requiredAnswers(db, bb.id, [other.id])), /支払いの途中/);
});

test('F12 F17 更新が失敗したら何も変えない。公開中は公開の条件を満たさない変更を拒否', () => {
  const db = fresh(); db.login('u-yamada');
  const e = db.eventById('e-bandbattle'); const end0 = e.endAt;
  assert.throws(() => db.updateEvent(e.id, { endAt: '2026-11-08T10:00:00+09:00' }), /終了/);
  assert.equal(db.eventById(e.id).endAt, end0);
  assert.throws(() => db.updateEvent(e.id, { venueName: '' }), /会場/);
  assert.equal(db.eventById(e.id).venueName, '下北沢 SHELTER');
});

test('F13 招待リンクで団体の owner になれる（期限切れ・取り消し済みは不可）', () => {
  const db = fresh(); db.login('u-yamada');
  const inv = db.createInvitation('o-keio');
  db.login('u-p170');
  db.acceptInvitation(inv.token);
  assert.ok(db.isOwner('o-keio'));
  assert.ok(db.t.invitations.find(i => i.id === inv.id).acceptedAt);
  db.login('u-p171');
  assert.throws(() => db.acceptInvitation(inv.token), /使用済み|無効/);
});

test('F14 QR 受付は owner と NMJ 運営', () => {
  const db = fresh();
  db.login('u-admin'); assert.equal(db.canCheckin('e-bandbattle'), true);
  db.login('u-p172'); assert.equal(db.canCheckin('e-bandbattle'), false);
});

test('F15 複製しても質問の対象枠を引き継ぐ', () => {
  const db = fresh(); db.login('u-yamada');
  const copy = db.duplicateEvent('e-bandbattle');
  const q = db.questionsOf(copy.id).find(x => x.label === '食物アレルギー');
  const party = db.slotsOf(copy.id).find(s => s.kind === 'PARTY');
  assert.deepEqual(q.slotIds, [party.id]);
});

test('F16 参加者のあだ名を公開する設定なら、公開ページ用の一覧が返る', () => {
  const db = fresh(); db.login('u-yamada');
  assert.equal(db.publicAttendees('e-bandbattle'), null);
  db.updateEvent('e-bandbattle', { attendeeListVisibility: 'PUBLIC_NICKNAME' });
  db.logout();
  const list = db.publicAttendees('e-bandbattle');
  assert.ok(list.length > 0 && list.every(p => p.displayName && p.slug && !('answers' in p)));
});

test('F18 通報の理由が「その他」なら詳細が必須', () => {
  const db = fresh(); db.login('u-p173');
  assert.throws(() => db.report('EVENT', 'e-run', 'OTHER', ''), /詳細/);
  assert.ok(db.report('EVENT', 'e-run', 'OTHER', '日付が違う'));
});

test('F19 告知のお知らせから本文を引ける', () => {
  const db = fresh(); db.login('u-yamada');
  const an = db.sendAnnouncement('e-bandbattle', { subject: '集合場所変更', body: '西門に集合', audiences: ['ATTENDEES'] });
  const n = db.notificationsOf().find(x => x.announcementId === an.id);
  assert.equal(db.announcementById(n.announcementId).body, '西門に集合');
});

// ---- R2 レビュー指摘 ----
test('R2-1 別タブでログインし直したら、古いタブの書き込みは別人として実行せずに止める', () => {
  const storage = memStorage();
  const a = createDb({ storage }); a.login('u-p180');
  const b = createDb({ storage }); b.login('u-p181');
  assert.throws(() => a.updateProfile({ displayName: 'A' }), /別のタブ/);
  const c = createDb({ storage });
  assert.notEqual(c.profileOf('u-p181').displayName, 'A');
  assert.notEqual(c.profileOf('u-p180').displayName, 'A');
});

test('R2-2 期限切れの確保は、同じイベントの別の枠への申込を妨げない', () => {
  let now = Date.parse('2026-10-29T10:00:00+09:00');
  const db = createDb({ storage: memStorage(), clock: () => now });
  const uid = newUser(db); db.login(uid);
  const e = db.eventById('e-clean');
  const potato = db.slotsOf(e.id).find(x => x.priceYen > 0);
  db.apply(e.id, [potato.id], requiredAnswers(db, e.id, [potato.id]));
  now += 31 * 60 * 1000;
  const free = db.slotsOf(e.id).find(x => x.priceYen === 0);
  assert.equal(db.apply(e.id, [free.id], requiredAnswers(db, e.id, [free.id])).kind, 'confirmed');
});

test('R2-3 同じ版から2つのタブが保存しても、片方の変更を黙って失わない', () => {
  const storage = memStorage();
  const a = createDb({ storage }); const b = createDb({ storage });
  a.login('u-yamada');               // a が保存（版が進む）
  b.toggleSave('e-run');             // b は古い版 → 読み直してから保存
  const c = createDb({ storage });
  assert.equal(c.currentUser().id, 'u-yamada');
  assert.equal(c.isSaved('e-run'), true);
});

test('R2-4 reset した後、古いタブが前の状態を書き戻さない', () => {
  const storage = memStorage();
  const a = createDb({ storage }); a.login('u-yamada');
  const g = a.createGroup({ displayName: '消えるはず', slug: 'gone-after-reset' });
  const b = createDb({ storage });
  b.reset();
  a.login('u-yamada');
  assert.equal(createDb({ storage }).organizerById(g.id), null);
});

test('R2-5 保存期間を過ぎたイベントの決済に残った回答の下書きも消す', () => {
  const db = fresh();
  db.t.payments.push({ id: 'pay-x', userId: 'u-p190', eventId: 'e-gasshuku', slotIds: ['e-gasshuku-s1'], answersDraft: { q: '氏名' }, provider: 'MOCK', providerRef: 'x', amountYen: 1, status: 'FAILED', holdExpiresAt: '2026-02-01T00:00:00Z', failureReason: 'x', paidAt: null, refundedAt: null, createdAt: '2026-02-01T00:00:00Z' });
  db.save();
  const again = createDb({ storage: (() => { const m = memStorage(); m.setItem(db.KEY, JSON.stringify(db.t)); return m; })() });
  assert.equal(again.t.payments.find(p => p.id === 'pay-x').answersDraft, null);
});

test('R2-6 CSV: 改行で始まるセルにも \' を付ける', () => {
  const db = fresh(); const uid = newUser(db); db.login(uid);
  const e = db.eventById('e-intern'); const s = db.slotsOf(e.id)[0];
  const ans = requiredAnswers(db, e.id, [s.id]);
  const nameQ = db.questionsOf(e.id).find(q => q.commonKey === 'NAME'); ans[nameQ.id] = '\n=1+1';
  db.apply(e.id, [s.id], ans);
  db.login('u-p003');
  assert.ok(db.exportCsv(e.id, true).includes(`"'\n=1+1"`));
});
