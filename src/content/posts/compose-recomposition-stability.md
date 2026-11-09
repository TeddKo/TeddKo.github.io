---
title: "Compose 재구성과 stability: donut-hole skipping 부터 strong skipping 까지"
description: "Compose 가 재구성 범위를 정하는 방식과 donut-hole skipping, 컴파일러가 파라미터 stability 를 추론하는 규칙, @Stable 과 @Immutable 의 계약, strong skipping 이 기본이 된 뒤 달라진 최적화 기준을 정리했습니다."
pubDatetime: 2026-11-09T16:21:00+09:00
category: android
tags:
  - Jetpack Compose
  - Recomposition
  - Stability
  - Strong Skipping
  - Kotlin
---

Compose 성능 이야기를 하다 보면 "이 클래스는 unstable 이라 재구성이 계속 일어난다", "`@Immutable` 붙이면 된다", "`List` 대신 `ImmutableList` 를 써라" 같은 말이 따라 나옵니다. 몇 년 전에는 대체로 맞는 조언이었습니다. Kotlin 2.0.20 에서 strong skipping 이 기본값이 된 뒤로는 그대로 따르면 오히려 느려지는 경우가 생깁니다. 재구성이 어떤 단위로 일어나는지부터 컴파일러와 런타임이 각각 무엇을 맡는지까지 순서대로 정리했습니다.

## 재구성은 state 를 읽은 범위에서 시작합니다

컴포저블 함수는 UI 를 그리는 코드라기보다 "현재 상태라면 화면은 이렇다"를 설명하는 함수입니다. 상태가 바뀌면 Compose 는 그 설명을 다시 실행하는데, 앱 전체를 다시 돌리지는 않습니다.

`mutableStateOf` 로 만든 값은 스냅샷 시스템 위에 있습니다. 컴포저블이 실행되면서 state 의 `value` 를 읽으면, 런타임은 지금 실행 중인 **재시작 범위(restart scope)** 가 그 state 를 읽었다고 기록합니다. 나중에 state 가 바뀌면 그 state 를 읽었던 범위만 무효화되고, 다음 프레임에서 무효화된 범위만 다시 실행됩니다.

재시작 범위가 되는 것은 두 가지입니다.

- 반환값이 없는 일반 `@Composable` 함수. 컴파일러가 본문을 restart group 으로 감싸고, 끝에서 "이 범위를 다시 실행하려면 이 함수를 이 인자로 다시 부르면 된다"는 람다를 등록합니다.
- inline 이 아닌 composable 람다. `Button` 의 `content` 처럼 다른 컴포저블에 넘기는 `@Composable () -> Unit` 은 컴파일러가 `ComposableLambda` 객체로 감싸고, 이 객체가 그 자체로 하나의 재시작 범위가 됩니다.

반대로 `Column`, `Row`, `Box` 는 inline 함수라 자기 범위를 만들지 않습니다. 이들의 content 람다는 호출한 함수 본문에 펼쳐지므로, `Column { }` 안에서 state 를 읽으면 `Column` 을 감싼 바깥 함수가 무효화됩니다. 값을 반환하는 컴포저블(`remember` 같은)과 `@NonRestartableComposable` 을 붙인 함수도 범위를 만들지 않습니다.

## donut-hole skipping

다음 두 코드는 화면 결과가 같습니다.

```kotlin
@Composable
fun CounterScreen() {
    var count by remember { mutableIntStateOf(0) }
    val label = "눌린 횟수 $count"
    Column {
        Header(title = "카운터")
        Button(onClick = { count++ }) {
            Text(label)
        }
    }
}
```

```kotlin
@Composable
fun CounterScreen() {
    var count by remember { mutableIntStateOf(0) }
    Column {
        Header(title = "카운터")
        Button(onClick = { count++ }) {
            Text("눌린 횟수 $count")
        }
    }
}
```

첫 번째는 `count` 를 `CounterScreen` 본문에서 읽습니다. 버튼을 누르면 `CounterScreen` 범위가 무효화되어 함수 전체가 다시 실행됩니다. `Header` 는 `title` 이 그대로라서 건너뛰고, `Button` 도 인자가 같아 건너뜁니다. 다만 `content` 람다가 캡처한 `label` 이 바뀌었으므로 람다 범위는 다시 실행됩니다.

