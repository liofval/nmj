# NEXT MOVE TICKETS プロトタイプ（静的 HTML・ビルドなし）

Figma「NMJ Ticket｜PC」(fileKey `M83Df5IlWnEOvGhXWqIeKW` / page `1743:7675`) の見た目で、`docs/wireframes.html`（v0.4）の画面構成を、`docs/schema.prisma`（v0.4・10/8 定例の決定）のデータで動かすプロトタイプ。Figma にある10画面は 1440 幅で Figma どおり、Figma に無い画面は同じ部品で組む。

- 動かし方: `docs/ticket/index.html` をブラウザで開く（file:// でも可）。状態はブラウザの localStorage（`nmt:db:v2`）に残る。右下の DEMO バーでログイン中の人の切り替えとリセット
- デモの「いま」は 2026-10-29（木）10:00。開いてから最大6時間だけ進む（決済の確保期限 30 分を試すため）
- テスト: `node --test tests/`（`data.js` のルール）

## ファイル

| パス | 中身 |
|---|---|
| `data.js` | モック DB。テーブル・列・enum は `schema.prisma` と同じ名前。seed と操作（申込・決済・受付・告知・通報・移管…）。`window.NMT.db` |
| `common.js` | ヘッダー3種・フッター・DEMO バーの差し込みと画面部品 `window.NMT.ui`（カード・モーダル・確認・トースト・通報・リンクコピー・QR） |
| `style.css` | トークン＋共通部品＋プロトタイプ共通部品（16b）＋レスポンシブ（17） |
| `events.css` `flow.css` `media.css` `org.css` `manage.css` | ページ群ごとの CSS（下表） |
| `assets/` | 画像・SVG |

## 画面（wireframes.html の画面一覧と同じ）

| 区分 | 画面 | ファイル | URL の引数 | CSS |
|---|---|---|---|---|
| 公開 | Home（Figma 01） | `index.html` | | events |
| 公開 | Events カード／リスト（Figma 02）・検索 | `events.html` `events-list.html` | `?q= &genre= &area= &kind= &when=today\|weekend\|month &free=1 &avail=1 &date=YYYY-MM-DD &sort=new` | events |
| 公開 | カレンダー（Figma 03） | `calendar.html` | `?ym=2026-11 &day=` | events |
| 公開 | イベント詳細（状態違い） | `event.html` | `?id=` | flow |
| 公開 | Media・記事（Figma 06/07） | `media.html` `article.html` | `?cat=` / `?slug=` | media |
| 公開 | 主催者ページ（団体・個人。Figma 08） | `organizer.html` | `?slug=` | media |
| 参加者 | ログイン・初回設定 | `login.html` | `?next=` | flow |
| 参加者 | 申込 ①枠 → ②質問 → ③確認 → 完了 | `apply.html` | `?id=` | flow |
| 参加者 | モック決済 → 確認中 → 完了／失敗 | `checkout.html` | `?payment=` | flow |
| 参加者 | マイページ（Figma 12）・QR チケット・プロフィール編集 | `mypage.html` `ticket.html` `profile.html` | `?id=`（チケット） | media |
| 参加者 | フォロー中・保存したイベント | `following.html` `saved.html` | | media |
| 主催 | ダッシュボード（Figma 14） | `dashboard.html` | `?org=`（slug） | org |
| 主催 | 団体作成・団体の設定 | `group-new.html` `group-settings.html` | `?org=` | org |
| 主催 | イベント作成・編集（Figma 17） | `event-create.html` | `?org=` / `?id=` | org |
| 主催 | 参加者リスト・受付／QR で受付 | `attendees.html` `checkin.html` | `?id=` | manage |
| 主催 | 告知配信・イベント移管 | `announce.html` `transfer.html` | `?id=` | manage |
| 運営 | 通報の確認 | `admin-reports.html` | | manage |

リンクは `NMT.ui.url('event', { id: e.id })` のように作る（ファイル名の対応は `common.js` の `PAGES`）。

