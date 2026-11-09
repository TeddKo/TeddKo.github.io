---
title: "Vercel 은 BaaS 가 아니라 프론트엔드 배포 플랫폼입니다"
description: "Vercel 이 실제로 무엇을 해 주는 서비스인지, Fluid compute 와 Routing Middleware, 저장소, AI Gateway, 요금제, 락인 문제까지 정리하고 Cloudflare 와 셀프 호스팅 대안도 함께 비교했습니다."
pubDatetime: 2026-11-08T22:52:00+09:00
category: frontend
tags:
  - Vercel
  - Next.js
  - 배포
  - 프론트엔드
---

Vercel 을 Firebase 나 Supabase 와 같은 줄에 놓고 "백엔드 서비스"로 이해하는 경우가 꽤 있습니다. 둘은 다른 종류입니다. Supabase 나 Firebase 는 데이터베이스와 인증을 대신 운영해 주는 BaaS 이고, Vercel 은 **웹 애플리케이션을 빌드하고 배포하고 서빙하는 플랫폼**입니다. Git 저장소를 연결하면 빌드해서 CDN 과 서버리스 함수에 올려 주는 것이 본업이고, 데이터베이스는 직접 만들지 않고 외부 제공사를 연결해서 씁니다.

이 글은 Vercel 이 정확히 어디까지 맡아 주는지, 지금의 모습은 어떤지, 그리고 묶이는 비용은 얼마나 되는지를 적었습니다. 저는 Cloudflare Workers 와 GitHub Pages 로 사이드 프로젝트를 돌리고 있어서 그쪽과 비교하는 대목이 몇 군데 있습니다.

## Git push 가 곧 배포입니다

Vercel 을 쓰는 가장 큰 이유는 배포 흐름이 짧다는 점입니다. 저장소를 연결해 두면 production 브랜치(보통 `main`)에 push 할 때마다 production 배포가 일어나고, 그 외 브랜치에 push 하거나 PR 을 열면 preview 배포가 만들어집니다. 배포마다 URL 이 따로 생기는데, 브랜치의 최신 상태를 가리키는 URL 과 특정 커밋에 고정된 URL 두 종류입니다. PR 코멘트에 링크가 달리니 리뷰어는 로컬에서 브랜치를 받을 필요 없이 바로 화면을 봅니다.

![Git push 가 빌드와 배포 생성을 거쳐 production 또는 preview 배포가 되는 흐름과, 요청이 Routing Middleware 와 CDN, Fluid compute 를 쓰는 Vercel Functions 를 거쳐 Blob, Global Config, Marketplace storage 로 이어지는 흐름을 그린 그림](@/assets/images/vercel-frontend-cloud-flow.png)

한 가지 알아 둘 점은 새 프로젝트의 **첫 배포는 어느 브랜치에서 하든 production 으로 처리된다**는 것입니다. 첫 배포가 실패해도 그렇게 셉니다. 이후부터는 위 규칙이 적용됩니다. 환경은 Local, Preview, Production 이 기본이고 Pro 이상에서는 `staging` 같은 커스텀 환경을 더 만들 수 있습니다.

로컬 개발은 CLI 로 이어집니다. `vercel link` 로 프로젝트를 연결하고 `vercel env pull` 을 하면 환경 변수가 `.env.local` 로 내려옵니다.

## 프레임워크를 읽고 인프라를 만듭니다

Vercel 이 내세우는 개념이 framework-defined infrastructure 입니다. 인프라 설정 파일을 따로 쓰는 대신 프레임워크 코드에서 필요한 인프라를 추론한다는 뜻입니다. Route Handler 를 하나 만들면 함수가 되고, 정적 페이지는 CDN 에 올라가고, ISR 설정이 있으면 재생성 캐시가 붙습니다.

