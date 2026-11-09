---
title: "Hono, Express, Fastify, Elysia, NestJS 중 무엇을 쓸까, 같은 엔드포인트로 비교해 봤습니다"
description: "Web Standard 위의 Hono 와 Elysia, Node http 위의 Express 와 Fastify, 구조를 강제하는 NestJS 를 같은 GET 엔드포인트로 나란히 놓고 런타임, 검증, DI, 성능 수치 읽는 법, 버전 상태와 선택 기준을 적었습니다."
pubDatetime: 2026-11-08T21:13:00+09:00
category: server
tags:
  - Hono
  - Express
  - Fastify
  - Elysia
  - NestJS
  - 서버
---

TypeScript 서버 프레임워크 비교 글에 요즘 자주 같이 나오는 이름이 Hono, Express, Fastify, Elysia, NestJS 입니다. 다섯 개 모두 요청을 받아 응답을 돌려주지만 출발점이 다릅니다. 요청 객체가 Node 의 `http` 에서 오는지 Web Standard 의 `Request` 에서 오는지, 검증을 스키마로 하는지 데코레이터로 하는지, 구조를 프레임워크가 잡아 주는지 개발자에게 맡기는지가 갈립니다. 같은 엔드포인트를 다섯 가지로 써 보면서 그 차이를 따라가 보겠습니다. 비슷한 구도의 글로 [Spring Boot 와 Ktor 비교](/posts/spring-vs-ktor/)도 있습니다.

npm `latest` 태그는 다음과 같습니다.

| 프레임워크              | npm latest              | 비고                                    |
| ----------------------- | ----------------------- | --------------------------------------- |
| Hono                    | 4.13.17 (2026-11-07)    | 5.0.0-rc.1 이 `next` 태그               |
| Express                 | 5.3.0 (2026-10-09)      | 4.x 는 `latest-4` 태그의 4.22.3         |
| Fastify                 | 5.12.8 (2026-11-02)     | 6.0.0-alpha.6 이 `next` 태그            |
| Elysia                  | 2.0.0-rc.4 (2026-11-08) | 1.x 마지막 안정판은 1.4.31 (2026-11-05) |
| NestJS (`@nestjs/core`) | 12.4.0 (2026-11-06)     | 11.x 는 `legacy` 태그                   |

Elysia 는 `latest` 태그가 릴리스 후보를 가리킵니다. 아래 예제는 1.x 문법이고 2.0 의 변경은 마지막 장에서 다룹니다.

## 설계 철학: Web Standard 와 Node http

가장 큰 갈림길은 요청과 응답 객체입니다. Express 는 Node 의 `http.IncomingMessage` 와 `ServerResponse` 를 확장한 `req`, `res` 위에 있고, Fastify 도 Node `http` 서버 위에서 돌면서 자체 `request`, `reply` 객체를 줍니다.

Hono 는 공식 문서에서 Web Standards 위에 만든 작고 단순하고 빠른 프레임워크라고 스스로를 소개합니다. 의존성이 없고 TypeScript 를 일급으로 지원하며, 핸들러는 컨텍스트 `c` 를 받아 `Response` 를 돌려줍니다. Elysia 도 Web Standard `Request`/`Response` 를 씁니다. 문서는 Bun 에 최적화되어 있지만 Bun 전용은 아니라고 설명합니다. 코어가 표준 객체 위에 있으니 런타임을 바꿔도 코드를 옮기기 쉽습니다.

NestJS 는 HTTP 계층을 직접 만들지 않고 어댑터에 맡깁니다. 문서에는 `ExpressAdapter`, `FastifyAdapter`, `NodeAdapter` 가 나옵니다. NestJS 가 파는 것은 그 위에 얹는 모듈, 프로바이더, 파이프, 가드 같은 애플리케이션 구조입니다.

![Hono 와 Elysia 는 Web Standard 의 Request 와 Response 위에, Express 와 Fastify 는 Node http 위에 놓이고, NestJS 는 ExpressAdapter, FastifyAdapter, NodeAdapter 어댑터 위에 모듈과 프로바이더 같은 애플리케이션 구조를 얹는 모습을 세 칸으로 나눠 보여 주는 그림입니다. Web Standard 쪽은 Bun, Deno, Cloudflare Workers 와 Node.js 어댑터로, 나머지 둘은 Node.js 로 이어집니다.](@/assets/images/hono-express-fastify-elysia-nestjs-runtime-layers.png)

