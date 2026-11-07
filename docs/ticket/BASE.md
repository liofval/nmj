# NEXT MOVE TICKETS 静的 HTML の共通基盤

Figma「NMJ Ticket｜PC」(fileKey `M83Df5IlWnEOvGhXWqIeKW` / page `1743:7675`) から起こした PC 1440 幅の静的モック。ビルドなし。

## ファイル

| パス | 中身 |
|---|---|
| `style.css` | トークン（Figma 変数）＋共通部品＋ Top 専用部品 |
| `common.js` | ヘッダー3種・フッターの差し込み（fetch なし。file:// で直接開いて動く） |
| `index.html` | 01 Top（見本として読むとよい） |
| `assets/` | Figma から落とした画像・SVG。全ページ同階層なので `assets/xxx` で参照 |

## ページのファイル名（ナビのリンク先もこれ）

| 画面 | ファイル | ヘッダー |
|---|---|---|
| 01 Top | `index.html` | `default` |
| 02 Events カード | `events.html` | `v2` active=events |
| 02 Events リスト | `events-list.html` | `v2` active=events |
| 03 Calendar | `calendar.html` | `v2`（Figma 1771:10220） |
| 06 Media | `media.html` | `v2` active=media |
| 07 Article | `article.html` | `v2` active=media |
| 08 Organizer | `organizer.html` | `v2`（Figma 1773:10376。高さ71でタブ違いの可能性あり、着手時に instance を確認） |
| 12 My page | `mypage.html` | `v2`（Figma 1773:10547。高さ71、同上） |
| 14 Dashboard | `dashboard.html` | `org` active=dashboard（Figma 1774:10538） |
| 17 Event create | `event-create.html` | `org`（Figma 1775:10554） |

存在しないページ（イベント詳細・ガイド・ニュース・カテゴリ・規約など）へのリンクは `#`。リンク先の対応表は `common.js` 冒頭の `PAGES`。

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
<script src="common.js" defer></script>
</head>
<body>
<div data-header="v2" data-active="events"></div>
<main>
  <section class="wrap section"> … </section>
</main>
<div data-footer></div>
</body>
</html>
```

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

- 絶対配置は使わない（flex / grid）。例外は Top のイベントパス（1枚絵）だけ。
- 色・書体は直書きせずトークンを使う。ページ固有のスタイルは、そのページでしか使わないものだけ `style.css` 末尾にページ名のコメントを付けて足す。
- SP 対応は対象外。狭い幅でも横スクロールが出ないことだけ守る（巨大文字は親で `overflow:hidden`）。
