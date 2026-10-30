---
title: "Spring Boot 와 Ktor 비교: auto-configuration 과 플러그인, DI, 라우팅, 코루틴, 엔진"
description: "Kotlin 서버 프레임워크인 Spring Boot 3.4 와 Ktor 3.0 을 구성 철학, 요청 처리 파이프라인, 의존성 주입, 라우팅 방식, 코루틴 지원, 서버 엔진, 생태계, 멀티플랫폼 클라이언트 관점에서 공식 문서 기준으로 비교하고 선택 기준을 살펴봅니다."
pubDatetime: 2025-01-14T22:00:00+09:00
category: server
tags:
  - Spring
  - Ktor
  - Kotlin
  - 서버
  - 코루틴
---

Kotlin 으로 서버를 만들 때 가장 먼저 거론되는 두 프레임워크가 Spring Boot 와 Ktor 입니다. Kotlin 공식 문서의 서버 사이드 소개에서 Spring 은 Kotlin 의 언어 기능을 활용해 더 간결한 API 를 제공하는 프레임워크로, Ktor 는 코루틴을 사용해 높은 확장성을 노리면서 관용적인 API 를 제공하는 JetBrains 의 프레임워크로 설명됩니다. 둘의 출발점이 다르다 보니 같은 엔드포인트를 만들어도 코드의 모양과 프로젝트의 구조가 크게 갈립니다.

비교 기준 시점은 2025년 1월입니다. Spring Boot 3.4 는 2024년 11월 21일에 나와 Spring Framework 6.2 를 사용합니다. Ktor 3.0 은 2024년 10월에 출시되어 3.0.3 까지 패치가 나온 상태입니다.

## 구성하는 방식

Spring Boot 의 중심에는 auto-configuration 이 있습니다. 문서의 설명대로 클래스패스에 있는 jar 의존성을 보고 애플리케이션을 자동으로 구성합니다. HSQLDB 가 클래스패스에 있고 DB 연결 빈을 직접 정의하지 않았다면 인메모리 데이터베이스를 구성해 주는 식입니다. 이 구성은 침습적이지 않습니다. 직접 `DataSource` 빈을 추가하면 기본 임베디드 DB 지원이 물러납니다. 필요 없는 자동 구성 클래스는 `exclude` 로 끌 수 있고 `--debug` 로 실행하면 어떤 자동 구성이 왜 적용되었는지 조건 리포트로 확인할 수 있습니다.

Ktor 는 반대 방향에서 시작합니다. Ktor 는 기본으로 활성화하는 플러그인이 하나도 없고 직렬화, 압축, 헤더, 쿠키 같은 기능을 필요한 만큼 `install()` 로 설치합니다. 서버를 띄우는 코드와 설치한 기능이 코드에 그대로 드러나는 구조입니다.

```kotlin
fun main() {
    embeddedServer(Netty, port = 8080) {
        install(ContentNegotiation) { json() }
        routing {
            get("/users/{id}") {
                val id = call.parameters["id"]?.toLongOrNull()
                    ?: return@get call.respond(HttpStatusCode.BadRequest)
                call.respond(UserResponse(id, "user-$id"))
            }
        }
    }.start(wait = true)
}

@Serializable
data class UserResponse(val id: Long, val name: String)
```

Spring Boot 에서 같은 엔드포인트는 어노테이션으로 표현합니다.

```kotlin
@SpringBootApplication
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}

@RestController
@RequestMapping("/users")
class UserController(private val service: UserService) {
    @GetMapping("/{id}")
    suspend fun get(@PathVariable id: Long): UserResponse = service.find(id)
}

@Service
class UserService {
    suspend fun find(id: Long) = UserResponse(id, "user-$id")
}

data class UserResponse(val id: Long, val name: String)
```

두 예제는 Kotlin 2.0.21, Ktor 3.0.3, Spring Boot 3.4.1(`spring-boot-starter-web` 과 `kotlinx-coroutines-reactor`) 기준입니다. Spring 쪽 코드가 짧아 보이는 것은 웹 서버, JSON 변환, 라우팅이 모두 자동 구성에 들어 있기 때문입니다. Ktor 쪽에서는 `ContentNegotiation` 설치와 포트 지정이 코드에 보입니다. Ktor 는 `embeddedServer` 를 직접 호출하는 방식 외에 설정 파일(YAML 또는 HOCON)에 모듈 함수를 나열하는 방식으로도 서버를 띄울 수 있습니다. 프로젝트 생성기(start.ktor.io)에서는 엔진과 함께 설정 스타일을 고를 수 있습니다.

