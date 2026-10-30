---
title: "AAC ViewModel, MVVM 의 ViewModel, Compose retain 은 서로 다른 것입니다"
description: "MVVM 패턴의 ViewModel 역할과 androidx.lifecycle.ViewModel 은 이름만 같고 책임이 다릅니다. ViewModelStore 가 구성 변경을 넘기는 방식을 소스로 확인하고, Compose 1.10 의 retain 과 remember, rememberSaveable 의 수명을 비교했습니다."
pubDatetime: 2026-10-21T21:30:00+09:00
category: android
tags:
  - ViewModel
  - MVVM
  - Compose
  - Android
---

Android 에서 "ViewModel" 이라는 단어는 적어도 두 가지를 가리킵니다. 하나는 MVVM 패턴에서 View 와 Model 사이에 놓이는 **역할**이고, 다른 하나는 `androidx.lifecycle.ViewModel` 이라는 **클래스**입니다. 둘은 겹치는 경우가 많지만 같은 개념이 아닙니다. 여기에 Compose 1.10 에서 정식으로 들어온 `retain` 이 더해지면서 "구성 변경을 넘기려면 ViewModel 인가, retain 인가"라는 질문도 생겼습니다. 공식 문서와 androidx 소스를 기준으로 세 가지를 구분해 보겠습니다.

## MVVM 의 ViewModel 은 패턴 속 역할입니다

