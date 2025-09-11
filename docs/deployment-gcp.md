## GCP デプロイ手順（Cloud Run）

### 0. プロジェクト新規作成から（最短ハンズオン）

以下は CLI を使って「プロジェクト作成 → 課金リンク → API 有効化 → レジストリ/サービスアカウント → WIF 設定 → GitHub 側設定」までを一気通貫で行う手順です。角かっこは自分の値に置き換えてください。

```bash
# 任意に変更
export PROJECT_ID="[一意なプロジェクトID: 例 tripo-app-123456]"
export PROJECT_NAME="Tripo App"
export REGION="asia-northeast1"     # 任意リージョン
export REPO_NAME="tripo-app"        # Artifact Registryのリポジトリ名
export SA_NAME="gh-actions-deployer"
export POOL_ID="github-pool"
export PROVIDER_ID="github-provider"
export GH_OWNER="[GitHubのオーナー/組織名]"
export GH_REPO="[GitHubのリポジトリ名]"
export BILLING_ACCOUNT_ID="[請求先アカウントID]"

# 0-1) プロジェクト作成（親の組織/フォルダがある場合は --organization / --folder を付与）
gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"

# 0-2) 課金アカウントをリンク
gcloud beta billing projects link "$PROJECT_ID" \
  --billing-account="$BILLING_ACCOUNT_ID"

# 0-3) デフォルトプロジェクト設定
gcloud config set project "$PROJECT_ID"

# 0-4) 必要 API を有効化
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com iam.googleapis.com secretmanager.googleapis.com

# 0-5) Artifact Registry（Docker）を作成
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID"

# 0-6) デプロイ用サービスアカウントを作成
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="GitHub Actions Deployer" \
  --project="$PROJECT_ID"

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# 0-7) 必要ロールを付与
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE"
done

# 0-8) Workload Identity Federation（WIF）を作成
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" --location="global" \
  --display-name="GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub OIDC Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"

# 0-9) GitHub リポジトリを WIF 経由で SA に関連付け
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/attribute.repository/$GH_OWNER/$GH_REPO"

# 0-10) GitHub Secrets に設定する値（控えておく）
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID"
echo "GCP_SERVICE_ACCOUNT_EMAIL=$SA_EMAIL"
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_REGION=$REGION"
echo "ARTIFACT_REPOSITORY=$REPO_NAME"
echo "CLOUD_RUN_SERVICE=[作成するCloud Runサービス名 例 tripo-app]"

# 0-11) 初回の Cloud Run サービス作成（任意：環境変数・公開設定などを先に用意する場合）
# ここではダミーイメージでサービスだけ先に作っておく例（後でActionsから上書きデプロイ）
gcloud run deploy [CLOUD_RUN_SERVICE] \
  --image=us-docker.pkg.dev/cloudrun/container/hello \
  --allow-unauthenticated \
  --region="$REGION" \
  --project="$PROJECT_ID"

# 0-12) Cloud Run の環境変数を設定（必要に応じて）
gcloud run services update [CLOUD_RUN_SERVICE] \
  --project="$PROJECT_ID" --region="$REGION" \
  --set-env-vars=NEXTAUTH_URL=[本番URL],NEXTAUTH_SECRET=[値],DATABASE_URL=[値],TRIPO_API_KEY=[値],TRIPO_API_URL=https://api.tripo3d.ai/v2/openapi,ADMIN_EMAIL=[値],ADMIN_PASSWORD=[値]

# 以降は GitHub リポジトリ側で Secrets を登録し、`main` へ push すると自動デプロイが走ります。
```


本プロジェクトは GitHub Actions から `main` ブランチへ push された際に Google Cloud Run へ自動デプロイできます。以下の手順で必要な設定を行ってください。

### 1. 事前準備（GCP 側）

- プロジェクトを作成（または既存を使用）し、プロジェクト ID を控える。
- 有効化する API：
  - Cloud Run API
  - Artifact Registry API
  - Cloud Build API
  - IAM API
  - Secret Manager API（機密情報を使う場合に推奨）

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com iam.googleapis.com secretmanager.googleapis.com \
  --project <PROJECT_ID>
