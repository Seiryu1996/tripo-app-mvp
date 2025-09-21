## GCP デプロイ手順（Cloud Run + Workload Identity Federation）

本番デプロイは GitHub Actions から Workload Identity Federation (WIF) を使って Cloud Run へ行います。サービスアカウント JSON キーは利用しません。以下の手順で GCP 側のセットアップと GitHub Secrets の登録を行ってください。

---

### 0. プロジェクト作成から一気に実施する場合（ハンズオン）

角かっこは自分の値に置き換えてください。

```bash
# 任意に変更
export PROJECT_ID="[固有のプロジェクトID: 例 tripo-app-123456]"
export PROJECT_NAME="Tripo App"
export REGION="asia-northeast1"        # 任意リージョン
export REPO_NAME="tripo-app"           # Artifact Registry のリポジトリ名
export SA_NAME="gh-actions-deployer"
export POOL_ID="github-pool"
export PROVIDER_ID="github-provider"
export GH_OWNER="[GitHubのオーナー/組織名]"
export GH_REPO="[GitHubのリポジトリ名]"
export BILLING_ACCOUNT_ID="[請求先アカウントID]"

# 0-1) プロジェクト作成（親組織/フォルダがある場合は --organization / --folder を付与）
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
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="GitHub Actions Deployer" \
  --project="$PROJECT_ID"

# 0-7) サービスアカウントへ必要ロールを付与
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor \
  roles/storage.objectAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE"
done

# 0-8) Workload Identity Pool/Provider を作成
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub OIDC Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"

# 0-9) GitHub リポジトリをサービスアカウントに関連付け
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/attribute.repository/$GH_OWNER/$GH_REPO"

# 0-10) GitHub Secrets へ登録する値を控える
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_REGION=$REGION"
echo "ARTIFACT_REPOSITORY=$REPO_NAME"
echo "CLOUD_RUN_SERVICE=[Cloud Runサービス名 例 tripo-app]"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID"
echo "GCP_SERVICE_ACCOUNT_EMAIL=$SA_EMAIL"

echo "上記値を GitHub リポジトリの Secrets に登録してください"

# 0-11) Cloud Run サービスを初期作成（ダミーイメージで OK）
gcloud run deploy [CLOUD_RUN_SERVICE] \
  --image=us-docker.pkg.dev/cloudrun/container/hello \
  --allow-unauthenticated \
  --region="$REGION" \
  --project="$PROJECT_ID"

# 0-12) Cloud Run 環境変数を設定（アプリで利用する値）
gcloud run services update [CLOUD_RUN_SERVICE] \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --set-env-vars='NEXTAUTH_URL=[本番URL],NEXTAUTH_SECRET=[値],DATABASE_URL=[値],TRIPO_API_KEY=[値],TRIPO_API_URL=https://api.tripo3d.ai/v2/openapi,ADMIN_EMAIL=[値],ADMIN_PASSWORD=[値],GCS_BUCKET_NAME=[GCSバケット名],GCP_PROJECT_ID=[PROJECT_ID],GCP_CLIENT_EMAIL=[サービスアカウントメール],GCP_PRIVATE_KEY=[Secret Manager推奨で管理]'
```

上記設定が完了し、GitHub Secrets を登録すると `main` ブランチへの push で GitHub Actions が Cloud Run へデプロイします。

---

### 1. 既存プロジェクトで確認するチェックリスト

1. 課金アカウントがリンクされている。
2. 必要 API が有効になっている。
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com iam.googleapis.com secretmanager.googleapis.com \
     --project <PROJECT_ID>
   ```
3. Docker 用 Artifact Registry リポジトリが存在する。
4. デプロイ用サービスアカウントに以下ロールが付与されている。
   - `roles/run.admin`
   - `roles/artifactregistry.writer`
   - `roles/iam.serviceAccountUser`
   - `roles/secretmanager.secretAccessor`
   - `roles/storage.objectAdmin`
5. Workload Identity Pool/Provider が作成済みで、対象 GitHub リポジトリが `roles/iam.workloadIdentityUser` としてバインドされている。
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format='value(projectNumber)')
   gcloud iam service-accounts get-iam-policy <SERVICE_ACCOUNT_EMAIL> \
     --project=<PROJECT_ID> \
     --format='yaml(bindings)'
   # principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GH_OWNER}/${GH_REPO}
   # が出力に含まれていることを確認
   ```
6. モデル永続化用の GCS バケット (`GCS_BUCKET_NAME`) が存在し、サービスアカウントに書き込み権限がある。
7. Cloud Run サービスに必要な環境変数が設定されている（`NEXTAUTH_*`, `DATABASE_URL`, `TRIPO_*`, `ADMIN_*`, `GCS_BUCKET_NAME`, `GCP_*` など）。
8. GCS バケットは **非公開**（`allUsers` 等の公開権限を付与しない）で運用し、アクセスはアプリが生成する API 経由で行う。

---

### 2. GitHub Secrets に登録する値

GitHub リポジトリの **Settings → Secrets and variables → Actions** で以下を登録します。

| Secret 名 | 用途 |
| --- | --- |
| `GCP_PROJECT_ID` | GCP プロジェクト ID |
| `GCP_REGION` | Cloud Run リージョン |
| `CLOUD_RUN_SERVICE` | Cloud Run サービス名 |
| `ARTIFACT_REPOSITORY` | Artifact Registry リポジトリ名 |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/.../workloadIdentityPools/.../providers/...` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | GitHub Actions から impersonate するサービスアカウント |
| アプリ用シークレット | `NEXTAUTH_SECRET`, `DATABASE_URL`, `TRIPO_API_KEY`, `ADMIN_*`, `GCS_BUCKET_NAME`, `GCP_PRIVATE_KEY` など |

> `GCP_PRIVATE_KEY` は Secret Manager で管理し、Cloud Run から参照させる方法も推奨です。

---

### 3. Cloud Run 環境変数の更新例

```bash
gcloud run services update <CLOUD_RUN_SERVICE> \
  --project=<PROJECT_ID> \
  --region=<REGION> \
  --set-env-vars \
  NEXTAUTH_URL=<https://your-domain>,\
  NEXTAUTH_SECRET=<ランダムな値>,\
  DATABASE_URL=<TiDB接続文字列>,\
  TRIPO_API_KEY=<Tripo APIキー>,\
  TRIPO_API_URL=https://api.tripo3d.ai/v2/openapi,\
  ADMIN_EMAIL=<初期管理者メール>,\
  ADMIN_PASSWORD=<初期管理者パスワード>,\
  GCS_BUCKET_NAME=<モデル保存用のGCSバケット>,\
  GCP_PROJECT_ID=<PROJECT_ID>,\
  GCP_CLIENT_EMAIL=<サービスアカウントメール>,\
  GCP_PRIVATE_KEY=<サービスアカウントの秘密鍵(Secret Manager推奨)>
```

Secret Manager を利用する場合は Cloud Run の「Variables & Secrets」画面で Secret 参照を設定してください。

---

### 4. デプロイフロー概要

1. `main` ブランチへ push
2. `.github/workflows/deploy.yml` が起動
3. GitHub Actions が WIF で Google Cloud へ認証
4. Docker イメージをビルドして Artifact Registry に push
5. Cloud Run へデプロイ
6. `deploy` ジョブの出力に本番 URL が表示される

以上で WIF を利用した安全なデプロイ準備が完了します。
