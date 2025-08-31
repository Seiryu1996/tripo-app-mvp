# Tripo 3D Model Generator MVP

TripoのAPIを使用してテキストや画像から3Dモデルを生成するWebアプリケーション。

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router)
- **バックエンド**: Next.js API Routes
- **データベース**: TiDB (MySQL互換)
- **ORM**: Prisma
- **認証**: JWT
- **スタイリング**: Tailwind CSS
- **コンテナ化**: Docker

## 機能

### 管理者機能
- ユーザーの作成・編集・削除
- 管理者ダッシュボード

### ユーザー機能
- ログイン認証
- テキストから3Dモデル生成
- 画像から3Dモデル生成
- 生成履歴の確認
- 3Dモデルのダウンロード

## セットアップ

### 1. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、以下の値を設定：

```bash
cp .env.example .env
```

必要な環境変数：
- `DATABASE_URL`: TiDBの接続文字列
- `NEXTAUTH_SECRET`: JWT用のシークレットキー
- `ADMIN_EMAIL`: 初期管理者のメールアドレス
- `ADMIN_PASSWORD`: 初期管理者のパスワード
- `TRIPO_API_KEY`: Tripo APIキー
- `TRIPO_API_URL`: Tripo APIのエンドポイント

### 2. Docker環境での起動

```bash
# アプリケーションのビルドと起動
docker compose build
docker compose up

# バックグラウンドで起動する場合（ログ確認後）
# docker compose up
```

### 3. データベースの初期化

コンテナ起動後、別のターミナルで：

```bash
# Prismaの初期設定
docker compose exec app npm run db:generate
docker compose exec app npm run db:push

# 初期データ（管理者・テストユーザー・サンプルモデル）の投入
docker compose exec app npm run db:seed

# Prisma Studioの起動（データベース確認用）
docker compose exec app npm run db:studio
```

### 4. 初期アカウント情報

シーダー実行後、以下のアカウントが利用可能：

**管理者アカウント:**
- メール: 環境変数`ADMIN_EMAIL`（デフォルト: admin@tripo.com）
- パスワード: 環境変数`ADMIN_PASSWORD`（デフォルト: admin123）

**テストユーザー:**
- user1@tripo.com / user123 (田中太郎)
- user2@tripo.com / user123 (佐藤花子)  
- user3@tripo.com / user123 (鈴木次郎)

## 使用方法

### 管理者
1. `http://localhost:3000/login` でログイン
2. 管理者画面でユーザーの作成・管理
3. 新規ユーザーにメールアドレスとパスワードを共有

### ユーザー
1. `http://localhost:3000/login` でログイン
2. ダッシュボードで新しいモデルを作成
3. テキストまたは画像を入力して3Dモデル生成
4. 生成完了後、3Dモデルをダウンロード

## API エンドポイント

### 認証
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - 認証済みユーザー情報取得

### 管理者
- `GET /api/admin/users` - ユーザー一覧取得
- `POST /api/admin/users` - ユーザー作成
- `PUT /api/admin/users/[id]` - ユーザー更新
- `DELETE /api/admin/users/[id]` - ユーザー削除

### 3Dモデル
- `GET /api/models` - ユーザーのモデル一覧取得
- `POST /api/models` - 新しいモデル生成開始

## データベーススキーマ

### User
- 管理者とユーザーの区別（role: ADMIN/USER）
- パスワードはbcryptでハッシュ化

### Model
- 3Dモデル生成履歴
- テキスト/画像入力の対応
- 生成状況の追跡（PENDING/PROCESSING/COMPLETED/FAILED）
- Tripo APIのタスクIDを保存

## Dockerコマンド

### 基本的な操作

```bash
# アプリケーションのビルド
docker compose build

# コンテナの起動（フォアグラウンド）
docker compose up

# コンテナの起動（指定されていない場合も前提としてフォアグラウンドで実行）
docker compose up

# コンテナの停止
docker compose down

# コンテナの停止（ボリュームも削除）
docker compose down -v

# コンテナの再起動
docker compose restart

# ログの確認
docker compose logs
docker compose logs -f  # リアルタイム監視

# 特定のサービスのログ確認
docker compose logs app
```

### コンテナ内でのコマンド実行

```bash
# コンテナ内でシェルを起動
docker compose exec app /bin/sh

# コンテナ内で単発コマンド実行（データベース関連）
docker compose exec app npm run db:generate
docker compose exec app npm run db:push
docker compose exec app npm run db:seed
docker compose exec app npm run db:reset
docker compose exec app npm run db:studio

# その他の開発コマンド
docker compose exec app npm run lint
docker compose exec app npm install  # 新しいパッケージ追加時
```

### トラブルシューティング

```bash
# キャッシュを無視して完全リビルド
docker compose build --no-cache

# すべてのコンテナ・イメージ・ボリュームの削除（完全クリーンアップ）
docker compose down -v --rmi all

# コンテナの状態確認
docker compose ps
docker compose top

# リソース使用量の確認
docker compose exec app top
```

## 開発時のコマンド（ローカル環境）

```bash
# 依存関係のインストール
npm ci

# 開発サーバーの起動
npm run dev

# データベース関連
npm run db:generate  # Prisma clientの生成
npm run db:push      # スキーマの同期
npm run db:seed      # 初期データ投入
npm run db:reset     # データベースリセット + シード実行
npm run db:studio    # Prisma Studio起動

# リント
npm run lint
```

## 注意事項

- `docker-compose`コマンドではなく`docker compose`を使用
- `-d`オプション（バックグラウンド実行）は使用しない
- 本番環境では適切なセキュリティ設定を行う
- Tripo APIの利用制限に注意
- TiDBの接続制限に注意