# Plano de deploy — teste-voto na Google Cloud (GCP)

Objetivo: publicar o teste-voto na GCP com custo ~zero (free tier), dados
desacoplados do deploy, acesso privado por allow-list de e-mails no início e
abertura pública por uma variável. Infra gerenciada com Terraform em `infra/`.

## 1. Arquitetura alvo

```
┌─────────────────────┐         ┌──────────────────────────────────────────┐
│  máquina local      │         │  GCP (projeto único)                     │
│                     │         │                                          │
│  npm run ingest     │         │  ┌─────────────┐    mount GCS (FUSE)     │
│  npm run sync:*     │         │  │ GCS bucket  │───────────┐             │
│       │             │  PUT    │  │  tse.db     │           │ /mnt/tse-data
│       ▼             │ ──────► │  │  photos/**  │           ▼             │
│  npm run            │  gcloud │  └─────────────┘   ┌───────────────────┐  │
│   publish:data      │         │                    │ Cloud Run (1 svc) │  │
└─────────────────────┘         │                    │  entrypoint:      │  │
                                │                    │  copia p/ $DATA_DIR│  │
                                │  ┌──────────────┐  │  node server/…    │  │
                                │  │ Artifact Reg.│─►│  :8080            │  │
                                │  │ (imagem)     │  │  ├ /api/*  (SQLite)│  │
                                │  └──────────────┘  │  ├ /photos/*       │  │
                                │                    │  └ /* (dist/ SPA)  │  │
                                │                    └─────────▲─────────┘  │
                                │                              │            │
                                │                    IAP (fase privada)     │
                                │                    allow-list de e-mails  │
                                └──────────────────────────────────────────┘
```

Decisões-chave:

- **Um único serviço Cloud Run** serve app (build do Vite em `dist/`), API e
  fotos. Zero CORS, zero LB (que custaria ~US$18/mês), escala a zero.
- **Dados no GCS, fora da imagem**: o bucket é montado no container via
  *Cloud Storage volume mount* (FUSE, gen2 — suportado no
  `google_cloud_run_v2_service`). No startup, um entrypoint copia
  `tse.db` + `photos/` para o disco local do container antes de subir o Node.
  - Por que copiar em vez de ler o SQLite direto do FUSE: SQLite exige
    semântica de lock/mmap que o FUSE não garante. São 1,6 MB de banco e
    8,7 MB de fotos — a cópia leva < 2 s no cold start.
- **IAP direto no Cloud Run** (GA, sem custo, sem load balancer) para a fase
  privada; a abertura pública é `public_access = true` + `terraform apply`.
- **`content/editorial/` vai dentro da imagem** (é conteúdo versionado no
  repositório, não dado do TSE). Mudança editorial = novo deploy; mudança de
  dados = `npm run publish:data`. Separação limpa.
- **Sem novas dependências npm**: o upload usa `gcloud storage` via
  `node:child_process` (conforme AGENTS.md: backend só com padrão do Node).

## 2. Pré-requisitos (uma vez)

1. Projeto GCP com billing ativado (obrigatório mesmo no free tier).
2. `gcloud` CLI autenticado: `gcloud auth login` e
   `gcloud auth application-default login`.
3. Terraform >= 1.6 instalado localmente.
4. Conta com `roles/owner` (ou Editor + IAM Admin) no projeto.
5. **Passo manual do IAP** (projetos sem organização Google): a primeira
   ativação do IAP exige configurar a tela de consentimento OAuth pelo Console
   — não é automatizável via Terraform. Caminho: Console → Cloud Run →
   serviço → Security → habilitar IAP uma vez (pode desabilitar depois; o
   Terraform reassume). Detalhes:
   <https://cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run>

## 3. Etapa 1 — publicação de dados (local → GCS)

### Script novo: `scripts/publish-data.ts` (+ `npm run publish:data`)

Fluxo:

1. (Opcional, flag `--ingest`) roda o pipeline completo antes:
   `npm run ingest && npm run sync:incumbents && npm run sync:parliament &&
   npm run sync:history`.
2. **Checkpoint do WAL**: abre `data/tse.db` e executa
   `PRAGMA wal_checkpoint(TRUNCATE)` — o repositório usa WAL
   (`repository.ts`), e o upload deve levar um único arquivo consistente.
3. Gera `data/manifest.json` com `publishedAt`, sha256 do `tse.db`, contagem
   de fotos e a eleição corrente — mantém a regra de proveniência do projeto.
4. Upload via `gcloud storage` (autenticação do usuário local):
   - `gcloud storage cp data/tse.db gs://<bucket>/tse.db`
   - `gcloud storage cp data/manifest.json gs://<bucket>/manifest.json`
   - `gcloud storage rsync data/photos gs://<bucket>/photos --recursive`
   - **Nunca** enviar `data/download/` (110 MB de zips brutos) nem
     `data/camara/` (intermediário de ingestão) — só o que o runtime lê.