## ページの雛形

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>〇〇｜NEXT MOVE TICKETS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+JP:wght@400;500;700;900&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@1&family=Barlow+Condensed:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="flow.css">
<script src="data.js"></script>
<script src="common.js"></script>
</head>
<body>
<div data-header="v2" data-active="events"></div>
<main id="main"> … </main>
<div data-footer></div>
<script>
NMT.ready(function (db, ui) {
  // ここに画面の処理。db = NMT.db（data.js）、ui = NMT.ui（common.js）
});
</script>
</body>
</html>
```

data.js・common.js は `<head>` で同期読み込み（defer を付けない。付けると本文末のインライン script が先に走り `NMT is not defined` になる）。`NMT.ready` はヘッダー差し込み（DOMContentLoaded）の後に呼ばれる。中で投げた Error はトーストで出る。

## データ（data.js の主な関数）

- 参照: `eventById` `slotsOf` `questionsFor(eventId, slotIds)` `organizerBySlug` `profileOf(userId)`（あだ名・@ユーザーネーム）`genreById` `articleBySlug` `followerCount` `savedCount` `membersOf`
- 一覧: `genres()` `publishedArticles(cat)` `searchEvents({ q, genre, area, kind, free, from, to, status:'upcoming'|'past'|'all', organizerId, includeDraft, sort })` `weekendRange()` `eventBadge(id)`（`{kind,label}` → `ui.pill`）`priceRange(id)` `slotState(slotId)`（open/full/before/closed）`slotRemaining` `eventRemaining`
- ログイン: `currentUser()` `login(userId)` `logout()` `createUser()` `isAdmin()` `isOwner(orgId)` `managedOrganizers()` `validateSlug()` `updateProfile()` `setEmailPreference()`
- 参加者: `apply(eventId, slotIds, answers)` → `{kind:'confirmed', ticketId}` か `{kind:'payment', paymentId}` ／ `completePayment(paymentId, success)` `retryPayment` `cancelPayment` `paymentById` `cancelRegistration(regId)` `myTickets()` `pendingPayments()` `toggleSave` `isSaved` `savedOf` `toggleFollow` `isFollowing` `followingOf` `setFollowNotify` `notificationsOf` `markRead` `report(type, id, reason, detail)`
- 主催: `createGroup` `similarGroups(name)` `requestJoin` `decideJoin` `updateGroup` `createInvitation` `leaveGroup` `createEvent(orgId, …)` `updateEvent` `addSlot` `updateSlot` `removeSlot` `addQuestion` `removeQuestion` `publishErrors` `publishEvent` `duplicateEvent` `cancelEvent(id, reason)` `canTransfer(id)` `transferEvent(id, toOrgId)`（支払い済みがあると不可）`attendees(eventId)`（保存期間後は回答なし）`answersDeleteAt` `answersExpired` `checkinLogsOf(eventId)` `cancelledCount` `recentRegistrations(orgId)` `setCheckin(ticketId, status, 'MANUAL')`（owner と NMJ 運営） `checkinByToken(token, eventId)` `checkinSummary` `exportCsv(eventId, includeAnswers)` `announceAudience` `sendAnnouncement` `announcementsOf`
- 運営: `reports({ status })` `resolveReport(id, 'RESOLVED'|'DISMISSED'|'OPEN', resolution)` `reportTargetLabel(report)`
- 表示: `NMT.fmt.card(iso)`（11/8（日）17:30）`md` `wd` `hm` `ymd` `yen` `priceLabel` `ago(iso, db.now())` `days` `localInput` `fromLocalInput`、ラベルは `NMT.LABEL.SlotKind` など、エリアは `NMT.AREAS`
- 失敗はすべて `Error`（日本語のメッセージ）で投げる。画面では try/catch してメッセージをそのまま出す

### ヘッダー／フッターの入れ方

- `<div data-header="default"></div>` … Header（Top 用・高さ100）
- `<div data-header="v2" data-active="home|events|media"></div>` … Header v2（下線タブ＋アバター・高さ74）
- `<div data-header="org" data-active="dashboard|events|settings" data-org="団体名"></div>` … Header Org（黒地・高さ78。`data-org` 省略時は「慶應軽音サークル」）
- `<div data-footer></div>` … Footer v2
- `data-active` を省略したときの既定は v2=`events`、org=`dashboard`。default にタブの選択状態は無い

## トークン（CSS カスタムプロパティ）

- 色: `--color-black / white / ink / surface / line / line-strong / subtle / muted / muted-dark / gray-100 / coral / mint / lavender / pink`
- 書体: `--font-jp`（Noto Sans JP）/ `--font-display`（Anton）/ `--font-mono`（DM Mono）/ `--font-serif`（Instrument Serif・My Tickets のみ）/ `--font-condensed`（Barlow Condensed・Top のイベントパスのみ）
- 余白: `--page-max: 1440px` / `--page-pad: 40px` / `--gap-section: 96px`

## 共通クラス

| 用途 | クラス |
|---|---|
| 幅（1440 中央寄せ・左右40） | `.wrap` |
| セクション（上48・下96） | `.section`／灰背景 `.section--gray`／上余白なし `.section--flush-top`／ピンク背景 `.section--pink` |
| 見出し（英字＋和文＋右リンク） | `.sec-head` > `.sec-head__titles` > `.sec-head__en` `.sec-head__ja`、右に `.link-arrow` |
| 文字スタイル | `.t-display-m` `.t-h2` `.t-h3` `.t-body` `.t-small` `.t-button` `.t-mono-label` `.t-mono-body` `.t-muted` |
| アイコン | `.icon`（20px）／`.icon--14` |
| ボタン | `.btn` ＋ `.btn--black`（白矢印 `icon-arrow-btn-white.svg`）／`.btn--coral`／`.btn--outline`（Figma の「もっと見る」は矢印なし） |
| チップ | `.chip`（選択中 `.is-active`）、並び `.chip-row`、左ラベル `.chip-row__label` |
| ステータス | `.pill` ＋ `.pill--open`（受付中・mint）／`.pill--few`（残りわずか・coral）／`.pill--soldout`（売り切れ） |
| 価格 | `.price`（Anton 24）／無料は `.price.price--free` |
| 検索ボックス | `.searchbox` > `.searchbox__field`（伸びる欄は `--grow`）`.searchbox__label` `.searchbox__value` `.searchbox__input` ＋ `.btn--coral` |
| イベントカード | `.event-grid`（302px×4・gap16）> `.event-card` > `__flyer` `__date` `__title` `__venue` `__org` `__bottom` |
| ジャンルカード | `.genre-grid` > `.genre-card` ＋ `--coral/--mint/--lavender/--pink/--gray/--white` |
| 記事カード | `.article-grid`（3列・gap32）> `.article-card` > `__img` `__cat` `__title` `__meta` |
| 主催者向け帯 | `.cta-band` > `.wrap.cta-band__inner` > `.cta-band__text` ＋ ボタン |
| Top 専用 | `.pass-hero`（イベントパス。`../badge.html` を iframe で埋め込み）、`.top-search` |

## アセット（`assets/`）

- アイコン: `icon-search.svg` `icon-chevron-down.svg` `icon-arrow-up-right.svg`（リンク用）`icon-arrow-btn.svg`（黒・ボタン用）`icon-arrow-btn-white.svg`（白・黒ボタン用）`avatar.svg`
- フライヤー（800×1200 を 4:5 で cover）: `flyer-halloween.jpg` `flyer-morning-run.jpg` `flyer-hackathon.jpg` `flyer-zine-fair.jpg`
- 記事画像（432×288 で cover）: `article-guide.jpg` `article-interview.jpg`（3枚目は `flyer-halloween.jpg` を流用＝Figma と同じ画像）

新しい画像は Figma の `get_design_context` が返す URL を `curl -L` で落として `assets/` に置き、意味の分かる名前を付ける（Figma の一時 URL は残さない）。JPEG が `.png` で返ることがあるので `file` で確かめて拡張子を合わせる。

## 決まり

- 絶対配置は使わない（flex / grid）。例外は Top のイベントパス（1枚絵）とモーダル・DEMO バー。
- 色・書体は直書きせずトークンを使う。ページ群の CSS に入れるのは、その群でしか使わないものだけ。
- レスポンシブ: 幅・余白・見出しは `%`・`vw`・`vh`・`clamp()`・`min()`・`fr` で書き、1440 幅で Figma の px になるようにする（clamp の最大値＝Figma の値）。ブレークポイントは `@media (max-width: 1023px)`（タブレット）と `(max-width: 767px)`（SP）の2つ。表は `.table-scroll` に入れる。1px の線・アイコン・15px 以下の文字は px のまま。
- 画面に出る人名はあだ名と @ユーザーネームだけ。本名・連絡先（申込の回答）は主催者の参加者リストと本人にだけ出す。
- 1タップで戻せる操作（フォロー・保存）は確認を出さない。破壊的操作は `ui.confirm({ danger:true })`（キャンセルが左）。
- `innerHTML` に入れる値は必ず `ui.esc()` を通す。
