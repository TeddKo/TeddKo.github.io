---
title: "백엔드 언어를 고를 때 문법보다 먼저 봐야 할 것: JS, JVM, PHP, Python, Ruby, Go, Rust"
description: "JS, JVM, PHP, Python, Ruby, Go, Rust 서버가 요청을 처리하는 방식의 차이를 같은 엔드포인트 코드로 살펴보고, 버전 현황과 선택 기준을 적었습니다."
pubDatetime: 2026-11-08T21:38:00+09:00
category: server
tags:
  - Node.js
  - JVM
  - PHP
  - Python
  - Ruby
  - Go
  - Rust
  - 서버
---

백엔드 언어 후보로 자주 올라오는 것이 JavaScript(TypeScript), JVM 언어(Java, Kotlin), PHP, Python, Ruby, Go, Rust 입니다. 이 일곱은 문법 취향보다 **요청을 처리하는 방식**이 먼저 갈립니다. 이벤트 루프 하나로 처리하는지, 요청마다 스레드를 쓰는지, 요청이 끝나면 상태를 통째로 버리는지, GIL 이나 GVL 이라는 제약 안에서 병렬성을 어떻게 얻는지, 런타임이 스케줄링까지 해 주는지 컴파일러가 소유권으로 안전을 검증하는지에 따라 같은 API 서버도 운영 느낌이 꽤 달라집니다.

Node.js 26(Lithium)이 2026년 10월 28일부터 LTS 이고, Bun 1.4.4, Deno 2.9.8, Java 25(LTS), Kotlin 2.4.21, Spring Boot 4.1.2, PHP 8.5 와 8.4, Python 3.14 와 3.15, Ruby 4.0, Go 1.27, Rust 1.99 가 현재 버전입니다. 자세한 날짜는 뒤쪽 "버전 현황" 절에 모았습니다.

## 실행 모델

JS 계열은 단일 JavaScript 스레드와 이벤트 루프가 기본입니다. Node.js 공식 문서 설명으로는 가능한 작업은 시스템 커널에 넘기고, 끝나면 콜백이 poll 큐에 들어와 처리됩니다. 루프는 timers, poll, check 같은 단계를 돌며 단계마다 FIFO 큐를 비웁니다. 그래서 CPU 를 오래 쓰는 콜백 하나가 루프 전체를 막을 수 있고, 무거운 계산은 Worker 나 별도 프로세스로 빼야 합니다. Bun 과 Deno 도 같은 모델이고 엔진과 내장 도구만 다릅니다.

JVM 은 스레드가 기본 단위입니다. 바이트코드를 인터프리터로 돌리다가 자주 쓰는 코드를 JIT 가 기계어로 바꾸기 때문에 워밍업이 끝난 뒤의 처리량이 강점입니다. 전통적으로는 요청 하나에 플랫폼 스레드 하나를 붙여서 동시 접속 수가 스레드 수에 묶였는데, JDK 21 에서 확정된 가상 스레드(JEP 444)가 이 한계를 풉니다. JDK 가 관리하는 가벼운 스레드를 소수의 OS 스레드 위에 올리는 방식이라 코드는 블로킹 그대로 두고 동시성만 늘어납니다. JEP 도 밝히듯 코드가 빨라지는 것은 아니고, 대기가 많은 작업의 처리량이 좋아지는 것입니다. 자세한 내용은 [Java 가상 스레드](/posts/java-virtual-threads/), 스레드의 기본 개념은 [프로세스와 스레드](/posts/process-and-thread/)에서 다뤘습니다.

PHP 의 전통 모델은 PHP-FPM 입니다. 요청마다 스크립트를 처음부터 실행하고 끝나면 상태를 버리는 share-nothing 구조라 메모리 누수나 요청 간 상태 오염을 크게 걱정할 일이 없고 수평 확장도 단순합니다. 대신 프레임워크 부트스트랩 비용을 매 요청 냅니다. 이걸 피하려는 것이 워커 모드입니다. FrankenPHP 문서에 따르면 애플리케이션을 한 번 부팅해 메모리에 두고, 워커 스크립트가 `frankenphp_handle_request()` 를 루프로 호출하며, 슈퍼글로벌과 요청 본문 같은 요청 단위 상태만 초기화됩니다. 정적 변수, 전역 변수, 메모리 캐시는 요청을 넘어 남으니 사용자 데이터를 거기에 두면 안 됩니다. Swoole 과 RoadRunner 도 같은 계열입니다.

