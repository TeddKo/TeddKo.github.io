---
title: "SPA 는 왜 생겼고, 왜 다시 서버로 돌아가는 걸까"
description: "SPA 와 전통적인 MPA 의 동작 방식 차이, History API 로 만드는 클라이언트 라우팅, SPA 가 치르는 비용과 그에 대한 업계의 대응(SSR, SSG, 아일랜드, RSC, View Transitions), 그래도 SPA 가 맞는 경우를 정리했습니다."
pubDatetime: 2026-11-09T07:12:00+09:00
category: frontend
tags:
  - SPA
  - 프론트엔드
  - 렌더링
  - SSR
  - 웹
---

모바일 앱 개발을 하다 웹을 만지면 SPA 라는 말이 꽤 일찍 나옵니다. 화면 전환이 부드럽고 앱처럼 동작하는 웹이라는 느낌으로 받아들이기 쉬운데, 실제로 SPA 를 쓰는 서비스를 열어 보면 처음 로딩이 묵직하거나 새로고침하면 상태가 날아가는 경험도 같이 따라옵니다. 이 글은 SPA 가 정확히 무엇이고 전통적인 웹과 무엇이 다른지, 그 대가로 무엇을 치르는지, 그리고 최근 몇 년간 프레임워크들이 왜 다시 서버 쪽으로 무게를 옮기고 있는지를 순서대로 적었습니다. 프레임워크 자체를 비교한 이야기는 [React, Vue, Svelte, Angular, SolidJS 중 무엇을 고를까](/posts/react-vue-svelte/)에 있습니다.

## MPA 에서 SPA 로

전통적인 웹, 이른바 MPA(Multi-Page Application)는 링크를 누를 때마다 서버에 새 요청을 보내고 HTML 문서 전체를 새로 받아 옵니다. 서버는 템플릿에 데이터를 끼워 완성된 HTML 을 만들어 주고, 브라우저는 그걸 처음부터 파싱해서 그립니다. 단순하고 튼튼한 모델입니다. 대신 화면이 바뀔 때마다 문서가 통째로 교체되니 입력 중이던 값, 스크롤 위치, 열어 둔 메뉴 같은 화면 상태가 모두 초기화됩니다.

SPA(Single Page Application)는 MDN 설명 그대로 문서를 한 번만 로드하고, 이후에는 JavaScript 가 Fetch 같은 API 로 데이터를 받아 와서 문서의 본문을 바꿔 끼우는 방식입니다. 이동할 때 새 페이지를 요청하지 않습니다. 서버가 처음에 내려주는 HTML 은 거의 비어 있는 셸(`<div id="root"></div>` 정도)이고, 나머지는 번들된 JS 가 그립니다.

![MPA 는 이동할 때마다 서버가 HTML 문서 전체를 만들어 내려주고 브라우저가 문서를 새로 로드하는 반면, SPA 는 처음 한 번 HTML 셸과 JS 번들을 받은 뒤 링크 클릭을 JS 가 가로채 pushState 로 URL 을 바꾸고 JSON 만 fetch 해서 바뀐 영역만 다시 그리는 흐름을 나란히 보여 주는 그림](@/assets/images/what-is-spa-flow.png)

이 구조가 가능해진 배경에는 브라우저 안에서 서버와 비동기로 통신하는 기술이 있습니다. XMLHttpRequest 는 Microsoft 의 Outlook Web Access 팀이 1998년에 만든 개념이고, 1999년 3월 Internet Explorer 5.0 에 들어갔습니다. 이걸 대규모로 보여 준 게 2004년 Gmail 이었고, 2005년 2월 Jesse James Garrett 가 "Ajax: A New Approach to Web Applications" 라는 글에서 Ajax 라는 이름을 붙였습니다. 페이지 전체가 아니라 필요한 부분만 서버에서 받아 와 고친다는 발상이 그때 자리를 잡았고, 그 연장선에서 "아예 페이지 이동도 전부 JS 로 처리하자"는 SPA 가 나왔습니다. 이후 Backbone 과 AngularJS 같은 초기 프레임워크가 화면 상태와 라우팅을 JS 쪽에서 관리하는 틀을 만들었고, React 와 Vue 가 컴포넌트 단위로 그 방식을 일반화했습니다.