두 번째는 `count` 를 `Button` 의 `content` 람다 안에서 읽습니다. 이번에는 람다 범위만 무효화됩니다. `CounterScreen` 도, `Header` 도, `Button` 도 호출되지 않고 가운데 람다만 다시 돕니다. 바깥은 그대로 두고 안쪽 구멍만 다시 실행된다고 해서 이 동작을 donut-hole skipping 이라고 부릅니다.

![count 를 CounterScreen 본문에서 읽으면 CounterScreen 이 다시 실행되고 Header 와 Button 은 인자 비교 후 건너뛰며 content 람다만 다시 실행된다. count 를 Button 의 content 람다에서 읽으면 CounterScreen, Header, Button 은 호출되지 않고 content 람다만 다시 실행된다](@/assets/images/compose-recomposition-donut-hole.png)

여기서 얻을 수 있는 실무 감각은 "state 는 필요한 곳에서 최대한 늦게 읽는다"입니다. 부모에서 `state.value` 를 꺼내 자식에게 값으로 넘기면 부모 범위가 무효화되고, 자식에게 state 자체나 `() -> Int` 람다를 넘겨 자식이 읽게 하면 자식 범위만 무효화됩니다. 스크롤 위치나 애니메이션 값처럼 매 프레임 바뀌는 값은 `Modifier.offset { }`, `Modifier.drawBehind { }`, `graphicsLayer { }` 같은 람다 버전에서 읽으면 composition 을 아예 건너뛰고 layout 이나 draw 단계에서만 다시 계산됩니다.

## 건너뛸지는 인자 비교로 정합니다

재시작 범위가 다시 실행되면 그 안에서 호출하는 자식 컴포저블마다 "이번에 받은 인자가 지난번과 같은가"를 물어봅니다. 모두 같으면 자식 본문을 실행하지 않고 지난 결과를 그대로 씁니다. 이것이 skipping 입니다.

컴파일러는 이를 위해 모든 컴포저블에 `$composer` 와 `$changed` 라는 숨은 파라미터를 추가합니다. `$changed` 는 정수 하나에 파라미터마다 몇 비트씩 할당해 "호출자가 보기에 이 인자는 같다, 다르다, 상수다, 모른다"를 전달합니다. 호출자가 이미 아는 정보는 자식이 다시 비교하지 않아도 되게 하려는 장치입니다. 읽기 쉽게 줄이면 생성 코드는 이런 모양입니다.

```kotlin
// 컴파일러 출력을 읽기 쉽게 줄인 모양
fun Header(title: String, $composer: Composer, $changed: Int) {
    $composer.startRestartGroup(KEY)
    var dirty = $changed
    if (호출자가 title 의 변경 여부를 모름) {
        dirty = dirty or (if ($composer.changed(title)) DIFFERENT else SAME)
    }
    if (모든 인자가 SAME && $composer.skipping) {
        $composer.skipToGroupEnd()
    } else {
        Text(title)
    }
    $composer.endRestartGroup()?.updateScope { c, _ ->
        Header(title, c, $changed or 1)
    }
}
```

`$composer.changed(title)` 은 slot table 에 저장해 둔 지난 값과 `equals()` 로 비교하고, 다르면 새 값을 저장합니다. 마지막 `updateScope` 가 앞에서 말한 "다시 실행하려면 이렇게 부르라"는 등록입니다.

여기까지 보면 역할 분담이 분명합니다. **stability 는 컴파일러가 빌드 시점에 추론하고, 그 결과에 맞는 비교 코드를 생성합니다.** 런타임은 그 코드를 실행하며 slot table 의 값과 비교하고, 스냅샷 읽기를 추적해 어떤 범위를 무효화할지 정합니다. 런타임이 리플렉션으로 클래스 구조를 들여다보는 일은 없습니다. 다만 빌드 시점에 결론을 낼 수 없는 타입이 있어서, 그때는 컴파일러가 "실행할 때 이 값을 읽어 결정하라"는 코드를 대신 넣습니다. 이 경우는 아래에서 따로 다룹니다.

## 컴파일러가 stability 를 추론하는 규칙

"비교 방식을 정한다"는 것은 파라미터 타입이 stable 인지 unstable 인지 가린다는 뜻입니다. Compose 에서 stable 은 "값이 바뀌면 Compose 가 알 수 있는 타입"이고, unstable 은 "바뀌어도 Compose 가 알 수 없는 타입"입니다.

컴파일러가 stable 로 보는 것은 다음과 같습니다.