Kotlin 과 맞물리는 부분에는 Spring 쪽에 준비 작업이 하나 더 있습니다. Kotlin 클래스는 기본이 `final` 이어서 프록시가 필요한 Spring 어노테이션 클래스를 열어 줄 `kotlin-spring` 플러그인이 필요합니다. start.spring.io 가 만든 프로젝트에는 이 플러그인이 기본으로 켜져 있습니다. JSON 처리에는 Jackson 의 Kotlin 모듈이 필요하며 클래스패스에 있으면 자동으로 등록됩니다. Spring Boot 3.4 는 Kotlin 1.7 이상을 요구하고 적절한 버전을 의존성 관리로 맞춰 줍니다.

## 요청이 핸들러에 닿기까지

두 프레임워크의 요청 처리 구조는 그림으로 나란히 놓으면 차이가 드러납니다.

![Spring MVC 는 Servlet 컨테이너, Filter 체인, DispatcherServlet, HandlerMapping 과 Interceptor 를 거쳐 컨트롤러 메서드에 닿고, Ktor 는 엔진, ApplicationCall, 설치한 플러그인, Routing 을 거쳐 핸들러에 닿는다](@/assets/images/spring-vs-ktor-pipeline.png)

Spring MVC 는 front controller 패턴으로 설계되어 있습니다. 중앙의 서블릿인 `DispatcherServlet` 이 요청 처리의 공통 알고리즘을 제공하고 실제 작업은 설정 가능한 위임 컴포넌트가 맡습니다. 요청에 맞는 핸들러를 찾는 `HandlerMapping` 은 핸들러와 함께 앞뒤 처리를 위한 인터셉터 목록도 돌려줍니다. 이 모든 앞단에는 서블릿 컨테이너의 `Filter` 가 있습니다.

Ktor 의 플러그인은 요청·응답과 애플리케이션 로직 사이에 놓입니다. 요청은 핸들러로 가기 전에 설치된 플러그인을 하나 이상 거치고 핸들러가 처리한 뒤 응답이 나가기 전에 다시 플러그인을 거칩니다. 라우팅조차 하나의 플러그인입니다. 플러그인은 애플리케이션 전체에 설치할 수도 있고 특정 라우트에만 설치할 수도 있으며 라우트에 설치한 설정이 전역 설정보다 우선합니다. 직접 만드는 플러그인은 `createApplicationPlugin` 으로 정의하고 `onCall`, `onCallReceive`, `onCallRespond` 같은 훅에 로직을 걸면 됩니다.

## 의존성 주입

Spring 에서 DI 는 프레임워크 자체입니다. 컨테이너가 빈을 만들고 연결하며 문서는 Kotlin 에서도 `val` 읽기 전용 프로퍼티를 이용한 생성자 주입을 권합니다. 생성자가 하나뿐인 클래스는 `@Autowired` 없이도 자동으로 주입됩니다.

Ktor 3.0 에는 내장 DI 가 없어서 Koin 같은 외부 라이브러리를 플러그인으로 설치해 씁니다. Koin 은 `install(Koin) { modules(appModule) }` 로 설치하고 핸들러 안에서는 `call.get<UserService>()` 처럼 꺼냅니다. 다만 2025년 1월 기준 Koin 안정판(4.0.x)의 `koin-ktor` 는 Ktor 2.3 을 대상으로 빌드되어 있어 Ktor 3.0 과 함께 쓰면 라우트에서 `inject()` 할 때 `NoClassDefFoundError` 가 납니다. Ktor 3 대응은 4.1.0 베타의 `koin-ktor3` 아티팩트로 제공되고 있으므로 베타를 쓰거나 의존성을 직접 연결해야 합니다. 직접 연결한다면 서비스를 만들어 라우팅 함수에 인자로 넘기면 되고, 연결 코드는 `Application.module()` 안에 명시적으로 남습니다.

## 라우팅

Spring 은 어노테이션이 매핑 정보를 선언합니다. 컨트롤러 메서드가 `@RequestMapping` 계열 어노테이션으로 HTTP 에 매핑되고 요청 파라미터는 `@PathVariable` 같은 어노테이션으로 바인딩됩니다. WebFlux 의 `coRouter { }` 나 Spring MVC 의 `router { }` 같은 함수형 라우터 DSL 도 있지만 Spring 에서 일반적인 방식은 어노테이션입니다.

