---
title: "Kotlin Flow 정리: cold 와 hot, 연산자, StateFlow 와 SharedFlow, Android 에서의 수집"
description: "cold Flow 의 실행 시점과 빌더, 중간·종단 연산자, 컨텍스트 보존과 flowOn, buffer·conflate·collectLatest, catch·onCompletion, hot 인 StateFlow·SharedFlow 와 stateIn·shareIn, repeatOnLifecycle 과 collectAsStateWithLifecycle 을 실행 결과와 애니메이션으로 확인합니다."
pubDatetime: 2025-05-20T21:40:00+09:00
category: kotlin
tags:
  - Kotlin
  - Coroutines
  - Flow
  - StateFlow
  - Android
---

`suspend` 함수는 값을 하나 돌려주고 끝납니다. 값이 시간에 따라 여러 번 나오는 경우(센서, 검색어 입력, 데이터베이스 변경)는 `Flow` 가 맡습니다. Flow 는 만든 시점에 아무것도 실행하지 않는 cold 타입이고 같은 인터페이스 위에 구독자와 상관없이 값을 들고 있는 hot 타입(`StateFlow`, `SharedFlow`)이 따로 있습니다.

## cold Flow 는 collect 할 때 실행됩니다

`flow { }` 안의 코드는 수집자가 `collect` 를 호출하는 순간 실행되고 수집자마다 처음부터 다시 실행됩니다.

```kotlin
fun numbers(): Flow<Int> = flow {
    println("  producer start")
    for (i in 1..3) { delay(10); emit(i) }
}

val f = numbers()
println("collect 1"); f.collect { print("  $it") }; println()
println("collect 2"); f.collect { print("  $it") }; println()
```

출력은 `collect 1`, `producer start`, `1 2 3`, `collect 2`, `producer start`, `1 2 3` 순서입니다. `numbers()` 를 호출해 `f` 를 얻는 시점에는 `producer start` 가 나오지 않고 두 번의 `collect` 에서 한 번씩 나옵니다. 구독자가 없으면 아무 일도 하지 않으므로 낭비가 없고 구독자마다 별개의 실행이 생기므로 값을 공유하지 않습니다.

![cold Flow 는 collector 마다 flow 블록이 따로 실행되고 hot Flow 인 StateFlow 와 SharedFlow 는 하나의 흐름을 여러 collector 가 공유하는 그림](@/assets/images/kotlin-flow-cold-hot.png)

## 만드는 방법

가장 기본은 `flow { }` 빌더이고 안에서 `emit()` 으로 값을 내보냅니다. 값이 정해져 있으면 `flowOf(1, 2, 3)`, 컬렉션이나 시퀀스는 `asFlow()` 로 바꿉니다.

```kotlin
val a = flow { emit(1); emit(2) }
val b = flowOf(1, 2, 3)
val c = listOf(1, 2).asFlow()
```

콜백 기반 API 를 Flow 로 감쌀 때는 `callbackFlow`, 여러 코루틴에서 값을 내보내야 할 때는 `channelFlow` 를 씁니다.

## 연산자는 중간과 종단으로 나뉩니다

`map`, `filter`, `onEach`, `take` 같은 중간 연산자는 새 Flow 를 돌려줄 뿐 실행하지 않습니다. `collect`, `toList`, `first`, `fold` 같은 종단 연산자가 호출될 때 비로소 상류의 `flow { }` 가 돌기 시작합니다.

```kotlin
val result = flowOf(1, 2, 3, 4, 5, 6)
    .filter { it % 2 == 0 }
    .map { it * 10 }
    .toList()
println(result)  // [20, 40, 60]
```

원소는 하나씩 파이프라인 전체를 통과합니다. 1 이 `filter` 에서 걸러진 뒤에야 2 가 방출되고 2 가 `map` 까지 지나 수집자에게 도착한 다음 3 이 나옵니다. 아래 애니메이션에서 걸러진 값은 점선 테두리의 흐린 원으로, 통과한 값은 다음 줄에서 10 배가 되어 나타납니다.

