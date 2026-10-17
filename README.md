# RIFT // SALVAGE

iPhone Safari 向けの独立したオリジナルSFターン制脱出ローグライク（開発版）。

## ブラウザで遊ぶ

GitHub Pages の公開後は https://souten-yd.github.io/RIFT-SALVAGE/ から起動できます。

このリポジトリは静的サイトです。アプリのメイン画面は `index.html` で、ゲームコード・CSSはHTML内、戦闘用画像は `assets/v1/` にあります。サーバでビルドや実行を行う必要はありません。

- 任務を選択して「出撃する」
- マップをタップして移動、射撃・リロード・治療
- 目標端末と物資を回収して、脱出地点へ戻って撤収
- 帰還後、母艦で装備と永続強化を管理
- Safariの「共有」→「ホーム画面に追加」でアプリのように起動

v0.5 MINING REBUILD。iPhone実機での60fpsは未計測です。

## ライセンスと権利

Quasimorphの公式移植ではありません。ゲームのソース・アセットは本作独自の試作物です。第三者のゲームデータや公式素材は収録していません。

## 配布・検証

GitHub Pagesの公開方式はGitHub Actionsです。`.github/workflows/pages.yml` が `python3 tests/package.py` でHTMLと必要な画像・manifestを `_site` に梱包します。`index.html` だけをコピーすると新画像が欠落します。

開発はPRを基本とし、mainのファイルと実際の挙動を検証してからマージします。

## グラフィック刷新の仕様と検証

- [画像準拠の戦闘画面・素材・パフォーマンス実装仕様](docs/VISUAL_REBUILD_SPEC.md)
- [Codex向け実装指示・検収チェックリスト](docs/CODEX_VISUAL_REBUILD_INSTRUCTIONS.md)

この2文書は検収基準です。実装済みの範囲と未確認・残課題は [実装検証レポート](docs/VISUAL_REBUILD_REPORT.md) に記載しています。

通常キャンペーンは従来のセーブを継続します。母艦の「採掘施設の検証用任務へ」から `?showcase=1` の独立した任務を試せます。検証任務は通常の資金・装備を変更しません。

開発検証: `npm ci` → `npx playwright install chromium` → `npm test`。ローカル確認は `python3 -m http.server 8000`。性能測定は `npm run bench`（HIGH/ECO各60秒）。詳細は [アセット説明](assets/v1/README.md)。