Next.js 가 가장 매끄러운 건 사실입니다. 같은 회사가 만들기 때문입니다. 그래도 공식 문서의 지원 매트릭스에는 SvelteKit, Nuxt, TanStack, Astro, Remix, Vite 가 함께 올라와 있고, 기능별 지원 여부가 프레임워크마다 다릅니다. 예를 들어 ISR 은 Next.js, SvelteKit, Nuxt, Astro 는 되고 TanStack 과 Remix 는 안 됩니다. Skew Protection 도 Remix 는 지원하지 않는 것으로 표에 나옵니다. "아무 프레임워크나 똑같이 된다"기보다 "대부분 올라가지만 기능은 프레임워크에 따라 다르다"가 정확합니다.

프레임워크가 없는 프로젝트라면 루트의 `api/` 디렉터리에 파일을 두면 파일마다 함수가 하나씩 만들어집니다. 프레임워크 제작자를 위해서는 Build Output API 라는 파일 시스템 기반 명세가 열려 있어서, 그 디렉터리 구조대로 빌드 결과를 만들면 Vercel 의 함수, 라우팅, 캐시 기능을 쓸 수 있습니다.

## Vercel Functions 와 Fluid compute

함수는 이렇게 씁니다. Next.js App Router 라면 Route Handler 하나가 곧 함수입니다.

```ts
// app/api/hello/route.ts
export async function GET(request: Request) {
  const response = await fetch("https://api.vercel.app/products");
  const products = await response.json();
  return Response.json(products);
}
```

프레임워크 없이 쓸 때도 표준 `Request` 와 `Response` 를 받는 `fetch` 핸들러 하나를 default export 하면 됩니다. 문서는 엔드포인트마다 파일을 쪼개지 말고 관련 라우트를 한 함수에 모으라고 권합니다. 인스턴스 재사용이 그쪽에 유리하기 때문입니다.

이 재사용이 Fluid compute 의 핵심입니다. 기존 서버리스는 호출 하나에 인스턴스 하나를 붙였는데, Fluid compute 는 **한 인스턴스가 동시에 여러 호출을 처리**하도록 합니다. Node.js 와 Python 런타임에서 쓸 수 있습니다. 외부 API 를 기다리는 시간이 긴 AI 앱 같은 I/O 중심 워크로드에서 비용과 콜드 스타트가 같이 줄어드는 구조입니다. 응답을 보낸 뒤에도 `waitUntil` 로 로깅 같은 후처리를 이어갈 수 있고, 한 요청에서 난 예외가 같은 인스턴스의 다른 요청을 죽이지 않게 격리합니다.

Fluid compute 는 **2025년 4월 23일부터 신규 프로젝트에 기본 활성화**되어 있습니다. 기존 프로젝트는 대시보드의 Functions 설정이나 `vercel.json` 의 `"fluid": true` 로 켭니다. 실행 시간 기본값은 모든 플랜에서 300초이고, 최대치는 Hobby 300초, Pro 와 Enterprise 800초입니다. 30분까지 늘리는 옵션은 아직 베타입니다. 그 이상으로 오래 도는 작업은 함수가 아니라 Vercel Workflows 를 쓰라는 안내가 붙어 있습니다.

## Edge 에서 Routing Middleware 로

예전에 "Edge Middleware" 라고 부르던 자리는 지금 문서에서 **Routing Middleware** 입니다. 요청이 처리되기 전, 캐시보다 앞에서 실행되는 코드이고 리다이렉트, 리라이트, 헤더 추가, A/B 테스트 분기 같은 일에 씁니다. 모든 플랜에서 쓸 수 있습니다.

달라진 점이 있습니다. TypeScript 와 JavaScript 로 쓴 Routing Middleware 는 기본이 **Node.js 런타임**이고 Bun 도 선택할 수 있으며, 요금도 Fluid compute 방식으로 계산됩니다. 이름은 Edge 였지만 이제 꼭 엣지 런타임에서 도는 코드는 아닙니다. Python 도 지원합니다. 프레임워크가 자체 미들웨어 규약을 가진 경우(Next.js, Astro)에는 그 규약을 따릅니다. Next.js 16 부터는 `middleware.ts` 대신 프로젝트 루트의 `proxy.ts` 를 씁니다.