## 런타임 지원

Hono 문서에 나오는 실행 환경은 Cloudflare Workers, Fastly Compute, Deno, Bun, Vercel, Netlify, AWS Lambda, Lambda@Edge 등이고 Node.js 는 별도 어댑터로 지원합니다. 엣지에서 같은 코드를 돌리는 것이 Hono 의 기본 전제입니다.

Elysia 는 WinterTC 호환이라 Node.js, Deno, Cloudflare Workers, Vercel 에서도 실행됩니다. 2.0 베타 글에 따르면 Node 어댑터는 srvx 와 crossws 를 쓰고 Adapter API 가 공개되었습니다. Cloudflare Workers 에서는 `new Function` 이 막혀 있어 빌드 시점 컴파일(AOT)을 권장합니다. npm `engines` 에는 Elysia 2.0.0-rc.4 가 Node 22.18 이상으로 적혀 있습니다.

Express 5.3.0 은 Node 18 이상, NestJS 12 는 Node 20.19 이상(22.x 라인은 22.12 이상)이 필요하고 CLI 는 더 높은 버전을 요구한다고 마이그레이션 가이드에 나옵니다. Express, Fastify, NestJS 는 기본적으로 Node 서버 프레임워크라서 엣지 런타임에서 쓰려면 우회로가 필요합니다.

## 라우팅과 미들웨어 모델

Hono 는 라우터를 고를 수 있습니다. RegExpRouter 는 라우트를 하나의 큰 정규식으로 만들어 매칭하고, SmartRouter 는 모든 패턴을 지원하고, LinearRouter 는 등록이 빨라 요청마다 앱을 초기화하는 환경에 맞고, PatternRouter 는 구현이 작습니다. 미들웨어는 `app.use` 로 등록하고 `await next()` 앞뒤에 로직을 두는 양파 구조입니다. 인증, CORS, 압축, ETag, 로깅은 내장 미들웨어로 제공되고 쓴 것만 번들에 들어갑니다.

Express 의 미들웨어는 `(req, res, next)` 체인입니다. Express 5 에서 눈에 띄는 변화는 거절된 Promise 를 반환하는 핸들러와 미들웨어가 에러 처리 미들웨어로 넘어간다는 점입니다. 4 에서 `.catch(next)` 가 필요했던 `async` 핸들러를 그대로 쓸 수 있습니다. 반대로 경로 문법은 path-to-regexp 가 바뀌면서 까다로워졌습니다. `/*` 대신 `/*splat` 처럼 와일드카드에 이름을 붙여야 하고 `?` 선택 표기는 빠졌습니다. 파싱되지 않은 `req.body` 는 `{}` 가 아니라 `undefined` 입니다.

Fastify 는 플러그인과 캡슐화가 중심입니다. 훅(`onRequest`, `preHandler` 등)과 `register` 로 만든 플러그인 컨텍스트는 하위 라우트에만 적용됩니다. Elysia 는 메서드 체이닝으로 라우트와 훅을 이어 붙이고 플러그인도 `Elysia` 인스턴스입니다. NestJS 는 컨트롤러 데코레이터로 라우트를 선언하고, 미들웨어, 가드, 인터셉터, 파이프, 예외 필터가 요청 생명주기의 정해진 자리에 들어갑니다.

## 같은 엔드포인트: GET /users/:id

`id` 가 양의 정수인지 검증하고 `{ id, name }` 을 JSON 으로 돌려주는 엔드포인트를 만들어 보겠습니다. 서비스 로직은 `user-${id}` 를 돌려주는 가짜 구현입니다.

Hono 는 `@hono/zod-validator` 의 `zValidator` 에 검증 대상(`param`)을 지정합니다.

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { serve } from "@hono/node-server";

const app = new Hono().get(
  "/users/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  c => {
    const { id } = c.req.valid("param");
    return c.json({ id, name: `user-${id}` });
  }
);