- `Int`, `Long`, `Float`, `Boolean` 같은 원시 타입과 `String`
- 함수 타입. 람다는 언제나 stable 로 취급됩니다.
- enum 클래스와 `object`
- `MutableState`, `SnapshotStateList`, `SnapshotStateMap` 처럼 변경을 스냅샷으로 알리는 타입
- 모든 프로퍼티가 `val` 이고 그 타입이 전부 stable 인 final 클래스. 같은 모듈이든 다른 모듈이든 Compose 컴파일러가 처리한 모듈이어야 합니다.
- 컴파일러가 이름으로 아는 외부 타입. 컴파일러 소스의 `KnownStableConstructs` 에 목록이 있고, `Pair`, `Triple`, `Result`, `ClosedRange`, kotlinx.collections.immutable 의 `ImmutableList`·`PersistentList` 계열, Guava 의 `ImmutableList`·`ImmutableMap`, Dagger 의 `Lazy`, `BigInteger`, `BigDecimal`, `Locale` 이 들어 있습니다. 제네릭 타입은 타입 인자도 stable 이어야 해서 `Pair<String, Int>` 는 stable 이고 `Pair<String, MutableList<Int>>` 는 아닙니다.
- `@Stable`, `@Immutable` 을 붙이거나 stability 설정 파일에 적은 타입

같은 파일에는 `listOf`, `setOf`, `mapOf`, `emptyList`, `persistentListOf` 같은 함수 목록도 있습니다. 파라미터 타입이 `List` 라도 인자 자리에 `listOf("a", "b")` 를 직접 쓰면 그 식의 결과는 stable 로 봅니다.

unstable 이 되는 경우도 규칙이 단순합니다.

- `var` 프로퍼티가 하나라도 있으면 unstable 입니다. `var` 를 바꿔도 Compose 에 알릴 방법이 없기 때문입니다. 위임 프로퍼티는 예외라서 `var name by mutableStateOf("")` 는 이 규칙에 걸리지 않습니다.
- `val` 이어도 그 타입이 unstable 이면 클래스 전체가 unstable 입니다.
- `List`, `Set`, `Map` 은 인터페이스라 실제 구현이 `ArrayList` 일 수도 있어서 unstable 입니다. 원소가 stable 이어도 마찬가지입니다.
- Compose 컴파일러가 돌지 않은 모듈의 클래스는 unstable 입니다.

마지막 규칙이 멀티 모듈 프로젝트에서 자주 걸립니다. 컴파일러는 클래스를 처리할 때 추론 결과를 `@StabilityInferred` 어노테이션과 `$stable` 이라는 정적 필드로 남깁니다. 다른 모듈이 그 클래스를 쓸 때는 소스를 다시 분석하지 않고 이 기록을 읽습니다. 순수 Kotlin 으로 빌드한 `domain` 모듈의 `data class` 에는 이 기록이 없으니, UI 모듈의 컴파일러는 안을 들여다보지 못하고 unstable 로 처리합니다. 필드가 전부 `val String` 이어도 그렇습니다.

### 빌드 시점에 정해지지 않는 경우

컴파일러 소스의 `Stability` 는 `Certain`(확실히 stable 또는 unstable), `Runtime`, `Unknown`, `Parameter`, 그리고 이들을 묶은 `Combined` 로 나뉩니다. 뒤의 셋이 빌드 시점에 결론이 나지 않은 상태이고, 컴파일러 리포트에는 `stable` 도 `unstable` 도 아닌 `runtime` 으로 찍힙니다.

- **`Runtime`**: 다른 모듈에서 온 클래스는 소스를 다시 분석하지 않고, 실행할 때 그 클래스의 `$stable` 필드를 읽는 코드를 넣습니다. JVM 에서는 같은 모듈이라도 다른 파일에 있는 `public`, `internal` 클래스면 이 방식을 씁니다.
- **`Parameter`**: 제네릭 타입 파라미터 `T` 입니다.
- **`Unknown`**: 인터페이스와 `open`, `abstract` 클래스입니다. 실제로 어떤 구현이 올지 모르기 때문입니다.

```kotlin
class Box<T>(val value: T)
```

`Box<String>` 은 stable 이고 `Box<MutableList<String>>` 는 unstable 입니다. 컴파일러는 `@StabilityInferred` 의 `parameters` 값에 "몇 번째 타입 파라미터가 stability 에 영향을 주는가"를 비트로 기록합니다. 호출 지점에서 타입 인자가 정해지면 `Box` 자신의 `$stable` 과 타입 인자의 stability 를 합쳐 계산합니다.

