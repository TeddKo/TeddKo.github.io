---
title: "서버 모노레포 구성하기: Gradle 멀티 프로젝트, convention plugin, 영향 범위 빌드와 CODEOWNERS"
description: "모노레포와 폴리레포의 트레이드오프를 정리하고, Kotlin/Spring 서버를 Gradle 멀티 프로젝트로 구성할 때 쓰는 build-logic convention plugin, 버전 카탈로그, 컴포짓 빌드, 빌드 캐시와 구성 캐시, 변경된 모듈만 다시 빌드하는 방식, CODEOWNERS 를 예제 프로젝트로 확인합니다."
pubDatetime: 2026-02-24T21:20:00+09:00
category: server
tags:
  - 모노레포
  - Gradle
  - Kotlin
  - Spring
  - CI
---

서버가 커지면 모듈이 늘어나고 저장소를 몇 개로 나눌지가 질문이 됩니다. 서비스마다 저장소를 두는 폴리레포와 여러 프로젝트를 한 저장소에 두는 모노레포 중 어느 쪽이 낫다는 일반 해답은 없고 팀 규모와 변경이 얼마나 자주 여러 모듈에 걸치는지에 따라 비용이 갈립니다. 이 글은 두 방식의 트레이드오프를 먼저 보고 모노레포를 택했을 때 Gradle 로 구성하는 방법을 예제 프로젝트로 따라갑니다.

## 모노레포의 정의와 트레이드오프

monorepo.tools 는 모노레포를 서로 관계가 분명한 여러 개별 프로젝트를 담은 단일 저장소로 정의합니다. 코드를 한곳에 모았다는 것만으로는 모노레포가 아니며 부분 사이에 구분과 캡슐화가 없는 거대한 저장소는 그냥 큰 저장소일 뿐입니다. 좋은 모노레포는 모놀리식의 반대에 가깝다고 설명합니다. 이 사이트는 모노레포 도구인 Nx 의 팀이 운영하므로 도구 도입을 권하는 관점이 섞여 있다는 점은 감안해서 읽어야 합니다.

폴리레포에서는 팀이나 앱마다 저장소와 의존성, 도구, CI 가 따로 있습니다. 격리 덕분에 자율성이 생기지만 같은 문서의 표현대로 격리가 통합의 필요를 없애지는 못하고 통합 시점을 미룰 뿐입니다. 문서가 꼽는 폴리레포의 비용은 번거로운 코드 공유, 중복된 코드, 저장소를 가로지르는 변경의 비용, 강제하기 어려운 컨벤션 네 가지입니다. 모노레포는 공유가 쉽고 진실의 원천이 하나이며 프로젝트를 가로지르는 원자적 커밋이 가능하다는 장점을 내세웁니다. 대신 다른 비용을 냅니다. 저장소가 커질수록 빌드와 테스트, 도구가 감당해야 할 규모가 커지는 데다 한 저장소 안에서는 다른 모듈을 가져다 쓰기도 쉬워서 의존 관계가 얽히기 쉽습니다. 경계는 모듈 구조와 의존 규칙으로 지켜야 합니다.

대표적인 사례가 Google 입니다. Potvin 과 Levenberg 의 CACM 2016 논문 「Why Google Stores Billions of Lines of Code in a Single Repository」는 Google 의 단일 저장소가 전 세계 수만 명의 개발자에게 공통의 진실의 원천을 제공한다고 소개합니다. 이 저장소를 위해 직접 만든 소스 저장소 시스템과 이를 굴리는 워크플로, 그리고 이 모델의 장점과 비용도 함께 다룹니다. 일반 서버 팀이 같은 수준의 도구를 만들 필요는 없지만 저장소를 합칠수록 빌드 도구의 캐시와 영향 범위 계산이 중요해진다는 방향은 같습니다. Dart 진영에서 Melos 로 같은 문제를 다룬 예는 [Melos 모노레포로 나눈 Flutter 즐겨찾기 앱](/posts/flutter-search-favorites-melos-monorepo/)에서 볼 수 있습니다.

## 예제 프로젝트의 구성