## 라우팅은 어떻게 하나

SPA 에서 가장 헷갈리는 부분이 "페이지를 요청하지 않는데 주소창 URL 은 왜 바뀌지?" 입니다. 답은 브라우저의 History API 입니다. 예전에는 `#!/orders` 처럼 해시(fragment) 뒤를 바꾸는 식으로 흉내를 냈지만, `history.pushState` 는 문서를 다시 로드하지 않고 히스토리 항목을 추가하면서 URL 을 진짜 경로로 바꿔 줍니다. 사용자가 뒤로 가기를 누르면 `popstate` 이벤트가 발생하니, 앱은 그때 URL 을 읽어 맞는 화면을 그리면 됩니다.

라우터의 핵심은 이게 전부입니다. 아래는 프레임워크 없이 만든 최소한의 예시입니다.

```js
const routes = {
  "/": () => "<h1>홈</h1>",
  "/orders": () => "<h1>주문 목록</h1>",
};

function render() {
  const view = routes[location.pathname] ?? (() => "<h1>404</h1>");
  document.querySelector("#root").innerHTML = view();
}

document.addEventListener("click", e => {
  const a = e.target.closest("a[data-link]");
  if (!a) return;
  e.preventDefault();
  history.pushState(null, "", a.getAttribute("href"));
  render();
});

window.addEventListener("popstate", render);
render();
```

링크 클릭을 가로채서 `pushState` 로 URL 을 바꾸고 화면을 다시 그립니다. 뒤로 가기는 `popstate` 가 받습니다. 실제 라우터는 여기에 중첩 라우트, 파라미터, 데이터 로딩, 코드 스플리팅 같은 걸 얹은 것입니다. 한 가지 놓치기 쉬운 점은 서버 쪽 설정입니다. 사용자가 `/orders` 를 주소창에 직접 입력하거나 새로고침하면 브라우저는 서버에 `/orders` 를 요청하는데, 서버가 그런 파일이 없다고 404 를 내면 앱이 뜨지도 못합니다. 그래서 SPA 를 정적 호스팅할 때는 알 수 없는 경로를 전부 `index.html` 로 돌려주는 설정이 거의 항상 필요합니다.

## 얻는 것

가장 큰 장점은 상태가 이동을 넘어 살아남는다는 점입니다. 목록에서 필터를 걸고 상세로 들어갔다 돌아와도, 장바구니나 에디터 안의 작성 중인 내용이 문서 교체 없이 그대로 유지됩니다. 전환 애니메이션도 마음대로 만들 수 있고, 화면 일부만 갱신하니 이동 체감이 빠릅니다.

구조적으로도 이점이 있습니다. 서버는 JSON API 만 제공하면 되고 화면은 클라이언트가 책임지니, 같은 API 를 웹, Android, iOS 가 같이 씁니다. 저처럼 Android 앱과 서버를 같이 만지는 입장에서는 이 분리가 가장 실감 나는 부분입니다. 서버를 템플릿 렌더링에서 해방시키면 프론트와 백엔드 팀이 계약(API 스펙)만 맞추고 따로 일할 수 있습니다.

## 치르는 비용

문제는 이 이점들이 공짜가 아니라는 점입니다.

**초기 JS 용량과 첫 화면.** 서버가 빈 셸을 주기 때문에 사용자는 JS 번들을 내려받고, 파싱하고, 실행하고, 그 안에서 다시 데이터 API 를 호출한 뒤에야 내용을 봅니다. 요청이 직렬로 이어지는 폭포 구조입니다. 번들이 커질수록, 기기가 느릴수록 빈 화면 시간이 길어집니다.

