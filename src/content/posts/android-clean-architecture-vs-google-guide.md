---
title: "클린 아키텍처와 구글 앱 아키텍처 가이드는 같은 말이 아닙니다"
description: "Uncle Bob 의 Clean Architecture 와 Android 공식 앱 아키텍처 가이드를 레이어, 의존성 방향, 도메인 레이어, 모델 분리 관점에서 비교하고, 프로젝트 규모별 선택 기준과 실무에서 쓸 만한 팁을 적었습니다."
pubDatetime: 2026-10-30T09:00:00+09:00
category: android
tags:
  - 아키텍처
  - Clean Architecture
  - Android
---

"우리 앱은 클린 아키텍처를 씁니다"와 "구글 가이드대로 만들었습니다"는 같은 말처럼 오가지만 **같은 말이 아닙니다.** 레이어 이름이 비슷해서 헷갈릴 뿐, 의존성이 향하는 방향과 도메인 레이어의 위치가 다릅니다. 새 프로젝트의 구조를 정하거나 레거시를 모듈로 쪼갤 때 이 차이를 모르고 시작하면 나중에 "왜 Repository 인터페이스가 domain 에 있어야 하죠?" 같은 논쟁이 반복됩니다. 그래서 현재 Android 공식 가이드와 Uncle Bob 의 Clean Architecture 를 나란히 놓고 어떤 상황에서 무엇을 택할지까지 정리했습니다.

## 구글 가이드는 무엇을 말하나

