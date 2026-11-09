---
title: "프런트엔드를 서버 프레임워크로 만든다면, Laravel 부터 LiveView 와 Blazor 까지"
description: "Laravel 의 Blade, Livewire, Inertia 를 중심으로 Symfony UX, Rails Hotwire, Phoenix LiveView, Django, Blazor 가 화면 상태와 상호작용을 어디서 처리하는지 비교하고, 언제 JS SPA 로 넘어가야 하는지 적었습니다."
pubDatetime: 2026-11-08T20:59:00+09:00
category: frontend
tags:
  - Laravel
  - Livewire
  - Hotwire
  - Phoenix LiveView
  - Blazor
  - 프론트엔드
---

React 나 Vue 로 시작하면 화면은 브라우저의 일이고 서버는 JSON 을 내주는 곳이 됩니다. 그런데 관리자 화면이나 업무 시스템을 만들다 보면 이 분업이 이상하게 느껴지는 순간이 옵니다. 폼 하나를 만들려고 API 를 설계하고, 타입을 양쪽에 따로 선언하고, 인증을 두 번 붙이고 있기 때문입니다. 서버 프레임워크가 화면까지 맡는 쪽은 이 중복을 통째로 없애는 대신 다른 값을 치릅니다. 상태가 서버에 있으면 클릭마다 네트워크가 끼어들고, 연결이 끊기면 화면이 멈춥니다.

이 글은 PHP 의 Laravel 을 중심에 두고, 같은 문제를 다른 언어가 어떻게 푸는지 옆에 놓아 봅니다. 자바스크립트 쪽 도구끼리의 비교는 [React, Vue, Svelte 비교](/posts/react-vue-svelte/)에 따로 적었습니다.

## Laravel 이 화면을 만드는 세 가지 길

Laravel 13 은 2026년 3월 17일에 나왔고 PHP 8.3 이상을 요구합니다. 버그 수정은 18개월, 보안 수정은 2년이라 2028년 3월 17일까지 지원됩니다. 이 릴리스의 새 기능은 AI SDK, JSON:API 리소스, 벡터 검색, 큐 라우팅처럼 거의 전부 서버 쪽 이야기입니다. 화면은 여전히 아래 셋 중 하나로 만듭니다.

**Blade** 는 요청마다 서버가 HTML 을 완성해 내려보내는 전통 방식입니다. 상호작용이 필요한 자리에만 자바스크립트를 얹습니다. **Livewire** 는 PHP 클래스에 상태와 메서드를 두고 Blade 에서 `wire:click` 같은 속성으로 연결합니다. **Inertia** 는 라우팅과 컨트롤러는 Laravel 에 남기고 페이지 컴포넌트만 React, Vue, Svelte 로 쓰는 방식입니다.

공식 starter kit 은 이 구분을 그대로 보여 줍니다. React(React 19, Inertia 2, shadcn/ui), Vue(Vue 3, Inertia 2, shadcn-vue), Svelte(Svelte 5, Inertia 2, shadcn-svelte) 는 Inertia 위에 올라가고, Livewire 키트는 Livewire 4 와 Flux UI 로 구성됩니다. `laravel new --livewire` 처럼 설치할 때 고르면 됩니다. Laravel 은 JS 프레임워크의 경쟁자라기보다 그것들을 얹을 수 있는 백엔드에 가깝고, 서버만으로 가겠다는 선택지가 같은 줄에 하나 더 놓여 있는 셈입니다.

Livewire 는 3 에서 4 로 넘어오면서 모양이 꽤 바뀌었습니다. 4 에서는 PHP 와 Blade 를 한 파일에 담는 single-file 컴포넌트가 `make:livewire` 의 기본 출력이고, 컴포넌트 안의 일부 영역만 독립적으로 갱신하는 islands 가 들어왔습니다. 문서에는 Volt 가 더 이상 필요하지 않고 기존 Volt 클래스 방식 컴포넌트가 수정 없이 동작한다고 적혀 있습니다. Volt 를 쓰던 프로젝트는 import 와 라우트 선언만 바꾸면 됩니다. 클래스와 Blade 를 따로 두는 v3 방식도 그대로 쓸 수 있고, GitHub 릴리스에는 3.8.11 과 4.4.8 이 나란히 올라와 있습니다.

## 상태가 어디 사느냐가 전부입니다

서버가 화면을 맡는 방식은 겉보기엔 비슷해도 "상호작용이 일어났을 때 서버가 무엇을 기억하고 있느냐"에서 갈립니다. 이 한 가지에서 전송 방식, 확장 비용, 연결이 끊겼을 때의 동작이 거의 다 따라 나옵니다.