**SEO.** MDN 도 SPA 의 단점으로 SEO 가 어렵다는 점을 꼽습니다. 크롤러가 JS 를 실행해 주는 경우도 있지만 처리 범위와 시점을 앱이 통제할 수 없고, 링크 미리보기를 만드는 쪽은 대체로 HTML 안의 메타 태그만 읽습니다. 공유되는 페이지라면 HTML 에 내용이 있는 편이 훨씬 안전합니다.

**뒤로 가기와 스크롤 복원.** 브라우저가 공짜로 해 주던 일을 앱이 직접 해야 합니다. 목록에서 한참 내려가 상세로 들어갔다가 뒤로 가면 맨 위로 튀는 SPA 를 한 번쯤 써 보셨을 겁니다. `history.scrollRestoration` 을 `manual` 로 두고 위치를 직접 저장해 복원하는 식의 코드가 필요합니다. MDN 도 내비게이션 구현에 품이 더 든다고 적고 있습니다.

**긴 세션의 메모리.** 문서가 새로 로드되지 않으니 이전 화면에서 등록한 이벤트 리스너, 타이머, 구독, 캐시가 정리되지 않으면 그대로 쌓입니다. MPA 는 페이지를 옮기면 브라우저가 알아서 비워 주던 것들입니다. 하루 종일 켜 두는 대시보드에서 탭이 점점 느려진다면 이쪽을 의심해 봐야 합니다.

**접근성.** 문서 이동이 없으니 스크린 리더는 화면이 바뀌었다는 걸 모릅니다. 포커스가 이전 화면의 사라진 버튼에 남거나, 페이지 제목이 그대로인 채로 내용만 바뀝니다. 라우트가 바뀔 때 `document.title` 을 갱신하고 새 화면의 제목이나 메인 영역으로 포커스를 옮기는 처리를 직접 해야 합니다.

## 업계는 어떻게 대응했나

이 비용들 때문에 프레임워크 진영이 같은 방향으로 움직였습니다. 첫 화면은 서버가 만들고, JS 는 필요한 만큼만 보내자는 쪽입니다.

**SSR 과 하이드레이션.** 서버에서 컴포넌트를 HTML 로 먼저 그려 보내면 사용자는 JS 가 도착하기 전에도 내용을 봅니다. 그 뒤 브라우저가 같은 컴포넌트를 실행해 기존 HTML 에 이벤트 핸들러와 상태를 붙이는 단계가 하이드레이션입니다. React 의 `hydrateRoot` 가 그 역할이고, 문서에는 서버와 클라이언트가 만든 결과가 다르면 버그로 보라고 적혀 있습니다. `window` 가 있느냐로 렌더 결과를 가르거나, 서버와 클라이언트가 서로 다른 데이터를 그리면 불일치가 생깁니다. 그리고 하이드레이션 중에는 화면이 보이는데 눌러도 반응이 없는 구간이 생길 수 있습니다. 서버에서 한 번, 브라우저에서 한 번 같은 일을 하는 것이니 JS 용량 자체는 줄지 않습니다.

**SSG.** 요청 때마다 서버가 그리는 대신 빌드할 때 모든 페이지를 HTML 로 미리 만들어 CDN 에 올려 두는 방식입니다. 블로그, 문서, 마케팅 페이지처럼 내용이 자주 바뀌지 않는 곳에서는 가장 싸고 빠릅니다.

**아일랜드 아키텍처.** 페이지 대부분은 정적 HTML 이고 상호작용이 필요한 부분만 작은 섬(island)으로 띄우는 방식입니다. 이 블로그가 쓰는 Astro 가 대표적입니다. Astro 컴포넌트는 기본적으로 클라이언트 JS 없이 HTML 과 CSS 만 내보내고, React 나 Svelte 같은 컴포넌트를 `client:load`, `client:idle`, `client:visible` 같은 지시자로 필요한 시점에만 하이드레이션합니다. 본문은 정적인데 댓글창이나 검색 박스만 동작하면 되는 페이지에서는 보낼 JS 가 확 줄어듭니다.