export type AppType = typeof app;
serve({ fetch: app.fetch, port: 3000 });
```

Express 는 내장 검증이 없어서 zod 같은 라이브러리를 직접 호출합니다.

```ts
import express from "express";
import { z } from "zod";

const Params = z.object({ id: z.coerce.number().int().positive() });
const app = express();

app.get("/users/:id", async (req, res) => {
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "invalid id" });
  const { id } = parsed.data;
  res.json({ id, name: `user-${id}` });
});

app.listen(3000);
```

Fastify 는 JSON Schema 를 `schema` 옵션에 넘기면 Ajv 가 검증하고, `response` 스키마가 있으면 직렬화에도 씁니다.

```ts
import Fastify from "fastify";

const app = Fastify();

app.get<{ Params: { id: number } }>(
  "/users/:id",
  {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "integer", minimum: 1 } },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: { id: { type: "integer" }, name: { type: "string" } },
        },
      },
    },
  },
  async req => ({ id: req.params.id, name: `user-${req.params.id}` })
);

await app.listen({ port: 3000 });
```

Elysia 는 `t` 로 스키마를 만들고, 핸들러 인자의 타입이 스키마에서 추론됩니다. 아래는 1.x 문법이고 문서의 예제처럼 `t.Number()` 로 경로 파라미터를 받습니다.

```ts
import { Elysia, t } from "elysia";

new Elysia()
  .get("/users/:id", ({ params: { id } }) => ({ id, name: `user-${id}` }), {
    params: t.Object({ id: t.Number({ minimum: 1 }) }),
  })
  .listen(3000);
```

NestJS 는 컨트롤러, 서비스, 모듈로 나뉘고 숫자 변환과 검증은 `ParseIntPipe` 가 맡습니다.

```ts
import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Injectable()
class UsersService {
  find(id: number) {
    return { id, name: `user-${id}` };
  }
}

@Controller("users")
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.users.find(id);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
class AppModule {}

