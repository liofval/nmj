# Design Direction 01 — YOUTH / ENERGY / MOVEMENT / VOICE

公開先: https://liofval.github.io/nmj/design-direction/01/

参照ワイヤー: https://liofval.github.io/nmj/project.html#hp-wireframe

参照元のHOME8セクションを先に反映し、独立した `home.css` / `home.js` で再設計。情報構造・順序・見出し・本文を維持。構造とデザインの対応は [STRUCTURE.md](STRUCTURE.md)。

OrangeはEnergy / Action / Move、Neutralは整理の土台。Yellow / Blue / Cyan / Lavenderは部分色面やVOICE・写真の背面に使用。一セクションは原則2色＋Neutral、写真に存在する色は別扱い。

写真は検討用イメージ、実際のNMJ活動ではない。ローカル画像と出典は `assets/`。VOICEの順次出現・写真と色面の控えめなスクロール追従・写真cropとカードhover・CTAの矢印を実装。停止とモーション軽減設定に対応。

## 資料の分離と保存

- `docs/hp-direction/index.html`: 最新参照ワイヤー。プロジェクトのHPタブから表示。
- `discussion.html`: 訴求軸・デザイン方向性の比較資料。
- `previous.html`: 前版OPEN ENERGY（元のstyle.css / script.jsを使用）。
- `docs/hp-wireframe.html`・`docs/prototype.html`: 既存資料、未変更。

## 操作

A / B / CでワイヤーにあったHEROコピーを比較。色はコピー切り替え時も役割を維持。若者CTAはEVENTSへ、企業・行政・地域CTAは送信を伴わない説明ダイアログ。イベントからメディアワイヤーへ移動できる。

## 確認

```sh
python3 -m http.server 8000 --directory docs
```

http://localhost:8000/design-direction/01/ と http://localhost:8000/project.html#hp-wireframe を比較。