MVVM 은 John Gossman 이 2005년 10월 8일 블로그에 올린 [Introduction to Model/View/ViewModel pattern for building WPF apps](https://learn.microsoft.com/en-us/archive/blogs/johngossman/introduction-to-modelviewviewmodel-pattern-for-building-wpf-apps) 에서 소개됐습니다. 글은 이 패턴을 MVC 의 변형으로 설명합니다. View 를 디자이너가 XAML 같은 선언형 언어로 만드는 환경에 맞춰 다듬은 것이고, 데이터 바인딩이라는 범용 메커니즘에 기대는 패턴이라고 적혀 있습니다.

ViewModel 의 역할도 같은 글에 나옵니다. Model 의 타입은 컨트롤에 바로 연결하기 어렵고, 뷰에 두기에는 애매한 동작이 있으며, 선택 상태나 모드 같은 뷰 상태를 둘 곳이 필요합니다. 이 일을 맡는 것이 ViewModel 입니다. 글의 표현으로 "Model of a View" 를 뜻하고, Model 타입을 View 타입으로 바꾸는 데이터 변환기와 View 가 호출할 Command 를 가집니다.

Microsoft Learn 의 [Model-View-ViewModel](https://learn.microsoft.com/en-us/dotnet/architecture/maui/mvvm) 문서도 같은 구도입니다. view model 은 View 가 바인딩할 속성과 command 를 구현하고, 상태 변경은 `INotifyPropertyChanged` 같은 변경 알림 이벤트로 뷰에 알립니다. View 는 view model 을 알지만 view model 은 View 를 모릅니다.

두 자료 어디에도 ViewModel 이 **언제까지 살아 있어야 하는지**는 나오지 않습니다. 화면 회전이나 프로세스 종료 같은 개념은 패턴의 관심사가 아닙니다. 패턴이 정의하는 것은 책임과 의존 방향입니다.

## AAC ViewModel 은 수명이 정해진 상태 보관소입니다

`androidx.lifecycle.ViewModel` 은 수명이 정해진 상태 보관용 클래스입니다. 공식 [ViewModel 개요](https://developer.android.com/topic/libraries/architecture/viewmodel)는 이를 "business logic or screen level state holder" 로 소개하고, 문서가 꼽는 주된 장점이 상태를 캐시해 구성 변경을 넘겨 유지하는 것이라고 설명합니다. 화면 회전처럼 Activity 가 구성 변경을 겪어도 ViewModel 안의 비동기 작업은 계속된다고 합니다.

### ViewModelStore 와 구성 변경

ViewModel 은 `ViewModelStoreOwner` 가 가진 `ViewModelStore` 에 담깁니다. `ViewModelStore` 는 키로 ViewModel 을 찾는 맵이고, `clear()` 를 부르면 담긴 모든 ViewModel 의 `clear()` 가 호출됩니다. 구성 변경을 넘기는 부분은 `ComponentActivity` 가 맡습니다([ComponentActivity.kt](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/activity/activity/src/main/java/androidx/activity/ComponentActivity.kt), [ViewModelStore.kt](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/lifecycle/lifecycle-viewmodel/src/commonMain/kotlin/androidx/lifecycle/ViewModelStore.kt)).

![구성 변경 전 Activity 가 onRetainNonConfigurationInstance 로 ViewModelStore 를 NonConfigurationInstances 에 담아 두면 새 Activity 인스턴스가 lastNonConfigurationInstance 로 같은 ViewModelStore 를 되찾고, ON_DESTROY 이면서 구성 변경이 아닐 때만 clear 와 onCleared 가 호출되는 흐름](@/assets/images/aac-viewmodel-mvvm-retain-store.png)

소스에서 확인되는 흐름은 다음과 같습니다.

- `onRetainNonConfigurationInstance()` 에서 현재 `ViewModelStore` 를 `NonConfigurationInstances` 객체에 담아 반환합니다. 이 객체는 Activity 인스턴스가 아니라 Android 프레임워크가 구성 변경을 넘겨 들고 있습니다.
- 새 Activity 인스턴스는 `ViewModelStore` 가 필요해지는 시점에 `lastNonConfigurationInstance` 에서 이전 `ViewModelStore` 를 꺼냅니다. `viewModelStore` 를 처음 읽을 때, 또는 첫 라이프사이클 이벤트를 받을 때입니다. 꺼낼 것이 없을 때만 새로 만듭니다.
- 라이프사이클 옵저버가 `ON_DESTROY` 를 받았을 때 `isChangingConfigurations` 가 `false` 이면 `viewModelStore.clear()` 를 호출합니다. 구성 변경으로 인한 destroy 에서는 비우지 않습니다.

그래서 ViewModel 의 수명은 문서의 표현대로 `ViewModelStoreOwner` 가 사라질 때까지입니다. Activity 라면 종료되어 destroy 될 때, Navigation 의 `NavBackStackEntry` 라면 백 스택에서 빠질 때, Compose 에서 스코프를 따로 잡았다면 컴포저블이 컴포지션을 떠날 때입니다. 정리 시점에 `onCleared()` 가 호출됩니다.

### 코루틴과 SavedStateHandle

`viewModelScope` 는 ViewModel 수명을 따르는 내장 `CoroutineScope` 입니다. lifecycle 2.8.0 부터는 생성자 매개변수로 받을 수 있게 되어 테스트에서 `backgroundScope` 를 주입할 수 있습니다([lifecycle 릴리즈 노트](https://developer.android.com/jetpack/androidx/releases/lifecycle)).

```kotlin
class MyViewModel(
    viewModelScope: CoroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
) : ViewModel(viewModelScope)
```

릴리즈 노트 예시는 `Dispatchers.Main + SupervisorJob()` 을 그대로 기본값으로 쓰지만, 이 식의 타입은 `CoroutineContext` 이고 생성자가 받는 타입은 `CoroutineScope` 입니다. `CoroutineScope(...)` 로 감싸야 컴파일됩니다.

구성 변경과 프로세스 종료는 다른 문제입니다. 프로세스가 죽으면 `ViewModelStore` 도 함께 사라집니다. 공식 문서는 `SavedStateHandle` 이 구성 변경뿐 아니라 프로세스 종료를 넘어 데이터를 유지하게 해 준다고 설명합니다. ViewModel 자체가 아니라 `SavedStateHandle` 이 그 역할을 맡습니다.

### 생성과 KMP

ViewModel 은 `ViewModelProvider` 와 `ViewModelProvider.Factory` 로 만들고, Compose 에서는 `viewModel()` 을 씁니다. Navigation3 에서는 lifecycle 2.10.0 의 `lifecycle-viewmodel-navigation3` 아티팩트가 `rememberViewModelStoreNavEntryDecorator()` 로 엔트리 단위 스코프를 제공합니다. lifecycle 2.8.0(2024년 5월 14일)부터 `lifecycle-viewmodel` 은 `ViewModel`, `ViewModelStore`, `ViewModelStoreOwner`, `ViewModelProvider` 를 포함해 Kotlin Multiplatform 호환 아티팩트로 배포됩니다. 2.8.0 당시 대상은 Android 와 JVM, iOS 였고, 2.9.2 에서 Linux, macOS, watchOS, MinGW, JS, WasmJS 타깃이 추가됐습니다. 비 JVM 플랫폼에서는 팩토리 없이 `ViewModelProvider` 를 쓰면 `UnsupportedOperationException` 이 납니다.

공식 문서의 주의점도 하나 있습니다. ViewModel 은 `ViewModelStoreOwner` 보다 오래 살 수 있으므로 `Context` 나 `Resources` 같은 라이프사이클 관련 객체를 참조하지 않아야 합니다.

## 둘은 서로를 요구하지 않습니다

이름이 같아서 "ViewModel 클래스를 쓰면 MVVM" 이라고 생각하기 쉽지만, 공식 문서 어디에도 그런 말은 없습니다. [State holders and UI State](https://developer.android.com/topic/architecture/ui-layer/stateholders) 문서는 상태 홀더를 개념으로 두고 `ViewModel` 을 그 구현 수단으로 소개합니다. 비즈니스 로직 상태 홀더는 "typically implemented with a `ViewModel`" 이고, ViewModel 의 이점이 필요 없다면 일반 클래스로 옮겨도 된다고 합니다. 같은 문서가 상태 홀더를 `ViewModel` 이나 일반 클래스로 구현할 수 있다고 적습니다. 상태 홀더 자체는 필수도 아니어서 단순한 UI 는 로직을 인라인으로 둘 수 있다고 합니다.

따라서 조합은 네 가지가 모두 가능합니다.

|               | AAC `ViewModel` 클래스                               | 일반 클래스                                                       |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **MVVM 역할** | 흔한 구성. `StateFlow` 같은 상태를 View 가 구독      | 같은 역할을 수명 관리 없이, 또는 `retain` 같은 다른 수단으로 유지 |
| **MVVM 아님** | 이벤트를 받아 상태를 내려보내는 UDF 상태 홀더로 사용 | 단순 UI 상태 홀더나 인라인 로직                                   |

공식 문서는 UDF 를 상태 홀더가 관리하는 구조로 설명합니다. 상태는 아래로 내려가고 이벤트는 위로 올라가는 이 구조에서 가이드는 `ViewModel` 클래스를 이벤트를 받아 상태를 내려보내는 UDF 상태 홀더로 설명합니다. `StateFlow` 구독을 Gossman 식 데이터 바인딩과 같은 MVVM 으로 볼지는 해석의 문제이고, 같은 클래스가 두 모습 모두를 담을 수 있다는 점만 확인됩니다.

## Compose 의 retain 은 수명을 컴포지션에 묶습니다

`retain` 은 Compose Runtime 1.10.0-alpha01(2025년 8월 13일)에서 처음 소개됐고, 1.10.0 정식 릴리즈는 2025년 12월 3일입니다([Compose Runtime 릴리즈 노트](https://developer.android.com/jetpack/androidx/releases/compose-runtime)). 릴리즈 노트의 설명은 이렇습니다. `rememberSaveable` 처럼 값을 유지하지만 retain 된 값은 직렬화되지 않고, 저장된 값보다 수명이 짧으며, androidx `ViewModel` 과 비슷하게 동작합니다.

공식 [State lifespans](https://developer.android.com/develop/ui/compose/state-lifespans) 문서는 `retain` 을 `remember` 와 `rememberSaveable` 사이에 둡니다. retain 된 값은 컴포지션 위치에 따라 기억되면서 앱 수명에 묶인 별도 자료구조에도 저장됩니다. 구성 변경은 직렬화 없이 넘기지만 프로세스 종료는 넘기지 못합니다. 컴포지션 계층이 다시 만들어진 뒤에도 쓰이지 않으면 값은 retired 됩니다. `remember` 의 forgotten 에 해당하는 상태입니다.

```kotlin
@Composable
fun MediaPlayer() {
    val applicationContext = LocalContext.current.applicationContext
    val exoPlayer = retain {
        ExoPlayer.Builder(applicationContext).build()
    }
}
```

문서 예시는 생성 부분만 보여 줍니다. retain 된 값이 retired 될 때 정리하려면 `RetainedEffect` 를 함께 씁니다.

```kotlin
RetainedEffect(exoPlayer) {
    onRetire { exoPlayer.release() }
}
```

직렬화하지 않으므로 람다, Flow, 비트맵 같은 큰 객체도 담을 수 있습니다. 문서의 예시는 ExoPlayer 를 retain 해 구성 변경 중 재생이 끊기지 않게 하는 경우입니다. 대신 `Activity`, `View`, `Fragment`, `ViewModel`, `Context`, `Lifecycle` 와 이를 참조하는 객체는 retain 하면 안 되고, 문서는 "ViewModel 에 저장하지 않을 객체는 retain 하지도 말라" 고 요약합니다. 이런 용도로 쓰면 안 되는 타입에는 `@DoNotRetain` 을 붙일 수 있습니다(1.10.0-alpha02 추가). `retain` 의 키도 값과 같은 기간 참조된다는 점이 1.10.0-alpha03 에 명시됐습니다.

API 이름은 개발 과정에서 여러 번 바뀌었습니다. 1.10.0-beta01 에서 `RetainScope` 가 `RetainedValuesStore` 로, 1.10.0-beta02 에서 `RetainedValuesStore` 가 인터페이스가 되고 `LocalRetainedValuesStoreProvider` 로 설치하도록 바뀌었습니다. 일반적인 `retain` 과 `RetainedEffect` 호출은 영향을 받지 않았다고 릴리즈 노트에 적혀 있습니다. `RetainedEffect` 는 `DisposableEffect` 와 비슷하지만 컴포지션이 아니라 retain 수명을 따르는 사이드 이펙트입니다(1.10.0-alpha04). 아티팩트는 `androidx.compose.runtime:runtime-retain` 이고 패키지는 `androidx.compose.runtime.retain` 입니다. 이 아티팩트는 1.10.0-alpha04 부터 배포됐고, alpha01~03 에서는 `retain` 이 `runtime` 아티팩트의 `androidx.compose.runtime` 패키지에 있었습니다. `@DoNotRetain` 은 `runtime-annotation` 의 `androidx.compose.runtime.annotation` 패키지에 있습니다. 구성 변경을 넘기는 지원은 `androidx.compose.ui:ui:1.10.0` 에서 제공됩니다. `LocalRetainedValuesStore` 의 기본값은 `ForgetfulRetainedValuesStore` 로 `remember` 처럼 동작하고, Android 에서는 컴포지션 루트에 라이프사이클을 인식하는 store 가 설치되어 구성 변경을 넘깁니다. `LocalRetainedValuesStoreProvider` 로 별도 store 를 설치하면, provider 가 컴포지션에서 빠질 때 그 store 가 빠져나간 값을 계속 보관하기 시작합니다. 접히는 패널이나 내비게이션 호스트처럼 콘텐츠가 잠시 사라지는 경우를 위한 장치입니다. 같은 문서는 `androidx.navigation` 과 `androidx.navigation3` 지원이 이후 릴리즈에서 제공될 예정이라고 적고 있습니다.

## 수명을 나란히 놓으면

![remember 는 재컴포지션을, retain 과 ViewModel 은 구성 변경을, rememberSaveable 은 프로세스 종료를 넘어 값이 유지되는 범위를 비교한 도표. 컴포지션을 떠날 때 retain 은 retired 되고 ViewModel 은 owner 가 살아 있으면 유지되며, 프로세스 종료 시 ViewModel 인스턴스는 사라지고 SavedStateHandle 값만 복원된다](@/assets/images/aac-viewmodel-mvvm-retain-lifespan.png)

|                                 | `remember`                           | `retain`                                                         | `rememberSaveable`                                    | AAC `ViewModel`                                                             |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| 재컴포지션                      | 유지                                 | 유지                                                             | 유지                                                  | 컴포지션과 무관                                                             |
| 구성 변경                       | 소실                                 | 유지                                                             | 유지                                                  | 유지                                                                        |
| 프로세스 종료                   | 소실                                 | 소실                                                             | 유지                                                  | 인스턴스 소실. `SavedStateHandle` 에 넣은 값만 새 인스턴스로 복원           |
| 내비게이션 pop                  | 컴포지션을 떠나면 소실               | 컴포지션을 영구히 떠나면 retired (Navigation 지원은 문서상 예정) | 엔트리 pop 시 SaveableStateHolder 가 상태를 지워 소실 | `NavBackStackEntry`(Nav2) 또는 Nav3 엔트리 데코레이터 스코프면 pop 시 clear |
| 다른 화면으로 이동(백스택 잔류) | 컴포지션을 떠나므로 소실             | 컴포지션을 떠나 retired (내비게이션용 store 미지원)              | SaveableStateHolder 가 보관                           | 엔트리 스코프면 유지                                                        |
| 인스턴스                        | 같은 인스턴스                        | 같은 인스턴스(`===`)                                             | 복원된 동등 객체(`==`)                                | 같은 인스턴스                                                               |
| 수명 소유자                     | Composition                          | `RetainedValuesStore`                                            | 저장된 인스턴스 상태                                  | `ViewModelStore`                                                            |
| 코루틴                          | 직접 구성 (`rememberCoroutineScope`) | 없음. `RetainObserver` 로 직접 관리                              | 없음                                                  | `viewModelScope` 내장                                                       |
| 공유                            | 위치마다 별도                        | 위치마다 별도 인스턴스                                           | 위치마다 별도                                         | `ViewModelStore` 안에서 싱글턴                                              |
| 테스트                          | 컴포저블 테스트 필요                 | 컴포저블 테스트 필요                                             | 컴포저블 테스트 필요                                  | 일반 JUnit 에서 생성 가능 (코루틴은 `viewModelScope` 주입)                  |

"컴포지션과 무관", "일반 JUnit", 백스택 잔류 행처럼 공식 문서에 한 줄로 적히지 않은 칸은 ViewModel 이 Compose 를 모르는 일반 클래스라는 구조에서 따라 나오는 설명입니다. 문서가 직접 말하는 비교는 `retain` 과 `ViewModel` 열입니다. `ViewModel` 은 `ViewModelStore` 안에서 싱글턴이고 `ViewModelStore` 가 clear 되거나 destroy 될 때까지 살아 있습니다. `retain` 값은 각 컴포지션 위치에 묶이므로 같은 타입을 다른 위치에서 retain 하면 새 인스턴스가 만들어집니다. `ViewModel` 에는 Hilt 주입, `SavedStateHandle`, 내장 코루틴이 있습니다.

## 무엇을 언제 쓰나

State lifespans 문서가 안내하는 기준을 정리하면 다음과 같습니다.

- **`remember`**: 스크롤이나 애니메이션 같은 내부 상태, 비싼 객체 재생성 방지. 사용자 입력은 구성 변경에서 사라지므로 맡기면 안 됩니다.
- **`rememberSaveable` / `rememberSerializable`**: 텍스트 입력, 스크롤 위치, 토글처럼 앱이 다른 곳에서 복구할 수 없는 사용자 상태. `Bundle` 로 직렬화할 수 있어야 합니다.
- **`retain`**: 특정 컴포저블 인스턴스에 속하고 형제 컴포저블과 공유하지 않는 객체. 캐시, 노출 추적, `AndroidView` 의존 객체, 서드파티 라이브러리 관리자 같은 UI 배관용 객체가 예시로 나옵니다.
- **`ViewModel`**: UI 와 데이터 레이어의 상호작용을 분리하고, `Flow` 를 `State` 로 바꾸고, 구성 변경에 끊기면 안 되는 suspend 호출을 돌리고, 화면 전체 같은 넓은 영역의 상태를 공유할 때. 프로세스 종료까지 살려야 하는 핵심 UI 상태도 여기에 둡니다.

문서는 `retain` 과 `rememberSaveable` 의 수명이 모두 필요한 객체라면 `ViewModel` 이어야 한다는 신호일 수 있다고 덧붙입니다. 또 `remember` 로 만든 객체를 다시 `retain` 하는 것은 안티패턴이라고 경고하고, Android 가이드의 앱 아키텍처 권장 범위를 벗어난 사용자 정의 구조에서는 `retain` 을 "ViewModel 비슷한" 컴포넌트의 기반으로 쓸 수 있다고 말합니다.

## 참고 자료

- [Introduction to Model/View/ViewModel pattern for building WPF apps (John Gossman, 2005-10-08, Microsoft Learn archive)](https://learn.microsoft.com/en-us/archive/blogs/johngossman/introduction-to-modelviewviewmodel-pattern-for-building-wpf-apps)
- [Model-View-ViewModel (.NET MAUI, Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/architecture/maui/mvvm)
- [ViewModel overview (Android Developers)](https://developer.android.com/topic/libraries/architecture/viewmodel)
- [State holders and UI State (Android Developers)](https://developer.android.com/topic/architecture/ui-layer/stateholders)
- [State lifespans in Compose (Android Developers)](https://developer.android.com/develop/ui/compose/state-lifespans)
- [Lifecycle release notes (Android Developers)](https://developer.android.com/jetpack/androidx/releases/lifecycle)
- [Compose Runtime release notes (Android Developers)](https://developer.android.com/jetpack/androidx/releases/compose-runtime)
- [androidx ComponentActivity.kt (AOSP)](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/activity/activity/src/main/java/androidx/activity/ComponentActivity.kt)
- [androidx ViewModelStore.kt (AOSP)](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/lifecycle/lifecycle-viewmodel/src/commonMain/kotlin/androidx/lifecycle/ViewModelStore.kt)
- [Navigation 3 release notes (Android Developers)](https://developer.android.com/jetpack/androidx/releases/navigation3)
- [androidx ViewModel.kt (AOSP)](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/lifecycle/lifecycle-viewmodel/src/commonMain/kotlin/androidx/lifecycle/ViewModel.kt)
- [androidx LocalRetainedValuesStore.kt (AOSP)](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/runtime-retain/src/commonMain/kotlin/androidx/compose/runtime/retain/LocalRetainedValuesStore.kt)
- [androidx Retain.kt (AOSP)](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/runtime-retain/src/commonMain/kotlin/androidx/compose/runtime/retain/Retain.kt)
- [androidx RetainedEffect.kt (AOSP)](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/runtime-retain/src/commonMain/kotlin/androidx/compose/runtime/retain/RetainedEffect.kt)
- [runtime-retain artifact versions (Google Maven)](https://dl.google.com/android/maven2/androidx/compose/runtime/runtime-retain/maven-metadata.xml)