const app = await NestFactory.create(AppModule);
await app.listen(3000);
```

나란히 놓으면 Express 는 검증이 핸들러 안에 들어가고, Hono 와 Elysia 는 라우트 정의에 검증이 붙고, NestJS 는 클래스 구조부터 만들어야 합니다. 코드량은 NestJS 가 가장 많습니다. 그 대신 구조가 강제됩니다.

## 검증과 타입 안전성

Hono 는 검증 미들웨어가 입력 타입을 핸들러에 넘기고 `c.json()` 이 응답 타입을 정합니다. RPC 는 서버가 `AppType` 을 내보내고 클라이언트가 `hc<AppType>(url)` 로 호출하는 방식입니다. 호출 인자가 검증 스키마와 맞는지 컴파일러가 검사하고, 응답은 표준 `fetch` Response 처럼 `res.json()` 으로 읽습니다. 모노레포라면 서버와 클라이언트 양쪽 `tsconfig.json` 에 `"strict": true` 가 필요합니다. 검증 라이브러리는 `@hono/zod-validator` 말고도 Standard Schema 를 지원하는 `@hono/standard-validator` 의 `sValidator` 로 Zod, Valibot, ArkType 을 쓸 수 있습니다.

Fastify 의 기본은 JSON Schema 입니다. Ajv v8 이 `body`, `querystring`, `params`, `headers` 를 검증하고, 기본 설정의 `coerceTypes: 'array'` 덕분에 문자열 파라미터가 스키마 타입으로 바뀝니다. 타입 추론은 타입 프로바이더를 따로 붙여야 얻습니다. 문서에는 `json-schema-to-ts`, TypeBox, Zod 용이 나옵니다.

Elysia 는 `t` 스키마 하나로 런타임 검증과 컴파일 타입을 함께 얻고, Eden 클라이언트로 서버 타입을 코드 생성 없이 프론트엔드에서 씁니다. Standard Schema 를 지원해서 Zod 나 Valibot 도 됩니다. 서버 타입을 클라이언트와 공유한다는 점에서 Hono RPC 와 Eden 은 같은 계열입니다.

NestJS 의 전통적인 방식은 DTO 클래스에 class-validator 데코레이터를 붙이고 `ValidationPipe` 를 전역 등록하는 것입니다. 잘못된 입력은 `message` 배열이 담긴 400 응답이 됩니다. NestJS 12 에서는 `StandardSchemaValidationPipe` 가 추가되어 `@Body({ schema: createUserSchema })` 처럼 Zod, Valibot, ArkType 스키마를 파라미터 데코레이터에 붙일 수 있습니다. 이제 데코레이터와 스키마를 둘 다 쓸 수 있는 셈입니다.

Express 는 내장 검증이 없으니 타입 안전성도 `req.params` 를 다루는 개발자 몫입니다.

## DI 와 애플리케이션 구조

NestJS 의 차별점은 의존성 주입과 모듈 구조입니다. 위 예제처럼 `@Injectable()` 프로바이더를 `@Module` 에 등록하고 생성자로 주입받습니다. 기능 단위로 모듈을 나누는 규약이 있어서 팀이 커져도 구조가 비슷하게 유지됩니다. 계층 구조와 의존 방향은 [서버 계층 구조: 레이어드, 헥사고날, 클린](/posts/server-layered-hexagonal-clean/)에서 정리했는데, NestJS 의 모듈은 이런 구조를 프레임워크 차원에서 밀어 주는 쪽에 가깝습니다. 여러 서비스를 한 저장소에서 다루는 방식은 [서버 모노레포](/posts/server-monorepo/)에서 다뤘습니다.

나머지 네 프레임워크에는 내장 DI 컨테이너가 없습니다. Fastify 는 `decorate` 로 인스턴스에 서비스를 붙이고 플러그인 캡슐화로 의존성을 전달합니다. Hono 는 `c.set`/`c.get` 과 `app.use`, Express 는 `app.locals` 나 모듈 함수 인자를 씁니다. 구성을 코드에서 전부 읽을 수 있고 가볍지만, 구조를 세우는 일은 팀이 해야 합니다.

## 성능 자료를 읽는 법

성능 수치는 가장 오해하기 쉬운 부분입니다. 공개된 자료는 전부 프레임워크 제작자가 직접 게시한 것이고 환경도 제각각이라, 아래 숫자는 한 줄에 세워 순위를 매기는 용도가 아닙니다.

Fastify 공식 벤치마크 페이지(2026년 11월 1일 갱신)는 Node.js 단일 인스턴스에서 Fastify 5.12.7 과 Express 5.3.0 을 비교합니다. `GET /` 은 초당 89,733 요청 대 67,794 요청, JSON 본문을 에코하는 `POST /` 는 69,080 대 44,142 입니다. 그런데 페이지 스스로 이 차트를 illustrative comparison 이라 부르고, 하드웨어와 Node 버전, 부하 도구 설정은 밝히지 않으며, 실제 라우트로 측정해 보라고 안내합니다.

Hono 벤치마크 문서는 첫 줄에서 benchmarks are only benchmarks 라고 적습니다. Cloudflare Workers 에서 Hono 가 초당 402,820 ops 로 라우터 비교 대상 중 가장 높게 나왔지만 MacBook Pro M1 에서 라우터만 비교한 결과이고 DB 호출이나 직렬화 비용은 들어 있지 않습니다. Node.js 와 Bun 결과는 스크린샷으로만 올라와 있습니다.

Elysia 2 베타 글에는 Bun 에서 Elysia 가 초당 210,411 요청, Hono 가 168,275 요청이라는 수치가 있습니다. 같은 글에서 저자는 2.0 이 처리량 자체를 크게 올리지는 않을 것이고 시작 시간, 메모리, 번들 크기가 개선 대상이라고 밝힙니다.

실제 서비스에서는 프레임워크보다 DB, 외부 호출, 직렬화가 병목인 경우가 많습니다. 팀의 실제 라우트와 런타임으로 직접 재 보는 쪽이 확실합니다.

## 플러그인 생태계

Express 는 가장 오래되고 넓은 미들웨어 생태계를 갖고 있고 다운로드 규모도 큽니다. Express 팀의 5.1 공지에 따르면 `npm install express` 가 v5 대신 v4.21.2 를 받던 시절 v4 의 주간 다운로드가 약 1,700만이었습니다. Fastify 는 `@fastify/` 스코프에 CORS, 타입 프로바이더 같은 공식 플러그인이 있습니다. Hono 는 내장 미들웨어와 `@hono/` 스코프 패키지, 서드파티 미들웨어를 제공합니다. NestJS 는 `@nestjs/` 스코프로 config, GraphQL, 마이크로서비스, Terminus 같은 공식 패키지를 폭넓게 내놓습니다. Elysia 는 `@elysiajs/` 스코프 플러그인이 있고 2.0 에서는 `@elysia` 스코프로 옮겨 가는 중입니다.

## 버전 상황

각 프레임워크의 최신 상태입니다.

Express 5.0.0 은 2024년 9월에 npm 에 올라왔고, 2025년 3월 31일 공지로 5.1.0 이 `latest` 태그가 되었습니다. 지금 `latest` 는 5.3.0(2026년 10월 9일)이고 4.x 는 4.22.3 이 `latest-4` 태그에 있습니다. 공지가 제안한 일정에서는 4.x 의 EOL 이 2026년 10월 1일 이후로 늘어날 수 있다고 했습니다. 마이그레이션은 `npx codemod@latest @expressjs/v5-migration-recipe` 로 자동화할 수 있습니다.

Fastify 5 는 2024년 9월에 나왔고 5.12.8 이 2026년 11월 2일 보안 릴리스입니다. 최근 몇 달 5.12.x 에 보안 수정이 연달아 들어갔고 6.0.0-alpha 가 병행됩니다. alpha.6 릴리스 노트에는 `routerOptions.compile`, 스택이 없는 기본 검증 에러, 콘텐츠 타입이 응답 스키마에 선언되지 않으면 실패로 처리하는 변경이 있습니다. 6 은 아직 안정판이 아닙니다.

Hono 는 4.13.17(2026년 11월 7일)이 최신입니다. 4.13.16 에 보안 수정이 모였습니다. `mount()` 로 마운트한 접두사 안의 미들웨어를 우회할 수 있던 문제, RegExpRouter 의 와일드카드 미들웨어 누락, `validator('form')` 의 검증 우회, `csrf()` 의 `text/ping` 처리가 그 내용입니다. 해당 기능을 쓴다면 올리는 것이 좋습니다. 5.0.0-rc.0 과 rc.1 은 2026년 10월에 prerelease 로 나왔습니다.

Elysia 는 2.0 이 큰 분기점입니다. 2026년 7월 30일 베타 글에 따르면 처음부터 다시 쓴 버전이고, AOT 컴파일(Bun.build, Vite, esbuild, rspack 지원), TypeBox 트리 셰이킹, 번들 크기 50% 이상 감소, 시작 시간 30% 이상 단축을 내세웁니다. 물론 저자의 환경에서 나온 수치입니다. 파괴적 변경도 큽니다. 훅과 스키마가 핸들러 앞으로 이동했고, `onBeforeHandle` 은 `beforeHandle` 로, `resolve` 는 `derive` 로 바뀌었고, 에러 응답은 RFC 9457 `application/problem+json` 기반이 됩니다. 코드모드(`bunx @elysia/codemod@latest`)가 대부분을 자동 변환한다고 합니다. 1.4.x 는 보안 수정만 나옵니다. 위 예제의 1.x 문법을 2.0 에 그대로 옮기면 안 되니, 도입할 때는 `latest` 태그가 가리키는 버전부터 살펴야 합니다.

NestJS 12 는 2026년 8월 27일 npm 에 처음 올라왔고 지금은 12.4.0(2026년 11월 6일)입니다. 마이그레이션 가이드의 주요 항목은 이렇습니다. 코어 패키지가 모두 ESM 으로 배포되지만 CommonJS 앱도 `require(esm)` 으로 변환 없이 올릴 수 있습니다. Node 20.19 이상이 필요하고, Standard Schema 지원이 들어왔고, `@Optional()` 상속과 라이프사이클 훅 순서, Terminus 의 기존 `HealthIndicator` API 제거 같은 파괴적 변경이 있습니다. Node 24.9 미만에서는 Jest 가 ESM 패키지를 읽지 못해 Vitest 로 옮기거나 Node 를 올려야 합니다. 12.3.0 에는 네이티브 Node HTTP 어댑터가, 12.4.0 에는 핸들러가 반환하는 웹 Response 나 스트림을 보내는 기능이 들어갔습니다.

## 선택 기준

다섯 프레임워크의 차이를 요청 객체, 런타임, 미들웨어, 검증, 타입, DI 기준으로 한 장에 모으면 다음과 같습니다.

![Hono, Express, Fastify, Elysia, NestJS 를 요청 객체, 런타임, 미들웨어, 검증, 타입, DI 와 구조 여섯 가지 항목으로 나란히 비교한 표 이미지입니다. Hono 와 Elysia 는 Web Standard 객체를, Express 와 Fastify 는 Node http 를 쓰고, 내장 DI 와 모듈 구조는 NestJS 만 갖습니다.](@/assets/images/hono-express-fastify-elysia-nestjs-matrix.png)

엣지 런타임에서 돌리거나 같은 코드를 Node, Bun, Deno 사이에서 옮겨 다니고 싶다면 Hono 가 가장 자연스럽습니다. RPC 로 프론트엔드와 타입을 공유하는 구성도 됩니다. Bun 을 쓰면서 스키마 하나로 검증, 타입, 클라이언트 타입 공유까지 얻고 싶다면 Elysia 가 어울립니다. 다만 지금은 2.0 전환기라 버전 선택과 마이그레이션 비용을 같이 따져야 합니다.

Node 서버에서 스키마 기반 검증과 응답 직렬화, 플러그인 캡슐화가 필요하다면 Fastify 가 균형이 좋습니다. 기존 코드와 미들웨어 자산이 많거나 가장 널리 알려진 도구를 원한다면 Express 5 가 무난합니다. 검증과 구조는 직접 챙겨야 하지만 5 에서 `async` 핸들러의 에러 전달이 나아졌습니다.

여러 팀이 함께 만드는 큰 서비스에서 DI, 모듈, 가드, 파이프 같은 규약으로 구조를 맞추고 싶다면 **NestJS 가 맞습니다.** 코드량과 학습 비용은 늘지만 일관성으로 돌려받습니다. 서비스 규모와 팀 구성에 따른 구조 선택은 [모놀리스와 마이크로서비스](/posts/monolith-vs-microservices/)와도 이어지는 주제입니다.

어느 쪽이든 **성능 수치만 보고 정하지는 마세요.** 실제 라우트로 재 보고, 팀이 유지보수할 수 있는지, 보안 업데이트를 따라갈 수 있는지를 같이 봐야 합니다.

## 참고 자료

- [Hono: Getting Started](https://hono.dev/docs/)
- [Hono: RPC](https://hono.dev/docs/guides/rpc)
- [Hono: Validation](https://hono.dev/docs/guides/validation)
- [Hono: Benchmarks](https://hono.dev/docs/concepts/benchmarks)
- [Hono releases (GitHub)](https://github.com/honojs/hono/releases)
- [Express: Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html)
- [Express: Express v5.1.0 is now latest](https://expressjs.com/en/blog/2025-03-31-v5-1-latest-release)
- [Fastify: Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [Fastify: Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/)
- [Fastify: Benchmarks](https://fastify.dev/benchmarks/)
- [Fastify releases (GitHub)](https://github.com/fastify/fastify/releases)
- [Elysia: At a glance](https://elysiajs.com/at-glance.html)
- [Elysia: Blog](https://elysiajs.com/blog)
- [Elysia 2 beta - DayDream](https://elysiajs.com/blog/elysia-20)
- [Elysia releases (GitHub)](https://github.com/elysiajs/elysia/releases)
- [NestJS: Migration guide](https://docs.nestjs.com/migration-guide)
- [NestJS: Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS: Controllers](https://docs.nestjs.com/controllers)
- [NestJS: HTTP adapter](https://docs.nestjs.com/faq/http-adapter)
- [NestJS releases (GitHub)](https://github.com/nestjs/nest/releases)
- [npm registry: hono](https://registry.npmjs.org/hono)
- [npm registry: express](https://registry.npmjs.org/express)
- [npm registry: fastify](https://registry.npmjs.org/fastify)
- [npm registry: elysia](https://registry.npmjs.org/elysia)
- [npm registry: @nestjs/core](https://registry.npmjs.org/@nestjs/core)