![flowOf(1..6) 에서 filter 로 짝수만 통과시키고 map 으로 10 배를 한 뒤 collect 결과 20, 40, 60 이 쌓이는 과정을 마블 다이어그램으로 보여 주는 애니메이션](@/assets/images/kotlin-flow-operators.gif)

## 컨텍스트 보존과 flowOn

Flow 는 수집자가 `collect` 를 호출한 코루틴 컨텍스트에서 실행됩니다. `flow { }` 안에서 `withContext` 로 다른 컨텍스트로 옮긴 채 `emit` 하면 규칙 위반으로 예외가 납니다.

```kotlin
flow { withContext(Dispatchers.Default) { emit(1) } }.collect { }
// IllegalStateException: Flow invariant is violated: Flow was collected in [...]
```

상류 작업만 다른 스레드로 보내려면 `flowOn` 을 씁니다. `flowOn` 은 자기보다 위쪽 연산자의 컨텍스트만 바꾸고 수집자 쪽 컨텍스트는 그대로 둡니다.

```kotlin
flow { println("upstream on " + Thread.currentThread().name); emit(1) }
    .flowOn(Dispatchers.Default)
    .collect { println("downstream on " + Thread.currentThread().name) }
// upstream on DefaultDispatcher-worker-1
// downstream on main
```

디스패처가 바뀌면 상류와 하류가 서로 다른 코루틴에서 실행되고 둘 사이에 버퍼가 놓입니다.

## 수집자가 느릴 때

상류가 100ms 마다 값을 내고 수집자가 한 값을 처리하는 데 300ms 가 걸리는 경우를 보겠습니다. 기본 동작은 방출과 수집이 번갈아 실행되므로 상류가 수집자를 기다립니다.

```kotlin
fun slow() = flow { for (i in 1..3) { delay(100); emit(i) } }

slow().collect { delay(300) }                 // 약 1200ms
slow().buffer().collect { delay(300) }        // 약 1000ms
```

`buffer()` 는 방출과 수집을 별개 코루틴으로 나눠 상류가 기다리지 않게 합니다. 100ms 만에 첫 값이 나오고 이후 수집 3 회가 300ms 씩 이어지므로 합계가 1000ms 입니다. 모든 값을 처리하되 시간을 겹치는 선택입니다.

중간 값을 버려도 되는 경우에는 `conflate()` 와 `collectLatest` 가 있습니다.

```kotlin
slow().conflate().collect { delay(300); println(it) }   // 1, 3
slow().collectLatest { delay(300); println(it) }        // 3
```

`conflate()` 는 수집자가 바쁜 동안 쌓인 값 중 최신 값만 남깁니다. 1 을 처리하는 300ms 동안 2 와 3 이 방출되고 수집자는 이 중 3 을 받습니다. `collectLatest` 는 새 값이 오면 진행 중이던 처리를 취소하고 새 값으로 다시 시작하므로 마지막 값만 끝까지 처리됩니다. 검색어 입력처럼 최신 값만 의미 있는 곳에 맞습니다.

## 예외는 catch 와 onCompletion 이 다룹니다

`catch` 는 자기보다 상류에서 발생한 예외만 잡습니다. 수집 블록에서 던진 예외는 `catch` 를 지나 그대로 호출자에게 전달됩니다.

```kotlin
flow { emit(1); throw RuntimeException("up") }
    .catch { println("caught " + it.message); emit(0) }
    .onCompletion { println("completion cause=$it") }
    .collect { println("got $it") }
// got 1, caught up, got 0, completion cause=null

try {
    flowOf(1).catch { println("not reached") }.collect { throw IllegalArgumentException("down") }
} catch (e: IllegalArgumentException) { println("escapes catch: " + e.message) }
```

