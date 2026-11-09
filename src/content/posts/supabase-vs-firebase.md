---
title: "Supabase 와 Firebase, 모바일 개발자가 백엔드를 고르는 기준"
description: "Supabase 와 Firebase 를 데이터 모델, 인증, 실시간, 스토리지, 서버리스 함수, 요금, 락인, 모바일 SDK 로 나눠 비교하고, 최근 달라진 점과 선택 기준을 적었습니다."
pubDatetime: 2026-11-08T23:04:00+09:00
category: server
tags:
  - Supabase
  - Firebase
  - BaaS
  - 서버
---

앱을 하나 만들 때 서버를 직접 짜지 않고 BaaS 를 붙이는 선택지는 결국 두 이름으로 모입니다. Firebase 와 Supabase 입니다. 둘 다 인증, 데이터베이스, 파일 저장, 서버리스 함수, 실시간 동기화를 한 묶음으로 주지만 **뼈대가 다릅니다.** Supabase 는 Postgres 위에 얹은 껍데기이고, Firebase 는 자기만의 문서 저장소에서 출발해 지금은 Postgres 쪽으로도 손을 뻗고 있습니다. 이 글에서는 Android 개발자 입장에서 두 서비스를 같은 쿼리, 같은 접근 제어로 나란히 놓고 보고, 최근 달라진 부분까지 정리했습니다.

데이터베이스 자체의 성격 차이는 [RDBMS 와 NoSQL](/posts/rdbms-vs-nosql/)에 먼저 적어 두었습니다. 이 글은 그 내용을 BaaS 라는 제품 단위로 옮긴 것에 가깝습니다.

## 데이터 모델과 쿼리

Supabase 는 프로젝트를 만들면 Postgres 데이터베이스 하나가 생깁니다. 테이블과 외래 키를 만들고, 클라이언트는 PostgREST 기반 Data API 로 접근합니다. SQL 을 그대로 쓸 수도 있어서, 조인이나 집계, 트랜잭션은 일반 Postgres 와 다르지 않습니다. 접근 제어는 Row Level Security(RLS) 가 맡습니다. 테이블마다 RLS 를 켜고 정책을 쓰면 SDK 가 보낸 사용자 토큰으로 행 단위 권한이 판정됩니다.

Firebase 는 선택지가 둘로 갈립니다. 하나는 전통적인 Cloud Firestore 와 Realtime Database 입니다. 컬렉션과 문서 구조이고, 권한은 보안 규칙(security rules)이라는 별도 언어로 씁니다. 쿼리는 인덱스에 올라타는 것만 됩니다. 단일 필드 인덱스는 자동으로 생기지만, 한 필드로 거르고 다른 필드로 정렬하는 식의 조합은 복합 인덱스를 직접 만들어야 합니다.

다른 하나가 Cloud SQL for PostgreSQL 을 쓰는 Data Connect 인데, 2026년 4월 22일에 **Firebase SQL Connect** 로 이름이 바뀌었습니다. API 는 그대로입니다. 스키마와 쿼리를 GraphQL 로 선언하면 도구가 PostgreSQL 스키마와 마이그레이션 DDL 을 만들고, 배포된 오퍼레이션은 서버에 저장되어 클라이언트 코드가 임의 쿼리를 보내지 못합니다. Kotlin Android, iOS, Flutter, 웹용 타입 안전 SDK 가 생성됩니다. Cloud Next 2026 발표에서는 여기에 실시간 동기화, 오프라인 캐시, GraphQL 대신 SQL 로 직접 쿼리를 쓰는 네이티브 SQL 이 더해졌다고 했습니다. 관계형 모델이 필요하면 Firebase 안에서도 이제 길이 있다는 뜻입니다.

### 같은 질문 두 번: 한 사용자의 최신 글 10개

`posts` 에 `user_id`(Firestore 에서는 `userId`)와 `created_at` 이 있다고 하고, 특정 사용자의 최신 글 10개를 가져옵니다. 먼저 supabase-js 입니다.

```typescript
const { data, error } = await supabase
  .from("posts")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(10);
```

Firestore 는 Android 에서 이렇게 씁니다.

```kotlin
db.collection("posts")
    .whereEqualTo("userId", userId)
    .orderBy("createdAt", Query.Direction.DESCENDING)
    .limit(10)
    .get()
    .addOnSuccessListener { snapshot -> /* snapshot.documents */ }
```

