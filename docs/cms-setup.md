# 블로그 Admin (Sveltia CMS) 셋업

`/cms/` 에서 글·About·프로젝트·사이트 설정·UI 문구·이미지까지 전부 편집한다.
데이터는 전부 리포의 파일이고, 저장하면 `master` 에 커밋 → GitHub Actions 가 자동 배포한다.

편집 방법은 두 가지다. **둘 다 설정해두고 상황에 맞게 쓰는 걸 권장한다.**

---

## A. 로컬 편집 (인증 불필요, 가장 빠름)

```bash
pnpm dev
```
브라우저(Chrome / Edge)에서 <http://localhost:4321/cms/> 접속 →
**"Work with Local Repository"** 선택 → 리포 폴더 선택.

- File System Access API 로 로컬 파일을 직접 읽고 쓴다. 인증 설정이 전혀 필요 없다.
- 저장하면 작업 트리의 파일이 바로 바뀐다. 커밋·푸시는 직접 한다.
- 편집하면서 옆 탭에서 실제 사이트가 즉시 갱신되는 걸 볼 수 있다.
- Safari / Firefox 는 이 API 를 지원하지 않는다. Chrome 계열을 써라.

---

## B. 원격 편집 (배포된 사이트에서, 모바일 포함)

<https://teddko.github.io/cms/> 에 접속해서 GitHub 로그인 한 번으로 편집한다.
GitHub OAuth 는 브라우저만으로는 끝낼 수 없어서(클라이언트 시크릿 교환이 필요)
중계 역할을 하는 작은 워커를 한 번 띄워야 한다.

### 비용

전부 무료다.

- Cloudflare Workers 무료 플랜: **10만 요청/일**, 신용카드 불필요.
  이 워커는 로그인하는 순간에만 호출된다 — 하루 수십 건 수준이라 한도 근처도 가지 않는다.
- `*.workers.dev` 서브도메인이 기본 제공되므로 도메인을 살 필요가 없다.
- GitHub OAuth App 생성도 무료다.

### 1. 워커 배포

<https://github.com/sveltia/sveltia-cms-auth> 의
**"Deploy to Cloudflare Workers"** 버튼을 누른다 (Cloudflare 계정 필요, 무료 가입).

배포 후 워커 URL 을 복사해둔다. 형식:
```
https://sveltia-cms-auth.<본인-서브도메인>.workers.dev
```

> 직접 배포하려면 리포를 클론하고 `wrangler deploy` 해도 된다.

### 2. GitHub OAuth App 등록

<https://github.com/settings/applications/new> 에서 새 OAuth App 생성:

| 항목 | 값 |
|---|---|
| Application name | 아무거나 (예: `TeddKo Blog CMS`) |
| Homepage URL | `https://teddko.github.io` |
| **Authorization callback URL** | `<워커URL>/callback` |

콜백 URL 의 `/callback` 을 빼먹으면 로그인이 실패한다.

생성 후 **Client ID** 를 복사하고, **Generate a new client secret** 으로 시크릿을 만들어 복사한다.
시크릿은 이 화면을 벗어나면 다시 못 본다.

### 3. 워커에 환경변수 등록

Cloudflare 대시보드 → 해당 Worker → **Settings → Variables and Secrets**:

| 이름 | 값 | 비고 |
|---|---|---|
| `GITHUB_CLIENT_ID` | 위에서 복사한 Client ID | |
| `GITHUB_CLIENT_SECRET` | 위에서 복사한 Client Secret | **Encrypt 체크 필수** |
| `ALLOWED_DOMAINS` | `teddko.github.io` | 권장. 다른 사이트가 이 워커를 못 쓰게 막는다 |

저장 후 워커를 재배포(Deploy)한다.

### 4. CMS 설정에 워커 URL 연결

`public/cms/config.yml` 의 `backend` 블록에 `base_url` 을 추가한다:

```yaml
backend:
  name: github
  repo: TeddKo/TeddKo.github.io
  branch: master
  base_url: https://sveltia-cms-auth.<본인-서브도메인>.workers.dev
```

커밋·푸시하면 배포 후부터 `/cms/` 에서 GitHub 로그인 버튼이 동작한다.

---

## 보안 메모

- `/cms/` 페이지 자체는 공개된 정적 파일이다. 숨길 수 없고 숨길 필요도 없다 —
  **쓰기 권한은 GitHub 인증이 100% 통제한다.** 로그인하지 않으면 아무것도 못 바꾼다.
- 리포 쓰기 권한이 있는 계정만 편집할 수 있다.
- `src/pages/cms/index.astro` 에 `noindex` 가 걸려 있고, `astro.config.ts` 의
  sitemap 필터와 `robots.txt` 에서 `/cms/` 를 제외한다.
- `ALLOWED_DOMAINS` 를 설정하면 제3자 사이트가 이 워커를 빌려 쓰는 걸 막는다. 꼭 넣어라.

---

## 편집 → 배포 흐름

```
/cms/ 에서 저장
   → master 에 커밋 (Sveltia 가 수행)
   → .github/workflows/deploy.yml 트리거
   → astro build + pagefind 색인
   → GitHub Pages 배포          (약 2분)
```

로컬 편집 모드(A)를 썼다면 커밋·푸시는 직접 해야 배포된다.

---

## 데이터가 실제로 어디 있는지

CMS 는 파일만 편집한다. 각 화면이 건드리는 실제 파일:

| Admin 화면 | 파일 |
|---|---|
| 글 | `src/content/posts/*.md` |
| About 본문 | `src/content/pages/about.md` |
| About 페이지 구성 | `src/data/about.json` |
| 홈 화면 | `src/data/home.json` |
| 사이트 설정 · 소셜 · 공유 | `src/data/site.json` |
| 프로젝트 목록 | `src/data/projects.json` |
| 강점 카드 | `src/data/skills.json` |
| 프로젝트 상세 | `src/data/projects/*.json` |
| UI 문구 (한/영) | `src/data/i18n.ko.json`, `src/data/i18n.en.json` |
| 이미지 | `src/assets/images/`, `public/images/projects/` |

`.json` 안의 값은 Astro 가 빌드 타임에 import 하고, `astro check` 가 타입을 검사한다.
CMS 에서 잘못된 데이터를 넣으면 **배포 전 빌드 단계에서 잡힌다.**
