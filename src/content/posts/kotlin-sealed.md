---
title: "Kotlin sealed class 와 sealed interface, when 이 누락을 잡아 주는 이유"
description: "sealed class 와 sealed interface 의 하위 타입 제약, when 의 완전성 검사가 동작하는 조건, enum 과의 차이, UiState 와 Outcome 모델링, data object 사용법을 컴파일 오류와 함께 확인합니다."
pubDatetime: 2023-10-24T21:50:00+09:00
category: kotlin
tags:
  - Kotlin
  - sealed class
  - when
  - 모델링
---

화면 상태가 로딩, 성공, 실패 셋뿐이라면 이 세 가지를 타입으로 적어 두고 컴파일러가 빠짐없이 다뤘는지 검사해 주면 편합니다. `sealed` 는 하위 타입의 목록을 컴파일 시점에 닫아 두는 한정자입니다.

## 하위 타입을 닫아 두는 문법

`sealed class` 와 `sealed interface` 는 직접 상속하거나 구현할 수 있는 타입을 같은 패키지, 같은 모듈 안으로 제한합니다. 파일은 달라도 되고(Kotlin 1.5 부터) 그 이전에는 같은 파일 안에 있어야 했습니다. 모듈 밖에서는 하위 타입을 추가할 수 없으므로 컴파일러는 가능한 하위 타입을 전부 알고 있습니다. `sealed interface` 도 Kotlin 1.5 에 추가되었습니다.

```kotlin
sealed interface UiState {
    data object Loading : UiState
    data class Success(val items: List<String>) : UiState
    data class Error(val message: String) : UiState
}
```

sealed class 는 그 자체로 추상 클래스여서 직접 인스턴스를 만들 수 없고 생성자는 기본이 `protected` 입니다. 익명 객체로도 상속할 수 없어서 `object : UiState {}` 는 컴파일 오류가 납니다(하위 타입은 이름이 있어야 합니다).

## when 이 모든 경우를 확인합니다

하위 타입 목록이 닫혀 있으므로 `when` 은 `else` 없이도 모든 경우를 다뤘는지 검사합니다.

```kotlin
fun render(state: UiState): String = when (state) {
    UiState.Loading -> "loading"
    is UiState.Success -> "items=${state.items.size}"
    is UiState.Error -> "error=${state.message}"
}
```

싱글톤인 `Loading` 은 `is` 없이 값으로 비교하고 데이터를 가진 클래스는 `is` 로 검사해 분기 안에서 스마트 캐스트를 받습니다. 하위 타입을 하나 늘리면 이 `when` 은 컴파일되지 않습니다.

```kotlin
data object Empty : UiState   // 추가

// 컴파일 오류: when 이 모든 경우를 다루지 않음(Empty 분기 누락)
```

![sealed interface UiState 의 하위 타입 Loading, Success, Error 가 when 분기에 하나씩 대응하고 새로 추가한 Empty 는 분기가 없어 컴파일 오류가 나는 그림](@/assets/images/kotlin-sealed-when.png)

`else` 를 달아 두면 이 검사가 사라집니다. 새 하위 타입은 `else` 로 흘러가 조용히 지나가므로, 하위 타입이 늘어날 때 처리 누락을 컴파일러가 알려 주게 하려면 sealed 대상 `when` 에는 `else` 를 쓰지 않는 편이 낫습니다.

`when` 을 문장으로 쓰는 경우에는 버전이 영향을 줍니다. 식으로 쓰면 항상 완전해야 했지만 문장으로 쓴 `when` 은 오랫동안 빠뜨려도 통과했습니다. Kotlin 1.6 에서 sealed, enum, Boolean 을 대상으로 하는 문장 `when` 이 완전하지 않으면 경고를 내기 시작했고 1.7 부터는 오류입니다.

```kotlin
fun stmt(s: UiState) {
    when (s) {
        UiState.Loading -> println("L")
        is UiState.Success -> println("S")
        is UiState.Error -> println("E")   // 하나라도 빠지면 1.7 부터 컴파일 오류
    }
}
```

## enum 과 어디가 다른가

`enum` 도 `when` 완전성 검사를 받지만 성격이 다릅니다. enum 상수는 각각 인스턴스가 하나뿐이고 모든 상수가 같은 프로퍼티 구성을 가집니다. sealed 하위 타입은 각자 다른 프로퍼티를 가질 수 있고 인스턴스도 여러 개 만들 수 있습니다. `Success` 가 목록을, `Error` 가 메시지를 들고 있는 위 예제는 enum 으로 표현할 수 없습니다. 값이 고정된 몇 개의 선택지라면 enum 이 단순하고 경우마다 담는 데이터가 다르다면 sealed 가 맞습니다.

sealed 하위 타입은 제네릭도 가질 수 있어서 결과 타입을 만들 때 자주 씁니다.

```kotlin
sealed class Outcome<out T> {
    data class Ok<T>(val value: T) : Outcome<T>()
    data class Fail(val cause: Throwable) : Outcome<Nothing>()
}

fun <T> Outcome<T>.getOrNull(): T? = when (this) {
    is Outcome.Ok -> value
    is Outcome.Fail -> null
}
```

`Outcome<out T>` 의 `out` 과 `Fail` 의 `Outcome<Nothing>` 덕분에 `Fail` 은 어떤 `Outcome<T>` 자리에도 들어갑니다. 코틀린 표준 라이브러리의 `kotlin.Result` 와 이름이 겹치지 않도록 예제는 `Outcome` 으로 지었습니다.

## data object

상태 하나가 데이터 없이 존재만 하는 경우에는 `object` 를 쓰는데 일반 `object` 는 `toString()` 이 `UiState$Loading@1b2c3d` 같은 문자열을 돌려줘서 로그에 쓰기 불편합니다. Kotlin 1.9 에서 안정화된 `data object` 는 data class 처럼 `toString()`, `equals()`, `hashCode()` 를 만들어 줍니다.

```kotlin
println(UiState.Loading)  // Loading  (data object 일 때)
```

`data object` 는 인스턴스가 하나이므로 `copy()` 와 `componentN()` 은 만들지 않습니다. sealed 계층 안의 싱글톤 상태는 `data object` 로 선언하는 쪽이 출력과 비교에서 일관됩니다.

## 쓰기 좋은 자리

화면 상태(`UiState`), 네트워크 결과(`Outcome`), 사용자 이벤트, 파서의 토큰처럼 경우의 수가 정해져 있고 경우마다 처리가 달라지는 곳에 쓰입니다. 하위 타입을 추가하면 처리하지 않은 `when` 이 컴파일 단계에서 드러납니다. 외부 모듈이 하위 타입을 추가해야 하는 확장 지점에는 맞지 않아서 일반 인터페이스를 씁니다.

## 참고 자료

- Sealed classes and interfaces — https://kotlinlang.org/docs/sealed-classes.html
- What's new in Kotlin 1.5.0 — https://kotlinlang.org/docs/whatsnew15.html
- Compatibility guide for Kotlin 1.7 — https://kotlinlang.org/docs/compatibility-guide-17.html
- What's new in Kotlin 1.9.0 — https://kotlinlang.org/docs/whatsnew19.html
- Object declarations: data objects — https://kotlinlang.org/docs/object-declarations.html#data-objects