![Blade 전체 페이지, Livewire 와 Live Components, Hotwire Turbo, Phoenix LiveView, Blazor Server 와 WebAssembly, Inertia 브리지가 각각 상태를 어디에 두고 무엇을 주고받는지 한 표로 정리한 그림입니다.](@/assets/images/laravel-and-server-driven-ui-models.png)

가장 놀라운 쪽은 Livewire 입니다. 서버가 컴포넌트를 메모리에 들고 있을 것 같지만 그렇지 않습니다. 렌더링이 끝나면 컴포넌트의 공개 프로퍼티를 JSON 스냅샷으로 만들어 HTML 에 `wire:snapshot` 속성으로 심어 두고, 사용자가 버튼을 누르면 브라우저가 호출할 메서드와 그 스냅샷을 함께 보냅니다. 서버는 요청마다 컴포넌트를 새로 만들어 프로퍼티를 채우고, 메서드를 실행하고, 다시 렌더링해서 새 스냅샷과 HTML 을 돌려줍니다. 상태는 서버가 아니라 브라우저와 서버 사이를 오가는 셈이라 서버 프로세스는 요청이 끝나면 아무것도 붙들고 있지 않습니다. 로드 밸런서 뒤에 서버를 몇 대 두든 상관없다는 게 이 방식의 큰 장점입니다.

Phoenix LiveView 는 정반대입니다. 페이지는 일반 HTTP 요청으로 처음 그려지고, 브라우저가 연결을 올리면 서버에 사용자마다 LiveView 프로세스가 하나 뜹니다. 문서의 표현대로 소켓 assigns 는 서버 쪽에 유지되는 값이고, 이벤트가 오면 프로세스가 상태를 바꾸고 달라진 부분만 diff 로 밀어 보냅니다. 요청마다 상태를 복원하는 비용이 없고 서버가 먼저 화면을 밀어 줄 수도 있지만, 접속자 수만큼 프로세스와 메모리를 서버가 들고 있어야 합니다. Elixir 는 가벼운 프로세스를 수없이 띄우도록 설계된 런타임이라 이 방식과 궁합이 좋습니다. 같은 구조를 PHP 의 요청-응답 모델로 흉내 내려면 얘기가 달라집니다.

Blazor Server 는 LiveView 와 같은 쪽입니다. 컴포넌트는 서버에서 실행되고 UI 갱신, 이벤트 처리, JS 호출이 SignalR 연결(WebSockets)로 오갑니다. 클라이언트마다 서버에 쌓이는 상태가 circuit 이고, 브라우저 탭을 하나 더 열면 circuit 이 하나 더 생깁니다. Microsoft 문서는 이 모델의 한계를 숨기지 않습니다. 상호작용마다 네트워크를 한 번 거치니 지연이 늘고, 연결이 끊기면 인터랙션이 멈추고, 사용자가 많으면 서버가 연결과 상태를 감당해야 하며, CDN 에서 정적으로 서빙하는 식의 배포는 안 됩니다.

Hotwire 는 둘과 다른 길을 갑니다. Turbo Drive 는 같은 도메인의 링크 클릭과 폼 제출을 가로채 응답으로 `<body>` 를 갈아끼우고, Turbo Frames 는 `<turbo-frame>` 으로 감싼 영역만, Turbo Streams 는 `append`, `replace`, `remove` 같은 동작으로 여러 곳을 갱신합니다. 서버에는 화면 전용 상태가 없습니다. 모든 게 HTML 조각이고 상태는 DB 와 세션에 있습니다. 그래서 가장 평범한 서버 앱에 가깝고, 실시간이 필요할 때만 Streams 를 WebSocket 이나 SSE 에 올립니다.

## 같은 카운터를 네 번 만들어 보면

가장 작은 예제로 위 차이가 코드에서 어떻게 보이는지 살펴보겠습니다. Livewire 4 의 single-file 컴포넌트입니다. 파일 이름은 `make:livewire counter` 로 만들면 `resources/views/components/⚡counter.blade.php` 가 됩니다.

```blade
<?php

use Livewire\Component;

new class extends Component {
    public int $count = 0;

    public function increment(): void
    {
        $this->count++;
    }
};
?>

<div>
    <button wire:click="increment">{{ $count }}</button>
</div>
```

`$count` 는 평범한 PHP 프로퍼티입니다. 버튼을 누르면 앞에서 본 스냅샷이 서버로 올라가 `increment()` 가 돌고 숫자만 바뀐 HTML 이 돌아옵니다. Phoenix LiveView 는 같은 일을 프로세스 안의 assigns 로 합니다.