Ktor 의 라우팅은 DSL 입니다. `routing { }` 안에서 `get`, `post` 같은 동사 함수로 경로와 핸들러를 정의하고 `route("/users") { }` 로 경로를 묶으며 블록을 중첩해 세그먼트를 쌓습니다. 경로 파라미터는 `{login}`, 선택 파라미터는 `{login?}`, 나머지 경로는 `{...}` 로 표현하고 `call.parameters` 로 읽습니다. 라우트를 `Route` 의 확장 함수로 빼면 최상위 블록을 짧게 유지할 수 있습니다. 어노테이션 리플렉션 없이 코드가 곧 라우팅 테이블이므로 경로가 어디서 어디로 이어지는지 코드를 따라가며 읽을 수 있습니다.

## 비동기 모델과 코루틴

Ktor 는 처음부터 코루틴 위에 만들어졌고 핸들러 블록과 `call.respond` 가 모두 일시 중단 함수라서 별도 설정 없이 코루틴 안에서 코드를 쓸 수 있습니다. Kotlin 문서가 Ktor 를 소개하면서 코루틴을 먼저 내세우는 것도 그 때문입니다. 코루틴 자체는 [코루틴의 CPS 변환과 상태 기계](/posts/kotlin-coroutines-cps/)에서 다뤘습니다.

Spring 의 코루틴 지원은 기존 모델에 얹는 방식입니다. Spring Framework 문서에 따르면 `kotlinx-coroutines-core` 와 `kotlinx-coroutines-reactor` 가 클래스패스에 있을 때 Spring MVC 와 WebFlux 의 어노테이션 컨트롤러에서 `suspend` 함수와 `Flow` 반환을 쓸 수 있습니다. 위 예제의 `suspend fun get` 이 그 경우입니다. 다만 Spring MVC 에서 `suspend` 를 써도 서버 스택은 서블릿 기반 그대로여서 JPA 같은 블로킹 호출이 사라지지는 않습니다. 서버 전체를 논블로킹으로 만들고 싶다면 [Spring WebFlux](/posts/spring-webflux/)로 스택을 바꿔야 합니다. JDK 21 의 [가상 스레드](/posts/java-virtual-threads/)는 이 선택지와는 다른 방향으로 스레드 수의 한계를 완화합니다.

## 서버 엔진

Ktor 는 엔진을 선택하는 구조입니다. 지원 엔진은 Netty, Jetty, Tomcat, CIO 이며 앞의 셋은 JVM 전용에 HTTP/2 를 지원합니다. CIO(Coroutine-based I/O)는 JVM 외에 Kotlin/Native 와 GraalVM 에서도 쓸 수 있지만 HTTP/2 는 지원하지 않습니다. WAR 로 서블릿 컨테이너에 배포하는 `ServletApplicationEngine` 도 있습니다.

Spring Boot 는 서블릿 애플리케이션에 임베디드 Tomcat, Jetty, Undertow 를 지원하고 WebFlux 에서는 Reactor Netty, Tomcat, Jetty, Undertow 를 지원합니다.

## 생태계와 테스트

Spring 의 강점은 관련 프로젝트의 폭입니다. Spring Data, Spring Security, Spring GraphQL, Spring Integration 같은 프로젝트가 Boot 릴리즈와 함께 버전이 올라갑니다. Spring Boot 3.4 릴리즈 노트가 함께 올라간 Spring 프로젝트 버전을 정리해 둔 것이 한 예입니다. Ktor 는 기능 단위가 플러그인이라 직렬화, 압축, 쿠키, 세션 같은 서버 기능은 공식 플러그인으로 조합하고 데이터 접근처럼 프레임워크 바깥의 영역은 별도 라이브러리를 골라 붙입니다. 선택의 폭이 넓은 만큼 조합의 책임도 개발자에게 있습니다.

테스트 방식에도 차이가 있습니다. Ktor 의 `testApplication { }` 는 실제 서버를 띄우지 않고 테스트 엔진이 요청을 내부에서 처리하며 미리 구성된 HTTP 클라이언트를 제공합니다. 소켓을 열지 않으므로 포트 충돌이 생기지 않습니다.

시작 시간이나 메모리 사용량은 흔히 비교되는 항목인데, 확인한 공식 문서에는 두 프레임워크를 일반적인 수치로 비교한 내용이 없습니다. 둘 다 애플리케이션이 쓰는 기능과 엔진에 따라 크게 달라지므로 실제 구성으로 측정해야 하는 항목입니다.

## 멀티플랫폼