Android 공식 [Guide to app architecture](https://developer.android.com/topic/architecture) 는 관심사 분리(separation of concerns)를 가장 중요한 원칙으로 두고 최소 두 개 레이어를 권장합니다.

![UI 레이어(UI 요소와 ViewModel), 선택적 도메인 레이어(UseCase), 데이터 레이어(Repository 와 DataSource)가 위에서 아래로 의존하는 Google 권장 앱 아키텍처 다이어그램](@/assets/images/android-arch-google-layers.png)

UI 레이어는 화면에 데이터를 보여 주고 사용자 입력을 받습니다. 구성 요소는 UI 요소(Jetpack Compose 등)와 상태 홀더(대표적으로 `ViewModel`)입니다. UI 는 상태(`UiState`)를 읽어 그리기만 합니다. 도메인 레이어는 선택입니다. 복잡하거나 여러 ViewModel 에서 재사용되는 비즈니스 로직을 UseCase 로 캡슐화하는 자리인데, 가이드는 필요할 때만 쓰라고 명시합니다. 데이터 레이어는 앱 데이터를 노출하고 비즈니스 로직 대부분을 담습니다. Repository 가 진입점이고, Repository 는 0개 이상의 DataSource(네트워크, DB, 파일 등)를 가집니다. 다른 레이어는 DataSource 에 직접 접근하지 않습니다.

의존 방향은 가이드의 다이어그램 설명에 적힌 그대로 "도메인 레이어는 데이터 레이어 클래스에 의존한다"입니다. UI 요소 → 상태 홀더 → (도메인) → 데이터 순으로 한쪽 방향입니다. 도메인 레이어를 두더라도 UI 가 데이터 레이어에 직접 접근하도록 허용할지, 반드시 UseCase 를 거치게 할지는 코드베이스에 맞춰 고르라고 안내합니다.

### SSOT 와 UDF

가이드를 받치는 두 축은 단일 진실 공급원(SSOT)과 단방향 데이터 흐름(UDF)입니다.

SSOT(Single Source of Truth)는 각 데이터 타입에 소유자를 하나만 두어 그 소유자만 데이터를 수정할 수 있게 하는 원칙입니다. 오프라인 우선 앱에서는 보통 로컬 DB 가 SSOT 입니다. 외부에는 불변 타입으로 노출합니다.

UDF(Unidirectional Data Flow)는 상태는 아래로(위에서 UI 로), 이벤트는 위로 흐르게 하는 구조입니다. ViewModel 이 상태를 보유·노출하고 UI 는 이벤트를 ViewModel 에 알립니다. ViewModel 이 상태를 갱신하면 UI 가 새 상태로 다시 그려집니다.

![UI 가 이벤트를 ViewModel 로 보내고 ViewModel 이 UiState 를 UI 로 내려보내는 단방향 데이터 흐름 루프](@/assets/images/android-arch-udf-loop.png)

### 권장 사항 중 눈에 띄는 것들

[Architecture recommendations](https://developer.android.com/topic/architecture/recommendations) 에서 실무에 바로 닿는 항목만 추렸습니다. 괄호의 강도는 문서에 적힌 그대로입니다.

- 명확히 구분된 데이터 레이어와 UI 레이어를 둡니다 (강력 권장).
- 데이터는 Repository 로 노출하고, DataSource 가 하나뿐이어도 Repository 를 만듭니다 (강력 권장).
- 레이어 간 통신에는 코루틴과 Flow 를 씁니다 (강력 권장).
- 도메인 레이어는 큰 앱에서 권장됩니다. 여러 ViewModel 이 로직을 공유하거나 ViewModel 이 복잡할 때만 씁니다.
- 복잡한 앱에서는 레이어마다 모델을 둡니다 (권장). Repository 가 DAO 모델을 UI 에 필요한 단순한 클래스로 매핑하는 식입니다.
- ViewModel 은 `Activity`, `Context`, `Resources` 를 참조하지 않고 화면 단위로 씁니다 (강력 권장). 상태는 `uiState`(`StateFlow`) 하나로 노출합니다 (권장, 서로 무관한 데이터면 여러 개도 허용).
- 의존성 주입(생성자 주입 위주)을 씁니다 (강력 권장). 복잡한 프로젝트에서는 Hilt 를 권장합니다 (권장).

## Uncle Bob 의 Clean Architecture

[The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) 는 Robert C. Martin 이 2012년에 정리한 개념입니다. 특정 플랫폼을 위한 것이 아닙니다. 업무 규칙을 프레임워크로부터 독립시키는 것이 목적입니다. 동심원으로 그려집니다.

![안쪽부터 Entities, Use Cases, Interface Adapters, Frameworks & Drivers 의 동심원과 의존성은 항상 안쪽을 향한다는 Dependency Rule](@/assets/images/android-arch-clean-circles.png)

| 원 (안 → 밖)             | 역할                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Entities**             | 전사(여러 앱이 공유하는) 업무 규칙. 단일 앱이라면 앱의 가장 일반적·핵심적인 비즈니스 객체 |
| **Use Cases**            | 앱 고유의 업무 규칙. Entities 를 조율해 하나의 시나리오를 수행                            |
| **Interface Adapters**   | 안쪽 형식과 바깥 형식을 변환. Presenter, Controller, Gateway 등                           |
| **Frameworks & Drivers** | UI, DB, 웹, 디바이스 같은 세부 사항                                                       |

이 구조를 지탱하는 것이 의존성 규칙(Dependency Rule)입니다. 소스 코드의 의존성은 오직 안쪽으로만 향해야 합니다. 안쪽 원은 바깥 원의 이름조차 알아서는 안 됩니다. 안쪽 계층이 바깥 계층의 기능을 써야 한다면 안쪽에 인터페이스를 정의하고 바깥이 그걸 구현하게 합니다. 이것이 의존성 역전(DIP)입니다. 덕분에 도메인(Entities, Use Cases)은 Android SDK, Room, Retrofit 을 전혀 몰라도 됩니다.

## 두 구조를 겹쳐 보면

1:1 로 대응하지는 않지만 대략 이렇게 포개집니다.

![Google 가이드의 UI, 도메인, 데이터 레이어가 Clean Architecture 의 각 원과 대략 대응되는 매핑 다이어그램](@/assets/images/android-arch-mapping.png)

| Google 가이드                  | Clean Architecture             | 비고                                    |
| ------------------------------ | ------------------------------ | --------------------------------------- |
| UI 요소 (Compose)              | Frameworks & Drivers           | 프레임워크 세부 사항                    |
| ViewModel (상태 홀더)          | Interface Adapters (Presenter) | UI 용 상태로 변환                       |
| 도메인 레이어 / UseCase (선택) | Use Cases (+ Entities)         | Clean 에서는 필수, 가이드에서는 선택    |
| Repository                     | Interface Adapters (Gateway)   | 인터페이스는 도메인, 구현은 바깥이 원칙 |
| DataSource (Room, Retrofit)    | Frameworks & Drivers           | 세부 사항                               |

## 어디서 갈라지나

### 의존성 방향

가장 크게 갈리는 지점입니다.

![왼쪽 Google 기본 구조는 UI 에서 UseCase 를 거쳐 데이터 레이어의 Repository 로 위에서 아래로 의존하고 오른쪽 Clean Architecture 는 RepositoryImpl 이 도메인의 Repository 인터페이스를 구현해 의존성이 역전된다](@/assets/images/android-arch-dependency-direction.png)

구글 가이드의 기본형은 UI → (도메인) → 데이터입니다. 가장 아래인 데이터 레이어에 도메인이 의존합니다. 가이드의 예제에서도 UseCase 가 `NewsRepository` 같은 데이터 레이어 클래스를 직접 받습니다.

오해하기 쉬운 부분이 있어서 덧붙입니다. 가이드가 인터페이스 사용을 금지하는 것은 아닙니다. 데이터 소스 의존을 인터페이스로 받으면 구현을 바꾸거나 테스트하기 쉽다고 언급합니다. 권장 사항의 네이밍 규칙(`OfflineFirstNewsRepository`, `DefaultNewsRepository` 등)도 Repository 인터페이스와 구현체를 전제로 합니다. 다만 가이드는 그 인터페이스를 어디에 둘지 규정하지 않습니다. 가이드의 예제는 데이터 레이어의 구체 클래스(`NewsRepository`)를 그대로 쓰며 공식 샘플 Now in Android 는 Repository 인터페이스와 구현을 모두 `core:data` 모듈에 둡니다.

Clean Architecture 는 반대입니다. `Repository` 인터페이스를 도메인 레이어에 둡니다. 데이터 레이어의 `RepositoryImpl` 이 그것을 구현합니다. 의존성이 data → domain 으로 뒤집힙니다.

### 도메인 레이어의 지위

가이드에서 도메인 레이어는 선택입니다. 복잡도나 재사용성이 필요할 때만 추가합니다. 가이드 스스로도 domain layer 가 클린 아키텍처 등 다른 아키텍처에서는 다른 뜻으로 쓰인다고 언급합니다. Clean 에서 도메인은 중심입니다. 모든 의존성이 향하는 곳이고 프레임워크로부터 완전히 독립적이어야 합니다.

### 모델 분리

가이드는 복잡한 앱에서 레이어별 모델을 권장하지만(권장), 간단한 앱이라면 데이터 레이어 모델을 UI 까지 그대로 써도 됩니다. Clean 은 경계를 넘을 때마다 경계 전용 데이터 구조를 두는 것이 원칙입니다. 그래서 `UserDto → User(Entity) → UserUiModel` 같은 매핑 코드가 많아집니다.

### 모듈화

가이드는 작은 앱이라면 `data`/`ui` 패키지(또는 모듈)로 나눠도 된다고 합니다. 모듈 분리는 별도 [모듈화](https://developer.android.com/topic/modularization) 문서에서 다룹니다. Clean 쪽은 레이어 경계를 모듈로 강제하면 효과가 큽니다. `domain` 모듈이 순수 Kotlin(JVM) 모듈이면 Android 의존성이 컴파일 단계에서 막힙니다.

### 한 표로

| 항목                       | Google 앱 아키텍처 가이드                                                       | Clean Architecture                                                 |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 레이어 수                  | UI + 데이터 (+ 선택적 도메인)                                                   | Entities / Use Cases / Adapters / Frameworks (원 개수는 고정 아님) |
| 도메인 레이어              | 선택 (복잡·재사용 시)                                                           | 필수, 중심                                                         |
| 의존성 방향                | UI → 도메인 → 데이터                                                            | 항상 안쪽(도메인)으로                                              |
| Repository 인터페이스 위치 | 규정 없음 (공식 샘플 Now in Android 는 data 모듈에 인터페이스와 구현을 함께 둠) | 도메인 레이어 (구현은 data)                                        |
| 모델 분리                  | 복잡한 앱에서 권장                                                              | 경계마다 분리가 원칙                                               |
| 프레임워크 독립성          | 권장하지만 강제 아님                                                            | 핵심 목표                                                          |
| 초기 비용                  | 낮음                                                                            | 높음 (보일러플레이트)                                              |
| 대표 키워드                | SSOT, UDF, UiState                                                              | Dependency Rule, DIP                                               |

## Kotlin 으로 절충해 보기

예시는 가이드의 UDF 형태(ViewModel + `StateFlow<UiState>`)에 Clean 의 의존성 역전을 얹은 절충안입니다. `import` 와 매핑 함수(`toDomain`)는 생략했습니다. `Flow` 는 순수 Kotlin 라이브러리(kotlinx-coroutines)여서 domain 모듈에서 써도 프레임워크 의존이 아닙니다.

```kotlin
// domain 모듈: 프레임워크를 모른다
data class Article(val id: String, val title: String, val publishedAt: Long)

interface ArticleRepository {            // 인터페이스는 domain 에
    fun observeArticles(): Flow<List<Article>>
}

class GetLatestArticlesUseCase(          // 동사 + 명사 + UseCase
    private val repository: ArticleRepository,
) {
    operator fun invoke(): Flow<List<Article>> =
        repository.observeArticles().map { list -> list.sortedByDescending { it.publishedAt } }
}
```

```kotlin
// data 모듈: domain 의 인터페이스를 구현한다
class OfflineFirstArticleRepository(
    private val local: ArticleLocalDataSource,    // Room (SSOT)
    private val remote: ArticleRemoteDataSource,  // Retrofit
) : ArticleRepository {
    override fun observeArticles(): Flow<List<Article>> =
        local.observeAll().map { entities -> entities.map { it.toDomain() } }
        // 동기화는 remote 를 읽어 local 에 쓰는 별도 경로에서 처리 (SSOT = local)
}
```

```kotlin
// UI 레이어: 단일 UiState 를 StateFlow 로 노출
data class ArticleUiState(
    val isLoading: Boolean = true,
    val articles: List<Article> = emptyList(),
)

class ArticleViewModel(
    getLatestArticles: GetLatestArticlesUseCase,
) : ViewModel() {
    val uiState: StateFlow<ArticleUiState> = getLatestArticles()
        .map { ArticleUiState(isLoading = false, articles = it) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = ArticleUiState(),
        )
}
```

`stateIn` 과 `WhileSubscribed(5_000)` 은 공식 권장 사항에 나오는 패턴입니다. 의존성 연결(`ArticleRepository` ← `OfflineFirstArticleRepository`)은 Hilt 의 `@Binds` 같은 DI 로 합니다.

화면에서는 ViewModel 의 상태를 수명주기를 인지하며 수집합니다.

```kotlin
@Composable
fun ArticleScreen(viewModel: ArticleViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // state 를 그리고, 클릭 같은 이벤트는 viewModel 의 함수로 전달
}
```

## 규모별로 고르면

| 상황                                 | 추천                                            |
| ------------------------------------ | ----------------------------------------------- |
| 소규모 앱, 1~2명, 빠른 출시          | 가이드 기본형 (UI + 데이터). 도메인 레이어 생략 |
| 중규모, 여러 화면이 같은 로직을 공유 | 가이드 + 필요한 곳에만 UseCase                  |
| 대규모, 여러 팀, 장기 유지보수       | Clean 스타일 도메인 모듈 + 의존성 역전          |
| 도메인 로직을 서버/KMP 등과 공유     | 순수 Kotlin `domain` 모듈 (Clean 스타일)        |
| 단순 CRUD, 로직 거의 없음            | UseCase 는 단순 위임만 하게 되므로 생략         |

## 적용할 때 걸리는 것들

가장 먼저 걸리는 건 도메인 레이어를 처음부터 만들고 싶은 유혹입니다. Repository 를 호출만 하는 UseCase 는 코드만 늘립니다. ViewModel 이 비대해지거나 두 곳 이상에서 같은 로직이 반복될 때 추출해도 늦지 않습니다. 반대로 Repository 는 DataSource 가 하나뿐이어도 만드는 쪽이 낫습니다. 가이드도 강하게 권장합니다. ViewModel 과 Composable 이 DataSource 를 직접 만지지 못하게 하는 경계가 되기 때문입니다.

의존성 역전도 필요한 만큼만 쓰는 편이 좋습니다. 구현이 하나뿐인 인터페이스가 늘어나면 오히려 읽기 어렵습니다. 모듈 경계(예: `domain` 순수 모듈)에서 쓰면 효과가 큽니다. 같은 모듈 안에서는 구체 클래스로도 충분할 때가 많습니다. 모델 분리도 같습니다. DTO/Entity 가 UI 요구와 다르거나 서버 스키마가 자주 바뀐다면 매핑 비용을 감수할 가치가 있습니다.

UseCase 는 한 가지 일만 하고 가변 상태를 갖지 않아야 합니다. 가이드도 UseCase 는 가변 데이터를 갖지 않고 main-safe 해야 한다고 설명합니다. ViewModel 은 Android 프레임워크 타입을 모르는 쪽이 좋아 `Context`, `Resources` 대신 UI 에서 문자열 리소스 ID 나 상태 값을 넘기고 UI 가 해석하게 합니다.

마지막으로, 규칙은 문서보다 모듈로 강제하는 편이 확실합니다. "domain 은 Android 를 쓰지 않는다"를 문서에 적어 두는 것보다 순수 Kotlin 모듈로 만들어 컴파일이 실패하게 하는 쪽이 낫습니다.

## 마치며

둘은 대립하는 관계가 아닙니다. 구글 가이드는 UI → (도메인) → 데이터의 실용적인 레이어링이며 Clean Architecture 는 모든 의존성이 도메인을 향하는 구조입니다. 가장 큰 차이는 도메인 레이어의 지위(선택 vs 필수)와, Clean 이 요구하는 Repository 인터페이스의 도메인 배치(의존성 역전)입니다.

두 접근은 SSOT 와 UDF, 레이어 간 명확한 경계라는 원칙을 공유합니다. 앱 규모에 따라 위 표처럼 도메인 모듈과 의존성 역전을 단계적으로 더하는 방식도 가능합니다.

## 참고 자료

- [Guide to app architecture — Android Developers](https://developer.android.com/topic/architecture)
- [UI layer](https://developer.android.com/topic/architecture/ui-layer)
- [Domain layer](https://developer.android.com/topic/architecture/domain-layer)
- [Data layer](https://developer.android.com/topic/architecture/data-layer)
- [Architecture recommendations](https://developer.android.com/topic/architecture/recommendations)
- [The Clean Architecture — Robert C. Martin (Uncle Bob), 2012](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Modularization](https://developer.android.com/topic/modularization)
- [Now in Android (official sample)](https://github.com/android/nowinandroid)
- [StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)

위 다이어그램은 모두 이 글을 위해 직접 그린 것이며, 공식 문서의 이미지를 복사하지 않았습니다.