Python 은 WSGI 와 ASGI 로 갈립니다. WSGI 는 요청을 응답으로 바꾸는 동기 함수 하나가 전부이고, ASGI 는 `send` 와 `receive` 를 받는 비동기 호출 객체로 WebSocket 이나 long-polling 같은 오래 유지되는 연결까지 다룹니다. ASGI 는 WSGI 의 상위 집합으로 설계되었습니다. 걸리는 쪽은 GIL 입니다. CPython 은 한 프로세스에서 파이썬 바이트코드를 동시에 실행하는 스레드가 하나뿐이라 CPU 병렬성은 보통 프로세스를 여러 개 띄워서 얻습니다. 이 제약은 변하는 중입니다. Python 3.14 의 What's New 는 free-threaded 빌드가 공식 지원 대상이 되었고 단일 스레드 성능 손실은 대략 5~10% 라고 적고 있습니다. PEP 779 는 이를 Phase II(공식 지원, 선택 사항)로 두고, free-threaded 빌드를 기본으로 삼는 Phase III 는 이후 별도 PEP 로 정한다고 합니다. 그러니 기본 빌드에서 GIL 은 아직 켜져 있습니다. 3.14 에는 서브인터프리터를 파이썬 코드에서 쓰는 `concurrent.interpreters` 모듈도 들어왔습니다.

Ruby 는 사정이 Python 과 닮았습니다. MRI 는 한 번에 Ruby 코드를 실행하는 스레드가 하나뿐이라서(GVL, Puma 문서는 GIL 이라고 부릅니다) Rails 서버의 표준 구성은 Puma 의 **여러 프로세스 × 프로세스당 여러 스레드**입니다. Puma 문서는 MRI 에서 스레드 기본값을 5 로 두고, 대기 시간 중 I/O 비중이 50% 를 넘지 않으면 이 값을 유지하라고 권합니다. 스레드를 늘려도 CPU 는 하나만 쓰니, 코어를 다 쓰려면 워커 프로세스를 늘려야 합니다. 병렬 실행 단위로는 Ractor 가 있는데, Ruby 4.0 에서도 여전히 실험 기능이고, 릴리스 노트는 실험 딱지를 떼는 것을 다음 목표로 적었습니다. 4.0 은 `Ractor::Port` 를 넣고 `Ractor.yield` 와 `Ractor#take` 를 없앴습니다. I/O 쪽에서는 Fiber 스케줄러가 있어서 블로킹 I/O 에서 파이버를 양보시킬 수 있고, 4.0 에서 `fiber_interrupt` 훅이 추가되었습니다. 성능은 JIT 가 맡는데, 기존 YJIT 에 더해 4.0 에 새 JIT 인 ZJIT 가 들어왔습니다. 릴리스 노트가 직접 "인터프리터보다 빠르지만 아직 YJIT 만큼은 아니다"라고 적고 프로덕션에는 권하지 않으며, 4.1 에서 YJIT 를 넘고 실서비스 수준이 되는 것이 목표라고 밝혔습니다. 지금 운영에서 켜는 JIT 는 YJIT 입니다.