```

- Artifact Registry リポジトリを作成（例：`tripo-app`）。

```bash
gcloud artifacts repositories create tripo-app \
  --repository-format=docker \
  --location=<REGION> \
  --project=<PROJECT_ID>
```

- 課金アカウントをリンク（Cloud Run/Artifact Registry 利用に必須）：

```bash
gcloud beta billing projects link <PROJECT_ID> \
  --billing-account=<BILLING_ACCOUNT_ID>
```

- 自分（実行ユーザー）に API 有効化権限を付与（必要に応じて）：

```bash
# いずれか（プロジェクトの権限がある管理者が実行）
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="user:<YOUR_GOOGLE_ACCOUNT_EMAIL>" \
  --role="roles/serviceusage.serviceUsageAdmin"

# もしくはプロジェクトのオーナー（強い権限）
# gcloud projects add-iam-policy-binding <PROJECT_ID> \
#   --member="user:<YOUR_GOOGLE_ACCOUNT_EMAIL>" \
#   --role="roles/owner"
```

権限不足で `AUTH_PERMISSION_DENIED` が出る場合は、上記のいずれかのロールが不足しています。組織/プロジェクト管理者に付与を依頼してください。

### 2. 認証方式の選択

推奨は GitHub Actions からの Workload Identity Federation（WIF）です。従来のサービスアカウント JSON キーでも動作します。

#### A) Workload Identity Federation（推奨）
1. Workload Identity Pool/Provider を作成し、GitHub からのトラストを構成。
2. Cloud Run デプロイ権限を持つサービスアカウントを作成（例：`gh-actions-deployer@<PROJECT_ID>.iam.gserviceaccount.com`）。
3. そのサービスアカウントを Provider にバインド。

参考：
https://github.com/google-github-actions/auth#setting-up-workload-identity-federation

GitHub リポジトリに以下の Secrets を登録：
- `GCP_PROJECT_ID`：GCP のプロジェクト ID
- `GCP_REGION`：デプロイ先リージョン（例：`asia-northeast1`）
- `CLOUD_RUN_SERVICE`：Cloud Run サービス名（例：`tripo-app`）
- `ARTIFACT_REPOSITORY`：Artifact Registry のリポジトリ名（例：`tripo-app`）
- `GCP_WORKLOAD_IDENTITY_PROVIDER`：`projects/…/locations/global/workloadIdentityPools/…/providers/…`
- `GCP_SERVICE_ACCOUNT_EMAIL`：`gh-actions-deployer@<PROJECT_ID>.iam.gserviceaccount.com`

#### B) サービスアカウント JSON キー
上記の代わりに、JSON キーを `GCP_SA_KEY` として登録すれば動作します（セキュリティ観点では WIF を推奨）。

#### 権限セットアップ（WIF/SA 共通）

デプロイ用サービスアカウントに最低限の権限を付与します：

```bash
# デプロイ用 SA を作成（任意名）
gcloud iam service-accounts create gh-actions-deployer \
  --project=<PROJECT_ID> \
  --display-name="GitHub Actions Deployer"

# 付与するロール（最小限）
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding <PROJECT_ID> \
    --member="serviceAccount:gh-actions-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role="$ROLE"
done
```

WIF の場合は、GitHub からのプリンシパルを SA にバインドします（例）：

```bash
# GitHub リポジトリ (org/repo) からのフェデレーションを許可
gcloud iam service-accounts add-iam-policy-binding \
  gh-actions-deployer@<PROJECT_ID>.iam.gserviceaccount.com \
  --project=<PROJECT_ID> \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/attribute.repository/<GITHUB_OWNER>/<REPO_NAME>"
```

Workload Identity Pool/Provider の作成コマンドは組織ごとに異なるため、公式手順を参照してください。

### 3. アプリケーション設定（環境変数）

本アプリは以下の環境変数を使用します。Cloud Run の「変数とシークレット」機能、または Secret Manager と連携して安全に設定してください。
- `DATABASE_URL`
- `NEXTAUTH_URL`（例：`https://<SERVICE>-<HASH>-<REGION>.a.run.app`）
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `TRIPO_API_KEY`
- `TRIPO_API_URL`

