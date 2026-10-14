# NMJ HP Direction — 訴求軸・デザイン方向性提案

公開先: https://liofval.github.io/nmj/design-direction/01/

プロジェクト内の入口: https://liofval.github.io/nmj/project.html#hp-wireframe

既存のプロジェクト資料タブから表示する独立したHTML/CSS/JS資料。完成サイトではなく、誰に何を伝えるかを関係者と比較・検討するための提案。

## 内容

HP PURPOSE → TARGET → COMMUNICATION AXIS → KEYWORDS → COLOR → TYPOGRAPHY → VOICE → MOTION → HOME WIREFRAME → DESIGN PRINCIPLES の順。

- 訴求軸A/B/Cの5項目比較と検討用HERO切り替え。選択は一時表示で、採用決定や投票を保存しない。
- 5色を色面・カード・吹き出し・CTAに使用。Neutral 40–45% / Color 55–60%は設計の目安。
- Archivo Black / Montserrat / Latoを候補として実表示。日本語はNoto Sans JPで補完、Helveticaは補助。
- VOICE → CONNECTION → MOVEMENTの短いデモ。停止ボタン、モーション軽減設定、ページ非表示時の停止に対応。
- HOMEの8セクションと役割、既存情報との対応、若者・パートナーの2つのCTA。
- 写真・人物・成果・事例は構成を検討するための領域やサンプル。実績や実在人物の発言として扱わない。

## 既存資料の保持

`docs/hp-wireframe.html` は編集せず維持。提案内のリンクと展開式iframeで原資料を比較できる。既存prototypeは変更しない。前版Design Direction 01は `docs/design-direction/01/previous.html` に保持。

`project.html` の `hp-wireframe` タブIDと公開URLは維持し、表示先をDesign Direction 01へ変更。ほかのタブの表示先・機能は維持。

## ローカル確認

```sh
python3 -m http.server 8000 --directory docs
```

http://localhost:8000/project.html#hp-wireframe を開く。PC 1440pxを基準に、760px以下ではモバイルレイアウト。