모양은 거의 같지만 뒤가 다릅니다. Firestore 쪽은 `userId` 동등 조건에 `createdAt` 정렬을 붙였으니 복합 인덱스가 필요합니다. 처음 실행하면 에러가 나고, 인덱스 생성 링크가 같이 옵니다. Supabase 쪽은 `user_id` 에 인덱스를 걸지 말지는 성능 문제일 뿐 동작 여부를 가르지는 않습니다. 반대로 나중에 "글쓴이 이름도 같이 보여 줘" 같은 요구가 붙으면 Postgres 에서는 조인 한 줄이고, Firestore 에서는 이름을 문서에 복사해 두거나 쿼리를 두 번 날리게 됩니다.

### 접근 제어: RLS 정책과 보안 규칙

"글은 본인만 읽는다"를 양쪽으로 쓰면 이렇습니다. Supabase 는 SQL 입니다.

```sql
alter table public.posts enable row level security;

create policy "own posts are readable"
on public.posts for select
to authenticated
using ( (select auth.uid()) = user_id );
```

`auth.uid()` 를 `(select ...)` 로 감싸는 건 공식 문서가 성능을 위해 권하는 형태입니다. 한 문장마다 함수를 한 번만 부르게 합니다. 정책에 쓰는 컬럼에 인덱스를 거는 것도 같이 권합니다.