계산한 결과는 앞에서 본 `$changed` 로 넘어갑니다. `$changed` 는 파라미터마다 3비트를 쓰는데, 아래 두 비트가 같다·다르다·상수·모름을 나타내고 위의 한 비트가 unstable 여부를 나타냅니다. 호출하는 쪽이 `$stable` 값을 읽어 이 비트를 채우면, 호출받는 쪽은 stability 가 불확실한 파라미터를 비교할 때 이 비트를 보고 `changed()`(`equals()`)를 쓸지 `changedInstance()`(`===`)를 쓸지 고릅니다. 실행 중에 정해지는 것은 이 비트 하나이고, 비교 코드 두 갈래는 컴파일러가 미리 만들어 둡니다.

추론 결과는 직접 확인할 수 있습니다.

```kotlin
composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose_compiler")
    metricsDestination = layout.buildDirectory.dir("compose_compiler")
}
```

빌드 후 `*-classes.txt` 에는 클래스마다 `stable class Contact { stable val name: String }` 같은 줄이, `*-composables.txt` 에는 함수마다 `restartable skippable fun Header(stable title: String)` 같은 줄이 생깁니다.

## @Stable 과 @Immutable 은 컴파일러와 맺는 계약입니다

두 어노테이션은 클래스를 stable 하게 만들어 주지 않습니다. "이 타입은 계약을 지키니 stable 로 취급하라"고 컴파일러에게 선언하는 것이고, 컴파일러는 확인하지 않고 믿습니다. Android 공식 문서는 이를 Kotlin 의 `!!` 에 비유합니다.

- **`@Immutable`**: 인스턴스가 만들어진 뒤 공개 프로퍼티 값이 절대 바뀌지 않는다는 약속입니다.
- **`@Stable`**: 값이 바뀔 수는 있지만, 같은 두 인스턴스의 `equals()` 결과가 늘 같고, 공개 프로퍼티가 바뀌면 composition 에 알리며(실제로는 내부를 `mutableStateOf` 로 만든다는 뜻), 공개 프로퍼티 타입이 모두 stable 이라는 약속입니다. 함수나 프로퍼티에 붙이면 같은 입력에 같은 결과를 돌려준다는 뜻이 되고, `Modifier.padding` 같은 함수에 붙어 있습니다.

skipping 관점에서 컴파일러는 둘을 구분하지 않습니다. 어느 쪽을 붙이든 그 클래스는 stable 로 처리되고 `equals()` 로 비교됩니다. 둘 다 `@StableMarker` 를 메타 어노테이션으로 가지고 있어서, 직접 만든 어노테이션에 `@StableMarker` 를 붙여도 같은 효과가 납니다.

계약을 어기면 버그가 납니다.

```kotlin
@Immutable
data class Cart(val items: MutableList<Item>)
```

`cart.items.add(item)` 으로 같은 인스턴스를 고치면 `equals()` 비교에서 지난 값과 같은 객체이므로 Compose 는 건너뛰고, 화면에 새 아이템이 나오지 않습니다. 성능 문제가 아니라 화면이 틀리는 문제입니다.

이 어노테이션들은 원래 `compose-runtime` 에 들어 있어서, 도메인 모듈에서 쓰려면 Compose 런타임 의존성을 끌어와야 했습니다. Compose 1.9 부터는 `androidx.compose.runtime:runtime-annotation` 아티팩트로 옮겨졌습니다. Compose 에 의존하지 않는 라이브러리나 KMP 공통 모듈에서도 이 작은 아티팩트만 추가해 `@Stable`, `@Immutable` 을 붙일 수 있습니다.

## strong skipping 이 바꾼 것

Compose 컴파일러는 Kotlin 2.0 부터 Kotlin 저장소로 옮겨 와 Kotlin 과 같은 버전으로 나오고, Gradle 에서는 `org.jetbrains.kotlin.plugin.compose` 플러그인으로 적용합니다. 그리고 Kotlin 2.0.20 부터 strong skipping 모드가 기본으로 켜졌습니다. 바뀐 점은 두 가지입니다.

**unstable 파라미터가 있어도 건너뛸 수 있습니다.** 예전에는 파라미터 하나라도 unstable 이면 그 컴포저블은 skippable 이 아니었고, 부모가 재구성될 때마다 같이 다시 실행됐습니다. 지금은 재시작 가능한 컴포저블이면 모두 skippable 이고, 비교 방식만 다릅니다.

