# Wireframe → Design Direction 01

## 参照元を先に保持

着手時の最新mainは `d8f5011`。`project.html#hp-wireframe` はDesign Direction 01と同じHTMLを表示していたため、その資料を `docs/hp-direction/index.html` に独立して保持し、タブを同ファイルへ接続し直した。提案内容・HOMEワイヤー・既存CSS/JSは保持し、相対リンクだけ所在に合わせて補正。

再設計の参照元は同資料内 `.home-preview`。Design Direction側の提案資料10章をそのままサイトのレイアウトに使わず、HOMEの8セクションだけを先に反映した。

## 維持した構造

| Order | Section ID | Heading |
| --- | --- | --- |
| 01 | wf-hero | 若者の熱狂が、社会を動かす。 |
| 02 | wf-about | 違う立場が、同じ未来を動かす。 |
| 03 | wf-voices | 最初の一歩は、こんな声から。 |
| 04 | wf-projects | PROJECTS IN MOTION. |
| 05 | wf-events | YOUR NEXT CHANCE. |
| 06 | wf-people | PEOPLE MAKE THE MOVE. |
| 07 | wf-stories | BEHIND THE MOVE. |
| 08 | wf-join | 次のMOVEに、あなたも混ざろう。 |

ヘッダーのABOUT / PROJECT / EVENT / PEOPLE・MEDIA、本文、カード2件、イベント情報、人物と言葉、ストーリー、若者とパートナーの2CTAを維持。ブラウザでセクションID・順序・見出し・本文を参照元と照合。

## 視覚と操作への反映

- HERO: 見出しと短い定義を先に置く。対話写真と黄色の斜め色面、オレンジのVOICEと大きなMOVE。
- ABOUT: 白地＋部分的な紫の色面。関係性を示す大きな×。
- VOICES: 黒地に水色の横長VOICEと青の短いVOICE。順に横から出現。
- PROJECTS: 同じ黄色のラベルを両カードに使用。活動写真と罫線中心の構成。色をカードごとに変えない。
- EVENTS: 黄色は左側の約31%の色面。情報とメディア導線は白地に整理。
- PEOPLE: 写真背面の紫、言葉の起点のオレンジ。STORIESは黒＋水色＋写真。
- JOIN: オレンジの部分色面と重要CTA。若者CTAはEVENTSへ、パートナーCTAは送信を伴わないサンプルダイアログ。

追加したのは写真・装飾・比較用ツールバーと操作のみ。HOMEに新たなコンテンツセクションは追加しない。検討用コピー・写真の注記は保持または事実に合わせて補正。

## 保存した資料

- `docs/hp-direction/index.html`: 最新の参照ワイヤーフレームと方向性資料
- `discussion.html`: 改修前の訴求軸・デザイン提案資料
- `previous.html`: 前版OPEN ENERGY
- `docs/hp-wireframe.html`: 元のHPワイヤーフレーム v0.1、未変更
- `docs/prototype.html`: 既存メディアprototype、未変更
