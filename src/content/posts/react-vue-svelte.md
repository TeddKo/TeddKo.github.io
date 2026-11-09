---
title: "React, Vue, Svelte, Angular, SolidJS 중 무엇을 고를까"
description: "React, Vue, Svelte, Angular, SolidJS 의 렌더링 모델, 반응성, 메타 프레임워크를 나란히 놓고, 최신 버전과 프로젝트 성격별 선택 기준을 적었습니다."
pubDatetime: 2026-11-08T20:47:00+09:00
category: frontend
tags:
  - React
  - Vue
  - Svelte
  - Angular
  - SolidJS
  - 프론트엔드
---

자바스크립트 프런트엔드 프레임워크는 선택지가 많아서 비교 글도 많습니다. 이 글은 그중 지금 실무에서 가장 자주 후보에 오르는 React, Vue, Svelte, Angular, SolidJS 를 같은 기준으로 놓고 봅니다. 기준은 UI 가 바뀔 때 DOM 이 어떻게 갱신되는지, 상태를 어떻게 선언하는지, 라우팅과 SSR 은 어떤 메타 프레임워크로 푸는지입니다.

최신 안정 버전은 React 19.3.1(2026년 10월 14일), Vue 3.5.45(2026년 11월 5일), Svelte 5.57.3, Angular 22.2.5(2026년 11월 6일), SolidJS 1.9.18(2026년 10월 29일) 입니다.

## 렌더링 모델

React 는 컴포넌트 함수를 다시 실행해 UI 설명을 만들고, 이전 결과와 비교해 DOM 을 고치는 가상 DOM 방식입니다. 상태가 바뀌면 해당 컴포넌트가 다시 렌더링되고 자식까지 딸려 실행될 수 있어서, 불필요한 렌더링을 줄이는 일이 오래된 숙제였습니다. React Compiler 가 이걸 빌드 단계에서 자동으로 메모이제이션해 줍니다.

Vue 3 도 기본은 가상 DOM 이지만, 컴파일러가 템플릿을 분석해 정적인 부분을 건너뛰고 반응형 시스템이 의존하는 값만 추적합니다. 지금 안정 버전인 3.5 가 이 구조입니다. 3.6 에서는 가상 DOM 없이 DOM 을 직접 갱신하는 Vapor 모드가 다듬어지고 있지만 아직 안정 릴리스가 아닙니다.

Svelte 는 컴파일러가 중심입니다. 컴포넌트를 빌드할 때 DOM 을 직접 고치는 코드로 바꿔 버려서 가상 DOM 비교가 없고 런타임이 작습니다. Svelte 5 부터 반응성은 runes 로 바뀌었고, `$state` 같은 표시가 컴파일러에게 의존 관계를 알려 줍니다.

Angular 는 가상 DOM 을 쓰지 않고 컴파일된 템플릿이 변경 감지를 거쳐 DOM 을 고칩니다. 예전에는 zone.js 가 비동기 작업마다 변경 감지를 일으켰지만, Angular 21 부터는 zoneless 가 기본이고 signals 가 바뀐 곳을 알려 주는 쪽으로 옮겨 왔습니다. 22 에서는 `changeDetection` 을 지정하지 않은 컴포넌트가 기본적으로 `OnPush` 로 동작합니다.

SolidJS 는 가상 DOM 이 없고 signals 를 DOM 업데이트에 직접 연결합니다. 컴포넌트 함수는 처음 한 번만 실행되고, 이후에는 signal 을 읽는 표현식만 다시 계산되어 해당 DOM 노드를 고칩니다. 컴포넌트 단위 재실행이라는 개념 자체가 없다는 점이 React 와 가장 크게 다릅니다.

![React 는 컴포넌트를 다시 실행해 가상 DOM 을 비교하고, Vue 는 템플릿 컴파일 결과를 바탕으로 의존하는 값만 추적한 뒤 가상 DOM 으로 갱신하며, Svelte 는 컴파일러가 만든 코드로 DOM 을 직접 고치고, Angular 는 signal 이 변경 감지를 일으켜 DOM 을 갱신하고, SolidJS 는 signal 이 바뀐 DOM 노드만 직접 갱신하는 과정을 나란히 그린 그림](@/assets/images/react-vue-svelte-rendering.png)

## 반응성과 상태 관리

같은 카운터를 다섯 가지로 써 보면 차이가 가장 빨리 보입니다. React 는 hooks 로 상태를 선언합니다.

```tsx
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Vue 는 `ref` 로 반응형 값을 만들고 템플릿에서 `.value` 없이 읽습니다.

```vue
<script setup lang="ts">
import { ref } from "vue";
const count = ref(0);
</script>