문서에서 인상 깊었던 건 "커스텀 코드가 필요 없으면 쓰지 말라"는 대목입니다. 단순 리다이렉트나 리라이트, 헤더는 `vercel.json` 의 정적 설정으로 쓰는 편이 CDN 에서 바로 처리되어 더 빠르고 싸다고 합니다. 세션 토큰 검증이나 외부 API 호출처럼 정적 규칙으로 표현할 수 없을 때만 미들웨어를 쓰라는 겁니다. matcher 를 지정하지 않으면 정적 파일 요청까지 전부 타서 지연과 비용이 늘어난다는 경고도 있습니다.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "fluid": true,
  "redirects": [
    { "source": "/old-page", "destination": "/new-page", "permanent": true }
  ]
}
```

## ISR, 캐시, CDN

정적으로 만든 페이지를 CDN 에 올려 두고 일정 주기나 요청에 따라 다시 만드는 ISR 은 Vercel 에서 가장 자연스럽게 동작하는 기능입니다. 캐시 헤더도 자동으로 설정됩니다. 요금표에도 ISR Reads 와 ISR Writes 가 별도 항목으로 있으니 어떤 단위로 과금되는지 알고 쓰는 편이 좋습니다. 이미지 최적화(Image Optimization)도 플랫폼이 처리하고 변환 횟수 단위로 과금합니다.

## 저장소는 직접 만들지 않습니다

여기서 BaaS 와 선이 갈립니다. 현재 Vercel 의 저장소 문서는 세 갈래입니다.

- **Blob**: 이미지, 영상, 생성된 파일 같은 큰 객체. 공개와 비공개 스토어가 있습니다.
- **Global Config**: 기능 플래그나 리다이렉트 목록처럼 자주 읽고 거의 안 바뀌는 설정. 대부분의 조회가 1ms 미만이고 99% 가 10ms 안에 끝난다고 문서에 적혀 있습니다. 쓰기는 초 단위입니다.
- **Marketplace storage**: Postgres, Redis 계열 KV, NoSQL, 벡터 DB 는 Neon, Upstash, Supabase 같은 외부 제공사가 맡고, Vercel 은 자격 증명을 환경 변수로 주입해 줍니다.

```bash
vercel install neon
vercel install upstash
vercel install supabase
```

지금 문서는 데이터베이스를 Marketplace 로 연결하는 방식으로 안내합니다. 결국 "Vercel 에 백엔드를 얹는다"는 건 Supabase 나 Neon 같은 서비스를 붙인다는 뜻이고, 그 서비스를 어디에 둘지는 별도로 고민해야 합니다. 함수와 DB 의 리전이 멀면 지연이 커지니 둘을 가까이 두라는 권고가 문서에 있습니다.

## AI 쪽

AI SDK 는 React, Next.js, Vue, Svelte, Node.js 에서 쓰는 TypeScript 툴킷이고, 공급자가 달라도 같은 코드로 호출하게 해 줍니다. 여기에 AI Gateway 가 붙습니다. 하나의 엔드포인트로 여러 공급자의 모델을 부르면서 자격 증명 관리, 요청 로그, 예산 상한, 공급자 장애 시 전환을 한곳에서 하는 서비스입니다. 문서에 따르면 공급자 토큰 가격에 **마크업을 붙이지 않고**, 직접 발급한 키를 쓰는 BYOK 도 지원합니다. 앱이 Vercel 위에서 돌지 않아도 API 키로 호출할 수 있습니다.

```ts
import { generateText } from "ai";