初回はコンソールから Cloud Run サービスを作成し、上記を設定しておくか、`gcloud run services update` で設定できます。

例（Secret Manager を使用しない場合の直接設定）：
```bash
gcloud run services update <SERVICE> \
  --project=<PROJECT_ID> --region=<REGION> \
  --set-env-vars=NEXTAUTH_URL=<URL>,NEXTAUTH_SECRET=<SECRET>,DATABASE_URL=<DB_URL>,TRIPO_API_KEY=<KEY>,TRIPO_API_URL=<API>,ADMIN_EMAIL=<MAIL>,ADMIN_PASSWORD=<PASS>
```

セキュリティ推奨：Secret Manager を使い、`--set-secrets` で紐付ける運用を推奨します。

### 4. GitHub Actions の挙動

- 既に `develop` ブランチへの push でテストが走ります（`.github/workflows/app.yml`）。
- 追加した `deploy.yml` により、`main` ブランチへの push で以下を実行します：
  1. GCP 認証（WIF または SA キー）
  2. `Dockerfile.production` でコンテナビルド
  3. Artifact Registry へ push
  4. Cloud Run へデプロイ（`--allow-unauthenticated`）

ファイル: `.github/workflows/deploy.yml`

必要な GitHub Secrets:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `CLOUD_RUN_SERVICE`
- `ARTIFACT_REPOSITORY`
- いずれか一方
  - `GCP_WORKLOAD_IDENTITY_PROVIDER` と `GCP_SERVICE_ACCOUNT_EMAIL`
  - または `GCP_SA_KEY`

（任意）GitHub Secrets としてアプリの環境変数も登録し、`deploy.yml` の `env_vars` に渡すことも可能です。

### 4.5 よくある権限エラーの対処

- `AUTH_PERMISSION_DENIED`（API 有効化に失敗）
  - 対象プロジェクト ID の誤り、または `roles/serviceusage.serviceUsageAdmin`（またはオーナー）不足
  - 組織ポリシーで API 有効化が禁止されている
- `Permission denied to access Artifact Registry`
  - デプロイ SA に `roles/artifactregistry.writer` が不足
- `Cloud Run deploy failed: permission denied`
  - デプロイ SA に `roles/run.admin` または `roles/iam.serviceAccountUser` が不足

### 5. ローカルでの動作確認（任意）

`Dockerfile.production` を使用してローカルで本番相当の動作を確認できます。

```bash
docker build -f Dockerfile.production -t tripo-app:prod .
docker run --rm -p 8080:8080 \
  -e NEXTAUTH_URL=http://localhost:8080 \
  -e NEXTAUTH_SECRET=devsecret \
  -e DATABASE_URL=... \
  -e TRIPO_API_KEY=... \
  -e TRIPO_API_URL=https://api.tripo3d.ai/v2/openapi \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=admin123 \
  tripo-app:prod
```

### 6. データベース・マイグレーション

Prisma のマイグレーション適用は運用設計に合わせて行ってください。
- 簡易運用：デプロイ後に手動で `prisma migrate deploy` を実行
- 発展運用：デプロイ時に Cloud Run Job を用意し、リリースパイプライン内で実行

### 7. トラブルシュート

- ビルド失敗：Artifact Registry/Cloud Build の API 有効化、権限、`Dockerfile.production` の依存関係を確認
- デプロイ失敗：Cloud Run のサービスアカウント権限、リージョン、サービス名、環境変数の不足を確認
- 実行時エラー：`DATABASE_URL` 等の環境変数・ネットワーク到達性（TiDB など）・`NEXTAUTH_URL` を確認

---

補足：プロジェクト「名」と「ID」は異なります。`gcloud` コマンドでは必ず一意なプロジェクト ID（例：`tripo-app-123456`）を指定してください。
