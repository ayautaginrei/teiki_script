# teiki_script
定期用スクリプト倉庫。下記を了承出来る人のみ使用可です。
- ほぼAI製
- 自分用を一部公開しているだけなので不具合対応は基本的にしません
- フィードバックは聞かなかったことにする可能性が高いです

### [メトポリスキルマネージャー](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/%E3%83%A1%E3%83%88%E3%83%9D%E3%83%AA%E3%82%B9%E3%82%AD%E3%83%AB%E3%83%9E%E3%83%8D%E3%83%BC%E3%82%B8%E3%83%A3%E3%83%BC.user.js)
スキルとステータス設定画面に機能を追加する拡張。
- スキルページで選択したスキルのプレビューが表示されるように
- ドラッグ＆ドロップでスキルの順番が入れ替えできるように
- スキルセット管理パネルを追加し、セリフやカットインURLを含めたスキルセット全体を保存できるように（バックアップとしてJSON形式で入出力ができます）

### [メトポリスキル詳細表示](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/%E3%83%A1%E3%83%88%E3%83%9D%E3%83%AA%E3%82%B9%E3%82%AD%E3%83%AB%E8%A9%B3%E7%B4%B0%E8%A1%A8%E7%A4%BA.user.js)
これ何のスキル？をツールチップで表示できるようにする拡張。
- あらゆるページでスキル名にツールチップを追加、マウスホバーで詳細を表示する拡張
- 基本情報と習得条件を表示します

### [BetterMetropolisCalling](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/BetterMetropolisCalling.user.js)
あらゆるUIに手を加えてなんか良くなった感じに見せる拡張。
- 全体的にCSSを追加
- ストーリーページの表示を改善（出撃先選択プルダウンの改善、選択人数表示、アイコンをクリックしてもチェックできるように）
- ~~スキルページで選択したスキルのプレビューが表示されるように~~ →メトポリスキルマネージャーへ移動
- キャラリストページでページャーをリスト上部にも表示

### [Stroll Green GFRe アイテム設定フロートメニュー](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/Stroll%20Green%20GFRe%20%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0%E8%A8%AD%E5%AE%9A%E3%83%95%E3%83%AD%E3%83%BC%E3%83%88%E3%83%A1%E3%83%8B%E3%83%A5%E3%83%BC.user.js)
アイテム操作をするのにいちいちhomeキーを押さずに済む拡張。
- 画面右側にアイテム設定画面のサブメニューをフロート化して表示
- 一部確認ポップアップの調整

### [Better Stroll Green GFRe](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/Better%20Stroll%20Green%20GFRe.user.js)
あらゆるUIに手を加えてなんか良くなった感じに見せる拡張。
- マップ移動欄に忌避と誘引の数値を表示（アイテム設定ページで取得する必要あり・一括移動非対応）
- 連れ出しキャラクターリストのステータス合計を計算し、表示色を変える機能（閾値と色を設定可）
- 花壇の管理をプルダウンからトグルボタンに
- 全体マップの探索リストを自動的に折りたたむ
- ~~アイテム操作ページにアイテム一括選択ボタンを追加　同名アイテムをワンクリックで選択可能に~~ 公式対応につき削除
- 一括選択機能の強化（アイコンクリックで個別選択・チェックボックスクリックで一括選択と使い分けられるように、また不要な確認ポップアップを排除）

### [ニワGFRe戦闘解析](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/%E3%83%8B%E3%83%AFGFRe%E6%88%A6%E9%97%98%E8%A7%A3%E6%9E%90.user.js)
戦闘ログを解析し集計する拡張。（⚠️11/12のアップデートで一部動作不可に 現状修正予定なし）
- ブラウザ表示幅に余裕がある際、リソースを動的に表示するウィンドウを追加
- ⚠️各種行動・リソース変化・状態異常などの様子をログ末尾に集計して表示

### [ニワGFRe マッピングヘルパー](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/%E3%83%8B%E3%83%AFGFRe%20%E3%83%9E%E3%83%83%E3%83%94%E3%83%B3%E3%82%B0%E3%83%98%E3%83%AB%E3%83%91%E3%83%BC.user.js)
特定の様式でマッピングするのを手助けする拡張。
- 各種行動＞マップ移動から、メンバーを非表示の右隣にできたボタンをクリックしてコピー
- コピーした文字列を、スプレッドシート内のコピー時に指示された場所に貼り付けするとマッピングできる

### [BO5アーケードヘルパー](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/BO5/BO5%E3%82%A2%E3%83%BC%E3%82%B1%E3%83%BC%E3%83%89%E3%83%98%E3%83%AB%E3%83%91%E3%83%BC.user.js)
アーケード登山を少しだけ楽にする拡張。
- 前回の挑戦記録を取得、BET額と選んだ武器設定を引き継ぎワンクリックで再挑戦（前回の挑戦記録が残っている時）
- 挑戦開始画面にMAX BETボタンを作成（前回の挑戦記録が残っていない時）
- ポンマスアイコンをクリックした際自動で戦闘設定選択

### [北アザブクマ拡張](https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/kitama/%E5%8C%97%E3%82%A2%E3%82%B6%E3%83%96%E3%82%AF%E3%83%9E%E6%8B%A1%E5%BC%B5.user.js)
ブクマを整頓する拡張。おまけでステータスウィンドウを開閉する機能付き。
- ブックマーク内の項目にハンドルをつけてドラッグ&ドロップで並び替え
- 項目を右クリックで色変更
- 未読マークをミュートするためのチェックボックス追加
- ACTIVITYページ内の現在エリアやステータスが記載されたウィンドウを開閉できる