- stable 파라미터: `equals()` 로 비교
- unstable 파라미터: `===` 인스턴스 비교
- 함수 타입 파라미터: stable 이지만 `===` 로 비교. 람다의 `equals()` 는 원래 인스턴스 비교라 결과는 같고, 아래의 자동 remember 덕분에 같은 인스턴스가 유지됩니다.

**composable 안의 람다를 자동으로 remember 합니다.** 컴파일러가 람다를 `remember` 로 감싸고 캡처한 값을 키로 씁니다. 키 비교도 같은 규칙이라 unstable 캡처는 `===`, stable 캡처는 `equals()` 로 봅니다. 예전에 unstable 객체를 캡처한 `onClick = { viewModel.onClick(item) }` 이 재구성마다 새 람다가 되어 자식을 매번 다시 실행시키던 문제가 이걸로 사라졌습니다.

예외가 필요하면 두 어노테이션을 씁니다. 건너뛰면 안 되는 컴포저블에는 `@NonSkippableComposable`, 기억하면 안 되는 람다에는 `@DontMemoize` 를 붙입니다. 모드 자체를 끄려면 `featureFlags` 에 `ComposeFeatureFlag.StrongSkipping.disabled()` 를 넣습니다.

![원시 타입과 String 과 enum, Compose 모듈의 val data class, ImmutableList 와 Pair 같은 컴파일러가 아는 타입, @Stable 과 @Immutable 클래스, MutableState 는 stable 로 추론되어 equals 로 비교되고, 람다는 stable 이지만 === 로 비교되며, var 프로퍼티 클래스, List 인터페이스, Compose 컴파일러가 돌지 않은 모듈의 클래스는 unstable 로 추론되어 === 로 비교되고, 제네릭 클래스와 다른 파일이나 모듈의 public 클래스는 runtime 으로 남아 실행 중 $stable 비트로 비교 방식이 정해지는 표](@/assets/images/compose-stability-matrix.png)

## 그래서 최적화 기준이 뒤집혔습니다

strong skipping 이전의 조언은 "unstable 은 무조건 재구성되니 전부 stable 로 만들어라"였습니다. 지금은 unstable 도 같은 인스턴스면 건너뛰므로, 질문이 "stable 인가"에서 "**같은 인스턴스가 다시 오는가, 새로 만들어지는가**"로 바뀌었습니다.

Android 공식 문서도 이 방향으로 고쳐졌습니다. 컬렉션을 예로 들면 이렇습니다.

- `List<Snack>` 은 unstable 이지만 같은 리스트 참조를 넘기면 `===` 한 번으로 건너뜁니다.
- `ImmutableList<Snack>` 으로 바꾸면 stable 이 되어 `equals()` 로 비교하는데, 이건 원소를 하나씩 비교한다는 뜻입니다. `LazyColumn` 에 넘기는 큰 목록이면 비교가 재구성보다 비쌀 수 있습니다.
- `data class SnackCategory(val name: String, val snacks: ImmutableList<Snack>)` 를 받은 컴포저블이 `category.snacks` 를 다시 자식에게 넘기면, 부모의 `SnackCategory.equals()` 에서 한 번, 자식 파라미터 비교에서 또 한 번 목록 전체를 비교합니다.

문서의 권고는 구조적 비교를 강제하지 말고 **참조를 보존하라**는 것입니다. ViewModel 에서 변환 결과를 캐싱하거나 `remember` 로 감싸서, 내용이 같으면 같은 인스턴스를 내려보내면 `===` 로 충분합니다. `ImmutableList` 나 어노테이션은 참조를 보존할 수 없고 벤치마크로 이득이 확인될 때만 쓰라고 적혀 있습니다.

`@Stable`, `@Immutable` 도 같습니다. Compose 모듈 안의 `val` 만 가진 클래스는 이미 stable 이라 붙일 필요가 없습니다. 붙일 만한 경우는 컴파일러가 추론하지 못하는 타입(인터페이스, 다른 모듈의 클래스)이면서, 데이터 소스가 같은 값의 새 인스턴스를 자주 만들고, 클래스가 작아 `equals()` 가 싼 경우입니다. 이전 글 [Kotlin data class 가 만들어 주는 멤버와 만들지 않는 것](/posts/kotlin-data-class/)에서 본 것처럼 data class 의 `equals()` 는 주 생성자 프로퍼티를 전부 비교하니, 중첩이 깊거나 컬렉션을 품은 모델이면 그 비용이 그대로 매 재구성에 붙습니다.

