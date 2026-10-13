# トンマナ提案 01 — OPEN ENERGY

NEXT MOVE JAPAN の比較検討用デザインプロトタイプ。既存プロトタイプとは独立した HTML / CSS / JavaScript で実装。

- 公開先: https://liofval.github.io/nmj/design-direction/01/
- 初期画面: HOME SAMPLE
- 上部ナビゲーション: HOME / CONCEPT / COLOR / TYPE / UI / EVENT DETAIL
- 直接リンク: `#home` / `#concept` / `#palette` / `#type` / `#ui` / `#event`
- PC基準: 1440px。760px以下でモバイルレイアウトに切り替え。
- フォント: Noto Sans JP / Barlow Condensed（Google Fonts）。読み込み不可の場合もフォールバックで表示。
- グラフィック: CSSとインラインSVG。ビルド・画像生成・外部JS依存なし。
- PROJECT / PEOPLEを押すとサンプル説明を表示。申し込み・共創相談は送信のないダイアログ。保存操作は画面内のみ。
- EVENT / PROJECT / PEOPLEの掲載内容・日時・会場は架空のサンプル。

ローカル確認:

```sh
python3 -m http.server 8000 --directory docs
```

http://localhost:8000/design-direction/01/ を開く。

## デザインの意図

白・オフホワイトと黒を土台に、青は行動、黄は熱量、紫は共創、水色は接点、オレンジは小さな注目マークに使用。大きな欧文・力強い日本語・直線的な色面・余白で、若者のエネルギーと社会に対する信頼を両立。

参考: https://corporate.iiba.space/career 。タイポグラフィ、色面、余白、シンプルなUIを参考に、NMJ向けに独自構成。