`onCompletion` 은 정상 종료와 예외 종료 양쪽에서 호출되고 예외로 끝났으면 `cause` 에 그 예외가 들어옵니다. 위 예제에서는 `catch` 가 예외를 처리했으므로 `cause` 가 `null` 입니다. `flow { }` 안에서 `emit` 을 `try/catch` 로 감싸 하류에서 온 예외를 잡아 버리면 안 된다는 규칙(예외 투명성)도 있어서 예외 처리는 `catch` 연산자에 맡기는 편이 안전합니다.

## StateFlow 는 최신 값 하나를 들고 있습니다

`MutableStateFlow` 는 초기값이 필수이고 `value` 로 현재 값을 읽고 씁니다. 같은 값을 다시 대입해도 방출되지 않고(`equals` 로 비교), 수집자가 느리면 중간 값을 건너뛰고 최신 값을 받습니다. 새 수집자는 구독하는 즉시 현재 값을 받습니다.

```kotlin
val sf = MutableStateFlow(0)
val seen = mutableListOf<Int>()
val job = launch(start = CoroutineStart.UNDISPATCHED) { sf.collect { seen += it; delay(100) } }
sf.value = 1; sf.value = 2; sf.value = 3; sf.value = 3
delay(500)
println(seen)  // [0, 3]
```

수집자가 0 을 받고 `delay(100)` 에 들어가 있는 동안 1, 2, 3 이 차례로 대입되어 값이 덮이고 수집자가 돌아왔을 때 읽는 것은 3 입니다. 마지막 `3` 은 현재 값과 같아서 무시됩니다. `StateFlow` 는 현재 상태를 담는 타입이어서 모든 방출을 수집자에게 보장하지 않습니다.

아래 애니메이션은 수집자가 1 을 받은 뒤 바빠지는 경우를 그린 것으로, 위 코드와 시점만 다르고 원리는 같습니다.

![StateFlow 에 1, 2, 3, 3, 4 를 차례로 대입하는 동안 느린 collector 가 1 을 처리하는 사이 덮인 2 를 건너뛰고 0, 1, 3, 4 를 받으며 같은 값 3 의 재대입은 무시되는 애니메이션](@/assets/images/kotlin-flow-stateflow-conflation.gif)

`StateFlow` 의 `collect` 는 끝나지 않습니다. 같은 코루틴에서 `StateFlow` 를 두 번 이어서 `collect` 하면 두 번째 호출에 도달하지 못하므로, 수집마다 별도 `launch` 가 필요합니다. 값을 읽고 바꾸는 `update { }` 와 `updateAndGet { }` 은 경쟁 상태에서 안전합니다.

## SharedFlow 는 이벤트를 나눠 줍니다

`MutableSharedFlow` 는 구독자에게 방출된 값을 전달하고 생성할 때 얼마나 기억할지 정합니다. `replay` 는 새 구독자에게 다시 보내 줄 최근 값의 개수이고 기본은 0 입니다.

```kotlin
val sh = MutableSharedFlow<Int>(replay = 2)
sh.emit(1); sh.emit(2); sh.emit(3)
println(sh.replayCache)       // [2, 3]
println(sh.take(2).toList())  // [2, 3]  (늦게 구독해도 replay 만큼 받음)
```

`replay = 0` 인 `SharedFlow` 에서는 구독자가 없을 때 `emit` 한 값이 곧바로 사라집니다. `emit` 이 중단되지도 않고 그대로 반환됩니다. 버퍼가 가득 찼을 때의 동작은 `onBufferOverflow` 로 정하며 기본은 `SUSPEND`(구독자를 기다림), `DROP_OLDEST` 와 `DROP_LATEST` 로 바꿀 수 있습니다(이 경우 `replay` 나 `extraBufferCapacity` 가 1 이상이어야 합니다). `StateFlow` 는 사실상 `replay = 1`, 버퍼가 차면 `DROP_OLDEST`, 같은 값은 건너뛰는 `SharedFlow` 입니다. 한 번만 소비해야 하는 화면 이동 같은 이벤트는 구독자가 없는 동안 값이 사라지거나 재구독 때 다시 전달되는 두 위험이 모두 있어서 상태로 모델링하는 방식이 권장됩니다.

