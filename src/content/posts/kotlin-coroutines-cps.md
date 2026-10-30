---
title: "suspend 함수는 어떻게 스레드를 막지 않고 멈출까: CPS 변환과 상태 머신"
description: "suspend 함수가 컴파일될 때 Continuation 파라미터가 추가되고 반환 타입이 Any? 로 바뀌는 CPS 변환, COROUTINE_SUSPENDED 와 label 기반 상태 머신, 재개 흐름을 디컴파일 결과와 애니메이션으로 따라가고 Dispatcher 와 구조적 동시성까지 짚습니다."
pubDatetime: 2024-08-27T22:20:00+09:00
category: kotlin
tags:
  - Kotlin
  - Coroutines
  - suspend
  - CPS
---

`suspend` 가 붙은 함수는 컴파일 과정에서 다른 모양으로 바뀝니다. 바이트코드에는 일반 함수와 클래스만 남아 있고 중단과 재개는 그 위에서 호출 규약으로 구현됩니다.

## 시그니처가 바뀝니다

`suspend fun load(id: Int): User` 를 컴파일하면 파라미터가 하나 늘고 반환 타입이 달라집니다.

![suspend fun load(id) 가 load(id, cont: Continuation<User>) 로 바뀌고 반환 타입이 Any? 가 되며 끝까지 실행되면 User 를, 중단되면 COROUTINE_SUSPENDED 를 반환하는 그림](@/assets/images/kotlin-coroutines-cps.png)

호출이 끝난 뒤에 할 일을 담은 객체를 인자로 넘기는 방식을 Continuation Passing Style, 줄여서 CPS 라고 부릅니다. 추가된 파라미터 `Continuation<User>` 가 그 객체입니다. 인터페이스는 단순해서 코루틴 컨텍스트 프로퍼티 하나와 결과를 받아 이어서 실행하는 함수 하나로 이루어집니다.

```kotlin
public interface Continuation<in T> {
    public val context: CoroutineContext
    public fun resumeWith(result: Result<T>)
}
```

반환 타입이 `Any?` 가 되는 것은 이 함수가 두 종류의 값을 돌려줄 수 있어서입니다. 중단 없이 끝나면 결과인 `User` 를 그대로 반환하고 중단해야 하면 `COROUTINE_SUSPENDED` 라는 특수한 마커를 반환합니다. 호출한 쪽은 반환값이 이 마커인지 확인해서 자기도 중단할지 정합니다. 마커가 반환되는 순간 호출 스택이 풀리면서 스레드가 다른 일을 하러 돌아갑니다.

## 상태 머신이 만들어집니다

함수 본문에 중단 지점이 여러 개이면 어디까지 실행했는지 기억해야 합니다. 컴파일러는 `Continuation` 을 구현하는 클래스를 하나 만들고 현재 위치를 `label` 이라는 정수 필드에 둡니다. 중단 지점을 넘어서도 써야 하는 지역 변수도 이 객체의 필드로 옮겨 저장합니다.

```kotlin
suspend fun load(): String {
    val a = fetchA()
    val b = fetchB(a)
    return a + b
}
```

이 함수를 컴파일한 클래스를 `javap` 로 보면 `ContinuationImpl` 을 상속한 `MainKt$load$1`(`파일명Kt$load$1`) 이라는 클래스에 `int label`, `Object result`, `Object L$0` 필드가 있습니다. `L$0` 에는 중단 전에 `a` 가 저장됩니다. 구조를 풀어 쓴 의사 코드는 아래와 같습니다. 실제 결과는 이보다 복잡하며(재진입 판별, 예외 처리, 변수 정리 등), 흐름을 보여 주려고 단순화했습니다.

```kotlin
// 단순화한 의사 코드: 실제 컴파일 결과와 세부 구현은 다릅니다
class LoadStateMachine(
    val completion: Continuation<String>,
) : ContinuationImpl(completion) {
    var label = 0
    var result: Any? = null
    var a: String? = null              // 중단 지점을 넘어 살아남는 지역 변수

    override fun invokeSuspend(r: Any?): Any? {
        result = r
        return load(this)              // 저장된 label 로 같은 함수에 다시 진입
    }
}

fun load(cont: Continuation<String>): Any? {
    val sm = cont as? LoadStateMachine ?: LoadStateMachine(cont)
    var r = sm.result
    if (sm.label == 0) {
        sm.label = 1
        r = fetchA(sm)
        if (r == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED
    }
    if (sm.label == 1) {
        val a = r as String
        sm.a = a
        sm.label = 2
        r = fetchB(a, sm)
        if (r == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED
    }
    if (sm.label == 2) {
        val b = r as String
        return sm.a + b
    }
    error("bad label")
}
```

`label` 은 중단 지점을 호출하기 전에 갱신됩니다. `fetchA(sm)` 이 바로 값을 돌려주면 `label == 1` 분기로 이어서 실행되고 마커를 돌려주면 `load` 는 마커를 그대로 반환해 끝납니다. 나중에 `fetchA` 가 끝나 `sm` 을 재개하면 `label` 이 1 이므로 첫 분기를 건너뛰고 그 결과로 두 번째 분기를 실행합니다. `fetchA` 와 `fetchB` 를 마커만 반환하는 함수로 바꾸고 `Continuation` 을 직접 구현해 컴파일하면, 이 의사 코드도 `A`, `B` 를 차례로 재개했을 때 `AB` 를 돌려줍니다.