Firestore 보안 규칙은 이렇게 씁니다.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if request.auth != null
                  && resource.data.userId == request.auth.uid;
    }
  }
}
```

규칙은 필터가 아니라 **허용 여부를 가르는 검사**입니다. 클라이언트가 `whereEqualTo("userId", ...)` 를 빼먹고 전체를 읽으려 하면 쿼리 자체가 거부됩니다. RLS 는 반대로 조건에 안 맞는 행을 조용히 걸러 내기 때문에, 쿼리는 성공하고 결과만 비어 보입니다. 디버깅할 때 느끼는 결이 다릅니다.

![Supabase 는 클라이언트 SDK 가 PostgREST 기반 Data API 를 거쳐 Postgres 에 닿고 RLS 정책이 행 단위로 판정하며, Firebase 는 클라이언트 SDK 가 Firestore 에 바로 닿고 보안 규칙이 요청마다 허용 여부를 판정한다. Auth, Storage, Realtime 은 Supabase 에서 RLS 와, Firebase 에서 보안 규칙과 맞물리고 Functions 는 별도 서버리스 실행 환경이다](@/assets/images/supabase-vs-firebase-access-control.png)

Supabase 쪽에서 하나 주의할 게 있습니다. RLS 를 켜기 전에는 Data API 에 테이블이 열려 있다는 점입니다. 2026년 4월 28일 변경 내역에 새 `public` 스키마 테이블이 Data API 에 자동으로 노출되지 않게 하는 방침이 올라왔고, 모든 프로젝트에 대한 적용 시점이 2026년 10월 30일로 적혀 있습니다. 기존 프로젝트를 운영 중이라면 노출 상태와 권한(grant)을 한 번은 점검할 때입니다.

## 인증

두 서비스 모두 이메일 비밀번호, 소셜 로그인, 전화 인증을 제공합니다. Supabase Auth 는 매직 링크, OTP, SAML 2.0 SSO, 다중 인증(MFA)을 지원하고, 소셜 제공자가 스무 개 안팎이며 OAuth2 나 OIDC 를 따르는 제공자는 커스텀으로 붙일 수 있습니다. 2026년에 들어서는 패스키가 베타(2026-05-28)로 올라왔습니다. 가장 큰 특징은 RLS 와의 결합입니다. SDK 가 요청마다 사용자 JWT 를 실어 보내고 정책이 그 토큰으로 판정하므로, 인증과 권한이 같은 곳에서 이어집니다. Clerk, Auth0, Cognito, WorkOS 같은 외부 인증이 발급한 JWT 도 받을 수 있고 Firebase Auth 도 그 목록에 들어 있습니다.

Firebase Authentication 은 Identity Platform 위에 있습니다. 무료로 월 5만 MAU 까지 쓰고, SAML/OIDC 는 50 MAU 까지입니다. 전화 인증은 Spark 에서는 안 되고 Blaze 에서 SMS 건당 과금입니다. 앱에서 Google 로그인 하나만 붙이는 용도라면 어느 쪽이든 하루 안에 끝납니다. 차이는 그다음에 납니다. 로그인한 사용자의 권한을 데이터 쪽에서 어떻게 표현하느냐가 SQL 정책이냐 보안 규칙이냐로 갈립니다.

## 실시간

Supabase Realtime 은 세 가지입니다. Broadcast 는 클라이언트 사이의 저지연 메시지, Presence 는 접속 상태 같은 공유 상태, Postgres Changes 는 테이블 변경 구독입니다. 2026년에 `realtime` 스키마가 수정 불가로 잠겼고(2026-07-14), 그래도 `realtime.messages` 의 RLS 정책은 그대로 쓸 수 있습니다. Broadcast 가 바이너리 페이로드를 받게 된 것(2026-06-11)도 올해 변화입니다.

Firestore 와 Realtime Database 는 실시간 리스너가 애초에 기본기입니다. `addSnapshotListener` 하나로 목록이 바뀔 때마다 콜백이 오고, 오프라인 캐시와 재연결이 SDK 안에 들어 있습니다. 모바일에서 이게 체감 차이로 이어집니다. 네트워크가 끊겼다 붙는 지하철에서 쓰는 앱이라면 Firebase 쪽이 손이 덜 갑니다. Supabase 는 연결이 끊겼을 때의 복구와 로컬 캐시 전략을 앱이 더 책임지는 쪽입니다. SQL Connect 에 오프라인 캐시가 들어온 건 Firebase 가 관계형 쪽에서도 같은 장점을 가져가려는 움직임으로 읽힙니다.

## 스토리지

Supabase Storage 는 파일 버킷에 RLS 로 접근 제어를 겁니다. S3 호환 인터페이스와 REST API, TUS 재개 가능 업로드를 지원하고, 객체 메타데이터는 Postgres 에 저장됩니다. 전역 CDN 과 이미지 변환이 붙어 있습니다. 파일 버킷 말고도 Iceberg 테이블용 분석 버킷, 임베딩용 벡터 버킷이 있습니다.

Cloud Storage for Firebase 는 Firebase 보안 규칙으로 제어하고 Auth 와 맞물립니다. 여기서 요금 함정이 하나 있습니다. Spark 플랜에서는 Cloud Storage 를 쓸 수 없고 Blaze 에서만 무료 할당량이 보입니다. "무료로 시작해서 이미지만 올려 보자"가 Firebase 에서는 안 됩니다.

## 서버리스 함수

Supabase Edge Functions 는 Deno 기반 Supabase Edge Runtime 위에서 돌고, TypeScript 가 주 언어입니다. 사용자와 가까운 노드에서 실행되고, 대시보드, CLI, MCP 로 배포합니다. 로컬에서는 `supabase functions serve` 로 흉내 냅니다. 같은 문서에서 콜드 스타트가 있으니 함수를 짧고 멱등하게 만들고, 오래 걸리는 일은 백그라운드로 빼라고 합니다. 2026년 9월 30일에는 Edge Functions 용 타입 지정형 미들웨어 Middleware 1.0 이 나왔습니다.

Cloud Functions for Firebase 는 JavaScript, TypeScript, Python 을 지원하고 Dart 는 실험적 프리뷰입니다(HTTP 와 callable 만). 트리거 종류가 풍부한 게 강점입니다. Firestore 문서 생성, 인증 이벤트, HTTPS, 스케줄, 작업 큐까지 Firebase 안의 이벤트에 바로 걸립니다. 배포하려면 Blaze 플랜이 필수입니다. Supabase 에서 같은 일을 하려면 데이터베이스 트리거나 웹훅으로 Edge Function 을 부르는 구성이 됩니다. 이벤트 구독의 편의는 Firebase 가, Postgres 와 한 몸이 되는 구성은 Supabase 가 낫습니다.

## 요금 구조와 무료 한도

숫자는 바뀌므로 결제 전에 공식 요금 페이지를 한 번 더 보시길 권합니다.

| 항목        | Supabase Free      | Supabase Pro | Firebase Spark(무료)  |
| ----------- | ------------------ | ------------ | --------------------- |
| 월 요금     | $0                 | $25부터      | $0                    |
| DB          | 500 MB             | 디스크 8 GB  | Firestore 1 GiB       |
| 파일 저장   | 1 GB               | 100 GB       | 사용 불가(Blaze 필요) |
| 인증 MAU    | 5만                | 10만         | 5만                   |
| 함수        | 호출 50만          | 호출 200만   | 사용 불가(Blaze 필요) |
| 비활동 정지 | 1주 비활동 시 정지 | 정지 없음    | 없음                  |

Supabase Free 는 활성 프로젝트가 2개까지이고, Realtime 동시 접속 피크 200개와 월 메시지 200만 건이 포함됩니다. Team 은 $599부터입니다. Firebase Firestore 는 무료 할당량이 하루 단위입니다. 읽기 5만 건, 쓰기 2만 건, 삭제 2만 건이고 네트워크 송신은 월 10 GiB 입니다. Realtime Database 는 Spark 에서 동시 접속 100개입니다. Blaze 는 종량제이며, 함수는 월 호출 200만 건이 무료 할당량에 들어 있습니다.

모델이 다르다는 점이 더 중요합니다. Supabase 는 **프로젝트 단위로 고정 요금 + 초과분**이고, Firebase 는 **연산 단위 종량제**입니다. Firestore 는 문서를 읽을 때마다 과금되므로 쿼리를 잘못 짜서 목록을 매번 통째로 다시 읽으면 청구서가 먼저 알려 줍니다. Supabase 에서는 데이터가 커지고 트래픽이 늘어나는 만큼 디스크와 컴퓨트 플랜을 올리는 식이라 월말 청구서가 비교적 예측됩니다. 반면 Supabase Free 는 1주 동안 아무도 안 쓰면 정지되니, 데모나 사이드 프로젝트를 방치했다가 다시 열면 깨워야 합니다.

## 락인과 셀프 호스팅

여기가 철학이 가장 갈리는 곳입니다. Supabase 는 오픈소스라서 Docker Compose 로 직접 띄울 수 있고, 공식 문서도 그 방식을 권장 경로로 안내합니다. 쿠버네티스용 Helm 차트는 커뮤니티 프로젝트입니다. 대신 셀프 호스팅은 프로젝트 하나만 돌고, 브랜칭이나 관리형 백업과 PITR 같은 기능은 없으며, 서버 보안, 업데이트, 백업, 고가용성은 직접 책임집니다. 데이터는 표준 Postgres 라서 `pg_dump` 로 나올 수 있고, 최악에는 다른 Postgres 호스팅으로 옮기면 됩니다. 데이터 쪽 락인은 약합니다.

Firebase 에는 셀프 호스팅이 없습니다. Emulator Suite 가 있지만 공식 문서가 직접 못 박습니다. 에뮬레이터는 성능과 보안이 아니라 정확성을 위해 만들어졌고 프로덕션에는 적합하지 않다고 합니다. Firestore 의 쿼리 모델과 보안 규칙은 Firebase 밖에서 그대로 재현되지 않으므로, 떠날 때는 데이터 모델부터 다시 짜야 합니다. 다만 SQL Connect 는 Cloud SQL Postgres 에 데이터가 들어 있으니 이쪽은 사정이 다릅니다.

## 모바일 SDK

Firebase 는 Android, iOS, Flutter 용 SDK 가 오래 다듬어졌고, Android Studio 와의 연동, `google-services.json` 기반 설정, 오프라인 캐시, 푸시, 크래시 리포트까지 한 번에 맞물립니다. Android 개발자가 가장 익숙한 환경입니다.

Supabase 도 퀵스타트에 Flutter, iOS SwiftUI, Android Kotlin, Expo React Native 가 있습니다. 2026년 11월 6일에는 supabase-flutter v3 가 나왔는데, 전체 API 에 타입 안전성을 입힌 **breaking change** 라고 적혀 있습니다. 쓰고 있다면 업그레이드 때 마이그레이션 가이드를 먼저 읽어야 합니다. 같은 주 2026년 11월 4일에는 Supabase CLI v3 도 나왔고, 로컬이 기본이며 호스티드 변경 전에 확인을 거치는 방식으로 바뀌었습니다. 모바일 클라이언트에서는 anon 키를 앱에 넣으니 RLS 가 사실상 유일한 방어선이라는 점도 기억해 둘 만합니다. 앱 바이너리에서 키를 꺼내는 건 어렵지 않습니다.

## Firebase 에만 있는 것들

FCM(Cloud Messaging), Crashlytics, Google Analytics 는 Supabase 에 대응물이 없습니다. 이 셋은 요금 페이지에서 무료 제품으로 분류됩니다. 앱 개발자에게는 백엔드 선택과 별개로 이 셋만 쓰려고 Firebase 프로젝트를 만드는 일이 흔합니다. Remote Config, A/B Testing, App Distribution, Test Lab 도 같은 제품군입니다.

그래서 현실에서는 "Supabase 냐 Firebase 냐"가 양자택일이 아닌 경우가 많습니다. Supabase 에 데이터와 인증을 두고, 푸시와 크래시 수집은 Firebase 를 쓰는 조합이 자연스럽습니다. Crashlytics 는 올해 Android 17 이상에서 저메모리 종료와 OOM 을 따로 묶어 이슈로 보여 주기 시작해서(2026-07-09), 안드로이드 쪽에서는 더 쓸모가 생겼습니다.

웹이 같이 있다면 호스팅은 따로 고를 수 있습니다. 프런트엔드 쪽 조합은 [Vercel 글](/posts/vercel-frontend-cloud/)에 따로 적었습니다.

## AI 기능

Firebase 는 **Firebase AI Logic** 이 앱에서 Gemini 를 부르는 통로입니다. 서버 프롬프트 템플릿, 자동 함수 호출과 JSON 스키마 매핑, App Check 로 쿼터 탈취 막기가 핵심입니다. Cloud Next 2026 발표에서는 온디바이스 모델을 우선 쓰고 안 되면 클라우드로 넘기는 하이브리드 추론이 Android 에서 제공되고 iOS 는 5월 예정이라고 했습니다. 최근 릴리스 노트에는 Gemini 2.5 Pro 와 Flash 요청이 2026년 12월 1일부터 Gemini 3.x 로 자동 라우팅된다는 공지(11월 2일 자)와, 11월 2일부터 App Check 자동 강제가 시작된다는 공지가 있습니다. 쓰고 있다면 파라미터 호환과 App Check 적용 여부부터 점검해야 합니다.

Supabase 는 pgvector 기반 벡터 저장소가 중심이고, 공식 문서는 "가장 좋은 벡터 데이터베이스는 이미 가진 데이터베이스"라는 입장입니다. 시맨틱 검색, 키워드 검색, 하이브리드 검색을 지원하고 OpenAI, Hugging Face, LangChain, Amazon Bedrock, LlamaIndex 같은 연동 문서가 있습니다. Storage 에는 벡터 버킷도 따로 있습니다. 그리고 호스티드 MCP 서버(`https://mcp.supabase.com/mcp`)가 있어서 AI 도구가 테이블 조회, SQL 실행, 마이그레이션 적용, 로그 확인을 할 수 있습니다. 공식 문서가 위험도 분명히 적어 둡니다. 프롬프트 인젝션으로 해로운 쿼리가 실행될 수 있으니 `read_only=true`, `project_ref` 로 범위를 좁히고, 운영 데이터보다 개발 브랜치에 연결하고, 도구 호출 승인은 수동으로 두라는 내용입니다. 사용자에게 이 서버를 넘겨주면 안 됩니다. 개발자 권한으로 동작하기 때문입니다.