## stateIn 과 shareIn 은 cold 를 hot 으로 바꿉니다

데이터베이스 쿼리처럼 cold Flow 인 상류를 여러 수집자가 공유하게 하려면 `stateIn` 이나 `shareIn` 으로 hot Flow 로 바꿉니다. 두 번째 인자인 `SharingStarted` 가 상류를 언제 시작하고 멈출지 정합니다. `Eagerly` 는 즉시 시작해 멈추지 않고 `Lazily` 는 첫 구독자가 생길 때 시작해 멈추지 않습니다. `WhileSubscribed(stopTimeoutMillis)` 는 구독자가 있는 동안만 상류를 돌리고 마지막 구독자가 떠난 뒤 지정한 시간이 지나면 상류를 멈춥니다.

```kotlin
var started = 0
val up = flow { started++; emit(started); awaitCancellation() }
val st = up.stateIn(scope, SharingStarted.WhileSubscribed(200), -1)
```

이 `st` 를 확인하면 구독자가 없는 동안에는 `started` 가 0, `value` 가 초기값 -1 입니다. 구독하면 상류가 시작되어 `started` 가 1 이 됩니다. 구독자가 떠났다가 200ms 안에 돌아오면 상류가 그대로여서 `started` 는 1 에 머뭅니다. 200ms 를 넘겨 돌아오면 상류가 다시 시작되어 `started` 가 2 가 됩니다. `value` 는 상류가 멈춘 뒤에도 `replayExpirationMillis` 기본값(`Long.MAX_VALUE`) 때문에 1 로 남아 있다가, 상류가 다시 시작되어 2 를 내보내면 그때 바뀝니다.

## Android 에서는 생명주기에 맞춰 수집합니다

Activity 나 Fragment 에서 `lifecycleScope.launch { flow.collect { } }` 로 수집하면 화면이 백그라운드로 가도 수집이 계속됩니다. `repeatOnLifecycle` 은 지정한 상태 이상일 때만 블록을 실행하고 그 아래로 내려가면 취소하며 다시 올라오면 새로 시작합니다.

```kotlin
viewLifecycleOwner.lifecycleScope.launch {
    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { render(it) }
    }
}
```

`StateFlow` 수집이 끝나지 않으므로 여러 개를 수집하려면 `repeatOnLifecycle` 안에서 `launch` 를 나눠야 합니다. Compose 에서는 `collectAsStateWithLifecycle()` 이 같은 일을 하며 `lifecycle-runtime-compose` 라이브러리에 들어 있습니다.

```kotlin
val uiState by viewModel.uiState.collectAsStateWithLifecycle()
```

ViewModel 쪽에서는 보통 `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)` 로 노출합니다. 5초의 유예는 화면 회전처럼 수집자가 잠깐 사라졌다 돌아오는 구성 변경에서 상류를 다시 시작하지 않으려는 값이고 Android 문서가 쓰는 관례적인 숫자입니다.

## 참고 자료

- Asynchronous Flow — https://kotlinlang.org/docs/coroutines-flow.html
- kotlinx.coroutines.flow API — https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/
- StateFlow API — https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/
- MutableSharedFlow API — https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-mutable-shared-flow.html
- SharingStarted.WhileSubscribed API — https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/-companion/-while-subscribed.html
- StateFlow and SharedFlow (Android) — https://developer.android.com/kotlin/flow/stateflow-and-sharedflow
- Use Kotlin coroutines with lifecycle-aware components — https://developer.android.com/topic/libraries/architecture/coroutines
- State and Jetpack Compose — https://developer.android.com/develop/ui/compose/state
- UI events — https://developer.android.com/topic/architecture/ui-layer/events