아래 레이아웃은 Kotlin/Spring 서버 세 개(`apps`)와 공유 라이브러리 세 개(`libs`), 공통 빌드 로직(`build-logic`)을 한 저장소에 둔 예제입니다. 이 글의 예제는 Gradle 8.14, Kotlin 2.2.21, Spring Boot 3.5.11 기준입니다(Spring Boot 3.5 가 공식 지원하는 Gradle 은 7.6.4 이상 7.x 와 8.4 이상 8.x 입니다).

![루트에 settings.gradle.kts, 버전 카탈로그, build-logic, apps 아래 세 앱, libs 아래 세 공유 라이브러리, CODEOWNERS 가 놓인 모노레포 디렉터리 트리](@/assets/images/server-monorepo-layout.png)

Gradle 에서 이런 구조는 멀티 프로젝트 빌드입니다. 루트 프로젝트 하나와 하위 프로젝트들이 `settings.gradle(.kts)` 파일 하나에 정의되고 문서는 이 방식이 모듈화, 병렬 실행, 코드 재사용을 가능하게 한다고 설명합니다. 하위 프로젝트는 `include()` 로 선언하며 프로젝트 경로 `apps:order-api` 는 기본으로 `./apps/order-api` 디렉터리에 대응합니다.

```kotlin
// settings.gradle.kts
pluginManagement {
    includeBuild("build-logic")
}

dependencyResolutionManagement {
    repositories { mavenCentral() }
}

rootProject.name = "server-platform"

include(
    ":apps:order-api",
    ":apps:admin-api",
    ":apps:batch-worker",
    ":libs:domain-core",
    ":libs:common-web",
    ":libs:test-support",
)
```

모듈 사이의 의존은 `project(":libs:domain-core")` 처럼 프로젝트 경로로 선언합니다. 의존 대상 프로젝트가 먼저 빌드되고 컴파일된 클래스와 전이 의존성이 소비자의 클래스패스에 들어갑니다.

```kotlin
// apps/order-api/build.gradle.kts
plugins {
    id("spring-app-conventions")
}

dependencies {
    implementation(project(":libs:domain-core"))
    implementation(project(":libs:common-web"))
    implementation(libs.spring.boot.starter.web)
    testImplementation(project(":libs:test-support"))
    testImplementation(libs.spring.boot.starter.test)
}
```

문서는 프로젝트 이름을 소문자와 대시로 짓고 `rootProject.name` 을 설정 파일에 명시하라고 권합니다. 루트 이름은 리포트에 쓰이고 체크아웃 디렉터리 이름과 무관하게 유지됩니다.

## build-logic 과 convention plugin

모듈이 여섯 개만 돼도 JDK 버전, 테스트 플랫폼, Kotlin 플러그인 같은 설정이 모든 `build.gradle.kts` 에 반복됩니다. Gradle 문서가 권하는 방법은 convention plugin 입니다. 빌드 스크립트 파일 이름이 곧 플러그인 ID 가 되고 하위 프로젝트는 `plugins { id("...") }` 로 가져다 씁니다. 이는 `allprojects {}` 나 `subprojects {}` 로 설정을 주입하는 방식을 대체합니다. 문서는 그 방식을 하위 프로젝트 사이에 빌드 로직을 공유하는 부적절한 방법이라고 부릅니다. 빌드 스크립트만 봐서는 어떤 설정이 주입되는지 알 수 없고 프로젝트 사이에 구성 시점의 결합이 생기기 때문입니다.

convention plugin 을 둘 위치는 `buildSrc` 와 `build-logic` 컴포짓 빌드 두 가지입니다. `buildSrc` 는 다른 빌드 스크립트보다 먼저 컴파일되어 루트와 하위 프로젝트의 클래스패스에 올라갑니다. 문서는 `buildSrc` 의 코드를 바꾸면 구성 단계가 무효화되어 모든 태스크가 다시 실행될 수 있다고 경고합니다. 빌드 로직을 구조화하고 공유하는 방법으로는 컴포짓 빌드가 안내되며, 이 예제의 `build-logic` 이 그 구조입니다. Gradle 의 모범 사례 문서도 빌드 로직을 둘 곳으로 `buildSrc` 보다 `build-logic` 같은 포함 빌드를 권합니다.

