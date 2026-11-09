---
title: "Compose Multiplatform 으로 만든 문서 리더 TeddReader 의 구조"
description: "TXT, EPUB, PDF, CBZ 를 읽는 Android/iOS 리더 TeddReader 를 Compose Multiplatform 으로 만들며 잡은 모듈 구조, expect/actual 경계, 상태 흐름, 빌드 로직과 Compose 안정성 설정을 코드와 함께 적었습니다."
pubDatetime: 2026-10-02T22:20:00+09:00
category: cmp
tags:
  - Compose Multiplatform
  - KMP
  - Kotlin
  - 아키텍처
---

[TeddReader](https://github.com/TeddKo/TeddReader)는 기기에 이미 있는 문서를 여는 리더입니다. TXT, EPUB, PDF, CBZ, 그리고 이미지가 든 폴더를 열 수 있고 어디까지 읽었는지 기억합니다. 서버도 계정도 없습니다. 혼자 진행한 프로젝트입니다. Android 와 iOS 가 같은 Kotlin 코드와 같은 Compose UI 를 쓰도록 Compose Multiplatform 으로 만들었습니다. 이 글은 그 저장소가 어떻게 생겼는지를 코드 기준으로 풀어 본 것입니다. 저장소에 스크린샷은 올려 두지 않았기 때문에 화면 대신 구조를 그림으로 그렸습니다.

## 왜 CMP 였나

리더는 UI 에서 해야 할 일이 많은 앱입니다. 페이지를 넘기는 효과만 열 가지이며 그중 세 가지는 손가락을 따라 움직이다가 놓는 지점에서 자리를 잡습니다. 글자 크기와 굵기를 바꾸면 책 전체가 다시 흐릅니다. 이런 화면을 플랫폼마다 따로 쓰면 같은 수식을 두 번 맞춰야 합니다. 그래서 UI 까지 공유하는 쪽을 택했습니다. 플랫폼이 실제로 다른 곳에서만 `androidMain`과 `iosMain`으로 내려가게 했습니다. 이 기준이 이후 구조의 대부분을 결정했습니다.

## 모듈은 이렇게 나눴습니다

`settings.gradle.kts`에는 `:androidApp`, `:baselineprofile`, `:app:reader`, `core` 모듈 일곱 개, 그리고 기능 여섯 개가 각각 `api`와 `impl` 한 쌍으로 들어 있습니다. 기능은 home, reader, search, bookmarks, document-info, settings 입니다.

```kotlin
// settings.gradle.kts
include(":app:reader")
include(":core:common")
include(":core:domain")
include(":core:data")
include(":core:datastore")
include(":core:room")
include(":core:designsystem")
include(":core:ui")
include(":feature:home:api")
include(":feature:home:impl")
```

![androidApp 과 iosApp 이 app:reader 로 들어가고, 앱 조립 모듈이 기능 구현과 저장소 구현을 거느리고, 기능 구현은 UI·기능 API·도메인 계약에, 저장소 구현은 도메인 계약에 의존하며 모두 core:common 으로 모이는 모듈 의존 그래프](@/assets/images/teddreader-modules.png)

화살표는 `build-logic`의 컨벤션 플러그인이 실제로 연결하는 의존성을 따라 그렸습니다. 읽는 법은 간단합니다. 아래쪽 `core:common`은 아무것도 의존하지 않고 위로 올라갈수록 조립하는 쪽입니다.

이 구조에는 두 가지 성질이 있습니다. 하나는 어떤 `feature` 모듈도 `core:data`를 모른다는 점입니다. 화면은 필요한 것을 `core:domain`의 인터페이스로 받습니다. 구현은 `app:reader`가 그래프에 올려 줍니다. 다른 하나는 `feature:*:impl`이 다른 기능의 `impl`에 닿지 않는다는 점입니다. 컨벤션 플러그인이 그 의존성을 넣어 주지 않으므로, 누군가 `project(...)` 의존을 직접 추가하지 않는 한 위반하려면 클래스패스에 없는 클래스를 import 해야 합니다.

기능 모듈의 `api`는 `HomeRoute`나 `LibraryRoute(folderId)` 같은 내비게이션 키만 담습니다.

```kotlin
// feature/home/api/.../HomeRoute.kt
@Serializable
data object HomeRoute

@Serializable
data class LibraryRoute(
    val folderId: String? = null,
)
```

## 모듈 빌드 파일에는 거의 아무것도 없습니다

`core:data`의 `build.gradle.kts`는 이게 전부입니다.

```kotlin
// core/data/build.gradle.kts
plugins {
    id("teddreader.core.data")
}
```

의존성은 `build-logic/`의 프리컴파일 스크립트 플러그인이 가집니다. 예를 들어 `feature:*:impl`이 공통으로 쓰는 플러그인은 모듈 경로에서 자기 `api`를 찾아 붙입니다. iOS 프레임워크 이름도 기능 이름에서 만듭니다.

```kotlin
// build-logic/src/main/kotlin/teddreader.feature.impl.gradle.kts
val featurePath = project.path.removeSuffix(":impl")
val featureName = featurePath.substringAfterLast(":")
val featureFrameworkName = "TeddReader" + featureName.replaceFirstChar { it.titlecase() }

kotlin {
    targets.withType<KotlinNativeTarget>().configureEach {
        binaries.framework {
            baseName = featureFrameworkName
            binaryOption("bundleId", "com.tedd.teddreader.feature.$featureName")
            isStatic = true
        }
    }
    sourceSets {
        commonMain.dependencies {
            implementation(project("$featurePath:api"))
            implementation(project(":core:common"))
            implementation(project(":core:domain"))
            implementation(project(":core:designsystem"))
            implementation(project(":core:ui"))
```

기능을 하나 더 만들 때 `impl/build.gradle.kts`에 쓸 것이 `id("teddreader.feature.impl")` 한 줄이라는 뜻입니다. 의존성 목록을 모듈마다 복사해 두면 어느 날 하나만 어긋납니다. 한 곳에 두면 어긋날 자리가 없습니다. 플러그인이 `libs.versions.toml`의 카탈로그를 `findLibrary`로 읽기 때문에 버전도 한 곳에서만 바뀝니다.

`teddreader.kmp.compose`에는 `teddreader.material3.gate`도 걸려 있습니다. Material 3 를 앱 토큰으로 감싼 모듈(`core:ui`, `core:designsystem`) 밖에서 `androidx.compose.material3`를 import 하면 `check`가 실패하는 Gradle 태스크입니다. 예외는 목차 drawer 에 쓰는 다섯 개 심볼뿐입니다. 디자인 시스템이 새는 것은 리뷰어 대신 빌드가 잡습니다.

## 공유하는 것과 갈라지는 것

공유 코드는 `commonMain`에 있습니다. 화면, ViewModel, 저장소 구현, 파서, 페이지 나누기 엔진 모두 여기입니다. `androidMain`과 `iosMain`으로 내려가는 곳은 플랫폼이 정말로 다른 지점으로 한정했습니다.

![commonMain 의 expect 선언 세 개가 androidMain 과 iosMain 의 actual 로 갈라지고, androidApp 의 MainActivity 와 iosApp 의 ContentView 가 같은 TeddReaderApp 으로 들어오는 그림](@/assets/images/teddreader-shared-vs-platform.png)

가장 작은 예가 접히는 기기의 힌지 정보입니다. Android 는 `WindowInfoTracker`로 접힘 feature 를 읽습니다. iOS 는 폴더블 기기가 없어서 `null`을 돌려줍니다.

```kotlin
// core/ui/src/commonMain/.../system/DisplayFold.kt
@Composable
expect fun rememberDisplayFold(): DisplayFold?

// core/ui/src/iosMain/.../system/DisplayFold.ios.kt
@Composable
actual fun rememberDisplayFold(): DisplayFold? = null
```

호출하는 쪽은 `null`이 올 수 있다는 것만 알면 됩니다. 플랫폼 분기를 `if (isIos)`로 흩뿌리지 않고 선언 하나로 모은 셈입니다.

플랫폼 차이가 더 깊은 곳도 있습니다. 텍스트를 측정하는 디스패처는 Android 에서 `Dispatchers.Default`, iOS 에서 `Dispatchers.Main`입니다.

```kotlin
// core/data/src/androidMain/.../ReaderPageMeasureDispatcher.android.kt
internal actual val ReaderPageMeasureDispatcher: CoroutineDispatcher = Dispatchers.Default

// core/data/src/iosMain/.../ReaderPageMeasureDispatcher.ios.kt
internal actual val ReaderPageMeasureDispatcher: CoroutineDispatcher = Dispatchers.Main
```

`expect` 선언 위의 KDoc 에 이유가 적혀 있습니다. iOS 쪽 Compose 의 텍스트 스타일 캐시가 평범한 `HashMap`이라, 메인 스레드가 화면의 페이지를 배치하는 동안 백그라운드에서 측정하면 `ConcurrentModificationException`으로 종료됐다고 합니다. 측정을 메인 스레드에 올려 그리기와 직렬화한 것입니다. 코드를 공유해도 플랫폼 런타임 차이는 사라지지 않습니다. 그 차이는 `actual` 한 줄에 들어 있습니다.

같은 맥락으로 페이지를 말아 넘기는 컬 효과도 타깃별로 값이 다릅니다. README 의 표를 보면 Android 는 컬 mesh 25 컬럼에 그림자 한 겹, iOS 는 12 컬럼에 네 겹입니다. 그림자도 Android 는 `Paint.setShadowLayer`의 네이티브 블러 한 번, iOS 는 반투명 path 를 겹쳐 가장자리를 부드럽게 만듭니다. PDF 는 Android 의 `PdfRenderer`, iOS 의 PDFKit(`UIKitView`)이 그립니다.

진입점은 Android 도 iOS 도 얇습니다. Android 의 `MainActivity`는 `TeddReaderApp`을 콘텐츠로 올립니다. iOS 는 Kotlin 쪽에 `ComposeUIViewController`를 돌려주는 함수 하나를 둡니다. SwiftUI 의 `ContentView`가 그것을 감쌉니다.

```kotlin
// app/reader/src/iosMain/.../MainViewController.kt
fun MainViewController(
    googleDrivePickerBridge: GoogleDrivePickerBridge? = null,
) = ComposeUIViewController {
    TeddReaderApp(googleDrivePickerBridge = googleDrivePickerBridge)
}
```

Google Drive 선택기만은 네이티브 로그인 UI 가 Kotlin 밖에 있어서 `GoogleDrivePicker.swift`가 `GoogleDrivePickerBridge`를 구현해 넘겨줍니다. 파일 가져오기도 Android 는 SAF 와 Drive 인텐트, iOS 는 `UIDocumentPickerViewController`로 갈립니다.

## 문서가 페이지가 되는 길

리더의 핵심은 UI 보다 파이프라인에 있습니다. 가져온 파일은 형식별 파서를 지나 `ReaderSection`이라는 평평한 텍스트와 블록 범위가 됩니다. `TextPageLayoutEngine`이 그것을 페이지로 나눕니다.

![파일 가져오기, 형식 판별, 파서, ReaderSection, TextPageLayoutEngine, 실제 Compose 줄 상자 측정, 페이지, 텍스트 앵커로 이어지는 파이프라인](@/assets/images/teddreader-pipeline.png)

읽던 위치는 페이지 번호 없이 섹션 안의 문자 오프셋(텍스트 앵커)으로 저장하므로 글꼴을 바꿔 페이지가 전부 다시 나뉘어도 같은 문장으로 돌아옵니다. `ReaderViewModel`에는 `anchorOffset`이라는 필드가 있습니다. 재분할이 끝나면 `reloadPages`가 이 오프셋을 새 페이지 인덱스로 풀어 줍니다.

페이지 경계가 정해지는 곳은 `TextPageLayoutEngine` 하나이고 불변식이 하나 있습니다. 한 페이지는 두 섹션에 걸치지 않습니다. EPUB 의 spine 아이템 하나가 곧 섹션이라, 챕터 제목이 항상 새 페이지 맨 위에 옵니다. 검색, 책갈피, 읽던 위치가 모두 같은 평면 문자열을 기준으로 삼는 것도 이 구조 덕분입니다.

## 상태는 한 방향으로만 흐릅니다

화면 상태는 ViewModel 이 가진 `MutableStateFlow`에서 나옵니다. `ReaderViewModel`은 `core:domain`의 저장소 인터페이스 네 개와 `OpenReaderDocumentUseCase`를 생성자로 받습니다.

![Room 과 DataStore 에서 core:data 의 저장소 구현을 거쳐 core:domain 인터페이스로, 그리고 ReaderViewModel 의 StateFlow 에서 화면으로 내려오고 사용자 동작이 다시 ViewModel 로 올라가는 상태 흐름](@/assets/images/teddreader-state-flow.png)

```kotlin
// feature/reader/impl/.../ReaderViewModel.kt
@KoinViewModel
class ReaderViewModel(
    private val documentRepository: DocumentRepository,
    private val bookmarkRepository: BookmarkRepository,
    private val readerSettingsRepository: ReaderSettingsRepository,
    private val readerRepository: ReaderRepository,
    private val openReaderDocumentUseCase: OpenReaderDocumentUseCase,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ReaderUiState())
    val uiState: StateFlow<ReaderUiState> = _uiState
```

화면 쪽은 `koinViewModel()`로 받아 `collectAsStateWithLifecycle()`로 구독하는 것이 전부입니다.

```kotlin
// feature/reader/impl/.../ReaderScreen.kt
fun ReaderRouteScreen(
    documentId: String,
    onBack: () -> Unit,
    ...
    viewModel: ReaderViewModel = koinViewModel(),
) {
    val persistedUiState by viewModel.uiState.collectAsStateWithLifecycle()
```

`ReaderUiState`는 `@Immutable` data class 입니다. 페이지 목록처럼 컬렉션이 들어가는 자리는 `ImmutableList`를 씁니다. 상태 클래스가 큰 편이라, 값을 하나 바꿀 때마다 `_uiState.update`로 복사본을 만드는 규율을 지켜야 합니다. ViewModel 의 KDoc 에는 suspend 함수마다 "지금도 이 문서가 열려 있는가"를 다시 확인한다는 관례가 길게 적혀 있습니다. 이 관례는 컴파일러가 강제하지 않으므로 새 함수를 추가할 때 빼먹으면 이전 책의 페이지가 화면에 뜰 수 있습니다. 코루틴 취소가 이미 시작된 DB 읽기를 멈추지 못한다는 점을 코드로 적어 둔 부분입니다.

## 의존성 주입은 컴파일러 플러그인으로

DI 는 Koin 이고 배선은 Koin 컴파일러 플러그인이 합니다. 저장소에서 KSP 를 쓰는 건 Room 뿐입니다. 정의는 만들어지는 클래스 바로 옆에 어노테이션으로 붙어 있습니다.

```kotlin
// core/data/.../repository/DocumentRepositoryImpl.kt
@Single([DocumentRepository::class])
class DocumentRepositoryImpl(
    private val documentDao: DocumentDao,
    private val searchIndexDao: SearchIndexDao,
    ...
) : DocumentRepository {
```

조립은 `app:reader`의 `ReaderAppModule` 하나가 합니다. 본문이 `includes` 목록뿐입니다.

```kotlin
// app/reader/.../di/ReaderAppModule.kt
@Module(
    includes = [
        DataModule::class,
        DomainModule::class,
        DataStoreModule::class,
        RoomModule::class,
        PlatformReaderModule::class,
        HomeFeatureModule::class,
        ReaderFeatureModule::class,
        ...
    ],
)
class ReaderAppModule
```

`startKoin()`은 없습니다. `TeddReaderApp`이 컴포저블 안에서 `KoinApplication`을 열기 때문에 그래프의 수명은 그 컴포저블에 묶이며 프로세스 전체와는 무관합니다. 모듈 집합을 `module<ReaderAppModule>()` 타입 하나로 고정한 것은 README 설명대로 컴파일러 플러그인이 전체 그래프를 컴파일 시점에 검증하게 하려는 선택입니다.

```kotlin
// app/reader/.../TeddReaderApp.kt
ProvidePlatformKoinInput()

KoinApplication(
    configuration = koinConfiguration { module<ReaderAppModule>() },
) {
```

Android `Context`처럼 컴포지션에서만 얻는 값은 `ProvidePlatformKoinInput()`이 `KoinApplication`보다 먼저 플랫폼별 홀더에 채워 둡니다. `PlatformReaderModule`은 `expect class`이고, `commonMain`이 만들 수 없는 객체(플랫폼 파일 소스, Room 데이터베이스, 환경설정 DataStore)는 `actual` 쪽이 만듭니다.

내비게이션은 Navigation 3 입니다. `ReaderNavHost`가 `NavDisplay`에 백스택을 넘깁니다. `entryProvider`가 `HomeRoute`, `LibraryRoute`, `ReaderRoute` 같은 키를 각 기능의 `RouteScreen`으로 연결합니다. 키는 `feature:*:api`에, 화면은 `impl`에 있으니 `app:reader`만 둘을 함께 압니다.

## Compose 성능에 쓴 설정들

리더는 손가락 아래에서 텍스트 한 페이지를 통째로 움직이기 때문에 재구성 비용이 곧 끊김입니다. 저장소에는 이를 위한 장치가 몇 개 있습니다.

먼저 볼 것은 `compose-stability.conf`입니다. `core:common`은 Compose 컴파일러를 적용하지 않는 순수 모듈이라 모델 클래스에 안정성 메타데이터가 생기지 않습니다. 그러면 UI 모듈에서 이 모델이 전부 unstable 로 취급되어 값이 같아도 매 emission 마다 재구성됩니다. 그래서 모델 패키지를 통째로 안정 타입으로 선언했습니다.

```
// compose-stability.conf
com.tedd.teddreader.core.common.model.*
```

파일 주석에는 전제 조건이 적혀 있습니다. 해당 패키지의 타입은 `val`만 가진 data/value/enum 클래스여야 하고 `ByteArray`나 가변 컬렉션 필드를 가지면 안 됩니다. 이 전제를 깨면 값이 바뀌어도 재구성이 생략됩니다. 또 이 파일의 내용은 Kotlin 컴파일 태스크의 입력으로 추적되지 않으므로 고친 뒤에는 `--rerun-tasks`나 `clean`이 필요하다는 경고도 있습니다. 그래서 이 경고를 파일 맨 위에 적어 두었습니다.

다음은 `teddreader.kmp.compose`에서 이 파일을 컴파일러에 연결하고, `-Pteddreader.composeReports`를 줬을 때만 컴파일러 리포트를 내도록 한 부분입니다.

```kotlin
// build-logic/src/main/kotlin/teddreader.kmp.compose.gradle.kts
composeCompiler {
    stabilityConfigurationFiles.add(
        rootProject.layout.projectDirectory.file("compose-stability.conf")
    )
    if (providers.gradleProperty("teddreader.composeReports").isPresent) {
        reportsDestination.set(layout.buildDirectory.dir("compose/reports"))
        metricsDestination.set(layout.buildDirectory.dir("compose/metrics"))
    }
}
```

평소 빌드에는 영향이 없습니다. 안정성이 퇴행했는지 보고 싶을 때만 옵션을 줍니다.

그다음은 README 에 적힌 단계 규율입니다. 프레임마다 바뀌는 값(페이저 오프셋, turn 진행률, 핀치 배율)은 composition 에서 읽지 않고 `() -> T` 람다로 넘겨 `graphicsLayer {}`나 `drawWithCache {}` 안에서 읽습니다. 방향이나 임계값 통과 같은 이산 값만 `derivedStateOf`로 composition 에 올립니다. 그래야 드래그 중에 재구성 없이 layout 과 draw 단계만 다시 돕니다.

마지막은 `baselineprofile` 모듈입니다. `com.android.test` 플러그인과 AndroidX Baseline Profile 플러그인을 쓰며 `useConnectedDevices = true`로 연결된 기기에서 실제 앱을 구동해 프로필을 만듭니다. 앱은 생성된 텍스트 파일만 쓰고 이 모듈 코드는 링크하지 않습니다. 재생성은 `./gradlew :androidApp:generateBaselineProfile`로 하며 rooted 에뮬레이터나 userdebug 기기가 필요하다고 모듈 주석에 적혀 있습니다.

## 테스트

공통 로직은 `commonTest`에서 `kotlin.test`로 쓰고 JVM 과 iOS 시뮬레이터 양쪽에서 돌립니다. Android 전용은 `androidHostTest`에 있습니다. README 의 집계로는 약 800 케이스이며 `core/data`(316)와 `feature/reader/impl`(233)에 몰려 있습니다. 파서, 페이지 나누기, 펼침 기하, 페이지 넘김 수식을 일부러 `Float`과 문자열 위의 순수 함수로 둔 덕분에 기기 없이 검증할 수 있습니다. 같은 테스트를 `./gradlew :core:data:iosSimulatorArm64Test`로 iOS 타깃에서도 돌릴 수 있습니다.

접근성 라벨이나 클릭 타깃의 유일성 같은 시맨틱 테스트는 `runComposeUiTest`가 iOS 시뮬레이터 테스트에서만 실행된다고 빌드 스크립트 주석에 적혀 있어 `iosTest` 소스셋에 두었습니다. Android host test 는 JVM 단위 테스트라 Robolectric 없이는 이 API 를 못 돌립니다.

## Android 와 iOS 를 한 저장소에서

공유율보다 경계의 모양을 보면, `expect`가 걸린 곳은 열아홉 군데 남짓입니다. 접힘 정보, 텍스트 디코딩, 디스패처, 폰트·로케일·시스템 바·인셋·배터리, 파일 시스템과 Room 생성자, PDF 서피스, 가져오기 UI, 컬 효과의 렌더링, Koin 플랫폼 입력이 그 목록입니다. 나머지, 즉 파서와 레이아웃 엔진과 상태 관리와 화면 대부분은 양쪽이 한 벌을 씁니다. 그래서 한 곳을 고치면 두 플랫폼이 같이 바뀝니다. 같은 테스트를 Android 와 iOS 시뮬레이터 타깃에서 한 번씩 돌려 확인합니다.

제약도 있습니다. iOS 는 접힘 정보가 없어서 두 페이지 펼침이 화면 크기 조건에만 걸립니다. 측정을 메인 스레드에 올려야 하는 제약도 iOS 에만 있습니다. 빌드에는 JDK 17 이상, Android SDK 37, 그리고 iOS 쪽 Xcode 가 모두 필요해서 환경을 맞추는 비용도 둘을 합친 만큼입니다. Google Drive 가져오기는 iOS 쪽 클라이언트 ID 를 `Config.xcconfig`에 따로 넣어야 합니다.

새 기능을 붙이는 절차는 정해져 있습니다. `settings.gradle.kts`에 `api`·`impl` 두 모듈을 include 하고, 각 `build.gradle.kts`에 플러그인 한 줄(`teddreader.feature.api` / `teddreader.feature.impl`)을 쓴 다음, `teddreader.app.reader` 컨벤션 플러그인에 두 모듈 의존을 추가하고 `ReaderAppModule`의 `includes`와 `ReaderNavHost`의 `entryProvider`에 하나씩 올립니다. 의존 규칙을 어기면 빌드 에러로 드러납니다.

저장소는 [github.com/TeddKo/TeddReader](https://github.com/TeddKo/TeddReader)에 있습니다. README 는 영어와 한국어 두 버전이 있습니다.

## 참고 자료

- [Kotlin Multiplatform: expect/actual](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html)
- [Compose Multiplatform](https://kotlinlang.org/docs/multiplatform/compose-multiplatform.html)
- [Navigation 3 in Compose Multiplatform](https://kotlinlang.org/docs/multiplatform/compose-navigation-3.html)
- [Navigation 3 (Android)](https://developer.android.com/guide/navigation/navigation-3)
- [Testing Compose Multiplatform UI](https://kotlinlang.org/docs/multiplatform/compose-test.html)
- [Compose compiler options](https://kotlinlang.org/docs/compose-compiler-options.html)
- [Compose stability configuration file](https://developer.android.com/develop/ui/compose/performance/stability/fix#configuration-file)
- [Koin compiler plugin](https://insert-koin.io/docs/intro/koin-compiler-plugin)
- [Koin compile-time safety](https://insert-koin.io/docs/reference/koin-compiler/compile-safety)
- [Baseline Profiles](https://developer.android.com/topic/performance/baselineprofiles/overview)
- [Jetpack WindowManager (FoldingFeature)](https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware)