```elixir
defmodule MyAppWeb.CounterLive do
  use MyAppWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, :count, 0)}
  end

  def render(assigns) do
    ~H"""
    <button phx-click="inc">{@count}</button>
    """
  end

  def handle_event("inc", _params, socket) do
    {:noreply, update(socket, :count, &(&1 + 1))}
  end
end
```

Blazor 는 C# 코드가 Razor 안에 들어가고, 렌더 모드 한 줄이 상태가 사는 곳을 정합니다.

```razor
@page "/counter"
@rendermode InteractiveServer

<button @onclick="Increment">@count</button>

@code {
    private int count;

    private void Increment() => count++;
}
```

`InteractiveServer` 를 `InteractiveWebAssembly` 로 바꾸면 똑같은 컴포넌트가 브라우저의 .NET 런타임에서 돌고 서버 왕복이 사라집니다. .NET 8 부터의 Blazor Web App 은 컴포넌트마다 렌더 모드를 고릅니다. 상호작용 없는 Static Server, Interactive Server, Interactive WebAssembly, 그리고 처음에는 서버로 돌다가 Blazor 번들이 내려받아진 뒤의 방문부터 클라이언트로 돌리는 Interactive Auto 가 있습니다. 같은 컴포넌트 코드를 두고 서버에서 돌릴지 브라우저에서 돌릴지 나중에 정할 수 있다는 점이 Blazor 의 가장 큰 특징입니다.

Hotwire 에서는 서버 상태 카운터가 따로 필요하지 않습니다. 클릭만으로 끝나는 동작은 Stimulus 가 브라우저에서 처리하고, 서버에 저장해야 하는 변화는 폼이나 링크로 Turbo 가 처리하는 식으로 나눕니다.

```html
<div data-controller="counter">
  <button data-action="counter#increment">
    <span data-counter-target="output">0</span>
  </button>
</div>
```

```javascript
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["output"];

  increment() {
    this.outputTarget.textContent = Number(this.outputTarget.textContent) + 1;
  }
}
```

저장이 필요한 부분은 Turbo Frame 으로 감싸면 됩니다. 아래 링크를 누르면 서버가 같은 id 의 프레임이 든 편집 폼을 내려주고, 프레임 안의 내용만 교체됩니다.

```html
<turbo-frame id="task_1">
  <p>우유 사기</p>
  <a href="/tasks/1/edit">수정</a>
</turbo-frame>
```

네 예제를 나란히 놓고 보면 Hotwire 만 카운터를 서버로 보내지 않는다는 점이 눈에 띕니다. 나머지 셋은 숫자 하나를 올리려고 서버를 다녀옵니다. 그래서 카운터 같은 순수 클라이언트 동작에는 서버 주도 방식이 어울리지 않습니다. 드롭다운을 열고 닫는 데까지 왕복을 만들면 안 되고, 이런 곳에는 Alpine.js 나 Stimulus 같은 작은 클라이언트 코드를 섞는 것이 일반적입니다.

## PHP 계열의 다른 선택지

PHP 에서 Laravel 만 이 길을 가는 건 아닙니다. Symfony 는 Twig 템플릿 위에 Symfony UX 를 얹습니다. UX Turbo 는 Hotwire Turbo 를 그대로 통합하고(`composer require symfony/ux-turbo`), Drive 에서는 폼 검증 오류에 422 를, 성공에는 303 리다이렉트를 쓰라는 규칙까지 문서에 적혀 있습니다. Mercure 허브를 붙이면 `<twig:Turbo:Stream:From>` 으로 실시간 스트림도 받습니다.

Live Components 는 Livewire 와 Phoenix LiveView 에서 영감을 받았다고 스스로 밝힙니다. `#[AsLiveComponent]` 를 붙인 PHP 클래스와 Twig 템플릿으로 구성되고, `#[LiveProp]` 은 상태가 되며 브라우저에서 바꾸려면 `writable: true` 를 줘야 합니다. 액션을 호출하면 Stimulus `live` 컨트롤러가 POST 요청을 보내고 서버가 상태를 복원해 다시 렌더링한 HTML 로 기존 DOM 을 morph 합니다. 상태가 요청마다 복원되니 Livewire 와 같은 계열이라고 보면 됩니다. Symfony 8.1 은 PHP 8.4 이상이 필요하고, 같이 쓰는 LTS 는 7.4 입니다.

PHP 에서 Livewire 도 Live Components 도 과하다 싶으면 htmx 를 쓰는 사람도 많습니다. 약 16k 의 라이브러리이고 `hx-post` 로 서버에 요청하고 `hx-swap` 으로 응답 HTML 을 끼워 넣는 식이라, 어떤 서버 언어와도 붙습니다.