![suspend fun load 의 상태 머신이 label 0, 1, 2 로 넘어가며 fetchA 와 fetchB 에서 COROUTINE_SUSPENDED 를 반환하고 재개될 때마다 cont 의 필드가 갱신되는 과정, 스레드가 중단 중에는 비어 있는 타임라인을 보여 주는 애니메이션](@/assets/images/kotlin-coroutines-state-machine.gif)

## 재개는 resumeWith 에서 시작합니다

`fetchA` 가 마커를 반환한 뒤 일이 끝나면, 어딘가에서 `sm.resumeWith(Result.success("A"))` 가 호출됩니다. 이 호출이 `invokeSuspend` 를 거쳐 `load(sm)` 을 다시 실행하고 저장된 `label` 덕분에 `fetchA` 다음 줄부터 이어집니다. 이 과정을 표준 라이브러리 API 만으로 확인할 수 있습니다.

```kotlin
import kotlin.coroutines.*

var saved: Continuation<String>? = null

suspend fun fetch(): String = suspendCoroutine { cont -> saved = cont }

suspend fun load(): String {
    val a = fetch()
    val b = fetch()
    return a + b
}

fun main() {
    suspend { println("result = " + load()) }
        .startCoroutine(Continuation(EmptyCoroutineContext) { })
    println("main continues")
    saved?.resume("A")
    println("after first resume")
    saved?.resume("B")
}
```

실행하면 출력 순서는 `main continues`, `after first resume`, `result = AB` 입니다. `startCoroutine` 은 첫 `fetch()` 에서 중단되고 곧바로 돌아오므로 `main continues` 가 먼저 찍힙니다. 이어서 `resume("A")` 가 두 번째 `fetch()` 까지 실행하고 다시 중단되어 `after first resume` 이 찍히고 `resume("B")` 가 나머지를 끝냅니다. 같은 스레드에서 일어나는 일입니다.

## 스레드를 막지 않는 이유

중단은 `COROUTINE_SUSPENDED` 를 반환해 호출 스택을 푸는 것으로 구현됩니다. 대기하는 동안 스레드에 남는 것이 없고 필요한 상태는 힙에 있는 `Continuation` 객체에 있습니다. 스레드를 `Thread.sleep` 이나 락으로 붙잡는 방식과 달리 같은 스레드가 다른 코루틴을 실행할 수 있습니다.

```kotlin
import kotlin.system.measureTimeMillis

fun main() = runBlocking {
    val t = measureTimeMillis {
        coroutineScope {
            repeat(1000) { launch { delay(100) } }
        }
    }
    println(t)
}
```

`runBlocking` 은 호출한 스레드 하나에서 돌아갑니다. 코루틴 1000 개가 각각 100ms 를 기다려도 `measureTimeMillis` 로 잰 전체 시간은 500ms 를 넘지 않습니다. 각 코루틴이 `delay` 에서 중단되는 동안 스레드는 다른 코루틴의 다음 구간을 실행하기 때문입니다.

## Dispatcher 는 재개를 어느 스레드에서 할지 정합니다

`resumeWith` 가 호출된 스레드에서 곧바로 이어 실행하는 것이 항상 맞지는 않습니다. 코루틴 컨텍스트에 들어 있는 `CoroutineDispatcher` 는 `Continuation` 을 감싸 재개 작업을 자기가 관리하는 스레드로 보냅니다. `Dispatchers.Default` 는 CPU 코어 수(최소 2)에 맞춘 공유 스레드 풀이고 `Dispatchers.IO` 는 블로킹 호출을 위한 풀이며 Default 와 스레드를 공유합니다. 안드로이드에서는 `Dispatchers.Main` 이 메인 스레드에서 재개시킵니다. `withContext(Dispatchers.IO) { ... }` 는 블록을 다른 디스패처로 옮겨 실행하고 끝나면 원래 디스패처로 재개합니다. 이때 스레드 전환을 일으키는 지점도 같은 `Continuation` 입니다.

## 구조적 동시성

코루틴은 부모 아래에서 시작되고 부모는 자식이 모두 끝날 때까지 끝나지 않습니다. `coroutineScope` 가 대표적입니다.

```kotlin
coroutineScope {
    launch { delay(1000); println("never") }
    launch { delay(50); throw IllegalStateException("boom") }
}   // IllegalStateException: boom 이 밖으로 전파됨, 첫 번째 자식은 취소됨
```

자식 하나가 예외로 실패하면 형제 코루틴이 취소되고 예외가 부모를 거쳐 호출자에게 전달되므로 `never` 는 출력되지 않습니다. 취소는 협력적으로 동작합니다. `delay` 같은 중단 지점에서 `CancellationException` 이 던져져 코루틴이 끝나므로, 중단 지점이 없는 긴 계산은 취소 신호를 받지 못합니다.

## 참고 자료

- KEEP: Kotlin Coroutines design proposal — https://github.com/Kotlin/KEEP/blob/master/proposals/coroutines.md
- Coroutines basics — https://kotlinlang.org/docs/coroutines-basics.html
- Cancellation and timeouts — https://kotlinlang.org/docs/coroutines-cancellation.html
- Coroutine context and dispatchers — https://kotlinlang.org/docs/coroutine-context-and-dispatchers.html
- kotlin.coroutines.Continuation API — https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.coroutines/-continuation/
- coroutineScope API — https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/coroutine-scope.html