Go 는 고루틴이 기본 단위입니다. 고루틴은 런타임이 관리하는 가벼운 실행 흐름이고 OS 스레드 위에서 M:N 으로 스케줄링되어, 코드는 `go f()` 로 시작하고 I/O 에서 블로킹 스타일 그대로 씁니다. 이 점에서 JVM 의 가상 스레드와 닮았는데 Go 는 처음부터 이 모델이었다는 차이가 있습니다. `net/http` 서버는 연결마다 고루틴을 띄웁니다. GC 가 있는 언어이고, Go 1.25 에서 실험으로 들어온 Green Tea GC 가 Go 1.26 부터 기본값입니다. 릴리스 노트는 GC 부담이 큰 프로그램에서 오버헤드가 10~40% 줄 것으로 보되 워크로드에 따라 다르다고 적었습니다. 컨테이너에서는 Go 1.25 부터 `GOMAXPROCS` 기본값이 cgroup CPU 제한을 따릅니다. 쿠버네티스에서 CPU limit 을 걸어 두면 런타임이 그 값에 맞춰 스레드 수를 정하고, limit 이 바뀌면 주기적으로 갱신합니다. 배포 단위는 보통 의존성이 다 들어간 정적 바이너리 하나입니다.

Rust 는 GC 도 없고 런타임도 얇습니다. 메모리는 소유권과 빌림 규칙으로 컴파일 타임에 검증되고, 서버에서의 동시성은 보통 `async`/`await` 와 Tokio 로 얻습니다. Tokio 는 작업 훔치기(work-stealing) 방식의 멀티스레드 스케줄러와 OS 이벤트 큐 기반 I/O 드라이버를 제공하고, `Future` 는 폴링될 때까지 아무것도 하지 않는 상태 기계입니다. Node.js 의 이벤트 루프를 여러 스레드로 펼친 모양에 가깝습니다. 대가는 컴파일러와의 씨름입니다. 공유 상태를 다룰 때 `Send`, `Sync`, 수명 같은 개념을 직접 만나게 되고, 컴파일 시간도 다른 여섯 계열보다 길게 체감되는 편입니다.

![JS 의 이벤트 루프, JVM 의 가상 스레드, PHP 의 FPM 과 워커 모드, Python 의 WSGI 와 ASGI 그리고 GIL, Ruby 의 Puma 프로세스와 GVL, Go 의 고루틴과 M:N 스케줄러, Rust 의 Tokio 작업 스케줄러가 요청을 처리하는 방식을 일곱 개의 칸으로 나눠 비교한 그림입니다. 각 칸은 요청 단위에서 스케줄러, 그 아래의 OS 스레드나 제약으로 이어지는 흐름을 보여 줍니다.](@/assets/images/server-js-jvm-php-python-concurrency-models.png)

## 같은 엔드포인트, 다른 동시성

같은 `GET /users/{id}` 를 일곱 계열로 쓰면 동시성 모델의 차이가 코드에 드러납니다. Node.js 는 `async` 함수가 이벤트 루프에서 일시 중단되는 방식이고, 여기서는 Hono 를 썼습니다.

```ts
import { Hono } from "hono";

const app = new Hono();

app.get("/users/:id", async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "bad id" }, 400);
  const user = await findUser(id);
  return c.json(user);
});

export default app;
```

JVM 은 Spring Boot 로 쓰면 블로킹 코드를 그대로 두고 가상 스레드에 맡길 수 있습니다. 켜는 설정은 `spring.threads.virtual.enabled=true` 한 줄입니다.

```kotlin
@RestController
@RequestMapping("/users")
class UserController(private val service: UserService) {
    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): UserResponse = service.find(id)
}

data class UserResponse(val id: Long, val name: String)
```

PHP 는 Laravel 로 라우트 한 줄입니다. 요청마다 새로 실행되는 모델이라 코드 어디에도 동시성 표현이 나오지 않습니다.

```php
<?php

use Illuminate\Support\Facades\Route;

Route::get('/users/{id}', fn (int $id) => response()->json([
    'id' => $id,
    'name' => "user-$id",
]))->whereNumber('id');
```

Python 은 FastAPI 로 쓰면 타입 힌트가 검증과 문서 생성의 입력이 됩니다.

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class UserResponse(BaseModel):
    id: int
    name: str


@app.get("/users/{id}", response_model=UserResponse)
async def get_user(id: int) -> UserResponse:
    return UserResponse(id=id, name=f"user-{id}")