5. (Flag `--reload`) força o Cloud Run a reler os dados criando uma nova
   revisão sem trocar a imagem:
   `gcloud run services update <svc> --region <r> --update-env-vars DATA_VERSION=<timestamp>`.

Leitura do bucket: variável `GCS_BUCKET` (documentar em `.env.example`).

## 4. Etapa 2 — container e Cloud Run

### Mudança pequena no `server/index.ts`

Hoje o servidor só fala `/api/*` e `/photos/*`; o app é servido pelo Vite.
Em produção o mesmo processo passa a servir `dist/`:

- Se `SERVE_STATIC=true` (setado no container), servir arquivos de `dist/`
  com fallback para `index.html` (SPA) nas rotas desconhecidas.
- Comportamento de dev inalterado (Vite continua no proxy).

### `Dockerfile` (multi-stage, na raiz)

```dockerfile
# build do frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build   # gera dist/

# runtime: servidor é 100% stdlib (node:http + node:sqlite) — sem node_modules
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY src ./src
COPY content ./content
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
ENV PORT=8080 SERVE_STATIC=true DATA_DIR=/app/data
EXPOSE 8080
CMD ["./docker-entrypoint.sh"]
```

### `docker-entrypoint.sh`

```sh
#!/bin/sh
set -eu
mkdir -p "$DATA_DIR"
cp /mnt/tse-data/tse.db "$DATA_DIR/tse.db"
cp -r /mnt/tse-data/photos "$DATA_DIR/photos"
exec node --experimental-sqlite --experimental-strip-types server/index.ts
```

- `unzip` não é necessário no runtime (só a ingestão local usa).
- `.dockerignore`: `node_modules`, `data/`, `dist/`, `infra/`, `.git`.

### Build e push (sem Docker local, dentro da franquia gratuita)

```sh
gcloud builds submit --tag <region>-docker.pkg.dev/<proj>/teste-voto/app:<tag>
```

Cloud Build tem 120 min/dia grátis; cada build leva ~3–5 min.

## 5. Etapa 3 — Terraform em `infra/`

```
infra/
  versions.tf               # terraform >= 1.6, provider google ~> 6.x
  variables.tf              # ver tabela abaixo
  main.tf                   # ativação das APIs
  storage.tf                # bucket + IAM da service account
  registry.tf               # Artifact Registry + cleanup policy
  run.tf                    # Cloud Run + IAP + allow-list/allUsers
  outputs.tf                # URL, bucket, comandos prontos
  terraform.tfvars.example
```

Variáveis:

| variável | default | obs |
|---|---|---|
| `project_id` | — | obrigatória |
| `region` | `southamerica-east1` | ver §6 sobre free tier |
| `service_name` | `teste-voto` | |
| `bucket_name` | — | obrigatória (nome global) |
| `image` | — | tag publicada no Artifact Registry |
| `public_access` | `false` | `true` abre para qualquer pessoa |
| `allowed_emails` | `[]` | allow-list da fase privada |

Recursos:

- **APIs** (`google_project_service`): `run`, `storage`, `artifactregistry`,
  `cloudbuild`, `iap`.
- **Bucket** (`google_storage_bucket`): `uniform_bucket_level_access`,
  `versioning` ligado (rollback de dados) + `lifecycle_rule` mantendo só as
  últimas ~5 versões. **Privado** — o acesso é só da service account do
  Cloud Run; nunca tornar o bucket público.
- **Service account** dedicada ao Cloud Run + `roles/storage.objectViewer`
  no bucket.
- **Artifact Registry**: repo Docker `teste-voto` + cleanup policy (manter
  as 3 imagens mais recentes) para caber na franquia de 0,5 GB.
- **Cloud Run** (`google_cloud_run_v2_service`):
  - `iap_enabled = !var.public_access`
  - `ingress = "INGRESS_TRAFFIC_ALL"` (o IAP protege todas as origens,
    inclusive o `run.app` default)
  - `execution_environment = "EXECUTION_ENVIRONMENT_GEN2"` (exigido para
    volume GCS)
  - `volumes { gcs { bucket = …, read_only = true } }` +
    `volume_mounts` em `/mnt/tse-data`
  - scaling: `min_instance_count = 0`, `max_instance_count = 3`
  - recursos: 1 vCPU / 512 Mi, `container_concurrency = 80`
  - env: `DATA_DIR=/app/data`, `SERVE_STATIC=true`, `PORT=8080`
- **IAM de acesso**:
  - Sempre: `roles/run.invoker` para
    `serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com`
    (`google_cloud_run_v2_service_iam_member`).
  - Privado (`public_access = false`):
    `google_iap_web_cloud_run_service_iam_binding` com
    `role = "roles/iap.httpsResourceAccessor"` e
    `members = [for e in var.allowed_emails : "user:${e}"]`.
  - Público (`public_access = true`): `roles/run.invoker` para `allUsers`.