```kotlin
// build-logic/build.gradle.kts
plugins {
    `kotlin-dsl`
}

dependencies {
    implementation(libs.kotlin.gradle.plugin)
    implementation(libs.kotlin.allopen)
    implementation(libs.spring.boot.gradle.plugin)
    implementation(libs.dependency.management.plugin)
}
```

```kotlin
// build-logic/src/main/kotlin/kotlin-conventions.gradle.kts
plugins {
    kotlin("jvm")
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
}
```

```kotlin
// build-logic/src/main/kotlin/spring-app-conventions.gradle.kts
plugins {
    id("kotlin-conventions")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}
```

`libs.kotlin.gradle.plugin` 같은 접근자를 `build-logic` 안에서 쓰려면 이 빌드의 `settings.gradle.kts` 가 루트의 카탈로그 파일을 가져와야 합니다. `build-logic` 은 메인 빌드와 별개의 빌드이기 때문입니다.

```kotlin
// build-logic/settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    versionCatalogs {
        create("libs") { from(files("../gradle/libs.versions.toml")) }
    }
}

rootProject.name = "build-logic"
```

## 버전 카탈로그

의존성 버전은 `gradle/libs.versions.toml` 한 곳에서 관리합니다. 파일은 `[versions]`, `[libraries]`, `[bundles]`, `[plugins]` 네 섹션으로 이루어집니다. Gradle 은 별칭마다 타입 안전 접근자를 만들어 IDE 자동 완성을 줍니다. 별칭의 대시는 점으로 바뀌어 `spring-boot-starter-web` 이 `libs.spring.boot.starter.web` 이 됩니다. 카탈로그는 빌드의 모든 프로젝트에 보이므로 앱과 라이브러리가 같은 버전을 쓰게 됩니다.

```toml
# gradle/libs.versions.toml
[versions]
kotlin = "2.2.21"
spring-boot = "3.5.11"
dependency-management = "1.1.7"

[libraries]
spring-boot-starter-web = { module = "org.springframework.boot:spring-boot-starter-web" }
spring-boot-starter-test = { module = "org.springframework.boot:spring-boot-starter-test" }
kotlin-gradle-plugin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }
kotlin-allopen = { module = "org.jetbrains.kotlin:kotlin-allopen", version.ref = "kotlin" }
spring-boot-gradle-plugin = { module = "org.springframework.boot:spring-boot-gradle-plugin", version.ref = "spring-boot" }
dependency-management-plugin = { module = "io.spring.gradle:dependency-management-plugin", version.ref = "dependency-management" }
```

Spring Boot 스타터에 버전이 없는 것은 `io.spring.dependency-management` 플러그인이 Boot 의 BOM 으로 버전을 맞추기 때문입니다.

## 컴포짓 빌드는 언제 쓰는가

멀티 프로젝트 빌드가 하나의 빌드 안에 하위 프로젝트를 두는 구조라면 컴포짓 빌드는 빌드 전체를 포함시키는 구조입니다. 설정 파일에서 `includeBuild("my-utils")` 로 선언하면 Gradle 이 포함된 빌드가 제공할 수 있는 의존성을 파악해 그룹과 이름이 일치하는 외부 의존성을 프로젝트 의존성으로 치환합니다. 라이브러리를 배포하지 않고 소비하는 쪽과 함께 개발할 수 있고, 큰 멀티 프로젝트 빌드를 더 작고 격리된 빌드로 나눠 따로 또는 함께 작업하는 구성도 가능합니다. 문서가 모노레포라는 말을 쓰지는 않지만, 한 저장소 안에서 빌드를 나누는 이 용도는 모노레포에 그대로 들어맞습니다. 이 예제의 `build-logic` 도 컴포짓 빌드의 한 사용입니다.

폴리레포에서 모노레포로 옮기는 과정에서도 쓸모가 있습니다. 저장소를 옮기기 전에 라이브러리 저장소를 소비 쪽 빌드에 `includeBuild` 로 연결해 두면, 코드 위치와 무관하게 의존 관계와 빌드 설정부터 맞춰 볼 수 있습니다.

## 빌드를 빠르게 유지하는 설정

모노레포의 빌드 시간은 저장소가 커질수록 늘어나므로 Gradle 의 세 가지 기능이 사실상 전제가 됩니다. 모두 `gradle.properties` 에서 켭니다.

```properties
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=true
```