## 다른 언어의 같은 자리

**Rails** 의 답은 Hotwire(Turbo, Stimulus, Native)입니다. 홈페이지는 Turbo 가 전통적으로 자바스크립트가 필요했던 상호작용의 80% 이상을 해결한다고 주장하고, 나머지를 Stimulus 가 맡는다고 설명합니다. 80% 라는 숫자는 만든 쪽의 주장이니 걸러 들어야 하지만, 방향은 분명합니다. 링크와 폼을 서버 호출로 두고 HTML 조각만 교체하는 이 방식 덕에 Rails 앱은 API 없이도 SPA 처럼 느껴지게 만들 수 있습니다. Native 는 같은 웹 코드베이스에서 모바일 앱을 만드는 도구입니다. Rails 8.1 은 2025년 10월 22일에 나왔고 2026년 11월 4일에는 8.1.4.1 과 8.0.5.2 보안 릴리스가 나왔습니다.

**Phoenix** 의 LiveView 는 앞에서 설명한 대로 프로세스 기반입니다. 상태가 서버에 있으니 폼 검증이나 목록 필터링처럼 서버가 답을 알아야 하는 상호작용에서 가장 편합니다. 반대로 서버가 몰라도 되는 동작까지 왕복시키면 손해라는 점은 다른 서버 주도 방식과 똑같습니다. 문서에 보이는 버전은 1.2.13 입니다.

**Django** 는 서버 템플릿이 기본이고, 상호작용이 필요하면 htmx 같은 라이브러리를 붙이는 쪽이 흔합니다. Django 자체가 컴포넌트 모델이나 실시간 diff 를 제공하는 건 아닙니다. 최신은 6.1.3 이고 5.2 LTS 는 2028년 4월까지 보안 수정을 받습니다.

**.NET** 의 Blazor 는 앞에서 본 렌더 모드가 핵심입니다. .NET 10 은 LTS 로 2028년 11월 14일까지 지원되고 .NET 11 은 RC 단계입니다. 서버 모델이 곤란한 곳, 예를 들어 오프라인이 필요한 곳에는 WebAssembly 모델을 PWA 로 만들어 쓰도록 문서가 안내합니다. 기존 .NET 자산이 많고 팀이 C# 으로 통일돼 있다면 Blazor 가 가장 자연스럽습니다.

## Inertia 는 서버 중심의 탈출구입니다

서버 주도 방식이 한계에 닿는 건 보통 화면이 클라이언트 상태로 가득 찰 때입니다. 드래그 앤 드롭, 복잡한 차트, 입력 중 즉시 반응해야 하는 에디터 같은 것들입니다. 이때 SPA 로 갈아타면서 서버를 전부 갈아엎는 건 비효율적입니다.

Inertia 는 이 틈을 메웁니다. 공식 문서는 "modern monolith"라는 말로 설명하는데, 클라이언트 쪽 라우팅이 없고 API 도 필요 없습니다. 컨트롤러와 페이지 뷰를 지금처럼 쓰되 페이지만 React, Vue, Svelte 컴포넌트로 만듭니다. 클라이언트 어댑터는 이 셋이 공식이고, 서버 어댑터는 Laravel, Rails, Phoenix, Django 가 있습니다. 그러니 이 글에 나온 서버 프레임워크 상당수가 같은 탈출구를 공유하는 셈입니다. 문서도 Laravel 에 가장 잘 맞춰져 있다고 밝힙니다.

버전 이야기를 하나 하면, Inertia 3 이 2026년 3월 26일에 나왔습니다. 2.x 는 2026년 9월 26일까지 버그 수정을, 2027년 3월 26일까지 보안 수정을 받습니다. 그런데 Laravel 공식 starter kit 은 아직 Inertia 2 를 씁니다. 새 프로젝트를 만들 때 키트를 그대로 쓸지 3 으로 올릴지는 따로 확인해 볼 문제입니다.

Livewire 로 시작해서 Inertia 로 옮기는 길도, 그 반대도 막혀 있지 않습니다. Laravel 은 백엔드이고 화면 방식은 페이지 단위로도 섞을 수 있기 때문입니다. 관리 화면은 Livewire 로, 에디터가 있는 한 페이지만 React 로 두는 식이 현실적입니다.

## 비교 정리

![Livewire, Hotwire, LiveView, Blazor Server, Inertia 를 상태 위치, 전송 방식, 상호작용 비용, 오프라인, 팀 기술 항목으로 비교한 표입니다.](@/assets/images/laravel-and-server-driven-ui-matrix.png)