<template>
  <button @click="count++">{{ count }}</button>
</template>
```

Svelte 5 는 runes 를 씁니다.

```svelte
<script lang="ts">
  let count = $state(0);
</script>

<button onclick={() => count++}>{count}</button>
```

Angular 는 클래스 컴포넌트에 `signal` 을 두고 템플릿에서 함수처럼 호출해 읽습니다.

```ts
import { Component, signal } from "@angular/core";

@Component({
  selector: "app-counter",
  template: `<button (click)="count.update(c => c + 1)">{{ count() }}</button>`,
})
export class Counter {
  count = signal(0);
}
```

SolidJS 는 React 와 비슷한 JSX 모양이지만 `createSignal` 이 getter 와 setter 를 돌려줍니다.

```tsx
import { createSignal } from "solid-js";

export function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}
```

React 는 불변 값을 새로 넣는 `setCount` 호출로 갱신을 알리고, Vue 와 Svelte 는 값을 직접 바꾸면 추적 시스템이 갱신 대상을 압니다. Angular 와 SolidJS 는 읽는 쪽이 `count()` 를 호출하는 순간 의존 관계가 기록되는 signal 방식이라 구조가 닮았습니다. 다만 Solid 는 `count()` 를 JSX 안에서 읽는 표현식이 그대로 갱신 단위가 되고, Angular 는 템플릿이 그 역할을 합니다. 코드는 Svelte 가 가장 짧지만, `$state` 는 일반 자바스크립트 문법이 아니라 컴파일러가 해석하는 표시라는 점은 알아 둘 필요가 있습니다.

React 의 오랜 불편은 의존성 배열과 `useMemo`, `useCallback` 같은 수동 최적화였습니다. 2025년 10월 7일 React Compiler v1.0 이 첫 안정 릴리스로 나오면서 이 부담을 컴파일러가 덜어 주는 쪽으로 방향이 굳었습니다. React 19.2 에서는 `useEffectEvent` 가 추가되어 이펙트 안에서 최신 값을 읽는 패턴도 깔끔해졌습니다.

## 메타 프레임워크와 서버 렌더링

라우팅, 데이터 로딩, SSR 은 라이브러리 단독으로는 풀리지 않아서 대부분 메타 프레임워크와 같이 씁니다. 현재 버전은 다음과 같습니다.

![React, Vue, Svelte, Angular, SolidJS 를 핵심 버전, 렌더링, 반응성, 대표 메타 프레임워크, 학습 곡선 항목으로 비교한 표](@/assets/images/react-vue-svelte-matrix.png)

Next.js 는 React Server Components 를 중심에 둔 프레임워크이고, React Router 는 프레임워크 모드를 갖춘 라우터입니다. Nuxt 는 Vue 의 SSR, 라우팅, 서버 엔진을 묶었고, SvelteKit 은 Svelte 공식 풀스택 프레임워크입니다. Angular 는 별도 메타 프레임워크 없이 라우터와 HTTP 클라이언트, 폼이 기본으로 들어 있고 SSR, 하이드레이션, 프리렌더링도 `@angular/ssr` 로 공식 지원합니다. SolidStart 는 Solid 위에 Vite 기반 풀스택 앱을 얹는 프레임워크입니다.

React Server Components 는 서버에서만 실행되는 컴포넌트를 두어 데이터 접근을 서버 안에서 끝내는 모델입니다. 덕분에 클라이언트로 보내는 자바스크립트가 줄어듭니다. 대신 서버와 클라이언트 경계를 직접 설계해야 하고 보안도 신경 써야 합니다. React 블로그에 따르면 2025년 12월 3일 RSC 에서 인증 없이 원격 코드를 실행할 수 있는 치명적 취약점이 공개되어 19.0.1, 19.1.2, 19.2.1 로 수정되었고, 12월 11일에는 서비스 거부와 소스 코드 노출 취약점이 추가로 보고되었습니다. RSC 를 쓰는 서비스라면 React 와 프레임워크 버전을 계속 최신으로 유지해야 합니다.

## 번들 크기와 성능

번들과 성능은 숫자 하나로 말하기 어렵지만 구조상 경향은 분명합니다. Svelte 는 컴포넌트마다 필요한 코드만 만들어서 런타임이 작고, React 와 Vue 는 런타임 라이브러리가 번들에 들어갑니다. Solid 는 가상 DOM 비교가 없어서 갱신 비용이 작은 구조입니다. Angular 는 프레임워크가 제공하는 기능이 넓은 만큼 기본 구성이 가장 무겁게 느껴지는 편입니다. 실제 앱에서는 데이터 요청, 이미지, 서드파티 스크립트가 훨씬 큰 비중을 차지하는 일이 많아서, 프레임워크 간 차이보다 대상 서비스를 직접 측정해 보는 편이 낫습니다.

## 생태계와 채용

State of JavaScript 2025 의 프런트엔드 프레임워크 항목을 보면 사용 순위는 전반적으로 안정적이었고 React 가 계속 가장 많이 쓰입니다. 많이 쓰이는 만큼 불만에서도 가장 자주 언급되는데, 내용은 인지 부하, 성능, 상태 관리, 생태계의 복잡함이었습니다. 만족도는 Solid 가 5년 연속 가장 높았습니다.

사용량 1위인 React 는 라이브러리도 인력 풀도 가장 넓습니다. Angular 는 한 팀이 같은 구조로 오래 유지보수하는 대규모 앱에서 자리가 확고하고, 메이저 버전마다 지원 기간이 정해져 있어서 업그레이드 계획을 세우기 쉽습니다. Solid 는 만족도는 높지만 라이브러리와 인력 풀은 가장 작은 축에 속합니다.

## 학습 곡선

Svelte 와 Vue 는 HTML 템플릿에 가까운 문법이라 입문 장벽이 낮습니다. Svelte 는 문법이 가장 가볍지만 runes 라는 새 개념을 배워야 하고, Vue 는 Options API 와 Composition API 중 무엇을 쓸지 정해야 합니다. React 는 JSX 와 hooks 규칙만 익히면 자바스크립트로 다 표현할 수 있는 대신, 라우팅과 데이터 로딩과 상태 관리를 어떤 조합으로 갈지 직접 골라야 합니다. Angular 는 TypeScript, 데코레이터, 의존성 주입, RxJS 까지 배울 것이 가장 많지만 한 번 익히면 프로젝트마다 구조가 비슷합니다. Solid 는 JSX 문법이 React 와 같아서 눈에는 익숙하지만, 컴포넌트가 한 번만 실행된다는 점을 모르고 React 방식으로 구조 분해를 하면 반응성이 끊깁니다.

## 지금 상황

React 최신 안정 버전은 19.3.1 입니다. 19.2(2025년 10월 1일)에서 `Activity`, `useEffectEvent`, 퍼포먼스 트랙이 들어왔고, 19.3(2026년 9월 9일)에서 View Transitions, Fragment Refs, Trusted Types 지원 등이 추가되었습니다. React Compiler 는 2025년 10월 7일 v1.0 이 나왔고, React Foundation 은 2026년 2월 24일 Linux Foundation 아래에서 공식 출범했습니다. Next.js 는 16.4.5, React Router 는 8.5.1 입니다.

Vue 는 3.5.45 가 최신 안정 버전이고 3.6 은 3.6.0-rc.14(2026년 10월 30일)까지 나온 릴리스 후보입니다. 3.6 변경 로그에 `compiler-vapor` 와 `runtime-vapor` 항목이 계속 올라오니 Vapor 모드 개발은 활발합니다. 그래도 안정 릴리스가 아직 없으니 Vapor 를 프로덕션 기본 렌더링으로 삼기는 이르고, 안정 버전 기준으로 Vue 는 가상 DOM 방식입니다. Nuxt 는 4.6.4 가 최신이고 Nuxt 3 는 2026년 7월 31일에 지원이 끝났습니다.

Svelte 는 5.57.3 이 최신입니다. 컴포넌트 안에서 `await` 를 쓰는 async Svelte 가 2025년 8월에 정식으로 나왔고, 이어서 attachments, Remote Functions, 타입이 있는 context 같은 기능이 들어왔습니다. SvelteKit 3 는 2026년 10월 1일 `sv` 1.0 과 함께 출시되었고 npm 최신 버전은 3.1.1 입니다. 업그레이드는 `sv migrate` 가 대부분 자동으로 처리하며, Cloudflare 의 `platform` 객체 제거 같은 breaking change 는 마이그레이션 가이드에 정리되어 있습니다.

Angular 는 22.2.5 가 최신이고 Angular 22 는 2026년 6월 3일에 출시되었습니다. Angular 공식 릴리스 일정에 따르면 22 는 2027년 6월까지 활성 지원, 2028년 6월까지 LTS 이고, 21 은 2027년 6월까지 LTS 입니다. zoneless 는 21 부터 기본이며, 22 변경 로그에는 Signal Forms API 가 공개 API 로 승격된 항목과 TypeScript 6.0 미만 지원 중단이 올라 있습니다. 컴포넌트 기본 변경 감지가 `OnPush` 로 바뀐 것은 breaking change 이므로 업그레이드할 때 확인해야 합니다.

SolidJS 는 1.9.18 이 최신 안정 버전이고, npm 의 `next` 태그에는 2.0.0-rc.21(2026년 11월 4일)이 올라와 있어 2.0 은 릴리스 후보 단계입니다. SolidStart 는 2.0.0 이 2026년 8월 4일에 나왔고 2.2.2 가 최신이며, 공식 문서 기준으로 SolidStart v2 는 Solid v1 과 Vite v8 이상 위에서 동작합니다.

## 어떻게 고를까

프런트엔드를 독립된 제품으로 크게 키울 거라 인력 수급과 라이브러리 선택지가 중요하다면 React 가 안전합니다. RSC 와 Next.js 로 서버 렌더링까지 한 스택에서 해결할 수 있지만 골라야 할 것이 많고, RSC 를 쓴다면 보안 패치를 놓치지 않는 운영이 따라와야 합니다.

템플릿 중심의 완만한 학습 곡선에 공식 라우터와 상태 관리가 잘 맞물린 구성을 원하면 Vue 와 Nuxt 가 어울립니다. Vapor 모드는 3.6 안정 릴리스가 나온 뒤에 봐도 늦지 않습니다.

번들 크기와 문법의 단순함이 중요하고 작은 팀이 빠르게 만드는 프로젝트라면 Svelte 와 SvelteKit 이 맞습니다. 다만 SvelteKit 3 는 출시된 지 한 달 남짓이고, React 와 비교하면 라이브러리와 인력 풀이 작습니다.

여러 팀이 오래 유지보수할 대규모 앱이라 라우터, 폼, HTTP, 테스트까지 정해진 구조가 있는 편이 낫다면 Angular 가 맞습니다. 배울 것은 많지만 signals 와 zoneless 로 반응성 모델이 현대화되어 예전의 무거운 이미지는 많이 옅어졌습니다.

갱신 성능과 반응성 모델의 단순함이 우선이고 생태계가 작은 것을 감수할 수 있다면 SolidJS 와 SolidStart 가 후보입니다. 2.0 이 아직 릴리스 후보라서 큰 변경이 한 번 더 올 수 있다는 점은 감안해야 합니다.

## 참고 자료

- [React releases (GitHub)](https://github.com/facebook/react/releases)
- [React Blog](https://react.dev/blog)
- [Vue core releases (GitHub)](https://github.com/vuejs/core/releases)
- [Vue core CHANGELOG (main)](https://raw.githubusercontent.com/vuejs/core/main/CHANGELOG.md)
- [Vue core CHANGELOG (minor branch, 3.6.0-rc.14)](https://raw.githubusercontent.com/vuejs/core/minor/CHANGELOG.md)
- [Vue v3.6.0-rc.14 release (GitHub)](https://github.com/vuejs/core/releases/tag/v3.6.0-rc.14)
- [npm registry: vue](https://registry.npmjs.org/vue)
- [Svelte releases (GitHub)](https://github.com/sveltejs/svelte/releases)
- [Svelte Blog](https://svelte.dev/blog)
- [What's new in Svelte: October 2026](https://svelte.dev/blog/whats-new-in-svelte-october-2026)
- [npm registry: @sveltejs/kit](https://registry.npmjs.org/@sveltejs%2fkit)
- [npm registry: react-router](https://registry.npmjs.org/react-router)
- [Next.js releases (GitHub)](https://github.com/vercel/next.js/releases)
- [Nuxt releases (GitHub)](https://github.com/nuxt/nuxt/releases)
- [Angular releases](https://angular.dev/reference/releases)
- [Angular CHANGELOG (GitHub)](https://github.com/angular/angular/blob/main/CHANGELOG.md)
- [Angular: Zoneless](https://angular.dev/guide/zoneless)
- [Angular: Signals](https://angular.dev/essentials/signals)
- [Angular: Server and hybrid rendering](https://angular.dev/guide/ssr)
- [npm registry: @angular/core](https://registry.npmjs.org/@angular%2fcore)
- [npm registry: solid-js](https://registry.npmjs.org/solid-js)
- [npm registry: @solidjs/start](https://registry.npmjs.org/@solidjs%2fstart)
- [Solid Docs: Signals](https://docs.solidjs.com/concepts/signals)
- [Solid Docs: SolidStart](https://docs.solidjs.com/solid-start)
- [State of JavaScript 2025: Front-end Frameworks](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/)