Ktor 는 서버뿐 아니라 HTTP 클라이언트도 제공합니다. 클라이언트는 Kotlin Multiplatform 으로 JVM, Android, JavaScript, Native, WasmJs 를 지원합니다. Android 앱이나 KMP 공유 모듈에서 같은 클라이언트 코드를 쓰면서 서버를 Ktor 로 구현하면 직렬화 모델을 서버와 클라이언트가 공유할 수 있습니다. Spring 쪽 HTTP 클라이언트인 `WebClient` 와 `RestClient` 는 JVM 에서 쓰는 도구입니다.

![Spring Boot 와 Ktor 를 구성 방식, DI, 라우팅, 비동기 모델, 서버 엔진, 부가 기능, HTTP 클라이언트 항목으로 비교한 표](@/assets/images/spring-vs-ktor-matrix.png)

## 선택 기준

팀이 이미 Spring 에 익숙하고 데이터 접근, 보안, 배치, 메시징처럼 여러 영역을 한 프레임워크 안에서 해결해야 한다면 Spring Boot 쪽의 비용이 낮습니다. auto-configuration 이 대부분의 연결을 해 줍니다. JPA 같은 블로킹 영속성 계층을 쓰는 구조에서도 Spring MVC 가 자연스럽습니다.

반대로 서버 코드를 코루틴으로 일관되게 쓰고 싶거나, 필요한 기능만 설치해 구성을 코드에서 전부 읽을 수 있게 하고 싶거나, 클라이언트와 서버가 Kotlin 코드를 공유하는 프로젝트라면 Ktor 가 어울립니다. 작은 서비스나 게이트웨이처럼 기능 범위가 좁은 서버에서 특히 그렇습니다. 다만 DI, 설정, 데이터 접근을 직접 조합하는 데 드는 설계 비용은 감수해야 합니다.

## 참고 자료

- [Kotlin for server-side](https://kotlinlang.org/docs/server-overview.html)
- [Ktor: Create a new Ktor project](https://ktor.io/docs/server-create-a-new-project.html)
- [Ktor: Server plugins](https://ktor.io/docs/server-plugins.html)
- [Ktor: Custom plugins](https://ktor.io/docs/server-custom-plugins.html)
- [Ktor: Routing](https://ktor.io/docs/server-routing.html)
- [Ktor: Engines](https://ktor.io/docs/server-engines.html)
- [Ktor: Testing](https://ktor.io/docs/server-testing.html)
- [Ktor: Client supported platforms](https://ktor.io/docs/client-supported-platforms.html)
- [Ktor: Releases](https://ktor.io/docs/releases.html)
- [Ktor releases (GitHub)](https://github.com/ktorio/ktor/releases)
- [Koin: Koin for Ktor](https://insert-koin.io/docs/reference/koin-ktor/ktor)
- [Koin issue #2027: Koin is not compatible with Ktor 3.0.0](https://github.com/InsertKoinIO/koin/issues/2027)
- [Koin 4.1.0-Beta1 release (koin-ktor3)](https://github.com/InsertKoinIO/koin/releases/tag/4.1.0-Beta1)
- [Spring Boot 3.4: Auto-configuration](https://docs.spring.io/spring-boot/3.4/reference/using/auto-configuration.html)
- [Spring Boot 3.4: Kotlin Support](https://docs.spring.io/spring-boot/3.4/reference/features/kotlin.html)
- [Spring Boot 3.4: Servlet Web Applications](https://docs.spring.io/spring-boot/3.4/reference/web/servlet.html)
- [Spring Boot 3.4 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.4-Release-Notes)
- [Spring Boot 3.4.0 available now](https://spring.io/blog/2024/11/21/spring-boot-3-4-0-available-now)
- [Spring Boot releases (GitHub)](https://github.com/spring-projects/spring-boot/releases)
- [Spring Framework Reference: DispatcherServlet](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet.html)
- [Spring Framework Reference: Special Bean Types](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/special-bean-types.html)
- [Spring Framework Reference: Coroutines](https://docs.spring.io/spring-framework/reference/languages/kotlin/coroutines.html)
- [Spring Framework Reference: Using Kotlin in Spring Projects](https://docs.spring.io/spring-framework/reference/languages/kotlin/spring-projects-in.html)
- [Spring Framework Reference: WebFlux Overview](https://docs.spring.io/spring-framework/reference/web/webflux/new-framework.html)
- [Spring Framework Reference: WebClient](https://docs.spring.io/spring-framework/reference/web/webflux-webclient.html)
- [Spring Framework Reference: Functional Endpoints (WebMvc.fn)](https://docs.spring.io/spring-framework/reference/web/webmvc-functional.html)
- [Spring Framework Reference: REST Clients](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)