첫 화면과 SEO 는 표에 넣지 않았습니다. 서버가 HTML 을 만들어 주는 방식은 이 부분이 거의 공짜이기 때문입니다. Blade 든 Livewire 든 처음 응답이 완성된 HTML 이라 검색 엔진과 느린 기기에 유리하고, LiveView 와 Blazor 의 인터랙티브 모드도 첫 렌더는 서버가 합니다(Blazor 는 prerendering 이 기본으로 켜집니다). 반대로 Inertia 로 클라이언트 렌더링을 쓰면 이 이점을 SSR 설정으로 다시 확보해야 합니다.

비용은 두 군데서 나옵니다. 하나는 지연입니다. 서버 주도 방식의 상호작용 시간은 코드가 아니라 사용자와 서버 사이의 왕복 시간이 결정합니다. 사내 도구라면 거의 느껴지지 않지만, 해외 사용자나 불안정한 모바일 회선에서는 버튼마다 반응이 늦습니다. 다른 하나는 오프라인입니다. 모바일 앱처럼 터널 안에서도 쓰이는 화면이라면 서버 주도 방식 대부분이 맞지 않고, 이런 경우 Blazor WebAssembly 를 PWA 로 만들거나 일반 SPA 를 쓰는 게 낫습니다.

## 팀에 맞춰 고릅니다

기술 우열보다 팀이 이미 가진 능력이 선택을 더 많이 좌우합니다. PHP 개발자 몇 명이 관리 도구를 만든다면 Laravel 과 Livewire 로 자바스크립트 빌드 체인 없이 끝내는 것이 가장 싸고, 나중에 화면이 복잡해지면 Inertia 를 얹으면 됩니다. Rails 팀이면 Hotwire, Elixir 를 이미 쓰면 LiveView, C# 이 주력이면 Blazor 입니다. 서버 언어를 먼저 정하고 나면 화면 방식의 후보는 대개 하나로 좁혀집니다.

반대로 프런트엔드 전담 인력이 있고 모바일 웹이나 오프라인 요구가 크다면 서버 주도 방식의 장점은 줄어듭니다. 그때는 서버를 JSON API 로 두고 React, Vue, Svelte 로 가는 편이 팀 구조에도 맞습니다. 서버 주도 방식은 "프런트엔드를 안 해도 된다"는 약속이 아니라 "프런트엔드 일을 서버 코드로 옮겨 온다"는 약속입니다. 그 서버 코드를 누가 쓰는지가 결국 기준이 됩니다.

## 참고 자료

- [Laravel 13.x Release Notes](https://laravel.com/docs/13.x/releases)
- [Laravel Starter Kits](https://laravel.com/starter-kits)
- [Livewire releases (GitHub)](https://github.com/livewire/livewire/releases)
- [Livewire 4.x: Upgrading](https://livewire.laravel.com/docs/4.x/upgrading)
- [Livewire 4.x: Components](https://livewire.laravel.com/docs/4.x/components)
- [Livewire 4.x: Hydration](https://livewire.laravel.com/docs/4.x/hydration)
- [Inertia: Getting started (v2)](https://inertiajs.com/docs/v2/getting-started/index)
- [Inertia: Getting started (v3)](https://inertiajs.com/docs/v3/getting-started/index)
- [Symfony UX Live Component](https://symfony.com/bundles/ux-live-component/current/index.html)
- [Symfony UX Turbo](https://symfony.com/bundles/ux-turbo/current/index.html)
- [Symfony Releases](https://symfony.com/releases)
- [Hotwire](https://hotwired.dev/)
- [Turbo Handbook: Introduction](https://turbo.hotwired.dev/handbook/introduction)
- [Stimulus Handbook: Introduction](https://stimulus.hotwired.dev/handbook/introduction)
- [Rails 8.1 release post](https://rubyonrails.org/2025/10/22/rails-8-1)
- [Rails blog](https://rubyonrails.org/blog)
- [Phoenix LiveView: Phoenix.LiveView](https://phoenix-live-view.hexdocs.pm/Phoenix.LiveView.html)
- [Django: Download](https://www.djangoproject.com/download/)
- [htmx](https://htmx.org/)
- [ASP.NET Core Blazor hosting models](https://learn.microsoft.com/en-us/aspnet/core/blazor/hosting-models?view=aspnetcore-10.0)
- [ASP.NET Core Blazor render modes](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/render-modes?view=aspnetcore-10.0)
- [.NET downloads](https://dotnet.microsoft.com/en-us/download/dotnet)