병렬 실행은 서로 독립인 하위 프로젝트의 태스크를 동시에 실행합니다. 기본값에서는 한 번에 태스크 하나만 실행하고 한 프로젝트가 실행 시간을 지배하거나 프로젝트 사이 의존이 촘촘하면 효과가 줄어듭니다. 빌드 캐시는 태스크 출력을 입력이 같을 때 재사용하는 장치로, 기능 자체는 기본으로 꺼져 있어 위처럼 켜야 합니다. 켜면 로컬 캐시가 바로 쓰이고, 원격 캐시는 따로 구성해야 하며(기본 제공 구현이 HTTP 캐시) 원격 푸시는 기본으로 꺼져 있습니다. 구성 캐시는 구성 단계의 결과를 저장해 두었다가 구성에 영향을 주는 입력이 바뀌지 않으면 그 단계를 건너뜁니다. 빌드와 플러그인이 구성 캐시의 요구 사항을 지켜야 하며, Gradle 9.0 부터는 문서가 구성 캐시를 선호하는 실행 방식으로 안내합니다.

의존 선언도 속도에 영향을 줍니다. 라이브러리 모듈에서 내부 의존성을 `api` 대신 `implementation` 으로 선언하면 소비자의 컴파일 클래스패스에 노출되지 않아, 그 의존성이 바뀌어도 소비자를 다시 컴파일하지 않아도 됩니다. 문서는 이 선택을 불필요한 재컴파일을 줄이는 방법으로 안내합니다.

## 변경된 모듈만 다시 빌드하기

위 예제에서 `domain-core` 의 `Order` 클래스에 필드를 추가한 뒤 `./gradlew compileKotlin` 을 실행하면 태스크 결과가 다음 예시 출력처럼 나뉩니다.

```text
> Task :libs:test-support:compileKotlin UP-TO-DATE
> Task :libs:common-web:compileKotlin UP-TO-DATE
> Task :apps:admin-api:compileKotlin UP-TO-DATE
> Task :libs:domain-core:compileKotlin
> Task :apps:batch-worker:compileKotlin
> Task :apps:order-api:compileKotlin
Configuration cache entry reused.
```

`domain-core` 를 의존하는 `order-api` 와 `batch-worker` 만 다시 컴파일되고 나머지는 입력이 같아 건너뜁니다. Gradle 은 태스크 입력이 바뀌었는지로 판단하므로 영향 범위를 따로 계산하는 도구가 없어도 로컬 증분 빌드에서는 이 동작이 자연스럽게 나옵니다. CI 러너가 매번 새 작업 공간에서 시작한다면 같은 효과를 내기 위해 원격 빌드 캐시나 CI 의 Gradle 캐시 보존 같은 장치가 필요합니다. 문서의 설정 예처럼 CI 서버에서만 캐시에 쓰고 개발자는 읽기만 하게 둘 수 있습니다.

```kotlin
// settings.gradle.kts
val isCiServer = System.getenv().containsKey("CI")

buildCache {
    remote<HttpBuildCache> {
        url = uri("https://example.com:8123/cache/")
        isPush = isCiServer
    }
}
```

![domain-core 가 변경되면 이를 의존하는 order-api 와 batch-worker 만 재빌드 대상이 되고, common-web 과 admin-api 는 영향을 받지 않는 의존 그래프](@/assets/images/server-monorepo-affected-graph.png)

모노레포 도구들이 내세우는 affected 감지는 변경이 영향을 주는 프로젝트를 식별해 그 태스크만 실행하는 기능입니다. 확인한 Gradle 문서에서는 이런 기능을 따로 소개하지 않아서 앱별 CI 를 분리하고 싶다면 CI 쪽 경로 필터를 씁니다. GitHub Actions 의 `paths` 필터는 변경된 파일 중 하나라도 패턴에 맞으면 워크플로를 실행합니다.

```yaml
on:
  pull_request:
    paths:
      - "apps/order-api/**"
      - "libs/domain-core/**"
      - "libs/common-web/**"
      - "build-logic/**"
      - "gradle/**"
```