## 최근 변화

눈에 띄는 변화를 따로 모았습니다.

- **Firebase Data Connect 는 SQL Connect 가 되었습니다**(2026-04-22). API 는 그대로이고, 실시간 동기화, 오프라인 캐시, 네이티브 SQL 이 더해졌습니다. 무료 체험은 3개월입니다. 체험이 끝날 때까지 Blaze 로 올리지 않으면 Cloud SQL 인스턴스가 보관 처리되고 90일 뒤 삭제됩니다.
- Firestore Enterprise 에서는 파이프라인 연산이 GA 가 되었고(2026-04-20), 텍스트 검색과 지리 검색이 GA 가 되었습니다(2026-10-19). Firestore 도 질의 표현력 면에서 SQL 쪽으로 다가가는 중입니다.
- **Firebase ML 은 deprecated** 이고 2027년 6월 15일에 종료됩니다. **Firebase Extensions 도 deprecated** 이고 2027년 3월 31일에 종료됩니다. 두 제품에 기대고 있다면 이전 계획이 필요합니다.
- Supabase 는 Postgres 14 지원을 2026년 7월 1일에 종료했고, 새 `public` 테이블의 Data API 자동 노출을 막는 방침을 2026년 10월 30일에 전 프로젝트로 확대하기로 했습니다. 로그가 사용량 기반 요금으로 바뀌었고(2026-09-25) 유예 기간은 2027년 초까지입니다.
- Supabase 는 2026년 10월 1일에 OrioleDB 를 유료 플랜 기능과 함께 퍼블릭 베타로 냈고 Multigres 는 프라이빗 알파입니다. 이 둘은 아직 운영에 올릴 단계가 아닙니다.
- Supabase 프로젝트 HTTP API 에서 오래된 TLS 1.2 암호 스위트를 끄는 작업이 2026년 11월 10일부터 시작됩니다. 구형 클라이언트나 오래된 Android 기기에서 접속이 끊길 수 있으니 최소 지원 OS 가 낮은 앱은 확인해 볼 만합니다.
- 개인 액세스 토큰에 프로젝트와 조직 범위를 걸 수 있게 되었습니다(2026-10-06). MCP 서버, Management API, CLI 에 모두 적용됩니다.

