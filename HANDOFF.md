# 引き継ぎメモ（新しい Claude アカウント用）

新しいセッションでは、まず「HANDOFF.md と各 README を読んで、続きをやってください」と依頼してください。

## このリポジトリにあるもの

| アプリ | フォルダ | 公開URL（GitHub Pages） |
| --- | --- | --- |
| ワンヘルス・クエスト（仮称） | `onehealth/` | https://ima2daka2mi-sys.github.io/3D-model-generation/onehealth/ |
| VDWC Virtual Gallery | ルート（`index.html`, `src/`） | https://ima2daka2mi-sys.github.io/3D-model-generation/ |

- 作業ブランチ: `claude/3d-space-panel-viewer-om07rl`
- 公開: このブランチに push すると `.github/workflows/pages.yml` が `gh-pages` ブランチへ自動コピーし、GitHub Pages に反映（1〜2分）
- three.js は `vendor/three/` に同梱（ビルド不要の静的サイト）
- ローカル確認: リポジトリ直下で `python3 -m http.server 8000` → http://localhost:8000/onehealth/

## ワンヘルス・クエストの構成

- 元資料: 提案書「ワンヘルスを踏まえた動物愛護理解促進」（`ima2daka2mi-sys-patch-1-animal` ブランチの `animal.pdf`）
- `onehealth/src/content.js` … クイズ・シナリオ文面（ここを直せば文面が変わる）
- `onehealth/src/world.js` … エントランス広場＋3エリア（A 理念 / B 感染症 / C 災害）の配置、当たり判定、ウサギ・小鳥の配置
- `onehealth/src/characters.js` … アバター、犬（柴・ビーグル）、猫、キツネ、牛、ウサギ、小鳥
- `onehealth/src/models.js` … 建物・家具・木など
- `onehealth/src/effects.js` … 空、光の粒、落ち葉、トラブルマークの光の柱、紙吹雪など（ポストエフェクトなし、スマホ向け）
- `onehealth/src/main.js` … 操作（タップ移動・スティック・WASD）、カメラ、クイズ進行、スタンプ、効果音

## これまでの主な要望と対応

- iPhone で動くこと（タッチ操作、ボタンが重ならないレイアウト、軽量設定）
- 犬・猫・キツネ・牛をかわいく、アバターは普通の人間の体型で顔はかわいく
- 犬は首と胴体を一体に（`blob()` で1メッシュ化）
- ウサギ・小鳥を追加

## 未対応・確認待ち

- 実機 iPhone（Safari）での表示・動作確認
- 管理者向け CMS、ログ収集、体験前後アンケート（提案書 8.2）、BGM
- 作品名・正式名称（現在は「ワンヘルス・クエスト（仮称）」）
- 独自に作成したクイズ5問の内容確認（README 参照）

## リポジトリを別の GitHub アカウント／組織へ移す場合

GitHub の Settings → General → Transfer ownership で移すと、公開URLは
`https://<新しい持ち主>.github.io/3D-model-generation/` に変わります。
移動先で Settings → Pages の公開元が `gh-pages` ブランチになっているか確認してください。