```

Ruby 는 Rails 로 쓰면 라우트 한 줄과 컨트롤러입니다. 이 코드도 동시성을 드러내지 않고, Puma 가 스레드 하나에 요청 하나를 붙여 실행합니다.

```ruby
# config/routes.rb
get "/users/:id", to: "users#show", constraints: { id: /\d+/ }

# app/controllers/users_controller.rb
class UsersController < ApplicationController
  def show
    id = params[:id].to_i
    render json: { id: id, name: "user-#{id}" }
  end
end
```

Go 는 1.22 부터 표준 라이브러리 `net/http` 만으로 메서드와 경로 와일드카드 라우팅이 됩니다. 핸들러는 고루틴 하나에서 블로킹 스타일로 돌아갑니다.

```go
package main

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type UserResponse struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, `{"error":"bad id"}`, http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(UserResponse{ID: id, Name: "user-" + strconv.FormatInt(id, 10)})
	})
	http.ListenAndServe(":8080", mux)
}
```

Rust 는 Axum 으로 씁니다. 경로 값은 `Path<u64>` 추출기가 파싱하고, 숫자가 아니면 핸들러에 들어오기 전에 400 으로 거절됩니다. 핸들러는 `async fn` 이라 Tokio 위에서 `await` 지점마다 일시 중단됩니다.

```rust
use axum::{extract::Path, routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct UserResponse {
    id: u64,
    name: String,
}

async fn get_user(Path(id): Path<u64>) -> Json<UserResponse> {
    Json(UserResponse { id, name: format!("user-{id}") })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/users/{id}", get(get_user));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

모양은 비슷해도 비동기를 코드에 드러내는 쪽(JS, Python, Rust 의 `async`)과 런타임이 감춰 주는 쪽(JVM 의 가상 스레드, Go 의 고루틴, PHP 의 요청 단위 격리, Ruby 의 Puma 스레드)으로 나뉩니다. Rust 는 `async` 를 드러내는 대신 컴파일러가 스레드 간 안전성까지 검사해 준다는 점이 JS 나 Python 과 다릅니다. Kotlin 이 코루틴으로 비동기를 쓰는 방식은 [Spring Boot 와 Ktor 비교](/posts/spring-vs-ktor/)에서, 리액티브 스택은 [Spring WebFlux](/posts/spring-webflux/)에서 다뤘습니다.

## 타입 시스템

JVM 은 컴파일 타임에 타입을 강제하는 정적 타입 언어입니다. Kotlin 은 널 안정성을 언어에 넣었고, Spring Boot 4 는 JSpecify 기반으로 포트폴리오 전반의 널 안정성을 개선했다고 발표했습니다. JavaScript 쪽은 TypeScript 가 사실상 표준입니다. Node.js 는 타입 제거(type stripping)로 TypeScript 파일을 직접 실행할 수 있고, v24.12.0 과 v25.2.0 에서 Stable 이 되었습니다. 다만 타입 검사를 해 주는 것은 아니고 타입 문법을 공백으로 바꿀 뿐입니다. `enum` 이나 런타임 코드가 있는 `namespace` 는 지원하지 않고 `tsconfig.json` 도 무시하므로 검사는 여전히 `tsc` 몫입니다.

PHP 8 계열은 유니온 타입, enum, readonly 프로퍼티가 생겨 현대적인 코드를 쓰기 좋아졌지만, 선언한 타입을 점검하려면 PHPStan 이나 Psalm 같은 정적 분석기를 같이 쓰는 경우가 많습니다. Python 의 타입 힌트도 실행에는 영향이 없는 주석에 가까워서 mypy, pyright 같은 검사기가 필요합니다. 그래도 FastAPI 와 Pydantic 처럼 힌트를 런타임 검증에 쓰는 라이브러리 덕에 쓰임새가 넓습니다. 3.14 는 어노테이션을 바로 평가하지 않고 필요할 때 평가하도록 바꿔서(PEP 649, PEP 749) 앞선 선언을 따옴표 없이 참조할 수 있습니다.

Go 와 Rust 는 JVM 처럼 컴파일 타임에 타입을 강제하는 정적 타입 언어입니다. Go 는 구조적 타입과 단순한 문법으로 타입 시스템을 일부러 작게 유지해 왔고, 제네릭은 있지만 Go 1.27 에서야 메서드가 자기 타입 매개변수를 갖게 될 만큼 조심스럽게 늘고 있습니다. Rust 는 반대로 표현력이 큽니다. 널 대신 `Option`, 예외 대신 `Result` 를 쓰고 소유권까지 타입으로 검사해서, 컴파일을 통과했다면 데이터 레이스 같은 부류의 버그가 사라진 상태입니다. Ruby 는 동적 타입이라 앞의 PHP, Python 과 비슷하게 별도의 검사 도구를 얹어 쓰는 쪽이고, 런타임 검증은 프레임워크의 파라미터 처리에 기대는 경우가 많습니다.

## 대표 프레임워크

JS 는 Express 가 오랜 표준이고, Hono 는 Web 표준 API 위에 만든 가벼운 프레임워크라 Node.js, Bun, Deno, 엣지 런타임에서 같은 코드가 돌아갑니다. NestJS 는 모듈과 DI, 데코레이터를 갖춰 Spring 과 비슷한 느낌을 줍니다. JVM 에서는 Spring Boot 가 중심이고 Ktor 는 코루틴 기반 경량 선택지, Quarkus 는 빠른 시작과 네이티브 이미지에 힘을 준 프레임워크입니다. PHP 는 Laravel 의 생태계가 가장 크고, Symfony 는 재사용 가능한 컴포넌트와 엄격한 구조로 알려져 있으며 Laravel 도 Symfony 컴포넌트를 씁니다. Python 은 Django 가 ORM, 관리자 화면, 인증까지 갖춘 풀스택이고 Flask 는 최소 구성, FastAPI 는 타입 힌트 기반 API 에 맞습니다.

Ruby 는 Rails 가 사실상 전부라고 해도 될 만큼 중심에 있고, 가벼운 쪽에는 Sinatra 와 Roda 가 있습니다. Rails 8 은 "PaaS 없이도" 배포하는 쪽으로 방향을 잡았습니다. Solid Queue, Solid Cache, Solid Cable 이 잡 큐, 캐시, WebSocket 어댑터를 Redis 대신 데이터베이스로 처리하고, Kamal 2 가 서버 한 대에 배포를 맡고, Thruster 가 Puma 앞에서 정적 파일 가속과 압축을 담당해 Nginx 없이도 컨테이너가 인터넷 트래픽을 받을 수 있습니다. Go 는 표준 `net/http` 만으로 서비스를 짜는 팀이 많고, 필요하면 Gin 같은 프레임워크를 얹습니다. Rust 는 Tokio 팀이 만든 Axum 이 대표적이고(현재 0.8 계열), Actix Web 도 오래 쓰여 온 선택지입니다.

## 시작 시간, 메모리, 서버리스

서버리스에서는 런타임의 시작 비용이 곧 지연이라 콜드 스타트가 중요합니다. JS 와 Python 은 인터프리터가 가볍게 뜨고, PHP 는 요청 단위 실행이라 함수형 배포와 잘 맞습니다. JVM 은 전통적으로 시작이 느리고 워밍업 전까지 메모리와 CPU 를 더 씁니다. 이를 줄이는 길이 GraalVM 네이티브 이미지 같은 사전 컴파일과 Project Leyden 의 AOT 기능입니다. JDK 25 에는 AOT 명령줄 사용성(JEP 514)과 AOT 메서드 프로파일링(JEP 515)이 들어갔고 컴팩트 객체 헤더(JEP 519)도 정식 기능이 되었습니다. 실제 시작 시간과 메모리는 애플리케이션과 설정에 따라 크게 달라지니 내 구성으로 직접 재 보는 수밖에 없습니다.

Go 와 Rust 는 이 항목에서 JVM 의 반대편에 섭니다. 둘 다 사전 컴파일된 네이티브 바이너리라 인터프리터나 JIT 워밍업이 없고, 런타임 의존성이 거의 없는 바이너리 하나를 컨테이너나 함수에 올리면 됩니다. Go 는 GC 와 런타임이 바이너리에 같이 들어가고, Rust 는 GC 가 없어서 메모리 사용량이 예측하기 쉽습니다. Ruby 는 Python 이나 PHP 처럼 인터프리터가 뜨는 방식이지만 Rails 는 부팅 때 코드를 많이 읽어서 콜드 스타트가 가벼운 편은 아닙니다. 이 때문에 Rails 는 서버리스보다 Kamal 로 띄운 상주 서버나 컨테이너에 더 자연스럽습니다. 이것도 수치가 아니라 방향이니, 실제 값은 직접 재 보셔야 합니다.

## 생태계와 채용

Python 의 가장 큰 무기는 AI/ML 과 데이터입니다. 모델 학습과 추론 라이브러리가 파이썬 중심으로 나오니 모델 서빙이나 데이터 파이프라인과 API 를 한 언어로 묶기 쉽습니다. JVM 은 대규모 엔터프라이즈에서 오래 쌓인 자산이 강점입니다. 트랜잭션, 메시징, 배치, 보안 쪽에 성숙한 라이브러리가 많고 정적 타입 덕에 큰 코드베이스를 유지하기 좋습니다. PHP 는 WordPress 와 흔하고 저렴한 호스팅 환경, 그리고 Laravel 로 제품을 빠르게 만드는 문화가 있습니다. JS 는 프론트엔드와 같은 언어라 타입, 검증 스키마, 유틸리티를 서버와 클라이언트가 나눠 쓸 수 있고 풀스택 인력도 구하기 쉽습니다. Ruby 는 Rails 의 관례 중심 개발 경험과 오래된 젬 생태계가 강점이라 스타트업의 제품 초기 속도에서 평가가 좋습니다. Go 는 클라우드 인프라와 네트워크 도구, 컨테이너 시대의 서비스 쪽에 자산이 쌓여 있고 표준 라이브러리가 두꺼워 외부 의존성을 적게 쓰기 좋습니다. Rust 는 성능과 안전성이 같이 필요한 영역에서 쓰이고 서버 생태계도 Tokio 를 중심으로 자랐지만, 웹 서비스용 배터리 포함 프레임워크는 아직 Rails 나 Django 만큼 두텁지 않아서 직접 고를 것이 많습니다.

학습 곡선은 Python 과 PHP 가 입문이 쉽고 Ruby 도 비슷합니다. JS 는 언어 자체는 쉬운데 비동기와 툴체인 선택지가 많고, JVM 은 언어, 빌드 도구, 프레임워크 개념이 많아 초기 진입 비용이 큰 대신 팀이 커진 뒤에는 규칙이 분명한 편입니다. Go 는 언어 명세가 작아서 며칠이면 읽히고 코드 스타일도 `gofmt` 하나로 모이는 반면, Rust 는 소유권과 수명을 익히는 데 가장 오래 걸리고 처음 몇 주는 컴파일러에게 혼나는 시간입니다.

## 한눈에 비교

![JS, JVM, PHP, Python, Ruby, Go, Rust 일곱 계열을 실행 모델, 타입, 대표 프레임워크, 배포 단위, 강점 다섯 가지 항목으로 비교한 표 이미지입니다. 언어를 행으로 두어 한 줄씩 읽으면 각 계열의 특징을 바로 볼 수 있습니다.](@/assets/images/server-js-jvm-php-python-matrix.png)

## 버전 현황

Node.js 는 26(Lithium)이 2026년 10월 28일부터 LTS 입니다. 24(Krypton)는 2026년 10월 20일에 Maintenance 로 넘어갔고, 22(Jod)는 2027년 4월 30일까지 지원됩니다. Node.js 27 은 알파 단계이며 앞으로는 연 1회 릴리즈로 바뀐다고 릴리즈 페이지에 안내되어 있습니다. Bun 은 1.4.4(2026년 10월 22일), Deno 는 2.9.8 입니다.

JVM 에서는 Java 25 가 2025년 9월 16일에 GA 되었고 대부분의 벤더가 LTS 로 제공합니다. Kotlin 은 2.4.21(2026년 10월 8일)이 최신 안정판입니다. Spring Boot 는 4.1.2 가 최신이고, 4.0 은 Spring Framework 7 위에서 2025년 11월에 나왔습니다. Spring Boot 4.1 은 Java 17 부터 26 까지 지원합니다.

PHP 8.5 는 2025년 11월 20일에 출시되어 2029년 말까지 지원되고, 8.4 는 2026년 12월 31일까지 활성 지원을 받습니다. Laravel 13 은 PHP 8.3 부터 8.5 를 지원합니다. Python 은 3.14(2025년 10월 7일)에서 free-threaded 빌드가 공식 지원 단계에 들어갔고 3.15 가 2026년 10월에 출시되었습니다. Django 6.1 은 Python 3.12 부터 3.15 를 지원합니다.

Ruby 는 4.0 이 2025년 12월 25일에 나왔고 4.0.9 가 2026년 10월 23일 릴리스입니다. 3.4 도 같은 날 3.4.12 가 나왔습니다. 4.0 은 실험적인 Ruby::Box 와 새 JIT 인 ZJIT, `Ractor::Port` 를 담았고 `Set` 이 코어 클래스가 되었습니다. Rails 는 8.1 이 최신 계열이고 8.1.4.1 이 2026년 11월 4일에 보안 업데이트로 나왔습니다. 8.1 에는 재시작 후 마지막 완료 단계부터 이어 가는 Active Job Continuations 와 구조화된 이벤트 리포팅이 들어갔습니다.

Go 는 1.27 이 2026년 8월 19일에 나왔고 1.26 의 최신 패치는 1.26.10(2026년 10월 19일)입니다. 릴리스 정책상 새 메이저가 둘 나오면 이전 메이저 지원이 끝나므로 1.25 는 지원 종료 대상이 되었습니다. 1.27 은 메서드에 타입 매개변수를 붙이는 제네릭 메서드와 goroutine leak 프로파일의 정식 제공이 눈에 띕니다. 1.26 에서는 `new` 에 표현식을 줄 수 있게 되었고 Green Tea GC 가 기본이 되었습니다.

Rust 는 1.99.0 이 2026년 10월 1일, 1.99.1 이 10월 15일에 나왔습니다. 에디션은 2024 가 1.85(2025년 2월 20일)에서 안정화되었고, 1.99 릴리스 글에 새 에디션 이야기는 없습니다. Axum 은 0.8.9, Tokio 는 1.54.1 이 최신 표기입니다.

## 선택 기준

프론트엔드 팀이 서버까지 맡거나 타입과 검증 스키마를 공유하고 싶다면 TypeScript 서버가 맞습니다. I/O 대기가 많은 API 게이트웨이나 BFF 에 특히 자연스럽고, CPU 연산이 많은 일은 따로 빼야 합니다. 대규모 도메인에 트랜잭션이 중요하고 코드를 오래 끌고 가야 하며 처리량도 필요하다면 JVM 이 든든합니다. 가상 스레드 덕에 블로킹 스타일을 유지한 채 동시성을 얻을 수 있고, 콜드 스타트가 문제라면 네이티브 이미지나 AOT 를 같이 검토하면 됩니다.

콘텐츠 사이트, 관리 도구, 빠른 출시, 기존 PHP 자산이나 WordPress 연동이 걸려 있다면 PHP 와 Laravel 이 효율적입니다. 화면까지 Laravel 로 그리는 방법은 앞서 [Laravel 과 서버 주도 UI](/posts/laravel-and-server-driven-ui/) 글에서 다뤘습니다. AI/ML 모델 서빙, 데이터 처리, 사내 도구와 프로토타입이 중심이면 Python 이 가장 마찰이 적습니다.

작은 팀이 CRUD 중심 제품을 빨리 만들어 내보내야 하고 Rails 관례가 맞는다면 Ruby 가 여전히 빠른 길입니다. Rails 8 이 잡 큐와 캐시, 배포까지 기본 구성으로 묶어 줘서 Redis 나 별도 PaaS 없이 시작할 수 있습니다. 다만 CPU 코어를 다 쓰려면 프로세스를 늘려야 한다는 점은 알고 가야 합니다. 클라우드 네이티브 서비스, 프록시와 CLI 를 함께 만들거나, 작은 바이너리와 빠른 기동, 단순한 동시성 모델이 중요하다면 Go 가 잘 맞습니다. 언어가 작아 팀원 간 코드 편차도 적습니다. 지연 시간과 메모리를 바짝 조여야 하거나 안전성이 최우선인 데이터 경로, 또는 이미 다른 언어 서비스의 병목 구간을 떼어 내는 일이라면 Rust 가 값을 합니다. 대신 개발 속도와 채용 폭을 일부 내줄 각오가 필요합니다.

어느 쪽이든 **언어 성능보다 팀의 숙련도와 이미 있는 생태계, 운영 환경이 더 큰 변수**입니다. 고르기 전에 실제 부하 특성으로 한 번 재 보시길 권합니다.

## 참고 자료

- [Node.js: Previous releases](https://nodejs.org/en/about/previous-releases)
- [Node.js release schedule (GitHub)](https://github.com/nodejs/Release/blob/main/schedule.json)
- [Node.js: The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [Node.js: TypeScript (type stripping)](https://nodejs.org/api/typescript.html)
- [Bun blog](https://bun.com/blog)
- [JDK 25](https://openjdk.org/projects/jdk/25/)
- [JEP 444: Virtual Threads](https://openjdk.org/jeps/444)
- [Kotlin releases (GitHub)](https://github.com/JetBrains/kotlin/releases)
- [Spring Boot](https://spring.io/projects/spring-boot)
- [Spring Boot 4.0.0 available now](https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now)
- [FrankenPHP: Using worker mode](https://frankenphp.dev/docs/worker/)
- [Python 3.14: What's New](https://docs.python.org/3/whatsnew/3.14.html)
- [PEP 779: Criteria for supported status for free-threaded Python](https://peps.python.org/pep-0779/)
- [ASGI: Introduction](https://asgi.readthedocs.io/en/latest/introduction.html)
- [endoflife.date: PHP](https://endoflife.date/php)
- [endoflife.date: Python](https://endoflife.date/python)
- [endoflife.date: Spring Boot](https://endoflife.date/spring-boot)
- [endoflife.date: Laravel](https://endoflife.date/laravel)
- [endoflife.date: Django](https://endoflife.date/django)
- [endoflife.date: Deno](https://endoflife.date/deno)
- [Ruby: Releases](https://www.ruby-lang.org/en/downloads/releases/)
- [Ruby 4.0.0 Released](https://www.ruby-lang.org/en/news/2025/12/25/ruby-4-0-0-released/)
- [Puma: Deployment](https://github.com/puma/puma/blob/master/docs/deployment.md)
- [Rails Releases](https://rubyonrails.org/category/releases)
- [Rails 8.0: No PaaS Required](https://rubyonrails.org/2024/11/7/rails-8-no-paas-required)
- [Rails 8.1](https://rubyonrails.org/2025/10/22/rails-8-1)
- [Go: Release History](https://go.dev/doc/devel/release)
- [Go 1.25 Release Notes](https://go.dev/doc/go1.25)
- [Go 1.26 Release Notes](https://go.dev/doc/go1.26)
- [Go 1.27 Release Notes](https://go.dev/doc/go1.27)
- [Go Blog: Routing Enhancements for Go 1.22](https://go.dev/blog/routing-enhancements)
- [Rust Blog](https://blog.rust-lang.org/)
- [Announcing Rust 1.85.0 and Rust 2024](https://blog.rust-lang.org/2025/02/20/Rust-1.85.0/)
- [Announcing Rust 1.99.0](https://blog.rust-lang.org/2026/10/01/Rust-1.99.0/)
- [docs.rs: axum](https://docs.rs/axum/latest/axum/)
- [docs.rs: tokio](https://docs.rs/tokio/latest/tokio/)