## 선택 기준

항목별 차이를 한 장으로 모으면 이렇습니다.

![Supabase 와 Firebase 를 데이터 모델, 접근 제어, 인증, 실시간, 스토리지, 서버리스 함수, 요금 모델, 셀프 호스팅, 모바일 SDK 항목으로 비교한 표](@/assets/images/supabase-vs-firebase-matrix.png)

| 상황                                              | 먼저 볼 쪽                                 | 이유                                                                        |
| ------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| 관계형 데이터, 조인과 리포트가 많은 앱            | Supabase                                   | 표준 Postgres, SQL, RLS                                                     |
| 오프라인과 불안정한 네트워크가 기본인 모바일 앱   | Firebase                                   | Firestore 오프라인 캐시, 리스너                                             |
| 푸시, 크래시, 분석이 필요한 앱                    | Firebase 를 함께                           | FCM, Crashlytics, Analytics 는 대체재가 없음                                |
| 나중에 직접 운영하거나 벤더를 옮길 가능성         | Supabase                                   | 오픈소스 셀프 호스팅, 표준 Postgres                                         |
| 프로토타입을 빨리 띄우는 개인 프로젝트            | 둘 다 가능                                 | Supabase 는 1주 비활동 정지, Firebase 는 Storage 와 Functions 에 Blaze 필요 |
| 사용량 예측이 중요한 서비스                       | Supabase                                   | 프로젝트 단위 요금                                                          |
| 이벤트 기반 백엔드(문서 변경, 인증 이벤트 트리거) | Firebase                                   | Cloud Functions 트리거 종류                                                 |
| AI 기능을 앱에서 바로 호출                        | Firebase AI Logic 또는 Supabase + pgvector | 모델 호출은 전자, 자체 데이터 검색은 후자                                   |