경로 목록에는 앱이 의존하는 라이브러리와 빌드 로직이 모두 들어가야 하므로 의존 그래프가 바뀔 때 필터도 함께 고쳐야 합니다. 경로 필터 때문에 워크플로가 건너뛰어지면 필수 체크가 대기 상태로 남아 PR 병합이 막힐 수 있습니다. 경로 필터가 부담스러우면 항상 전체 빌드를 실행하되 빌드 캐시로 시간을 줄이는 구성이 더 단순합니다.

## CODEOWNERS 로 소유권 두기

저장소가 하나가 되면 폴리레포에서 저장소 권한으로 나뉘던 책임 경계가 사라집니다. GitHub 의 CODEOWNERS 파일은 경로 패턴별로 코드 소유자를 지정하는 방법입니다. `.github/`, 저장소 루트, `docs/` 중 한 곳에 두며 GitHub 는 이 순서로 처음 발견한 파일을 씁니다. 패턴이 겹치면 마지막으로 일치한 패턴이 우선하므로 넓은 규칙을 위에, 좁은 규칙을 아래에 둡니다.

```text
# .github/CODEOWNERS
*                    @example-org/platform
/apps/order-api/     @example-org/order-team
/libs/domain-core/   @example-org/order-team @example-org/platform
/build-logic/        @example-org/platform
```

소유 코드를 수정하는 PR 이 열리면 코드 소유자가 자동으로 리뷰 요청을 받습니다. 초안(draft) PR 에는 요청이 가지 않고 준비 완료로 바꿀 때 알림이 갑니다. 승인을 강제하려면 브랜치 보호 규칙에서 Require review from Code Owners 를 켜야 하고 나열된 소유자 중 한 명의 승인으로 요구가 충족됩니다. CODEOWNERS 는 리뷰 요구를 만들 뿐 읽기나 쓰기 권한을 나누지는 않으므로 접근 제어가 필요한 코드는 따로 고려해야 합니다.

## 선택 기준

서비스들이 도메인 모델과 공통 라이브러리를 공유하고 한 변경이 여러 서비스에 걸치는 일이 잦다면 모노레포의 이점이 큽니다. 공유 라이브러리를 고치고 소비하는 서비스까지 한 PR 에서 검증할 수 있기 때문입니다. 서비스 사이에 공유 코드가 거의 없고 팀이 독립적으로 배포한다면 폴리레포의 격리가 더 단순합니다. 모노레포를 고른다면 빌드 시간과 설정 중복은 빌드 캐시, 구성 캐시, convention plugin 으로 관리합니다. 모듈 경계는 `api` 와 `implementation` 의 구분과 의존 규칙으로, 책임은 CODEOWNERS 로 유지해야 합니다.

## 참고 자료

- [monorepo.tools](https://monorepo.tools/)
- [Why Google Stores Billions of Lines of Code in a Single Repository (Google Research)](https://research.google/pubs/why-google-stores-billions-of-lines-of-code-in-a-single-repository/)
- [Gradle: Multi-Project Builds](https://docs.gradle.org/current/userguide/multi_project_builds.html)
- [Gradle: Composite Builds](https://docs.gradle.org/current/userguide/composite_builds.html)
- [Gradle: Sharing Build Logic between Subprojects](https://docs.gradle.org/current/userguide/sharing_build_logic_between_subprojects.html)
- [Gradle: Version Catalogs](https://docs.gradle.org/current/userguide/version_catalogs.html)
- [Gradle: Configuration Cache](https://docs.gradle.org/current/userguide/configuration_cache.html)
- [Gradle: Build Cache](https://docs.gradle.org/current/userguide/build_cache.html)
- [Gradle: Performance](https://docs.gradle.org/current/userguide/performance.html)
- [Gradle: Organizing Gradle Projects](https://docs.gradle.org/current/userguide/organizing_gradle_projects.html)
- [Gradle: Best Practices for Structuring Builds](https://docs.gradle.org/current/userguide/best_practices_structuring_builds.html)
- [Gradle 9.0.0 Release Notes](https://docs.gradle.org/9.0.0/release-notes.html)
- [Spring Boot 3.5: System Requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html)
- [Kotlin: Gradle plugin compatibility](https://kotlinlang.org/docs/gradle-configure-project.html)
- [Gradle: The Java Library Plugin](https://docs.gradle.org/current/userguide/java_library_plugin.html)
- [GitHub Docs: About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Docs: Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
