/* NEXT MOVE TICKETS — プロトタイプ用のモック DB
   テーブル名・列名・enum は docs/schema.prisma（v0.4・10/8 定例の決定）と同じ。
   ブラウザでは localStorage（キー nmt:db:v1）に保存し、どのページから操作しても同じ状態を見る。
   fetch を使わないので file:// で直接開いても動く。テストは tests/ticket-data.test.js（node --test tests/）。

   主なルール（schema.prisma のコメントより）
   - 支払い待ち・補欠は持たない。有料枠は Payment(PENDING) で席を確保し、PAID になって初めて Registration(CONFIRMED) を作る
   - 確保の期限（30分）を過ぎた PENDING は EXPIRED にして席を解放する
   - 同じ枠に有効な申込は1件。満員の枠・全体上限に達したイベントには申し込めない
   - QR チケットは1人1イベント1枚（複数枠でも1枚）。全枠キャンセルで無効化
   - 受付の状態（未受付 / 受付済 / 欠席）はいつでも戻せ、変えるたびに CheckinLog を残す
   - フォローできるのは団体（type=GROUP）だけ。団体の権限は owner のみ
   - 全イベント共通の質問（NAME / KANA / AFFILIATION）は作成時に自動で入り、削除できない */
(function (root) {
  'use strict';

  var KEY = 'nmt:db:v2';
  var DEMO_NOW = Date.parse('2026-10-29T10:00:00+09:00'); // デモの「いま」（木曜）。週末は 10/31・11/1
  var HOLD_MIN = 30;
  var CLOCK_CAP_MS = 6 * 60 * 60 * 1000; // デモの時計は開いてから最大6時間だけ進む

  // ---------- seed ----------
  var GIVEN = ['はると', 'みお', 'そうた', 'ゆい', 'れん', 'さくら', 'ゆうと', 'あおい', 'たける', 'ひな', 'かいと', 'りこ', 'そら', 'めい', 'こうき', 'さき', 'りく', 'ゆな', 'しょう', 'なな'];
  var FAMILY = [['佐藤', 'サトウ'], ['鈴木', 'スズキ'], ['高橋', 'タカハシ'], ['田中', 'タナカ'], ['伊藤', 'イトウ'], ['渡辺', 'ワタナベ'], ['山本', 'ヤマモト'], ['中村', 'ナカムラ'], ['小林', 'コバヤシ'], ['加藤', 'カトウ'], ['吉田', 'ヨシダ'], ['山口', 'ヤマグチ']];
  var GIVEN_KANJI = [['陽翔', 'ハルト'], ['美緒', 'ミオ'], ['颯太', 'ソウタ'], ['結衣', 'ユイ'], ['蓮', 'レン'], ['咲良', 'サクラ'], ['悠人', 'ユウト'], ['葵', 'アオイ'], ['健', 'タケル'], ['陽菜', 'ヒナ'], ['海斗', 'カイト'], ['莉子', 'リコ'], ['空', 'ソラ'], ['芽依', 'メイ'], ['光輝', 'コウキ'], ['早希', 'サキ'], ['陸', 'リク'], ['結菜', 'ユナ'], ['翔', 'ショウ'], ['奈々', 'ナナ']];
  var SCHOOLS = ['慶應義塾大学 2年', '早稲田大学 1年', '明治大学 3年', '青山学院大学 2年', '東京大学 1年', '武蔵野美術大学 3年', '立教大学 2年', '法政大学 4年', '社会人'];

  function iso(s) { return new Date(Date.parse(s)).toISOString(); }

  function buildSeed() {
    var t = {
      meta: { currentUserId: 'u-yamada', clockStartedAt: null, seq: 1000 },
      genres: [], users: [], organizers: [], organizerMembers: [], socialLinks: [], follows: [],
      events: [], slots: [], questions: [], registrations: [], answers: [], tickets: [], checkinLogs: [],
      payments: [], announcements: [], savedEvents: [], reports: [], articles: [], notifications: [],
      invitations: [], joinRequests: [], emailPreferences: [], exportLogs: []
    };
    var created = iso('2026-04-01T10:00:00+09:00');

    [['g-music', '音楽・ライブ', 'music', 'MUSIC', 'coral'], ['g-sports', 'スポーツ', 'sports', 'SPORTS', 'mint'], ['g-study', '学び・勉強会', 'study', 'STUDY', 'lavender'],
     ['g-party', '交流会・パーティ', 'party', 'PARTY', 'pink'], ['g-art', 'アート・展示', 'art', 'ART', 'gray'], ['g-career', 'キャリア', 'career', 'CAREER', 'white']]
      .forEach(function (g, i) { t.genres.push({ id: g[0], name: g[1], slug: g[2], en: g[3], color: g[4], sortOrder: i }); });

    function user(id, displayName, slug, opts) {
      opts = opts || {};
      t.users.push({ id: id, googleSub: 'g-' + id, email: slug + '@example.com', role: opts.role || 'USER', badgeName: opts.badgeName || null, createdAt: created });
      t.organizers.push({ id: 'o-' + id, type: 'USER', userId: id, slug: slug, displayName: displayName, iconUrl: null, bio: opts.bio || null, coverUrl: null, createdAt: created, updatedAt: created });
      ['EVENT_UPDATES', 'FOLLOW_NEWS', 'ANNOUNCEMENTS'].forEach(function (c) { t.emailPreferences.push({ userId: id, category: c, enabled: true, updatedAt: created }); });
    }
    user('u-yamada', 'やまだ', 'yamada', { badgeName: 'YAMADA' });
    user('u-mio', 'みお', 'mio');
    user('u-takeru', 'たける', 'takeru');
    user('u-saki', 'さき', 'saki');
    user('u-yuto', 'ゆうと', 'yuto');
    user('u-admin', 'NMJ 運営', 'nmj-admin', { role: 'ADMIN' });
    for (var i = 1; i <= 200; i++) {
      var n = ('00' + i).slice(-3);
      user('u-p' + n, GIVEN[i % GIVEN.length], 'guest' + n);
    }
    t.socialLinks.push({ id: 'sl-1', organizerId: 'o-u-yamada', platform: 'X', url: 'https://x.com/', sortOrder: 0 }, { id: 'sl-2', organizerId: 'o-u-yamada', platform: 'Instagram', url: 'https://www.instagram.com/', sortOrder: 1 });

    function group(id, name, slug, bio, owners) {
      t.organizers.push({ id: id, type: 'GROUP', userId: null, slug: slug, displayName: name, iconUrl: null, bio: bio, coverUrl: null, createdAt: created, updatedAt: created });
      owners.forEach(function (u) { t.organizerMembers.push({ organizerId: id, userId: u, role: 'OWNER', invitedAt: created, joinedAt: created }); });
    }
    group('o-keio', '慶應軽音サークル', 'keio-lightmusic', '1987年から続く、慶應義塾大学の軽音楽サークルです。年4回の定期ライブと、他大学との対抗ライブを開催しています。初心者歓迎、楽器の貸し出しあり。', ['u-yamada', 'u-mio', 'u-takeru']);
    group('o-link', '青学イベントサークル Link', 'aogaku-link', '青山学院大学を中心に、季節のパーティを企画しています。', ['u-saki']);
    group('o-run', 'RUN TOKYO CAMPUS', 'runtokyo', '週末の朝に都内の公園を走る、インカレのランニングコミュニティ。', ['u-yuto']);
    group('o-uthack', 'UT Hack', 'ut-hack', '東京大学の学生が運営するハッカソン団体。', ['u-p001']);
    group('o-zine', '武蔵美ZINE部', 'musabi-zine', 'ZINE をつくって交換する部活です。', ['u-p002']);
    group('o-career', 'Next Career Lab', 'next-career-lab', '先輩と話せるキャリアイベントを開いています。', ['u-p003']);
    group('o-waseda', 'Waseda Global', 'waseda-global', '留学生と日本人学生の交流サークル。', ['u-p004']);
    group('o-meiji', '明治大学フォークソング部', 'meiji-folk', '弾き語りとアコースティックの部活です。', ['u-p005']);
    t.socialLinks.push({ id: 'sl-3', organizerId: 'o-keio', platform: 'X', url: 'https://x.com/', sortOrder: 0 }, { id: 'sl-4', organizerId: 'o-keio', platform: 'Instagram', url: 'https://www.instagram.com/', sortOrder: 1 });

    // フォロー
    ['o-keio', 'o-link', 'o-run', 'o-zine', 'o-waseda'].forEach(function (o) { t.follows.push({ userId: 'u-yamada', organizerId: o, notifyEmail: true, createdAt: created }); });
    for (var f = 1; f <= 60; f++) t.follows.push({ userId: 'u-p' + ('00' + f).slice(-3), organizerId: 'o-keio', notifyEmail: f % 3 !== 0, createdAt: created });

    var qn = 0;
    function commonQuestions(eventId) {
      [['NAME', '氏名', null], ['KANA', 'フリガナ', null], ['AFFILIATION', '所属（学校名と学年 / 社会人）', '例：慶應義塾大学 2年']].forEach(function (q, i) {
        t.questions.push({ id: 'q-' + (++qn), eventId: eventId, commonKey: q[0], label: q[1], helpText: q[2], type: 'TEXT', options: null, required: true, isPersonalData: q[0] !== 'AFFILIATION', slotIds: [], sortOrder: i });
      });
    }
    function event(id, o) {
      var e = {
        id: id, organizerId: o.org, targetUniversityId: null, genreId: o.genre, area: o.area || '東京都', capacity: o.capacity || null,
        title: o.title, body: o.body || o.title + 'の詳細です。初めての方も歓迎します。', startAt: iso(o.start), endAt: iso(o.end),
        venueType: o.online ? 'ONLINE' : 'OFFLINE', venueName: o.venue, address: o.address || null, onlineUrl: o.online ? 'https://meet.example.com/' + id : null,
        status: o.status || 'PUBLISHED', publishedAt: o.status === 'DRAFT' ? null : created, cancelledAt: null, cancelReason: null,
        coverUrl: 'assets/' + o.cover, payoutAccountId: null, attendeeListVisibility: 'ORGANIZER_ONLY', answerRetentionDays: 30,
        dataUsePurpose: '受付での本人確認と、当日の緊急連絡のため', createdAt: created, updatedAt: o.updatedAt ? iso(o.updatedAt) : created
      };
      t.events.push(e);
      commonQuestions(id);
      (o.slots || []).forEach(function (s, i) {
        t.slots.push({ id: id + '-s' + (i + 1), eventId: id, kind: s.kind, name: s.name, description: s.desc || null, capacity: s.cap, priceYen: s.price || 0,
          opensAt: s.opens ? iso(s.opens) : null, closesAt: s.closes ? iso(s.closes) : null, sortOrder: i, _fill: s.fill || 0 });
      });
      (o.questions || []).forEach(function (q, i) {
        t.questions.push({ id: 'q-' + (++qn), eventId: id, commonKey: null, label: q.label, helpText: q.help || null, type: q.type, options: q.options || null,
          required: !!q.required, isPersonalData: !!q.personal, slotIds: (q.slots || []).map(function (n) { return id + '-s' + n; }), sortOrder: 10 + i });
      });
      return e;
    }

    event('e-halloween', { org: 'o-link', genre: 'g-party', title: '渋谷ハロウィン・アフターパーティ 2026', start: '2026-10-31T21:00:00+09:00', end: '2026-11-01T02:00:00+09:00', venue: '渋谷 WOMB', address: '東京都渋谷区円山町2-16', cover: 'flyer-halloween.jpg',
      body: 'ハロウィン当日の夜、渋谷 WOMB を貸し切ってアフターパーティを開きます。仮装は自由。20歳未満の方はソフトドリンクのみです。',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 150, price: 2000, fill: 142 }, { kind: 'ADULT', name: '一般', cap: 50, price: 3000, fill: 46 }],
      questions: [{ label: '20歳以上ですか', type: 'SELECT', options: ['はい', 'いいえ'], required: true }] });
    event('e-run', { org: 'o-run', genre: 'g-sports', title: '朝の代々木公園ランニング＆モーニング', start: '2026-11-01T07:30:00+09:00', end: '2026-11-01T09:30:00+09:00', venue: '代々木公園 原宿門', cover: 'flyer-morning-run.jpg',
      body: '5km をゆっくり走ったあと、近くのカフェでモーニング。ペースは2グループに分けます。',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 30, fill: 18 }, { kind: 'ADULT', name: '一般', cap: 10, fill: 4 }],
      questions: [{ label: '走るペース', type: 'SELECT', options: ['ゆっくり（7分/km）', 'ふつう（6分/km）'], required: true }] });
    event('e-hackathon', { org: 'o-uthack', genre: 'g-study', title: '24時間ハッカソン「つくって、見せて、寝る」', start: '2026-10-31T10:00:00+09:00', end: '2026-11-01T10:00:00+09:00', venue: '東京大学 本郷キャンパス', cover: 'flyer-hackathon.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 60, price: 1000, fill: 60 }],
      questions: [{ label: '得意な分野', type: 'MULTI_SELECT', options: ['フロントエンド', 'バックエンド', 'デザイン', '企画'] }] });
    event('e-zine', { org: 'o-zine', genre: 'g-art', title: '学生ZINEフェア — 刷って、並べて、交換する', start: '2026-11-01T12:00:00+09:00', end: '2026-11-01T18:00:00+09:00', venue: '吉祥寺 Art Center Ongoing', cover: 'flyer-zine-fair.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 100, price: 300, fill: 41 }, { kind: 'ADULT', name: '一般', cap: 40, price: 500, fill: 12 }] });
    event('e-intern', { org: 'o-career', genre: 'g-career', title: '先輩に聞く、はじめてのインターン選び', start: '2026-11-15T19:00:00+09:00', end: '2026-11-15T20:30:00+09:00', online: true, venue: 'オンライン', area: 'online', cover: 'article-interview.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 200, fill: 87 }] });
    event('e-boardgame', { org: 'o-waseda', genre: 'g-party', title: '国際交流ボードゲームナイト', start: '2026-10-31T18:00:00+09:00', end: '2026-10-31T21:00:00+09:00', venue: '高田馬場 JAM Café', cover: 'article-guide.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 30, price: 500, fill: 24 }] });
    event('e-acoustic', { org: 'o-meiji', genre: 'g-music', title: 'アコースティック・ナイト 秋の弾き語り12組', start: '2026-11-01T17:00:00+09:00', end: '2026-11-01T21:00:00+09:00', venue: '下北沢 lown', cover: 'flyer-acoustic.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 60, price: 1200, opens: '2026-10-31T12:00:00+09:00' }, { kind: 'ADULT', name: '一般', cap: 20, price: 1800, opens: '2026-10-31T12:00:00+09:00' }] });
    event('e-bandbattle', { org: 'o-keio', genre: 'g-music', title: 'インカレ・バンド対抗ライブ vol.4', start: '2026-11-08T17:30:00+09:00', end: '2026-11-08T21:00:00+09:00', venue: '下北沢 SHELTER', address: '東京都世田谷区北沢2-6-10', cover: 'flyer-band-battle.jpg', capacity: 100,
      body: '6大学の軽音サークルが1曲ずつ持ち寄る対抗ライブ。投票で優勝バンドを決めます。終演後は同じ会場で懇親会（ソフトドリンク・軽食）。',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 40, price: 1500, fill: 24 }, { kind: 'ADULT', name: '一般', cap: 10, price: 2500, fill: 10 }, { kind: 'STUDENT', name: '早割（学生）', cap: 20, price: 1200, fill: 20, closes: '2026-10-20T23:59:00+09:00' }, { kind: 'PARTY', name: '懇親会', cap: 30, price: 1500, fill: 12, desc: '終演後 21:15〜22:30' }],
      questions: [{ label: '食物アレルギー', type: 'TEXT', help: '懇親会で配慮します', slots: [4], personal: true }, { label: '応援しているバンド', type: 'TEXTAREA' }] });
    event('e-winter', { org: 'o-keio', genre: 'g-music', title: '冬の弾き語りナイト', start: '2026-11-28T18:00:00+09:00', end: '2026-11-28T21:00:00+09:00', venue: '三田 Live house Re:', cover: 'flyer-acoustic.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 50, price: 1000, opens: '2026-11-10T12:00:00+09:00' }] });
    event('e-oikon', { org: 'o-keio', genre: 'g-party', title: '追いコン 2026 — 4年生を送る夜', start: '2026-12-20T19:00:00+09:00', end: '2026-12-20T22:00:00+09:00', venue: '渋谷 club asia', cover: 'flyer-halloween.jpg', status: 'DRAFT', updatedAt: '2026-10-26T20:00:00+09:00' });
    event('e-gasshuku', { org: 'o-keio', genre: 'g-music', title: '冬合宿 2026', start: '2026-02-20T13:00:00+09:00', end: '2026-02-22T12:00:00+09:00', venue: '山中湖 スタジオ村', cover: 'flyer-band-battle.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 40, price: 18000, fill: 32 }] });
    event('e-sotsugyo', { org: 'o-keio', genre: 'g-music', title: '卒業ライブ 2026', start: '2026-03-14T17:00:00+09:00', end: '2026-03-14T21:00:00+09:00', venue: '下北沢 SHELTER', cover: 'flyer-band-battle.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 120, price: 1000, fill: 120 }] });
    event('e-autumn', { org: 'o-keio', genre: 'g-music', title: '秋の定期ライブ 2026', start: '2026-10-06T17:00:00+09:00', end: '2026-10-06T21:00:00+09:00', venue: '三田キャンパス 西校舎ホール', cover: 'flyer-acoustic.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 80, price: 500, fill: 46 }] });
    event('e-run-1019', { org: 'o-run', genre: 'g-sports', title: '朝の代々木公園ランニング＆モーニング', start: '2026-10-19T07:30:00+09:00', end: '2026-10-19T09:30:00+09:00', venue: '代々木公園 原宿門', cover: 'flyer-morning-run.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 30, fill: 22 }] });
    event('e-career-ad', { org: 'o-career', genre: 'g-career', title: '業界研究ナイト：広告・PR の先輩5人', start: '2026-11-12T19:00:00+09:00', end: '2026-11-12T21:00:00+09:00', venue: '渋谷ヒカリエ 8F', cover: 'article-interview.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 80, fill: 33 }, { kind: 'PARTY', name: '懇親会', cap: 30, price: 1000, fill: 9 }] });
    event('e-lt', { org: 'o-uthack', genre: 'g-study', title: '学生エンジニア LT 会 #12', start: '2026-11-20T19:30:00+09:00', end: '2026-11-20T21:00:00+09:00', online: true, venue: 'オンライン', area: 'online', cover: 'flyer-hackathon.jpg',
      slots: [{ kind: 'STUDENT', name: '聞く', cap: 300, fill: 64 }, { kind: 'STUDENT', name: '話す（5分）', cap: 8, fill: 5 }] });
    event('e-clean', { org: 'o-run', genre: 'g-sports', title: '多摩川クリーンアップ＆芋煮', start: '2026-11-22T10:00:00+09:00', end: '2026-11-22T14:00:00+09:00', venue: '二子玉川 兵庫島公園', cover: 'flyer-morning-run.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 40, fill: 11 }, { kind: 'ADULT', name: '一般', cap: 20, fill: 3 }, { kind: 'PARTY', name: '芋煮', cap: 50, price: 500, fill: 13 }] });
    event('e-photo', { org: 'o-zine', genre: 'g-art', title: 'インカレ写真部 合同展「となりの街」', start: '2026-11-21T11:00:00+09:00', end: '2026-11-21T19:00:00+09:00', venue: '代官山 ヒルサイドフォーラム', cover: 'flyer-zine-fair.jpg',
      slots: [{ kind: 'STUDENT', name: '入場（学生）', cap: 300, fill: 40 }, { kind: 'ADULT', name: '入場（一般）', cap: 100, price: 300, fill: 8 }] });
    event('e-osaka', { org: 'o-link', genre: 'g-party', title: '関西インカレ交流パーティ', start: '2026-11-14T18:30:00+09:00', end: '2026-11-14T21:30:00+09:00', venue: '梅田 Zeela', area: '大阪府', cover: 'flyer-halloween.jpg',
      slots: [{ kind: 'STUDENT', name: '学生', cap: 120, price: 2500, fill: 70 }] });

    // ---- 申込・チケット・決済（seed）----
    var pool = 0; // u-p006〜u-p200 を順に使う
    function nextGuest() { var k = (pool++ % 195) + 6; return 'u-p' + ('00' + k).slice(-3); }
    var answered = {}; // ticketId → { questionId: 1 }
    var regN = 0, tkN = 0, payN = 0;
    var past = function (e) { return Date.parse(e.endAt) < DEMO_NOW; };
    var NAMED = { 'u-yamada': ['山田 湊', 'ヤマダ ミナト', '慶應義塾大学 3年'], 'u-mio': ['三田 澪', 'ミタ ミオ', '慶應義塾大学 2年'], 'u-takeru': ['竹内 健', 'タケウチ タケル', '慶應義塾大学 2年'], 'u-saki': ['佐々木 咲', 'ササキ サキ', '青山学院大学 3年'], 'u-yuto': ['中島 悠斗', 'ナカジマ ユウト', '明治大学 1年'] };
    function nameFor(uid) {
      if (NAMED[uid]) return { name: NAMED[uid][0], kana: NAMED[uid][1], school: NAMED[uid][2] };
      var k = parseInt(uid.replace(/\D/g, ''), 10) || 0;
      var fam = FAMILY[k % FAMILY.length], giv = GIVEN_KANJI[(k * 7) % GIVEN_KANJI.length];
      return { name: fam[0] + ' ' + giv[0], kana: fam[1] + ' ' + giv[1], school: SCHOOLS[k % SCHOOLS.length] };
    }
    function seedRegister(uid, ev, slotList, at, checkin) {
      var tk = t.tickets.find(function (x) { return x.eventId === ev.id && x.userId === uid; });
      if (!tk) {
        tk = { id: 'tk-' + (++tkN), eventId: ev.id, userId: uid, token: tokenFrom('seed' + tkN + uid), checkinStatus: checkin || 'NOT_CHECKED_IN', checkedInAt: checkin === 'CHECKED_IN' ? ev.startAt : null, issuedAt: at, revokedAt: null, walletPassUrl: null };
        t.tickets.push(tk);
      }
      var paid = slotList.filter(function (s) { return s.priceYen > 0; });
      var pay = null;
      if (paid.length) {
        pay = { id: 'pay-' + (++payN), userId: uid, eventId: ev.id, slotIds: slotList.map(function (s) { return s.id; }), answersDraft: null, provider: 'MOCK', providerRef: 'mock_seed_' + payN,
          amountYen: paid.reduce(function (a, s) { return a + s.priceYen; }, 0), status: 'PAID', holdExpiresAt: at, failureReason: null, paidAt: at, refundedAt: null, createdAt: at };
        t.payments.push(pay);
      }
      var nm = nameFor(uid);
      slotList.forEach(function (s) {
        var reg = { id: 'r-' + (++regN), slotId: s.id, userId: uid, ticketId: tk.id, paymentId: s.priceYen > 0 && pay ? pay.id : null, status: 'CONFIRMED', appliedAt: at, cancelledAt: null, note: null };
        t.registrations.push(reg);
        t.questions.filter(function (q) { return q.eventId === ev.id && (!q.slotIds.length || q.slotIds.indexOf(s.id) >= 0); }).forEach(function (q) {
          var done = answered[tk.id] = answered[tk.id] || {}; if (done[q.id]) return; done[q.id] = 1;
          var v = q.commonKey === 'NAME' ? nm.name : q.commonKey === 'KANA' ? nm.kana : q.commonKey === 'AFFILIATION' ? nm.school : q.options ? q.options[0] : (q.required ? 'とくになし' : null);
          if (v != null) t.answers.push({ registrationId: reg.id, questionId: q.id, value: v, updatedAt: at });
        });
      });
      return tk;
    }
    // やまだ（デモの参加者）の申込
    var byId = function (id) { return t.events.find(function (e) { return e.id === id; }); };
    var slot = function (id) { return t.slots.find(function (s) { return s.id === id; }); };
    seedRegister('u-yamada', byId('e-bandbattle'), [slot('e-bandbattle-s1'), slot('e-bandbattle-s4')], iso('2026-10-20T21:10:00+09:00'));
    seedRegister('u-yamada', byId('e-intern'), [slot('e-intern-s1')], iso('2026-10-22T12:00:00+09:00'));
    seedRegister('u-yamada', byId('e-run-1019'), [slot('e-run-1019-s1')], iso('2026-10-12T08:00:00+09:00'), 'CHECKED_IN');
    // 定員を埋める
    t.slots.forEach(function (s) {
      var ev = byId(s.eventId);
      var have = t.registrations.filter(function (r) { return r.slotId === s.id; }).length;
      for (var k = have; k < s._fill; k++) {
        var uid = nextGuest();
        var at = new Date(DEMO_NOW - (k + 1) * 47 * 60 * 1000).toISOString();
        var ci = past(ev) ? (k % 9 === 0 ? 'ABSENT' : 'CHECKED_IN') : 'NOT_CHECKED_IN';
        // 同じ人が同じ枠に2回入らないように、埋まっていたら次の人
        while (t.tickets.some(function (x) { return x.eventId === ev.id && x.userId === uid; })) uid = nextGuest();
        seedRegister(uid, ev, [s], at, ci);
      }
      delete s._fill;
    });
    // 最近の申込をダッシュボード用に新しい時刻へ
    [['u-mio', 15], ['u-takeru', 60], ['u-saki', 120], ['u-yuto', 180]].forEach(function (p, i) {
      var at = new Date(DEMO_NOW - p[1] * 60 * 1000).toISOString();
      seedRegister(p[0], byId('e-bandbattle'), [slot('e-bandbattle-s1')].concat(i === 1 ? [slot('e-bandbattle-s4')] : []), at);
    });
    // ↑ で学生枠を 4 人ぶん足したので、学生枠は 28/40 になる

    // 保存
    ['e-zine', 'e-boardgame', 'e-photo'].forEach(function (e) { t.savedEvents.push({ userId: 'u-yamada', eventId: e, createdAt: created }); });
    for (var sv = 100; sv < 138; sv++) t.savedEvents.push({ userId: 'u-p' + sv, eventId: 'e-bandbattle', createdAt: created });

    // 告知・お知らせ
    t.announcements.push({ id: 'an-1', eventId: 'e-bandbattle', subject: '11/8 の集合場所が変更になりました', body: '出演バンドの集合場所を、下北沢 SHELTER の2F控室に変更します。お客さんの入場口は変わりません。', audiences: ['ATTENDEES'], recipientCount: 0, sentAt: iso('2026-10-29T08:00:00+09:00') });
    t.notifications.push(
      { id: 'n-1', userId: 'u-yamada', toEmail: 'yamada@example.com', type: 'ANNOUNCEMENT', title: '慶應軽音サークル：11/8 の集合場所が変更になりました', readAt: null, status: 'SENT', eventId: 'e-bandbattle', registrationId: null, announcementId: 'an-1', createdAt: iso('2026-10-29T08:00:00+09:00'), sentAt: iso('2026-10-29T08:00:00+09:00') },
      { id: 'n-2', userId: 'u-yamada', toEmail: 'yamada@example.com', type: 'REGISTRATION_CONFIRMED', title: 'インカレ・バンド対抗ライブ vol.4 の QR チケットを発行しました', readAt: null, status: 'SENT', eventId: 'e-bandbattle', registrationId: null, announcementId: null, createdAt: iso('2026-10-28T21:10:00+09:00'), sentAt: iso('2026-10-28T21:10:00+09:00') },
      { id: 'n-3', userId: 'u-yamada', toEmail: 'yamada@example.com', type: 'ANSWER_DELETION_NOTICE', title: '「秋の定期ライブ 2026」の申込時の回答は、7日後（11/5）に自動で削除されます', readAt: null, status: 'SENT', eventId: 'e-autumn', registrationId: null, announcementId: null, createdAt: iso('2026-10-29T06:00:00+09:00'), sentAt: iso('2026-10-29T06:00:00+09:00') }
    );
    t.announcements[0].recipientCount = t.tickets.filter(function (x) { return x.eventId === 'e-bandbattle'; }).length;

    // 通報
    t.reports.push(
      { id: 'rp-1', reporterUserId: 'u-p010', targetType: 'EVENT', targetId: 'e-osaka', reason: 'FRAUD', detail: '会場に問い合わせたら予約が無いと言われました。', status: 'OPEN', createdAt: iso('2026-10-28T23:12:00+09:00'), resolvedAt: null, resolvedById: null, resolution: null },
      { id: 'rp-2', reporterUserId: 'u-p011', targetType: 'ORGANIZER', targetId: 'o-link', reason: 'PERSONAL_DATA_ABUSE', detail: '申込時に住所まで聞かれました。', status: 'OPEN', createdAt: iso('2026-10-27T14:40:00+09:00'), resolvedAt: null, resolvedById: null, resolution: null },
      { id: 'rp-3', reporterUserId: 'u-p012', targetType: 'EVENT', targetId: 'e-hackathon', reason: 'OTHER', detail: 'タイトルの表記ゆれ', status: 'DISMISSED', createdAt: iso('2026-10-20T10:00:00+09:00'), resolvedAt: iso('2026-10-21T10:00:00+09:00'), resolvedById: 'u-admin', resolution: '問題なし' }
    );

    // 記事（Media）
    var arts = [
      ['shinkan-guide-2026', '新歓 2026 完全ガイド：サークル選びで後悔しない、5つの視点', '新歓ガイド', 'article-guide.jpg', 8, '2026-10-24', true, '雰囲気・お金・時間・人数・続け方。先輩30人に聞いた「入ってから気づいたこと」から、見学で確かめるべきポイントをまとめました。'],
      ['interview-100-party', '主催者に聞く：100人規模の交流会を3週間でつくるまで', 'インタビュー', 'article-interview.jpg', 10, '2026-10-20', true, null],
      ['handover-tips', '代替わりで団体を引き継ぐコツ — 引き継ぎ資料のテンプレ付き', 'ノウハウ', 'flyer-band-battle.jpg', 7, '2026-10-18', true, null],
      ['keio-lightmusic-interview', '「代替わりしても続く団体」をつくる：軽音サークル代表に聞く', 'インタビュー', 'article-interview.jpg', 6, '2026-10-14', false, null],
      ['first-meet', '「はじめまして」が苦手な人のための、イベントの楽しみ方', 'ガイド', 'article-guide.jpg', 8, '2026-10-24', false, null],
      ['shibuya-spaces', '渋谷で学生が集まる、夜のイベントスペース5選', 'スポット', 'flyer-halloween.jpg', 4, '2026-10-16', false, null],
      ['hackathon-24h', '24時間で何がつくれる？ ハッカソン常連の4年生に聞く', 'インタビュー', 'flyer-hackathon.jpg', 6, '2026-10-12', false, null],
      ['festival-pa', '学園祭ライブの裏側：PA担当がいちばん緊張する瞬間', '学園祭', 'flyer-acoustic.jpg', 5, '2026-10-08', false, null],
      ['livehouse-checklist', 'ライブハウスを借りる前に確認したい7つのこと', 'ノウハウ', 'flyer-band-battle.jpg', 7, '2026-10-02', false, null],
      ['announce-writing', 'イベント告知文の書き方：申込が伸びた3つの例', 'ノウハウ', 'flyer-zine-fair.jpg', 6, '2026-09-28', false, null]
    ];
    arts.forEach(function (a, i) {
      t.articles.push({ id: 'ar-' + (i + 1), slug: a[0], title: a[1], lead: a[7], body: a[1] + '\n\n本文はプロトタイプのため省略しています。', category: a[2], coverUrl: 'assets/' + a[3], readMinutes: a[4], isFeatured: a[6], status: 'PUBLISHED',
        authorUserId: 'u-admin', authorOrganizerId: a[0] === 'keio-lightmusic-interview' ? 'o-keio' : null, reviewedById: 'u-admin', reviewedAt: iso(a[5] + 'T09:00:00+09:00'), rejectReason: null,
        publishedAt: iso(a[5] + 'T10:00:00+09:00'), createdAt: iso(a[5] + 'T09:00:00+09:00'), updatedAt: iso(a[5] + 'T09:00:00+09:00'), eventIds: a[0] === 'keio-lightmusic-interview' ? ['e-bandbattle', 'e-zine'] : [] });
    });
    return t;
  }

  // 推測しにくい見た目の token（プロトタイプ用。本番はサーバーで乱数を作る）
  function tokenFrom(seed) {
    var h1 = 0x811c9dc5, h2 = 0x1b873593, out = '';
    for (var r = 0; r < 4; r++) {
      for (var i = 0; i < seed.length; i++) { h1 = Math.imul(h1 ^ seed.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ (h1 >>> 7), 2246822507); }
      h1 ^= r * 0x9e3779b9; out += ((h1 ^ h2) >>> 0).toString(36).padStart(7, '0');
    }
    return out;
  }

  // ---------- DB ----------
  function createDb(opts) {
    opts = opts || {};
    var storage = opts.storage || null;
    var t;
    try { t = storage && storage.getItem(KEY) ? JSON.parse(storage.getItem(KEY)) : null; } catch (e) { t = null; }
    if (!t || !t.meta) t = buildSeed();
    if (!t.meta.clockStartedAt) t.meta.clockStartedAt = Date.now();
    var clock = opts.clock || function () { return DEMO_NOW + Math.min(Math.max(Date.now() - t.meta.clockStartedAt, 0), CLOCK_CAP_MS); };

    function save() { if (storage) storage.setItem(KEY, JSON.stringify(t)); }
    function nowIso() { return new Date(clock()).toISOString(); }
    function id(p) { t.meta.seq += 1; return p + '-' + t.meta.seq.toString(36); }
    function fail(msg) { throw new Error(msg); }
    function need(x, msg) { if (!x) fail(msg); return x; }
    function by(table, key, v) { return t[table].find(function (r) { return r[key] === v; }) || null; }

    var db = { t: t, KEY: KEY, DEMO_NOW: DEMO_NOW, HOLD_MIN: HOLD_MIN };
    db.now = function () { return clock(); };
    db.save = save;
    db.reset = function () { if (storage) storage.removeItem(KEY); var n = buildSeed(); Object.keys(t).forEach(function (k) { delete t[k]; }); Object.assign(t, n); t.meta.clockStartedAt = Date.now(); save(); };

    // ---- 参照 ----
    db.userById = function (uid) { return by('users', 'id', uid); };
    db.organizerById = function (oid) { return by('organizers', 'id', oid); };
    db.organizerBySlug = function (slug) { return by('organizers', 'slug', slug); };
    db.personalOrganizer = function (uid) { return t.organizers.find(function (o) { return o.type === 'USER' && o.userId === uid; }) || null; };
    db.profileOf = function (uid) { return db.personalOrganizer(uid); };
    db.eventById = function (eid) { return by('events', 'id', eid); };
    db.genreById = function (gid) { return by('genres', 'id', gid); };
    db.slotById = function (sid) { return by('slots', 'id', sid); };
    db.ticketById = function (tid) { return by('tickets', 'id', tid); };
    db.paymentById = function (pid) { expireHolds(); return by('payments', 'id', pid); };
    db.articleBySlug = function (slug) { return by('articles', 'slug', slug); };
    db.genres = function () { return t.genres.slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; }); };
    db.publishedArticles = function (cat) { return t.articles.filter(function (a) { return a.status === 'PUBLISHED' && (!cat || a.category === cat); }).sort(function (a, b) { return Date.parse(b.publishedAt) - Date.parse(a.publishedAt); }); };
    db.slotsOf = function (eid) { return t.slots.filter(function (s) { return s.eventId === eid; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }); };
    db.questionsOf = function (eid) { return t.questions.filter(function (q) { return q.eventId === eid; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }); };
    db.questionsFor = function (eid, slotIds) { return db.questionsOf(eid).filter(function (q) { return !q.slotIds.length || q.slotIds.some(function (s) { return slotIds.indexOf(s) >= 0; }); }); };
    db.membersOf = function (oid) { return t.organizerMembers.filter(function (m) { return m.organizerId === oid; }); };
    db.followerCount = function (oid) { return t.follows.filter(function (f) { return f.organizerId === oid; }).length; };
    db.savedCount = function (eid) { return t.savedEvents.filter(function (s) { return s.eventId === eid; }).length; };
    db.registrationsOfTicket = function (tid) { return t.registrations.filter(function (r) { return r.ticketId === tid && r.status === 'CONFIRMED'; }); };
    db.answersOf = function (regId) { return t.answers.filter(function (a) { return a.registrationId === regId; }); };
    db.isUpcoming = function (e) { return Date.parse(e.endAt) >= clock(); };
    db.isStarted = function (e) { return Date.parse(e.startAt) <= clock(); };

    // ---- 定員 ----
    function expireHolds() {
      var n = clock(), changed = false;
      t.payments.forEach(function (p) { if (p.status === 'PENDING' && Date.parse(p.holdExpiresAt) < n) { p.status = 'EXPIRED'; p.answersDraft = null; changed = true; } });
      if (changed) save();
    }
    function heldSlots() {
      expireHolds();
      var m = {};
      t.payments.forEach(function (p) { if (p.status === 'PENDING') p.slotIds.forEach(function (s) { m[s] = (m[s] || 0) + 1; }); });
      return m;
    }
    db.slotTaken = function (sid) {
      return t.registrations.filter(function (r) { return r.slotId === sid && r.status === 'CONFIRMED'; }).length + (heldSlots()[sid] || 0);
    };
    db.slotRemaining = function (sid) { var s = db.slotById(sid); return Math.max(0, s.capacity - db.slotTaken(sid)); };
    db.eventTaken = function (eid) {
      // 全体上限は「参加者（チケット）」の数で数える。確保中の Payment も1人として数える
      expireHolds();
      var people = {};
      t.tickets.forEach(function (x) { if (x.eventId === eid && !x.revokedAt) people[x.userId] = 1; });
      t.payments.forEach(function (p) { if (p.eventId === eid && p.status === 'PENDING') people[p.userId] = 1; });
      return Object.keys(people).length;
    };
    db.eventRemaining = function (eid) {
      var e = db.eventById(eid);
      var sum = db.slotsOf(eid).filter(function (s) { return slotOpenState(s) === 'open'; }).reduce(function (a, s) { return a + db.slotRemaining(s.id); }, 0);
      return e.capacity ? Math.min(sum, Math.max(0, e.capacity - db.eventTaken(eid))) : sum;
    };
    function slotOpenState(s) {
      var n = clock();
      if (s.opensAt && Date.parse(s.opensAt) > n) return 'before';
      if (s.closesAt && Date.parse(s.closesAt) < n) return 'closed';
      return 'open';
    }
    db.slotState = function (sid) {
      var s = db.slotById(sid), st = slotOpenState(s);
      if (st !== 'open') return st;
      return db.slotRemaining(sid) === 0 ? 'full' : 'open';
    };
    db.priceRange = function (eid) {
      var ps = db.slotsOf(eid).map(function (s) { return s.priceYen; });
      if (!ps.length) return { min: 0, max: 0 };
      return { min: Math.min.apply(null, ps), max: Math.max.apply(null, ps) };
    };
    // 一覧カードのピル: open / few / soldout / before / closed / ended / cancelled / draft
    db.eventBadge = function (eid) {
      var e = db.eventById(eid);
      if (e.status === 'DRAFT') return { kind: 'draft', label: '下書き' };
      if (e.status === 'CANCELLED') return { kind: 'cancelled', label: '中止' };
      if (!db.isUpcoming(e)) return { kind: 'ended', label: '終了' };
      var slots = db.slotsOf(eid);
      if (slots.length && slots.every(function (s) { return slotOpenState(s) === 'before'; })) {
        var o = new Date(Math.min.apply(null, slots.map(function (s) { return Date.parse(s.opensAt); })));
        return { kind: 'before', label: fmt.md(o) + (fmt.hm(o) === '12:00' ? ' 正午から' : ' から'), opensAt: o.toISOString() };
      }
      var rem = db.eventRemaining(eid);
      if (rem === 0) return { kind: 'soldout', label: '売り切れ' };
      if (rem <= 12) return { kind: 'few', label: '残り' + rem + '枚' };
      return { kind: 'open', label: '受付中' };
    };

    // ---- 検索 ----
    // q: { q, genre(slug), area, kind(SlotKind), from, to(ISO), status: 'upcoming'|'all', organizerId, sort }
    db.searchEvents = function (q) {
      q = q || {};
      var list = t.events.filter(function (e) {
        if (!q.includeDraft && e.status === 'DRAFT') return false;
        if (q.organizerId && e.organizerId !== q.organizerId) return false;
        if ((q.status || 'upcoming') === 'upcoming' && !db.isUpcoming(e)) return false;
        if (q.status === 'past' && db.isUpcoming(e)) return false;
        if (q.genre) { var g = db.genreById(e.genreId); if (!g || g.slug !== q.genre) return false; }
        if (q.area && e.area !== q.area) return false;
        if (q.kind && !db.slotsOf(e.id).some(function (s) { return s.kind === q.kind; })) return false;
        if (q.free && db.priceRange(e.id).min > 0) return false;
        if (q.from && Date.parse(e.endAt) < Date.parse(q.from)) return false;
        if (q.to && Date.parse(e.startAt) > Date.parse(q.to)) return false;
        if (q.q) {
          var o = db.organizerById(e.organizerId);
          var hay = [e.title, e.venueName, o && o.displayName, o && o.slug].join(' ').toLowerCase();
          if (q.q.toLowerCase().split(/\s+/).some(function (w) { return w && hay.indexOf(w) < 0; })) return false;
        }
        return true;
      });
      list.sort(function (a, b) { return q.sort === 'new' ? Date.parse(b.publishedAt || b.createdAt) - Date.parse(a.publishedAt || a.createdAt) : (q.status === 'past' ? Date.parse(b.startAt) - Date.parse(a.startAt) : Date.parse(a.startAt) - Date.parse(b.startAt)); });
      return list;
    };
    db.weekendRange = function () {
      var d = new Date(clock() + 9 * 3600e3); // JST の暦で数える
      var dow = d.getUTCDay();
      var toSat = (6 - dow + 7) % 7;
      var sat = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + toSat) - 9 * 3600e3;
      if (dow === 0) sat -= 86400e3;
      return { from: new Date(sat).toISOString(), to: new Date(sat + 2 * 86400e3 - 1).toISOString() };
    };

    // ---- ログイン ----
    db.currentUser = function () { return t.meta.currentUserId ? db.userById(t.meta.currentUserId) : null; };
    db.login = function (uid) { need(db.userById(uid), 'ユーザーがいません'); t.meta.currentUserId = uid; save(); return db.currentUser(); };
    db.logout = function () { t.meta.currentUserId = null; save(); };
    function me() { return need(db.currentUser(), 'ログインしてください'); }
    db.isAdmin = function () { var u = db.currentUser(); return !!u && u.role === 'ADMIN'; };
    db.isOwner = function (oid, uid) {
      uid = uid || (db.currentUser() || {}).id;
      var o = db.organizerById(oid);
      if (!o || !uid) return false;
      if (o.type === 'USER') return o.userId === uid;
      return t.organizerMembers.some(function (m) { return m.organizerId === oid && m.userId === uid && m.role === 'OWNER'; });
    };
    db.managedOrganizers = function (uid) {
      uid = uid || (db.currentUser() || {}).id;
      return t.organizers.filter(function (o) { return db.isOwner(o.id, uid); }).sort(function (a, b) { return (a.type === 'GROUP' ? 0 : 1) - (b.type === 'GROUP' ? 0 : 1); });
    };
    db.createUser = function (o) {
      var uid = id('u');
      t.users.push({ id: uid, googleSub: 'g-' + uid, email: o.email, role: 'USER', badgeName: o.badgeName || null, createdAt: nowIso() });
      t.organizers.push({ id: 'o-' + uid, type: 'USER', userId: uid, slug: o.slug, displayName: o.displayName, iconUrl: null, bio: null, coverUrl: null, createdAt: nowIso(), updatedAt: nowIso() });
      ['EVENT_UPDATES', 'FOLLOW_NEWS', 'ANNOUNCEMENTS'].forEach(function (c) { t.emailPreferences.push({ userId: uid, category: c, enabled: true, updatedAt: nowIso() }); });
      save();
      return db.userById(uid);
    };
    var SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
    var RESERVED = ['admin', 'events', 'media', 'me', 'login', 'manage', 'search', 'api', 'settings'];
    db.validateSlug = function (slug, selfOrgId) {
      if (!SLUG_RE.test(slug || '')) return '半角英小文字・数字・_ - で3〜30文字にしてください';
      if (RESERVED.indexOf(slug) >= 0) return 'この名前は使えません';
      var o = db.organizerBySlug(slug);
      if (o && o.id !== selfOrgId) return 'このユーザーネームは使われています';
      return '';
    };
    db.updateProfile = function (patch) {
      var u = me(), o = db.personalOrganizer(u.id);
      if (patch.slug != null) { var err = db.validateSlug(patch.slug, o.id); if (err) fail(err); o.slug = patch.slug; }
      if (patch.displayName != null) { if (!String(patch.displayName).trim()) fail('あだ名を入力してください'); o.displayName = String(patch.displayName).trim(); }
      if (patch.bio != null) o.bio = patch.bio;
      if (patch.badgeName !== undefined) {
        var b = patch.badgeName ? String(patch.badgeName).trim() : '';
        if (b && !/^[A-Za-z .'\-]{1,20}$/.test(b)) fail('名札の名前は半角英字・スペース・. - \' で20文字までです');
        u.badgeName = b || null;
      }
      o.updatedAt = nowIso(); save(); return o;
    };
    db.setEmailPreference = function (category, enabled) {
      var u = me();
      var p = t.emailPreferences.find(function (x) { return x.userId === u.id && x.category === category; });
      if (!p) { p = { userId: u.id, category: category, enabled: true, updatedAt: nowIso() }; t.emailPreferences.push(p); }
      p.enabled = !!enabled; p.updatedAt = nowIso(); save();
    };

    // ---- フォロー・保存 ----
    db.isFollowing = function (oid) { var u = db.currentUser(); return !!u && t.follows.some(function (f) { return f.userId === u.id && f.organizerId === oid; }); };
    db.toggleFollow = function (oid) {
      var u = me(), o = need(db.organizerById(oid), '主催者がいません');
      if (o.type !== 'GROUP') fail('フォローできるのは団体だけです');
      var i = t.follows.findIndex(function (f) { return f.userId === u.id && f.organizerId === oid; });
      if (i >= 0) { t.follows.splice(i, 1); save(); return false; }
      t.follows.push({ userId: u.id, organizerId: oid, notifyEmail: true, createdAt: nowIso() }); save(); return true;
    };
    db.setFollowNotify = function (oid, on) { var u = me(); var f = t.follows.find(function (x) { return x.userId === u.id && x.organizerId === oid; }); if (f) { f.notifyEmail = !!on; save(); } };
    db.followingOf = function (uid) { uid = uid || me().id; return t.follows.filter(function (f) { return f.userId === uid; }); };
    db.isSaved = function (eid) { var u = db.currentUser(); return !!u && t.savedEvents.some(function (s) { return s.userId === u.id && s.eventId === eid; }); };
    db.toggleSave = function (eid) {
      var u = me(); need(db.eventById(eid), 'イベントがありません');
      var i = t.savedEvents.findIndex(function (s) { return s.userId === u.id && s.eventId === eid; });
      if (i >= 0) { t.savedEvents.splice(i, 1); save(); return false; }
      t.savedEvents.push({ userId: u.id, eventId: eid, createdAt: nowIso() }); save(); return true;
    };
    db.savedOf = function (uid) { uid = uid || me().id; return t.savedEvents.filter(function (s) { return s.userId === uid; }).map(function (s) { return db.eventById(s.eventId); }).filter(Boolean); };

    // ---- 申込 ----
    function checkApply(e, slotIds, answers, uid) {
      if (e.status !== 'PUBLISHED') fail('このイベントは申し込めません');
      if (db.isStarted(e)) fail('開始後は申し込めません');
      if (!slotIds.length) fail('参加枠を選んでください');
      var slots = slotIds.map(function (sid) { var s = need(db.slotById(sid), '枠がありません'); if (s.eventId !== e.id) fail('枠がイベントと合いません'); return s; });
      slots.forEach(function (s) {
        var st = slotOpenState(s);
        if (st === 'before') fail('「' + s.name + '」はまだ受付前です');
        if (st === 'closed') fail('「' + s.name + '」は受付を終了しました');
        if (t.registrations.some(function (r) { return r.slotId === s.id && r.userId === uid && r.status === 'CONFIRMED'; })) fail('「' + s.name + '」は申込済みです');
        if (t.payments.some(function (p) { return p.status === 'PENDING' && p.userId === uid && p.slotIds.indexOf(s.id) >= 0; })) fail('「' + s.name + '」は支払いの途中です');
        if (db.slotRemaining(s.id) < 1) fail('「' + s.name + '」は満員です');
      });
      var hasTicket = t.tickets.some(function (x) { return x.eventId === e.id && x.userId === uid && !x.revokedAt; });
      if (e.capacity && !hasTicket && db.eventTaken(e.id) >= e.capacity) fail('参加者の上限に達したため満員です');
      db.questionsFor(e.id, slotIds).forEach(function (q) {
        var v = answers[q.id];
        var empty = v == null || (Array.isArray(v) ? !v.length : !String(v).trim());
        if (q.required && empty) fail('必須の質問「' + q.label + '」に答えてください');
        if (!empty && q.type === 'TEL' && !/^[0-9+\-() ]{10,15}$/.test(String(v))) fail('「' + q.label + '」は電話番号の形で入力してください');
        if (!empty && q.type === 'SELECT' && q.options.indexOf(v) < 0) fail('「' + q.label + '」の選択肢が正しくありません');
      });
      return slots;
    }
    function confirm(uid, e, slots, answers, paymentId) {
      var at = nowIso();
      var tk = t.tickets.find(function (x) { return x.eventId === e.id && x.userId === uid; });
      if (!tk) { tk = { id: id('tk'), eventId: e.id, userId: uid, token: tokenFrom(uid + e.id + at + t.meta.seq), checkinStatus: 'NOT_CHECKED_IN', checkedInAt: null, issuedAt: at, revokedAt: null, walletPassUrl: null }; t.tickets.push(tk); }
      else if (tk.revokedAt) { tk.revokedAt = null; tk.token = tokenFrom(uid + e.id + at + t.meta.seq); tk.issuedAt = at; tk.checkinStatus = 'NOT_CHECKED_IN'; }
      var regs = slots.map(function (s) {
        var reg = { id: id('r'), slotId: s.id, userId: uid, ticketId: tk.id, paymentId: s.priceYen > 0 ? paymentId : null, status: 'CONFIRMED', appliedAt: at, cancelledAt: null, note: null };
        t.registrations.push(reg);
        return reg;
      });
      // 回答は最初の申込行にまとめて持たせる（対象枠つきの質問はその枠の行へ）
      db.questionsFor(e.id, slots.map(function (s) { return s.id; })).forEach(function (q) {
        var v = answers[q.id]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
        var target = regs.find(function (r) { return !q.slotIds.length || q.slotIds.indexOf(r.slotId) >= 0; }) || regs[0];
        t.answers.push({ registrationId: target.id, questionId: q.id, value: Array.isArray(v) ? v.join('、') : String(v), updatedAt: at });
      });
      var u = db.userById(uid);
      t.notifications.push({ id: id('n'), userId: uid, toEmail: u.email, type: 'REGISTRATION_CONFIRMED', title: e.title + ' の QR チケットを発行しました', readAt: null, status: 'SENT', eventId: e.id, registrationId: regs[0].id, announcementId: null, createdAt: at, sentAt: at });
      return tk;
    }
    // 戻り値: { kind:'confirmed', ticketId } または { kind:'payment', paymentId }
    db.apply = function (eid, slotIds, answers) {
      var u = me(), e = need(db.eventById(eid), 'イベントがありません');
      answers = answers || {};
      var slots = checkApply(e, slotIds, answers, u.id);
      var amount = slots.reduce(function (a, s) { return a + s.priceYen; }, 0);
      if (amount === 0) { var tk = confirm(u.id, e, slots, answers, null); save(); return { kind: 'confirmed', ticketId: tk.id }; }
      var p = { id: id('pay'), userId: u.id, eventId: e.id, slotIds: slotIds.slice(), answersDraft: answers, provider: 'MOCK', providerRef: 'mock_' + tokenFrom(u.id + eid + nowIso()).slice(0, 12),
        amountYen: amount, status: 'PENDING', holdExpiresAt: new Date(clock() + HOLD_MIN * 60 * 1000).toISOString(), failureReason: null, paidAt: null, refundedAt: null, createdAt: nowIso() };
      t.payments.push(p); save();
      return { kind: 'payment', paymentId: p.id };
    };
    // モック決済の Webhook に当たる処理
    db.completePayment = function (pid, success, reason) {
      expireHolds();
      var p = need(by('payments', 'id', pid), '決済が見つかりません');
      if (p.status === 'PAID') return { kind: 'confirmed', ticketId: (t.tickets.find(function (x) { return x.eventId === p.eventId && x.userId === p.userId; }) || {}).id };
      if (p.status === 'EXPIRED') fail('支払いの期限が切れました。もう一度申し込んでください');
      if (p.status !== 'PENDING') fail('この決済はすでに終わっています');
      if (!success) { p.status = 'FAILED'; p.failureReason = reason || 'カードが承認されませんでした'; save(); return { kind: 'failed' }; }
      p.status = 'PAID'; p.paidAt = nowIso();
      var e = db.eventById(p.eventId);
      var tk = confirm(p.userId, e, p.slotIds.map(db.slotById), p.answersDraft || {}, p.id);
      p.answersDraft = null; save();
      return { kind: 'confirmed', ticketId: tk.id };
    };
    // 失敗した決済をやり直す（回答は引き継ぐ）
    db.retryPayment = function (pid) {
      var p = need(by('payments', 'id', pid), '決済が見つかりません');
      if (p.status !== 'FAILED') fail('やり直せる決済ではありません');
      return db.apply(p.eventId, p.slotIds, p.answersDraft || {});
    };
    db.cancelPayment = function (pid) { var p = by('payments', 'id', pid); if (p && p.status === 'PENDING') { p.status = 'EXPIRED'; p.answersDraft = null; save(); } };
    db.cancelRegistration = function (regId) {
      var u = me(), r = need(by('registrations', 'id', regId), '申込がありません');
      if (r.userId !== u.id) fail('権限がありません');
      var e = db.eventById(db.slotById(r.slotId).eventId);
      if (db.isStarted(e)) fail('開始後はキャンセルできません');
      r.status = 'CANCELLED'; r.cancelledAt = nowIso();
      if (!db.registrationsOfTicket(r.ticketId).length) db.ticketById(r.ticketId).revokedAt = nowIso();
      save(); return r;
    };
    // マイページ用: 自分のチケット（イベント・枠・支払いをまとめたもの）
    db.myTickets = function (uid) {
      uid = uid || me().id;
      return t.tickets.filter(function (x) { return x.userId === uid; }).map(function (x) {
        var regs = t.registrations.filter(function (r) { return r.ticketId === x.id; });
        var active = regs.filter(function (r) { return r.status === 'CONFIRMED'; });
        var pays = t.payments.filter(function (p) { return p.userId === uid && p.eventId === x.eventId && p.status === 'PAID'; });
        return { ticket: x, event: db.eventById(x.eventId), registrations: active, cancelled: regs.filter(function (r) { return r.status === 'CANCELLED'; }), slots: active.map(function (r) { return db.slotById(r.slotId); }), paidYen: pays.reduce(function (a, p) { return a + p.amountYen; }, 0) };
      }).sort(function (a, b) { return Date.parse(a.event.startAt) - Date.parse(b.event.startAt); });
    };
    db.pendingPayments = function () { var u = db.currentUser(); expireHolds(); return u ? t.payments.filter(function (p) { return p.userId === u.id && p.status === 'PENDING'; }) : []; };

    // ---- 主催者 ----
    function ownerOf(eid) { var e = need(db.eventById(eid), 'イベントがありません'); if (!db.isOwner(e.organizerId)) fail('権限がありません'); return e; }
    db.canManageEvent = function (eid) { var e = db.eventById(eid); return !!e && db.isOwner(e.organizerId); };
    db.createGroup = function (o) {
      var u = me();
      var err = db.validateSlug(o.slug); if (err) fail(err);
      if (!String(o.displayName || '').trim()) fail('団体名を入力してください');
      var oid = id('o');
      t.organizers.push({ id: oid, type: 'GROUP', userId: null, slug: o.slug, displayName: String(o.displayName).trim(), iconUrl: null, bio: o.bio || null, coverUrl: null, createdAt: nowIso(), updatedAt: nowIso() });
      t.organizerMembers.push({ organizerId: oid, userId: u.id, role: 'OWNER', invitedAt: nowIso(), joinedAt: nowIso() });
      save(); return db.organizerById(oid);
    };
    db.similarGroups = function (name) {
      var n = String(name || '').replace(/\s/g, ''); if (n.length < 2) return [];
      return t.organizers.filter(function (o) { return o.type === 'GROUP' && (o.displayName.replace(/\s/g, '').indexOf(n) >= 0 || n.indexOf(o.displayName.replace(/\s/g, '').slice(0, 4)) >= 0); });
    };
    db.requestJoin = function (oid, message) {
      var u = me();
      var r = { id: id('jr'), organizerId: oid, userId: u.id, message: message || null, status: 'PENDING', decidedById: null, decidedAt: null, createdAt: nowIso() };
      t.joinRequests.push(r); save(); return r;
    };
    db.decideJoin = function (jrId, approve) {
      var r = need(by('joinRequests', 'id', jrId), '依頼がありません');
      if (!db.isOwner(r.organizerId)) fail('権限がありません');
      r.status = approve ? 'APPROVED' : 'REJECTED'; r.decidedById = me().id; r.decidedAt = nowIso();
      if (approve && !t.organizerMembers.some(function (m) { return m.organizerId === r.organizerId && m.userId === r.userId; })) t.organizerMembers.push({ organizerId: r.organizerId, userId: r.userId, role: 'OWNER', invitedAt: nowIso(), joinedAt: nowIso() });
      save(); return r;
    };
    db.updateGroup = function (oid, patch) {
      if (!db.isOwner(oid)) fail('権限がありません');
      var o = db.organizerById(oid);
      if (patch.slug != null) { var err = db.validateSlug(patch.slug, oid); if (err) fail(err); o.slug = patch.slug; }
      ['displayName', 'bio'].forEach(function (k) { if (patch[k] != null) o[k] = patch[k]; });
      o.updatedAt = nowIso(); save(); return o;
    };
    db.createInvitation = function (oid) {
      if (!db.isOwner(oid)) fail('権限がありません');
      var inv = { id: id('inv'), organizerId: oid, role: 'OWNER', token: tokenFrom(oid + nowIso() + t.meta.seq), expiresAt: new Date(clock() + 7 * 86400e3).toISOString(), createdById: me().id, acceptedById: null, acceptedAt: null, revokedAt: null, createdAt: nowIso() };
      t.invitations.push(inv); save(); return inv;
    };
    db.leaveGroup = function (oid) {
      var u = me();
      var owners = db.membersOf(oid).filter(function (m) { return m.role === 'OWNER'; });
      if (owners.length <= 1) fail('最後の owner は抜けられません。先に別の人を owner にしてください');
      t.organizerMembers = t.organizerMembers.filter(function (m) { return !(m.organizerId === oid && m.userId === u.id); });
      save();
    };
    db.createEvent = function (oid, o) {
      if (!db.isOwner(oid)) fail('権限がありません');
      var eid = id('e');
      t.events.push({ id: eid, organizerId: oid, targetUniversityId: null, genreId: o.genreId || 'g-music', area: o.area || '東京都', capacity: o.capacity || null, title: o.title || '無題のイベント', body: o.body || '',
        startAt: o.startAt ? iso(o.startAt) : new Date(clock() + 14 * 86400e3).toISOString(), endAt: o.endAt ? iso(o.endAt) : new Date(clock() + 14 * 86400e3 + 7200e3).toISOString(),
        venueType: o.venueType || 'OFFLINE', venueName: o.venueName || null, address: o.address || null, onlineUrl: o.onlineUrl || null, status: 'DRAFT', publishedAt: null, cancelledAt: null, cancelReason: null,
        coverUrl: o.coverUrl || 'assets/flyer-band-battle.jpg', payoutAccountId: null, attendeeListVisibility: o.attendeeListVisibility || 'ORGANIZER_ONLY', answerRetentionDays: o.answerRetentionDays || 30,
        dataUsePurpose: o.dataUsePurpose || null, createdAt: nowIso(), updatedAt: nowIso() });
      [['NAME', '氏名'], ['KANA', 'フリガナ'], ['AFFILIATION', '所属（学校名と学年 / 社会人）']].forEach(function (c, i) {
        t.questions.push({ id: id('q'), eventId: eid, commonKey: c[0], label: c[1], helpText: null, type: 'TEXT', options: null, required: true, isPersonalData: c[0] !== 'AFFILIATION', slotIds: [], sortOrder: i });
      });
      save(); return db.eventById(eid);
    };
    db.updateEvent = function (eid, patch) {
      var e = ownerOf(eid);
      ['title', 'body', 'genreId', 'area', 'capacity', 'startAt', 'endAt', 'venueType', 'venueName', 'address', 'onlineUrl', 'coverUrl', 'attendeeListVisibility', 'answerRetentionDays', 'dataUsePurpose'].forEach(function (k) {
        if (patch[k] !== undefined) e[k] = (k === 'startAt' || k === 'endAt') && patch[k] ? iso(patch[k]) : patch[k];
      });
      if ([30, 90, 365].indexOf(Number(e.answerRetentionDays)) < 0) fail('回答の保存期間は 30 / 90 / 365 日から選んでください');
      if (Date.parse(e.endAt) < Date.parse(e.startAt)) fail('終了は開始より後にしてください');
      e.updatedAt = nowIso(); save(); return e;
    };
    db.addSlot = function (eid, s) {
      ownerOf(eid);
      if (!s.name || !(s.capacity > 0)) fail('枠名と定員を入れてください');
      var slot = { id: id('s'), eventId: eid, kind: s.kind || 'STUDENT', name: s.name, description: s.description || null, capacity: Number(s.capacity), priceYen: Number(s.priceYen || 0), opensAt: s.opensAt || null, closesAt: s.closesAt || null, sortOrder: db.slotsOf(eid).length };
      t.slots.push(slot); save(); return slot;
    };
    db.updateSlot = function (sid, patch) {
      var s = need(db.slotById(sid), '枠がありません'); ownerOf(s.eventId);
      if (patch.capacity != null && Number(patch.capacity) < t.registrations.filter(function (r) { return r.slotId === sid && r.status === 'CONFIRMED'; }).length) fail('定員は申込済みの人数より少なくできません');
      ['kind', 'name', 'description', 'capacity', 'priceYen', 'opensAt', 'closesAt'].forEach(function (k) { if (patch[k] !== undefined) s[k] = (k === 'capacity' || k === 'priceYen') ? Number(patch[k]) : patch[k]; });
      save(); return s;
    };
    db.removeSlot = function (sid) {
      var s = need(db.slotById(sid), '枠がありません'); ownerOf(s.eventId);
      if (t.registrations.some(function (r) { return r.slotId === sid; })) fail('申込のある枠は削除できません');
      t.slots = t.slots.filter(function (x) { return x.id !== sid; }); db.t = t; save();
    };
    db.addQuestion = function (eid, q) {
      var e = ownerOf(eid);
      if (!q.label) fail('質問を入れてください');
      var row = { id: id('q'), eventId: eid, commonKey: null, label: q.label, helpText: q.helpText || null, type: q.type || 'TEXT', options: q.options || null, required: !!q.required, isPersonalData: !!q.isPersonalData, slotIds: q.slotIds || [], sortOrder: 10 + db.questionsOf(eid).length };
      if ((row.type === 'SELECT' || row.type === 'MULTI_SELECT') && !(row.options && row.options.length >= 2)) fail('選択肢を2つ以上入れてください');
      t.questions.push(row); e.updatedAt = nowIso(); save(); return row;
    };
    db.removeQuestion = function (qid) {
      var q = need(by('questions', 'id', qid), '質問がありません'); var e = ownerOf(q.eventId);
      if (q.commonKey) fail('共通の質問は削除できません');
      if (e.status !== 'DRAFT') fail('公開後は質問を削除できません');
      t.questions = t.questions.filter(function (x) { return x.id !== qid; }); db.t = t; save();
    };
    db.publishErrors = function (eid) {
      var e = db.eventById(eid), errs = [];
      if (!e.title || !e.title.trim()) errs.push('タイトルを入れてください');
      if (!db.slotsOf(eid).length) errs.push('参加枠を1つ以上作ってください');
      if (e.venueType === 'OFFLINE' && !e.venueName) errs.push('会場を入れてください');
      if (e.venueType === 'ONLINE' && !e.onlineUrl) errs.push('参加 URL を入れてください');
      if (db.questionsOf(eid).some(function (q) { return q.isPersonalData; }) && !(e.dataUsePurpose && e.dataUsePurpose.trim())) errs.push('個人情報の利用目的を入れてください');
      if (Date.parse(e.startAt) <= clock()) errs.push('開始日時を未来にしてください');
      return errs;
    };
    db.publishEvent = function (eid) {
      var e = ownerOf(eid), errs = db.publishErrors(eid);
      if (errs.length) fail(errs.join(' / '));
      e.status = 'PUBLISHED'; e.publishedAt = nowIso(); e.updatedAt = nowIso();
      // フォロワーへ新規公開のメール（配信停止の人は SUPPRESSED）
      t.follows.filter(function (f) { return f.organizerId === e.organizerId; }).forEach(function (f) {
        var u = db.userById(f.userId);
        var pref = t.emailPreferences.find(function (p) { return p.userId === f.userId && p.category === 'FOLLOW_NEWS'; });
        t.notifications.push({ id: id('n'), userId: f.userId, toEmail: u.email, type: 'NEW_EVENT_FROM_FOLLOWING', title: db.organizerById(e.organizerId).displayName + ' が新しいイベントを公開しました：' + e.title, readAt: null,
          status: f.notifyEmail && (!pref || pref.enabled) ? 'SENT' : 'SUPPRESSED', eventId: eid, registrationId: null, announcementId: null, createdAt: nowIso(), sentAt: nowIso() });
      });
      save(); return e;
    };
    db.duplicateEvent = function (eid) {
      var src = ownerOf(eid);
      var e = db.createEvent(src.organizerId, { title: src.title + '（コピー）', genreId: src.genreId, area: src.area, capacity: src.capacity, body: src.body, venueType: src.venueType, venueName: src.venueName, address: src.address, coverUrl: src.coverUrl, dataUsePurpose: src.dataUsePurpose, answerRetentionDays: src.answerRetentionDays });
      db.slotsOf(eid).forEach(function (s) { db.addSlot(e.id, { kind: s.kind, name: s.name, description: s.description, capacity: s.capacity, priceYen: s.priceYen }); });
      db.questionsOf(eid).filter(function (q) { return !q.commonKey; }).forEach(function (q) { db.addQuestion(e.id, { label: q.label, helpText: q.helpText, type: q.type, options: q.options, required: q.required, isPersonalData: q.isPersonalData }); });
      return e;
    };
    db.cancelEvent = function (eid, reason) {
      var e = ownerOf(eid);
      if (!reason || !reason.trim()) fail('参加者への説明を入れてください');
      e.status = 'CANCELLED'; e.cancelledAt = nowIso(); e.cancelReason = reason; e.updatedAt = nowIso();
      t.tickets.filter(function (x) { return x.eventId === eid && !x.revokedAt; }).forEach(function (x) {
        var u = db.userById(x.userId);
        t.notifications.push({ id: id('n'), userId: x.userId, toEmail: u.email, type: 'EVENT_CANCELLED', title: e.title + ' は中止になりました', readAt: null, status: 'SENT', eventId: eid, registrationId: null, announcementId: null, createdAt: nowIso(), sentAt: nowIso() });
      });
      t.payments.filter(function (p) { return p.eventId === eid && p.status === 'PAID'; }).forEach(function (p) { p.status = 'REFUNDED'; p.refundedAt = nowIso(); });
      save(); return e;
    };
    db.canTransfer = function (eid) {
      var e = db.eventById(eid);
      if (!e || !db.isOwner(e.organizerId)) return { ok: false, reason: '権限がありません' };
      if (t.payments.some(function (p) { return p.eventId === eid && p.status === 'PAID'; })) return { ok: false, reason: '支払い済みの申込があるイベントは移管できません（入金先が変わるため）' };
      return { ok: true };
    };
    db.transferEvent = function (eid, toOrgId) {
      var e = ownerOf(eid);
      var c = db.canTransfer(eid); if (!c.ok) fail(c.reason);
      need(db.organizerById(toOrgId), '移管先がありません');
      if (!db.isOwner(toOrgId)) fail('移管先の権限がありません（移管先でも owner である必要があります）');
      e.organizerId = toOrgId; e.updatedAt = nowIso(); save(); return e;
    };
    db.answersDeleteAt = function (eid) { var e = db.eventById(eid); return new Date(Date.parse(e.endAt) + e.answerRetentionDays * 86400e3).toISOString(); };
    db.answersExpired = function (eid) { return Date.parse(db.answersDeleteAt(eid)) <= clock(); };
    db.checkinLogsOf = function (eid) {
      var ids = {}; t.tickets.forEach(function (x) { if (x.eventId === eid) ids[x.id] = 1; });
      return t.checkinLogs.filter(function (l) { return ids[l.ticketId]; }).sort(function (a, b) { return Date.parse(b.changedAt) - Date.parse(a.changedAt); });
    };
    db.cancelledCount = function (eid) { var ids = db.slotsOf(eid).map(function (s) { return s.id; }); return t.registrations.filter(function (r) { return r.status === 'CANCELLED' && ids.indexOf(r.slotId) >= 0; }).length; };
    db.reports = function (q) { q = q || {}; return t.reports.filter(function (r) { return !q.status || r.status === q.status; }).sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); }); };
    // 参加者リスト（主催者用）: チケット1枚＝1行。保存期間を過ぎた回答は返さない
    db.attendees = function (eid) {
      var ev = db.eventById(eid);
      if (!ev || (!db.isOwner(ev.organizerId) && !db.isAdmin())) fail('権限がありません');
      var expired = db.answersExpired(eid);
      return t.tickets.filter(function (x) { return x.eventId === eid && !x.revokedAt; }).map(function (x) {
        var regs = db.registrationsOfTicket(x.id);
        var ans = {}; if (!expired) regs.forEach(function (r) { db.answersOf(r.id).forEach(function (a) { ans[a.questionId] = a.value; }); });
        return { ticket: x, user: db.userById(x.userId), profile: db.personalOrganizer(x.userId), slots: regs.map(function (r) { return db.slotById(r.slotId); }), answers: ans, appliedAt: regs.length ? regs[0].appliedAt : x.issuedAt };
      }).sort(function (a, b) { return Date.parse(b.appliedAt) - Date.parse(a.appliedAt); });
    };
    db.recentRegistrations = function (oid, n) {
      if (!db.isOwner(oid)) fail('権限がありません');
      var evIds = t.events.filter(function (e) { return e.organizerId === oid; }).map(function (e) { return e.id; });
      var byTicket = {};
      t.registrations.filter(function (r) { return r.status === 'CONFIRMED' && evIds.indexOf(db.slotById(r.slotId).eventId) >= 0; }).forEach(function (r) {
        (byTicket[r.ticketId] = byTicket[r.ticketId] || []).push(r);
      });
      return Object.keys(byTicket).map(function (k) { var rs = byTicket[k]; return { ticket: db.ticketById(k), profile: db.personalOrganizer(rs[0].userId), slots: rs.map(function (r) { return db.slotById(r.slotId); }), appliedAt: rs.map(function (r) { return r.appliedAt; }).sort().pop() }; })
        .sort(function (a, b) { return Date.parse(b.appliedAt) - Date.parse(a.appliedAt); }).slice(0, n || 5);
    };
    db.setCheckin = function (tid, status, method) {
      var x = need(db.ticketById(tid), 'チケットがありません');
      if (!db.isOwner(db.eventById(x.eventId).organizerId) && !db.isAdmin()) fail('権限がありません');
      if (['NOT_CHECKED_IN', 'CHECKED_IN', 'ABSENT'].indexOf(status) < 0) fail('受付の状態が正しくありません');
      if (x.revokedAt) fail('無効になったチケットです');
      if (x.checkinStatus === status) return x;
      t.checkinLogs.push({ id: id('cl'), ticketId: tid, fromStatus: x.checkinStatus, toStatus: status, method: method || 'MANUAL', changedById: me().id, changedAt: nowIso() });
      x.checkinStatus = status; x.checkedInAt = status === 'CHECKED_IN' ? nowIso() : null;
      save(); return x;
    };
    // QR 読み取り: { ticket, already } を返す
    db.checkinByToken = function (token, eventId) {
      var x = t.tickets.find(function (k) { return k.token === String(token).trim(); });
      if (!x) fail('このイベントのチケットではありません');
      if (eventId && x.eventId !== eventId) fail('別のイベントのチケットです');
      if (x.revokedAt) fail('キャンセル済みのチケットです');
      var already = x.checkinStatus === 'CHECKED_IN';
      if (!already) db.setCheckin(x.id, 'CHECKED_IN', 'QR');
      return { ticket: x, already: already };
    };
    db.checkinSummary = function (eid) {
      var s = { total: 0, NOT_CHECKED_IN: 0, CHECKED_IN: 0, ABSENT: 0 };
      t.tickets.forEach(function (x) { if (x.eventId === eid && !x.revokedAt) { s.total++; s[x.checkinStatus]++; } });
      return s;
    };
    db.exportCsv = function (eid, includeAnswers) {
      var e = ownerOf(eid), qs = db.questionsOf(eid);
      var rows = [['あだ名', 'ユーザーネーム', '参加枠', '受付'].concat(includeAnswers ? qs.map(function (q) { return q.label; }) : [])];
      db.attendees(eid).forEach(function (a) {
        rows.push([a.profile.displayName, '@' + a.profile.slug, a.slots.map(function (s) { return s.name; }).join(' / '), { NOT_CHECKED_IN: '未受付', CHECKED_IN: '受付済', ABSENT: '欠席' }[a.ticket.checkinStatus]]
          .concat(includeAnswers ? qs.map(function (q) { return a.answers[q.id] || ''; }) : []));
      });
      t.exportLogs.push({ id: id('ex'), eventId: e.id, userId: me().id, includeAnswers: !!includeAnswers, includeWaitlist: false, exportedAt: nowIso() });
      save();
      return rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
    };
    db.announceAudience = function (eid, audiences) {
      var to = {};
      if (audiences.indexOf('ATTENDEES') >= 0) t.tickets.forEach(function (x) { if (x.eventId === eid && !x.revokedAt) to[x.userId] = 1; });
      if (audiences.indexOf('SAVED') >= 0) t.savedEvents.forEach(function (s) { if (s.eventId === eid && !t.tickets.some(function (x) { return x.eventId === eid && x.userId === s.userId && !x.revokedAt; })) to[s.userId] = 1; });
      return Object.keys(to);
    };
    db.sendAnnouncement = function (eid, a) {
      var e = ownerOf(eid);
      if (!a.subject || !a.subject.trim() || !a.body || !a.body.trim()) fail('件名と本文を入れてください');
      if (!a.audiences || !a.audiences.length) fail('送り先を選んでください');
      var to = db.announceAudience(eid, a.audiences);
      var an = { id: id('an'), eventId: eid, subject: a.subject, body: a.body, audiences: a.audiences.slice(), recipientCount: to.length, sentAt: nowIso() };
      t.announcements.push(an);
      var org = db.organizerById(e.organizerId);
      to.forEach(function (uid) {
        var u = db.userById(uid);
        var pref = t.emailPreferences.find(function (p) { return p.userId === uid && p.category === 'ANNOUNCEMENTS'; });
        t.notifications.push({ id: id('n'), userId: uid, toEmail: u.email, type: 'ANNOUNCEMENT', title: org.displayName + '：' + a.subject, readAt: null, status: !pref || pref.enabled ? 'SENT' : 'SUPPRESSED', eventId: eid, registrationId: null, announcementId: an.id, createdAt: nowIso(), sentAt: nowIso() });
      });
      save(); return an;
    };
    db.announcementsOf = function (eid) { return t.announcements.filter(function (a) { return a.eventId === eid; }).sort(function (a, b) { return Date.parse(b.sentAt) - Date.parse(a.sentAt); }); };

    // ---- お知らせ ----
    db.notificationsOf = function (uid) { uid = uid || me().id; return t.notifications.filter(function (n) { return n.userId === uid; }).sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); }); };
    db.markRead = function (nid) { var n = by('notifications', 'id', nid); if (n && !n.readAt) { n.readAt = nowIso(); save(); } };

    // ---- 通報 ----
    db.report = function (type, targetId, reason, detail) {
      var u = me();
      if (['FRAUD', 'INAPPROPRIATE', 'PERSONAL_DATA_ABUSE', 'OTHER'].indexOf(reason) < 0) fail('通報の理由を選んでください');
      if (type === 'EVENT') need(db.eventById(targetId), '対象がありません'); else need(db.organizerById(targetId), '対象がありません');
      var r = { id: id('rp'), reporterUserId: u.id, targetType: type, targetId: targetId, reason: reason, detail: detail || null, status: 'OPEN', createdAt: nowIso(), resolvedAt: null, resolvedById: null, resolution: null };
      t.reports.push(r);
      t.users.filter(function (x) { return x.role === 'ADMIN'; }).forEach(function (a) {
        t.notifications.push({ id: id('n'), userId: a.id, toEmail: a.email, type: 'REPORT_RECEIVED', title: '通報を受け付けました', readAt: null, status: 'SENT', eventId: type === 'EVENT' ? targetId : null, registrationId: null, announcementId: null, createdAt: nowIso(), sentAt: nowIso() });
      });
      save(); return r;
    };
    db.resolveReport = function (rid, status, resolution) {
      if (!db.isAdmin()) fail('権限がありません（運営のみ）');
      var r = need(by('reports', 'id', rid), '通報がありません');
      if (['OPEN', 'RESOLVED', 'DISMISSED'].indexOf(status) < 0) fail('状態が正しくありません');
      r.status = status; r.resolution = resolution || null;
      r.resolvedAt = status === 'OPEN' ? null : nowIso(); r.resolvedById = status === 'OPEN' ? null : me().id;
      save(); return r;
    };
    db.reportTargetLabel = function (r) {
      if (r.targetType === 'EVENT') { var e = db.eventById(r.targetId); return e ? e.title : '（削除済み）'; }
      var o = db.organizerById(r.targetId); return o ? o.displayName + ' @' + o.slug : '（削除済み）';
    };

    expireHolds();
    save();
    return db;
  }

  // ---------- 表示用の書式 ----------
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function jst(d) { return new Date((typeof d === 'string' ? Date.parse(d) : +d) + 9 * 3600e3); }
  var fmt = {
    md: function (d) { var j = jst(d); return (j.getUTCMonth() + 1) + '/' + j.getUTCDate(); },
    wd: function (d) { return WD[jst(d).getUTCDay()]; },
    hm: function (d) { var j = jst(d); return j.getUTCHours() + ':' + ('0' + j.getUTCMinutes()).slice(-2); },
    ymd: function (d) { var j = jst(d); return j.getUTCFullYear() + '.' + ('0' + (j.getUTCMonth() + 1)).slice(-2) + '.' + ('0' + j.getUTCDate()).slice(-2); },
    // 11/8（日）17:30 — カードの日付
    card: function (d) { return fmt.md(d) + '（' + fmt.wd(d) + '）' + fmt.hm(d); },
    yen: function (n) { return n === 0 ? '無料' : '¥' + n.toLocaleString('ja-JP'); },
    priceLabel: function (r) { return r.max === 0 ? '無料' : r.min === 0 ? '無料〜' : '¥' + r.min.toLocaleString('ja-JP') + (r.max > r.min ? '〜' : ''); },
    ago: function (d, now) { var m = Math.round((now - Date.parse(d)) / 60000); if (m < 1) return 'たった今'; if (m < 60) return m + '分前'; var h = Math.round(m / 60); if (h < 24) return h + '時間前'; var dd = Math.round(h / 24); return dd === 1 ? '昨日' : dd + '日前'; },
    days: function (d, now) { var a = jst(now), b = jst(d); return Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / 86400e3); },
    localInput: function (d) { var j = jst(d); return j.toISOString().slice(0, 16); }, // <input type=datetime-local> 用（JST）
    fromLocalInput: function (v) { return v ? new Date(Date.parse(v + ':00+09:00')).toISOString() : null; }
  };
  var LABEL = {
    SlotKind: { STUDENT: '学生', ADULT: '大人', PARTY: '懇親会', OTHER: 'その他' },
    CheckinStatus: { NOT_CHECKED_IN: '未受付', CHECKED_IN: '受付済', ABSENT: '欠席' },
    QuestionType: { TEXT: '1行テキスト', TEXTAREA: '複数行テキスト', TEL: '電話番号', SELECT: '選択（1つ）', MULTI_SELECT: '選択（複数）' },
    ReportReason: { FRAUD: '詐欺・架空のイベント', INAPPROPRIATE: '不適切な内容', PERSONAL_DATA_ABUSE: '個人情報の不正な収集', OTHER: 'その他' },
    ReportStatus: { OPEN: '未対応', RESOLVED: '対応済み', DISMISSED: '問題なし' },
    PaymentStatus: { PENDING: '支払い待ち', PAID: '支払い済み', FAILED: '失敗', EXPIRED: '期限切れ', REFUNDED: '返金済み' },
    EmailCategory: { EVENT_UPDATES: '申込・QR チケット・中止', FOLLOW_NEWS: 'フォロー中の団体の新しいイベント', ANNOUNCEMENTS: '主催者からのお知らせ' },
    AnnouncementAudience: { ATTENDEES: '参加予定の人', SAVED: '保存した人（未申込）' }
  };
  var AREAS = ['東京都', '神奈川県', '埼玉県', '千葉県', '大阪府', '京都府', '愛知県', '福岡県', 'online'];

  var api = { createDb: createDb, buildSeed: buildSeed, fmt: fmt, LABEL: LABEL, AREAS: AREAS, KEY: KEY, DEMO_NOW: DEMO_NOW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.NMT = root.NMT || {};
    var storage = null; try { storage = root.localStorage; } catch (e) { storage = null; }
    root.NMT.data = api;
    root.NMT.db = createDb({ storage: storage });
    root.NMT.fmt = fmt; root.NMT.LABEL = LABEL; root.NMT.AREAS = AREAS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