하나만 꼽으라면 **데이터가 관계형인가, 문서 단위인가**입니다. 관계가 많으면 처음부터 Postgres 로 가는 게 편합니다. 질의가 화면 단위로 고정되어 있고 오프라인 동작이 중요하면 Firestore 가 편합니다. 그리고 어느 쪽을 고르든 접근 제어는 SQL 정책이든 보안 규칙이든 출시 전에 따로 한 번 읽는 시간을 잡으시길 권합니다. 두 서비스 모두 권한을 잘못 쓴 사고의 상당수가 이 부분에서 나옵니다. 데이터베이스 선택 자체가 고민이라면 [MySQL, Oracle, PostgreSQL 비교](/posts/mysql-oracle-postgresql/)도 참고가 됩니다.

## 참고 자료

- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Changelog](https://supabase.com/changelog)
- [Supabase Docs: Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [Supabase Docs: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Docs: Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Docs: Auth](https://supabase.com/docs/guides/auth)
- [Supabase Docs: Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase Docs: Storage](https://supabase.com/docs/guides/storage)
- [Supabase Docs: AI and Vectors](https://supabase.com/docs/guides/ai)
- [Supabase Docs: MCP](https://supabase.com/docs/guides/getting-started/mcp)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase Release Notes](https://firebase.google.com/support/releases)
- [Firebase Docs: SQL Connect](https://firebase.google.com/docs/data-connect)
- [Firebase Blog: What's new from Firebase at Cloud Next 2026](https://firebase.blog/posts/2026/04/Cloud-Next-2026-announcements)
- [Firebase Docs: Firestore security rules structure](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Firebase Docs: Firestore index types](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [Firebase Docs: Order and limit data](https://firebase.google.com/docs/firestore/query-data/order-limit-data)
- [Firebase Docs: Cloud Functions](https://firebase.google.com/docs/functions)
- [Firebase Docs: Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