**스트리밍과 서버 컴포넌트.** React Server Components 는 컴포넌트를 번들링 전에 서버(또는 빌드 시점)에서 먼저 렌더링하는 방식입니다. 서버 컴포넌트와 그 의존성은 브라우저로 전송되지 않고 결과만 내려가며, 데이터베이스나 파일을 직접 읽을 수 있어 그 데이터를 위한 별도 API 가 없어도 됩니다. React 문서의 예시에서는 마크다운 변환 라이브러리 두 개(gzip 기준 약 75K)가 번들에서 빠집니다. SSR 과 서로 다른 개념이면서 같이 쓸 수 있습니다.

**MPA 의 반격, View Transitions.** SPA 를 고르는 이유 중 하나가 부드러운 전환 애니메이션이었는데, 이제는 문서를 새로 로드하는 MPA 에서도 브라우저가 그걸 해 줍니다. 두 페이지 CSS 에 아래 한 줄을 넣으면 같은 origin 사이의 이동에 전환 효과가 붙습니다. Chrome 126 부터 지원되고 JS 호출은 필요 없습니다.

```css
@view-transition {
  navigation: auto;
}
```

이렇게 프레임워크와 브라우저가 각자 다른 쪽에서 같은 지점을 향해 오는 중입니다. 정리하면 이런 그림입니다.

![MPA, SPA, SSR 과 하이드레이션, SSG, 아일랜드를 첫 화면, 페이지 이동, SEO, JS 비용, 어울리는 곳으로 비교한 표](@/assets/images/what-is-spa-matrix.png)

## 그래도 SPA 가 맞는 곳

SPA 가 낡은 선택이 된 건 아닙니다. 로그인해야 들어가는 앱이라면 SEO 가 거의 의미가 없고, 사용자가 한 번 들어와 오래 머물며 상태를 쌓아 가니 초기 로딩 비용을 분할 상환하는 구조가 됩니다. 대시보드, 관리자 도구, 온라인 에디터, 협업 툴, 차트와 캔버스가 많은 화면이 그렇습니다. 화면 상태가 복잡하고 실시간성이 높을수록 클라이언트가 상태를 쥐고 있는 모델이 자연스럽습니다.

반대로 글과 상품 목록처럼 내용이 중심이고 검색 유입이 중요한 공개 페이지라면 SPA 로 시작하는 쪽이 오히려 비쌉니다. 이런 곳은 SSG 나 SSR, 아일랜드가 기본값이 된 지 오래입니다. 요즘 메타 프레임워크들은 한 앱 안에서 라우트마다 렌더링 방식을 다르게 고를 수 있게 해 주니, "SPA 냐 아니냐"를 한 번에 정하기보다 페이지마다 정하는 쪽으로 질문이 바뀌었습니다.

## 마무리하며

SPA 는 서버가 화면을 만들던 시절의 불편함을 풀려고 나온 방식이고, 그 대가가 초기 로딩과 SEO, 브라우저 기본 동작의 재구현이었습니다. 지금의 SSR, 아일랜드, 서버 컴포넌트는 그 대가를 줄이려는 시도입니다. 새 프로젝트라면 이 앱이 로그인 뒤에 사는 도구인지 검색으로 들어오는 콘텐츠인지부터 따져 보시길 권합니다. 그 답이 대부분의 렌더링 선택을 정해 줍니다.

## 참고 자료

- [MDN: SPA (Single-page application)](https://developer.mozilla.org/en-US/docs/Glossary/SPA)
- [MDN: History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [Astro Docs: Islands architecture](https://docs.astro.build/en/concepts/islands/)
- [React Docs: Server Components](https://react.dev/reference/rsc/server-components)
- [React Docs: hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)
- [Chrome for Developers: Cross-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
- [Wikipedia: Ajax (programming)](<https://en.wikipedia.org/wiki/Ajax_(programming)>)