const { text } = await generateText({
  model: "provider/model-id",
  prompt: "Explain AI Gateway in one sentence.",
});
```

`model` 은 `공급자/모델` 형태의 문자열로 지정합니다. 위 모델 이름은 자리 표시용이니 실제 값은 Gateway 의 모델 목록에서 고르면 됩니다.

## 요금제

공식 가격 페이지 기준으로 정리하면 이렇습니다. 숫자는 자주 바뀌니 결제 전에 직접 확인하세요.

| 항목               | Hobby                      | Pro                                  |
| ------------------ | -------------------------- | ------------------------------------ |
| 월 기본 요금       | $0                         | $20 (개발자 시트는 시트당 $20)       |
| 용도               | 개인, 비상업적 사용만      | 상업적 사용 가능                     |
| CDN 요청           | 월 100만                   | 월 1,000만 포함, 이후 100만당 $2부터 |
| Fast Data Transfer | 월 100GB                   | 월 1TB 포함, 이후 GB당 $0.15부터     |
| 초과 사용          | 추가 구매 불가, 한도까지만 | 종량제로 계속 사용                   |

Hobby 는 "personal, non-commercial use" 로 명시되어 있어서, 수익이 나는 서비스를 올리면 약관에 걸립니다. 사이드 프로젝트가 돈을 벌기 시작하는 시점에 Pro 로 넘어가야 합니다. Pro 는 사용량 크레딧 $20 이 포함되고, 그 이후는 종량제입니다. Fluid Active CPU 는 시간당 $0.128부터, 함수 호출은 100만 건당 $0.60부터, Blob 저장은 GB당 $0.023 입니다. 요금 구조가 요청 수, 전송량, CPU 시간, ISR 읽기와 쓰기로 쪼개져 있어서 트래픽이 불어나면 청구서를 예측하기 어렵다는 점이 이 플랫폼에서 늘 나오는 불만입니다. 예산 알림을 걸어 두고 시작하는 편이 안전합니다.

## 락인과 대안

Next.js 는 오픈 소스이고, Vercel 없이도 돌아갑니다. 공식 문서가 인정하는 배포 방식은 Node.js 서버(`next start`), Docker 컨테이너, 정적 export, 그리고 어댑터 네 가지입니다. Node.js 서버와 Docker 에서는 모든 기능이 지원됩니다. 컨테이너용으로는 `next.config.js` 에서 `output: "standalone"` 을 켜면 필요한 파일만 담은 작은 이미지가 나옵니다.

다만 셀프 호스팅은 Vercel 이 알아서 해 주던 일을 직접 떠맡는 일입니다. 공식 가이드만 봐도 인스턴스가 여러 개면 캐시 핸들러를 Redis 같은 공유 저장소로 바꿔야 하고, Server Functions 암호화 키를 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 로 고정해야 하고, 롤링 배포에서 버전 불일치를 막으려면 `deploymentId` 를 설정해야 하고, 리버스 프록시에서 스트리밍 버퍼링을 꺼야 합니다. 기능은 되지만 운영 지식이 필요합니다.

그리고 최근 구조가 바뀌었습니다. Next.js 는 **Deployment Adapter API** 를 16.2.0 에서 안정화했습니다(`adapterPath`). 플랫폼이 Next.js 빌드 과정에 공식적으로 끼어들 수 있게 한 것이고, 참조 구현이 Vercel 자신의 어댑터(`nextjs/adapter-vercel`)입니다. 공식 문서가 지금 "검증된 어댑터"로 꼽는 곳은 Vercel 과 Bun 이고, Cloudflare 와 Netlify 는 어댑터 API 기반 검증 어댑터를 작업 중이며 그동안은 각자 자체 통합을 제공한다고 적혀 있습니다.

Cloudflare 쪽은 제가 쓰는 플랫폼이라 조금 더 보았습니다. Cloudflare 문서는 Workers 에서 Next.js 를 돌리는 기본 방법으로 **vinext** 를 권하고 있습니다. Vite 플러그인으로 Next.js API 를 다시 구현한 것인데, 문서에 베타라고 적혀 있고 도입 전에 `npx vinext check` 를 돌려 보라고 합니다. 기존 OpenNext 어댑터는 vinext 로 아직 못 옮기는 프로젝트를 위한 대안으로 남아 있습니다. 정적 export 라면 Pages 도 선택지입니다. Next.js 가 아닌 SvelteKit 이나 Astro 를 쓴다면 이 고민이 사라집니다. 프레임워크 자체가 호스팅 대상별 어댑터 구조를 갖고 있기 때문입니다.
락인이 어디서 생기는지 정리하면 이렇습니다. 코드 자체는 표준 `Request` 와 `Response` 를 쓰니 옮기기 쉽습니다. 묶이는 건 `vercel.json` 라우팅 설정, Blob 과 Global Config 같은 전용 저장소, Skew Protection 이나 ISR 캐시의 동작 같은 **플랫폼 기능에 기대는 부분**입니다. DB 를 Neon 같은 제공사에 두면 그쪽은 Vercel 과 상관없이 따라옵니다.

![Vercel, 컨테이너 셀프 호스팅, Cloudflare Workers 를 Next.js 지원, 운영 부담, 비용, 락인과 이식성 항목으로 비교한 표](@/assets/images/vercel-frontend-cloud-matrix.png)

## 지금 상황

- Fluid compute 가 신규 프로젝트 기본값입니다(2025년 4월 23일부터). 함수 최대 실행 시간은 Pro 에서 800초이고 30분 옵션은 베타입니다.
- 이전의 Edge Middleware 는 Routing Middleware 로 불리며 Node.js, Bun, Python 에서 실행됩니다. Next.js 16 은 `proxy.ts` 를 씁니다.
- 데이터베이스는 Marketplace(Neon, Upstash, Supabase)를 통해 연결하고, Vercel 자체 저장소는 Blob 과 Global Config 로 정리되었습니다.
- Next.js 의 Deployment Adapter API 가 16.2.0 에서 안정화되어 Vercel 외 플랫폼이 공식 경로로 Next.js 를 지원할 길이 열렸습니다.
- AI Gateway 와 AI SDK 가 플랫폼의 한 축이 되었습니다. Gateway 는 모든 플랜에서 쓸 수 있습니다.
- 문서 곳곳에 Workflows, Queues, Sandbox 같은 에이전트 지향 제품이 보입니다. 정적 사이트 호스팅 서비스에서 AI 앱 런타임으로 무게중심이 옮겨 가는 중입니다.

## 선택 기준

Next.js 로 만들고, 팀이 작고, PR 마다 preview 링크를 돌려 보며 일하는 걸 중시한다면 Vercel 이 가장 마찰이 적습니다. 인프라를 만질 시간을 아끼는 대신 값을 내는 모델이고, 그 값이 가치가 있는지는 트래픽이 정합니다. 개인 프로젝트나 포트폴리오는 Hobby 로 충분하지만 **수익이 나는 순간 약관상 Pro 가 필요합니다.**

트래픽이 커질 서비스이고 비용 예측이 중요하다면 처음부터 대안을 열어 두세요. 컨테이너로 셀프 호스팅하면 비용은 고정되지만 캐시, 배포, 스트리밍 설정을 직접 책임집니다. Cloudflare 는 Workers 바인딩을 쓸 수 있는 대신 Next.js 호환은 아직 vinext 나 OpenNext 같은 별도 계층에 기댑니다. SvelteKit, Astro 같은 프레임워크라면 이식성 부담이 훨씬 가볍습니다.

저처럼 정적 블로그와 가벼운 API 정도만 필요하다면 GitHub Pages 와 Workers 조합으로도 충분합니다. 프런트엔드 프레임워크 선택은 [React, Vue, Svelte, Angular, SolidJS 비교](/posts/react-vue-svelte/) 글에서 따로 다뤘습니다.

## 참고 자료

- [Fluid compute (Vercel Docs)](https://vercel.com/docs/fluid-compute)
- [Routing Middleware (Vercel Docs)](https://vercel.com/docs/routing-middleware)
- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Storage overview](https://vercel.com/docs/storage)
- [Frameworks on Vercel](https://vercel.com/docs/frameworks)
- [Environments (Vercel Docs)](https://vercel.com/docs/deployments/environments)
- [Getting started with Vercel Functions](https://vercel.com/docs/functions/quickstart)
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [AI SDK Introduction](https://ai-sdk.dev/docs/introduction)
- [Next.js: Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [Next.js: Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js: adapterPath](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath)
- [Cloudflare Workers: Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
