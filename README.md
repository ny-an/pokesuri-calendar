# ポケスリカレンダー

シンプルで使いやすい表示専用のカレンダーアプリケーションです。
ポケスリイベントの情報だけを月表示カレンダーで確認できます。

## デモ

[GitHub Pages でのデモ](https://your-username.github.io/your-repository-name/)

## 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **スタイル**: SCSS
- **カレンダーライブラリ**: FullCalendar v6
- **ホスティング**: GitHub Pages対応

## プロジェクト構成

```
.
├── index.html         # メインHTMLファイル
├── css/
│   └── style.css      # コンパイル済みCSSファイル
├── scss/
│   └── style.scss     # SCSSソースファイル
├── js/
│   └── main.js        # メインJavaScriptファイル
├── data/
│   └── events.json    # イベントデータ
└── README.md          # このファイル
```

## イベントデータの編集

`data/events.json` ファイルを編集することで、表示するイベントを変更できます。

### イベントデータの形式

```json
{
  "id": "1",
  "title": "イベント名",
  "start": "2024-12-15T10:00:00",
  "end": "2024-12-15T12:00:00",
  "allDay": false,
  "location": "開催場所",
  "description": "イベントの詳細説明",
  "organizer": "主催者名",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
```

### フィールドの説明

- `id`: イベントの一意識別子（文字列）
- `title`: イベントのタイトル（必須）
- `start`: 開始日時（ISO 8601形式）
- `end`: 終了日時（ISO 8601形式、省略可能）
- `allDay`: 終日イベントかどうか（boolean）
- `location`: 開催場所
- `description`: イベントの詳細説明（改行は `\n` で表現）
- `organizer`: 主催者名
- `tags`: イベントに関連するタグの配列

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。

## 作者

[がおがおぷーん](https://x.com/gaogaoPuuun)

---

## 更新履歴

### v1.0.0 (2024-12-XX)
- 初回リリース
- 基本的なカレンダー表示機能
- イベント詳細モーダル
- レスポンシブ対応