손대지 못하는 외부 타입은 stability 설정 파일로 지정합니다. Compose 컴파일러 1.5.5 부터 지원하고, 한 줄에 클래스 하나, 와일드카드 `*` 와 `**` 를 쓸 수 있습니다.

```text
// compose_stability.conf
java.time.LocalDateTime
com.example.domain.model.**
```

```kotlin
composeCompiler {
    stabilityConfigurationFiles.add(
        rootProject.layout.projectDirectory.file("compose_stability.conf")
    )
}
```

설정 파일도 어노테이션과 똑같이 컴파일러가 검증하지 않는 계약입니다. `com.example.domain.model.**` 처럼 넓게 잡았다가 그 안에 `var` 가 있는 클래스가 하나라도 섞이면 앞의 `Cart` 예와 같은 버그가 납니다.

## 정리하면

재구성이 너무 잦아 보일 때 확인하는 순서를 적어 두면 이렇습니다.

1. state 를 어디서 읽는지 봅니다. 부모에서 읽고 값을 내려보내고 있다면, 읽는 위치를 자식이나 람다 Modifier 로 옮기는 것만으로 범위가 줄어듭니다.
2. Layout Inspector 의 재구성 횟수와 건너뛴 횟수로 실제로 건너뛰지 못하는 컴포저블을 찾습니다.
3. 건너뛰지 못하는 원인이 "같은 값의 새 인스턴스"인지 봅니다. `map`, `filter`, `copy` 가 매 emit 마다 새 객체를 만들고 있다면 상류에서 참조를 보존하는 쪽을 먼저 고칩니다.
4. 그래도 안 되고, 타입이 작고 `equals()` 가 싸다면 그때 `@Immutable` 이나 설정 파일을 씁니다.

공식 문서는 모든 컴포저블을 skippable 로 만들려 애쓰지 말라는 말도 덧붙입니다. skippable 컴포저블은 파라미터를 slot table 에 저장하고 매번 비교하는 비용을 냅니다. 거의 재구성되지 않는 함수나 skippable 자식을 호출하기만 하는 함수라면 그 비용이 아낄 수 있는 것보다 클 수 있습니다. 재구성 횟수보다 재구성 한 번이 얼마나 가벼운지, 그리고 벤치마크 결과를 기준으로 판단하는 편이 맞습니다.

## 참고 자료

- [Thinking in Compose (Android Developers)](https://developer.android.com/develop/ui/compose/mental-model)
- [Stability in Compose (Android Developers)](https://developer.android.com/develop/ui/compose/performance/stability)
- [Fix stability issues (Android Developers)](https://developer.android.com/develop/ui/compose/performance/stability/fix)
- [Diagnose stability issues (Android Developers)](https://developer.android.com/develop/ui/compose/performance/stability/diagnose)
- [Strong skipping mode (Android Developers)](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)
- [Compose compiler options DSL (Kotlin)](https://kotlinlang.org/docs/compose-compiler-options.html)
- [ComposeCompilerGradlePluginExtension (Kotlin Gradle plugin API)](https://kotlinlang.org/api/kotlin-gradle-plugin/compose-compiler-gradle-plugin/org.jetbrains.kotlin.compose.compiler.gradle/-compose-compiler-gradle-plugin-extension/)
- [Compose Runtime release notes (Android Developers)](https://developer.android.com/jetpack/androidx/releases/compose-runtime)
- [Stability.kt (JetBrains/kotlin, Compose compiler)](https://github.com/JetBrains/kotlin/blob/master/plugins/compose/compiler-hosted/src/main/java/androidx/compose/compiler/plugins/kotlin/analysis/Stability.kt)
- [KnownStableConstructs.kt (JetBrains/kotlin, Compose compiler)](https://github.com/JetBrains/kotlin/blob/master/plugins/compose/compiler-hosted/src/main/java/androidx/compose/compiler/plugins/kotlin/analysis/KnownStableConstructs.kt)
- [ClassStabilityTransformer.kt (JetBrains/kotlin, Compose compiler)](https://github.com/JetBrains/kotlin/blob/master/plugins/compose/compiler-hosted/src/main/java/androidx/compose/compiler/plugins/kotlin/lower/ClassStabilityTransformer.kt)
- [ComposableFunctionBodyTransformer.kt (JetBrains/kotlin, Compose compiler)](https://github.com/JetBrains/kotlin/blob/master/plugins/compose/compiler-hosted/src/main/java/androidx/compose/compiler/plugins/kotlin/lower/ComposableFunctionBodyTransformer.kt)