- **Orçamento** (recomendado): `google_billing_budget` com alerta em valor
  simbólico (ex.: US$1) — alerta não corta gasto, mas avisa cedo.

Estado: local mesmo, no início (KISS). `.gitignore` ganha
`infra/.terraform/`, `*.tfstate*` e `terraform.tfvars`. Backend GCS fica
como evolução futura documentada.

## 6. Custos — por que fica ~US$0

| Serviço | Franquia gratuita (mensal) | Uso esperado |
|---|---|---|
| Cloud Run | 2 mi requisições, 180 mil vCPU-s, 360 mil GiB-s | escala a zero; tráfego de quiz |
| GCS Standard regional | 5 GB always-free (us-east1/us-west1/us-central1) | ~11 MB (~60 MB com versões) |
| Artifact Registry | 0,5 GB | ~150 MB × 3 imagens com cleanup |
| Cloud Build | 120 min/dia | ~5 min/deploy |
| IAP | sem custo | — |
| Egress | 1 GB (América do Norte) | fotos 8,7 MB totais + API |

**Região**: o always-free de storage só vale em `us-east1`, `us-west1` e
`us-central1`. Como o público é brasileiro, o default é
`southamerica-east1` (latência ~10× menor): os 11 MB custam centavos de
**centavo** por mês e a franquia do Cloud Run vale em qualquer região.
Quem quiser free tier estrito troca `region` para `us-east1`.

Guardrails: `max_instance_count = 3`, budget com alerta, bucket privado,
cleanup de imagens.

## 7. Fase privada → fase pública

- **Privada**: usuário abre a URL, o IAP redireciona para login Google e só
  libera e-mails da allow-list. Adicionar/remover acesso = editar
  `allowed_emails` + `terraform apply` (ou Console → Cloud Run → Security).
- **Virar pública**: `public_access = true` em `terraform.tfvars` +
  `terraform apply`. Isso desliga o IAP e concede `run.invoker` a
  `allUsers`. Reversível a qualquer momento.

## 8. Mudanças no repositório (checklist de implementação)

- [x] `server/index.ts`: servir `dist/` com fallback SPA quando
      `SERVE_STATIC=true` (dev inalterado)
- [x] `scripts/publish-data.ts` + script `publish:data` no `package.json`
- [x] `Dockerfile`, `.dockerignore`, `docker-entrypoint.sh`
- [x] `infra/` (arquivos da §5) + `terraform.tfvars.example`
- [x] `.env.example`: `GCS_BUCKET`
- [x] `.gitignore`: entradas do Terraform
- [x] `AGENTS.md`: novos scripts (`publish:data`), `infra/` e o fluxo de
      deploy
- [x] Documentação operacional em `okf/` (Open Knowledge Format v0.2)
- [ ] Opcional futuro: Cloud Build trigger ou GitHub Action para build/deploy
      contínuo

## 9. Operação no dia a dia

| tarefa | comando |
|---|---|
| Atualizar dados do TSE | `npm run ingest && npm run sync:* && npm run publish:data -- --reload` |
| Deploy de código | `gcloud builds submit --tag … && terraform -chdir=infra apply -var="image=…"` |
| Liberar acesso a alguém | editar `allowed_emails` + `terraform -chdir=infra apply` |
| Abrir ao público | `public_access = true` + `terraform -chdir=infra apply` |
| Rollback de dados | restaurar versão anterior do `tse.db` no bucket + `--reload` |

## 10. Validação antes do go-live

1. `docker build -t teste-voto .` e rodar local com um diretório montado em
   `/mnt/tse-data` simulando o bucket; conferir `curl :8080/api/health`,
   `/api/candidates` e o carregamento do app em `/`.
2. `terraform -chdir=infra plan` limpo; `apply` completo do zero.
3. Acesso com e-mail da allow-list (passa) e fora dela (403 do IAP).
4. Flip para `public_access = true` e acesso anônimo.
5. `npm test`, `npm run lint` e `npm run check:distribution` seguem verdes —
   nenhuma mudança pode afetar a imparcialidade nem a proveniência.

## 11. Riscos e limitações conhecidos

- **Cold start**: FUSE + cópia de ~10 MB adiciona ~2–4 s na primeira
  requisição após escala a zero. Aceitável para o caso de uso; se incomodar,
  `min_instance_count = 1` (sai do ~zero: ~US$13/mês — não recomendado).
- **Dados ficam velhos enquanto instâncias quentes rodam**: o `--reload` do
  script de publicação resolve forçando nova revisão.
- **IAP sem organização**: exige o passo manual único do §2.
- **Bucket versioning + lifecycle**: sem a regra de limpeza, versões antigas
  do banco acumulam — a lifecycle rule do §5 cobre isso.
