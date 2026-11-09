---
title: "디자인 패턴 정리: GoF 의 세 갈래와 Builder, Factory, Adapter, Decorator 를 Kotlin 으로 다시 보기"
description: "GoF 책의 23개 패턴 분류, Builder·Factory Method·Abstract Factory·Adapter·Decorator 의 의도와 구조, AlertDialog.Builder·ViewModelProvider.Factory·RecyclerView.Adapter·java.io 데코레이터 같은 실제 API, 기본 인자·apply·companion object·클래스 위임이 바꾸는 지점, Singleton·Strategy·Observer·Facade 와 과한 패턴 적용의 함정을 정리합니다."
pubDatetime: 2026-07-21T21:30:00+09:00
category: kotlin
tags:
  - 디자인 패턴
  - GoF
  - Kotlin
  - Android
---

디자인 패턴은 객체지향 설계에서 반복되는 문제와 그 해법에 이름을 붙인 목록입니다. 이름이 있으면 "생성 과정을 숨기고 싶다" 같은 설명을 "Factory 를 둔다" 한 줄로 줄일 수 있습니다. 이 글은 그 출발점인 GoF 책의 분류를 먼저 보고, 자주 쓰는 네 가지(Builder, Factory, Adapter, Decorator)를 Kotlin 코드와 실제 API 로 확인한 뒤 Kotlin 문법이 어디까지 대신해 주는지 정리합니다.

## GoF 와 세 갈래

소프트웨어 설계 패턴을 널리 알린 책은 Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides 가 쓴 _Design Patterns: Elements of Reusable Object-Oriented Software_ 입니다. Addison-Wesley 에서 1994년에 나왔고 네 저자를 줄여 GoF(Gang of Four)라고 부릅니다. 출판사 소개 페이지는 책이 다루는 23개 패턴이 "더 유연하고 우아하며 결과적으로 재사용 가능한 설계"를 만들게 해 준다고 설명하고, 목차는 3장 Creational, 4장 Structural, 5장 Behavioral 로 나뉩니다.

23개 패턴은 이 세 장에 다음처럼 배치됩니다.

![생성 5개, 구조 7개, 행위 11개로 나뉜 GoF 패턴 목록. 이 글에서 자세히 다루는 Builder, Factory Method, Adapter, Decorator 는 굵게 표시했다](@/assets/images/design-patterns-in-kotlin-overview.png)

- 생성(Creational): 객체를 어떻게 만들지 다룹니다. Abstract Factory, Builder, Factory Method, Prototype, Singleton.
- 구조(Structural): 클래스와 객체를 어떻게 엮어 더 큰 구조로 만들지 다룹니다. Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy.
- 행위(Behavioral): 객체 사이의 책임 분담과 통신을 다룹니다. Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor.

아래 설명은 GoF 원문을 인용하지 않고 각 패턴을 흔히 쓰는 뜻으로 풀어 쓴 것입니다. Kotlin 문서 예제를 옮긴 코드는 해당 위치에 표시했고, 나머지는 설명용으로 새로 쓴 코드입니다.

## Builder

의도는 복잡한 객체를 만드는 과정을 분리해서, 같은 과정으로 다른 구성의 결과를 만들 수 있게 하는 것입니다. 생성자 인자가 많고 대부분 선택 사항일 때 자주 등장합니다. 구조는 단계별 설정 메서드를 가진 `Builder` 와 마지막에 결과를 돌려주는 `build()` 입니다. 설정 메서드가 `Builder` 자신을 돌려주면 호출을 이어 붙일 수 있습니다.

GoF 원래 구조에는 조립 순서를 정하는 `Director` 와, 같은 순서로 서로 다른 결과물을 만드는 여러 `ConcreteBuilder` 가 있습니다. 아래 예시처럼 선택 인자를 체이닝으로 채우는 형태는 Joshua Bloch 의 _Effective Java_ 가 널리 알린 변형으로, "선택 인자가 많은 생성자"라는 문제에 초점을 둡니다. 이 글에서 Kotlin 기본 인자로 대체된다고 말하는 대상도 이 변형입니다.

```kotlin
class HttpRequest private constructor(
    val url: String,
    val method: String,
    val headers: Map<String, String>,
    val timeoutMs: Long,
) {
    class Builder(private val url: String) {
        private var method = "GET"
        private val headers = mutableMapOf<String, String>()
        private var timeoutMs = 10_000L

        fun method(value: String) = apply { method = value }
        fun header(key: String, value: String) = apply { headers[key] = value }
        fun timeout(ms: Long) = apply { timeoutMs = ms }
        fun build() = HttpRequest(url, method, headers.toMap(), timeoutMs)
    }
}

val request = HttpRequest.Builder("https://example.com")
    .method("POST")
    .header("Accept", "application/json")
    .build()
```

### 실제 API

Android 의 `AlertDialog.Builder` 가 대표적입니다. 레퍼런스에서 `androidx.appcompat.app.AlertDialog.Builder` 와 `android.app.AlertDialog.Builder` 모두 `setPositiveButton(CharSequence text, DialogInterface.OnClickListener listener)` 같은 설정 메서드를 `AlertDialog.Builder` 타입으로 돌려주고, `create()` 는 "빌더에 지정한 인자로 AlertDialog 를 만든다", `show()` 는 만들고 곧바로 화면에 띄운다고 설명합니다.

```kotlin
AlertDialog.Builder(context)
    .setTitle("삭제")
    .setMessage("항목을 삭제할까요?")
    .setPositiveButton("삭제") { dialog, _ -> dialog.dismiss() }
    .show()
```

### Kotlin 에서 달라지는 점

Kotlin 은 함수 매개변수에 기본값을 줄 수 있고, 공식 문서는 이것이 "인자 하나를 건너뛰려고 오버로드를 여러 벌 선언하는 일을 줄인다"고 설명합니다. 호출할 때는 이름 있는 인자로 어떤 값이 무엇인지 드러낼 수 있습니다. 위 `HttpRequest` 는 설정 항목이 모두 기본값이 있는 평범한 클래스로 바꿀 수 있습니다.

```kotlin
class HttpRequest(
    val url: String,
    val method: String = "GET",
    val headers: Map<String, String> = emptyMap(),
    val timeoutMs: Long = 10_000L,
)

val request = HttpRequest(
    url = "https://example.com",
    method = "POST",
    headers = mapOf("Accept" to "application/json"),
)
```

Builder 클래스가 사라지고 프로퍼티도 모두 `val` 입니다. 다만 원래 Builder 는 `headers.toMap()` 으로 복사본을 만들었기 때문에, 호출자가 `MutableMap` 을 넘기는 경우까지 막으려면 `init` 블록이나 생성 함수에서 복사해야 합니다. 제약도 있습니다. Java 함수를 호출할 때는 Java 바이트코드가 매개변수 이름을 항상 보존하지 않기 때문에 이름 있는 인자를 쓸 수 없습니다. 그래서 Java 로 만든 `AlertDialog.Builder` 같은 API 는 Kotlin 에서도 빌더 체인으로 씁니다.

기본값만으로 부족한 경우도 있습니다. 중첩된 구조를 선언적으로 쌓아야 할 때가 그렇습니다. 문서는 "잘 지은 이름의 함수와 수신 객체 지정 람다를 조합하면 타입 안전한 정적 타입 빌더를 만들 수 있고, 이 빌더로 복잡한 계층 구조 데이터를 반선언적으로 만드는 Kotlin 기반 DSL 을 만들 수 있다"고 소개합니다. 표준 라이브러리의 `buildString` 이 작은 예입니다. 시그니처는 `buildString(builderAction: StringBuilder.() -> Unit): String` 이고 새로 만든 `StringBuilder` 를 람다로 채운 뒤 `String` 으로 바꿔 돌려줍니다.

```kotlin
val text = buildString {
    append("Hello")
    append(", ")
    append("World")
}
```

기존 객체를 설정하는 정도라면 `apply` 로 충분합니다. 문서는 `apply` 의 컨텍스트 객체가 `this` 이고 반환값이 객체 자신이며, 가장 흔한 용도가 객체 설정이라고 설명합니다.

다음은 Kotlin 문서 Scope functions 의 예제입니다.

```kotlin
data class Person(var name: String, var age: Int = 0, var city: String = "")

val adam = Person("Adam").apply {
    age = 32
    city = "London"
}
```

## Factory Method 와 Abstract Factory

Factory Method 의 의도는 객체를 만드는 인터페이스는 상위 클래스에 두되, 어떤 구체 클래스를 만들지는 서브클래스가 정하게 하는 것입니다. 상위 클래스의 코드는 `createXxx()` 를 호출하기만 하고, 서브클래스가 이 메서드를 재정의해 실제 객체를 고릅니다. Abstract Factory 는 서로 어울리는 객체 묶음(제품군)을 만드는 인터페이스를 따로 둡니다. 구현할 때 Factory Method 를 여러 개 모아 쓰는 경우가 많지만 별개의 패턴입니다.

```kotlin
interface Button { fun render(): String }
interface Checkbox { fun render(): String }

interface WidgetFactory {            // Abstract Factory: 제품군 단위
    fun button(): Button
    fun checkbox(): Checkbox
}

class MaterialFactory : WidgetFactory {
    override fun button() = object : Button { override fun render() = "material button" }
    override fun checkbox() = object : Checkbox { override fun render() = "material checkbox" }
}
```

Factory Method 는 상위 클래스의 메서드를 서브클래스가 재정의하는 모양입니다.

```kotlin
abstract class Screen {
    protected abstract fun createButton(): Button    // Factory Method

    fun render() = createButton().render()
}

class MaterialScreen : Screen() {
    override fun createButton() = object : Button { override fun render() = "material button" }
}
```

### 실제 API

`ViewModelProvider.Factory` 는 `ViewModel` 을 만드는 책임을 별도 인터페이스로 뺀 형태입니다. 생성자에 `Repository` 같은 인자가 필요한 `ViewModel` 을 만들 때 이 인터페이스를 구현합니다. lifecycle 2.10 기준으로 이 인터페이스에는 `create(Class<T>)`, `create(Class<T>, CreationExtras)`, `create(KClass<T>, CreationExtras)` 가 있고 셋 다 기본 구현이 있습니다. `KClass` 버전은 `Class` + `CreationExtras` 버전으로, 그 버전은 다시 `create(Class<T>)` 로 넘기고, `create(Class<T>)` 의 기본 구현은 `UnsupportedOperationException` 을 던집니다. 따라서 둘 중 하나는 직접 구현해야 합니다. 알려진 하위 클래스로는 `ViewModelProvider.NewInstanceFactory` 등이 있고, `ViewModelInitializer` 목록으로 `InitializerViewModelFactory` 를 만드는 `from(...)` 도 제공됩니다.

```kotlin
class DetailViewModelFactory(
    private val repository: Repository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
        require(modelClass.isAssignableFrom(DetailViewModel::class.java)) { "Unknown ViewModel" }
        return DetailViewModel(repository) as T
    }
}
```

### Kotlin 에서 달라지는 점

Kotlin 문서는 companion object 를 "클래스 수준 함수와 프로퍼티를 정의하는 곳이며 팩토리 메서드, 상수, 공유 유틸리티를 만들기 쉽게 한다"고 설명하고, 멤버는 클래스 이름을 한정자로 호출한다고 적습니다. 생성 방식을 숨기고 싶다면 생성자를 `private` 으로 막고 companion 의 함수만 공개하면 됩니다. companion object 는 클래스 본문 안에 선언되므로 바깥 클래스의 `private` 생성자를 호출할 수 있습니다. 이런 정적 생성 함수는 GoF 의 Factory Method(서브클래스 재정의)와는 다른, 흔히 "정적 팩토리 메서드"라고 부르는 관용구입니다.

```kotlin
class User private constructor(val name: String) {
    companion object {
        fun create(name: String): User = User(name.trim())
    }
}

val user = User.create(" Kim ")
```

생성 인자 검증이나 캐시, 하위 타입 선택이 필요 없다면 일반 생성자 호출로 충분하고 팩토리를 둘 이유가 없습니다.

## Adapter

의도는 이미 있는 클래스의 인터페이스를 클라이언트가 기대하는 다른 인터페이스로 바꿔 주는 것입니다. 바꿀 수 없는 외부 클래스를 기존 코드에 끼워야 할 때 씁니다. 구조는 클라이언트가 기대하는 `Target` 인터페이스, 이미 있는 `Adaptee`, 둘을 잇는 `Adapter` 입니다.

```kotlin
interface Logger { fun log(message: String) }              // Target

class LegacyPrinter { fun printLine(text: String) = println(text) }   // Adaptee

class PrinterLogger(private val printer: LegacyPrinter) : Logger {    // Adapter
    override fun log(message: String) = printer.printLine("[LOG] $message")
}
```

### 실제 API

`RecyclerView.Adapter` 레퍼런스는 어댑터를 "앱 고유의 데이터 집합을 `RecyclerView` 안에 표시되는 뷰에 연결(binding)하는 것"으로 설명합니다. 서브클래스는 `onCreateViewHolder(ViewGroup parent, int viewType)`, `onBindViewHolder(VH holder, int position)`, `getItemCount()` 를 구현해서 데이터 목록을 뷰 단위로 바꿔 줍니다. 데이터를 뷰로 바꿔 준다는 점은 Adapter 와 비슷하지만, 문서가 이 클래스를 GoF 의 Adapter 구조와 같다고 설명하는 것은 아닙니다.

### Kotlin 에서 달라지는 점

기능 몇 개를 덧붙이는 정도라면 확장 함수가 더 가볍습니다. Kotlin 문서는 확장을 "상속이나 Decorator 같은 디자인 패턴 없이 클래스나 인터페이스에 새 기능을 붙이는 방법"으로 소개합니다.

```kotlin
fun LegacyPrinter.log(message: String) = printLine("[LOG] $message")
```

다만 문서가 분명히 적듯 확장은 대상 클래스를 수정하지 않고 새 멤버를 추가하지도 않으며, 컴파일 시점에 선언된 타입으로 정적 디스패치됩니다. `LegacyPrinter` 를 `Logger` 가 필요한 자리에 그대로 넘기려면 확장 함수가 아니라 `Logger` 를 구현한 Adapter 클래스가 필요합니다. 확장 함수는 호출 문법을 바꿔 줄 뿐 타입은 바꿔 주지 못합니다.

## Decorator

의도는 같은 인터페이스를 유지한 채 객체에 기능을 동적으로 덧붙이는 것입니다. 구조는 공통 `Component` 인터페이스, 실제 일을 하는 구현, 그리고 `Component` 를 구현하면서 또 다른 `Component` 를 감싸는 `Decorator` 입니다. 데코레이터는 감싼 객체로 호출을 넘기기 전후에 자기 일을 합니다. 겹쳐 감쌀 수 있는 이유는 데코레이터도 `Component` 이기 때문입니다.

![호출자가 CountingInputStream, BufferedInputStream, FileInputStream 순으로 겹쳐 감싼 InputStream 에 read 를 호출하는 구조. 모두 같은 InputStream 타입이다](@/assets/images/design-patterns-in-kotlin-decorator.png)

### 실제 API

`java.io` 가 교과서적인 예입니다. JDK 문서는 `BufferedInputStream` 이 "다른 입력 스트림에 입력을 버퍼링하고 `mark`, `reset` 을 지원하는 기능을 더한다"고 설명하고, 생성자는 `BufferedInputStream(InputStream in)` 입니다. 상위 클래스 `FilterInputStream` 은 "다른 입력 스트림을 감싸 기본 데이터 원천으로 쓰며, 데이터를 변환하거나 부가 기능을 제공할 수 있다. 클래스 자체는 `InputStream` 의 일부 메서드를 감싼 스트림으로 요청을 넘기는 버전으로 재정의한다"고 되어 있습니다. 직접 만드는 데코레이터도 `FilterInputStream` 을 상속하면 됩니다.

```kotlin
class CountingInputStream(source: InputStream) : FilterInputStream(source) {
    var bytesRead = 0L
        private set

    override fun read(): Int = super.read().also { if (it != -1) bytesRead++ }

    override fun read(b: ByteArray, off: Int, len: Int): Int =
        super.read(b, off, len).also { if (it > 0) bytesRead += it }
}

val input = CountingInputStream(BufferedInputStream(FileInputStream("a.txt")))
```

### Kotlin 에서 달라지는 점

Kotlin 은 클래스 위임(`by`)을 언어가 지원합니다. 문서는 위임 패턴이 구현 상속의 좋은 대안이며 Kotlin 이 보일러플레이트 없이 기본 지원한다고 설명합니다. `by` 절은 위임 대상을 객체 안에 저장하고 컴파일러가 인터페이스의 모든 메서드를 그쪽으로 넘기는 코드를 생성합니다. 직접 `override` 한 멤버는 위임보다 우선합니다. 이 성질 덕분에 데코레이터를 짧게 쓸 수 있습니다. 바꾸고 싶은 메서드만 적으면 됩니다.

```kotlin
interface Notifier {
    fun send(message: String)
    fun sendUrgent(message: String)
}

class ConsoleNotifier : Notifier {
    override fun send(message: String) = println(message)
    override fun sendUrgent(message: String) = println("!! $message")
}

class PrefixedNotifier(private val inner: Notifier) : Notifier by inner {
    override fun send(message: String) = inner.send("[app] $message")
}
```

`PrefixedNotifier` 는 `send` 만 바꾸고 `sendUrgent` 는 컴파일러가 만든 전달 코드가 처리합니다. 문서가 경고하는 점이 하나 있습니다. 이렇게 재정의한 멤버는 위임 대상 객체 내부에서 호출되지 않습니다. 위임 대상은 자기 자신의 구현만 봅니다. 만약 `ConsoleNotifier.sendUrgent` 가 내부적으로 `send` 를 부른다면 `PrefixedNotifier` 가 재정의한 `send` 는 거치지 않습니다. 상속이라면 부모 클래스 안에서 부르는 `send` 도 자식이 재정의한 `send` 로 갑니다. 위임은 그렇지 않다는 점이 다릅니다.

## 짧게 보는 나머지 패턴

**Singleton** 은 클래스 인스턴스를 하나로 제한합니다. Kotlin 의 `object` 선언이 한 줄로 해결합니다. 문서는 `object` 가 클래스 정의와 인스턴스 생성을 한 번에 하며 싱글턴 구현에 유용하다고 하고, 초기화는 스레드 안전하고 첫 접근 때 이루어진다고 적습니다.

Kotlin 문서의 예제를 줄인 코드입니다.

```kotlin
object DataProviderManager {
    private val providers = mutableListOf<DataProvider>()
    fun registerDataProvider(provider: DataProvider) { providers.add(provider) }
}
```

**Strategy** 는 알고리즘을 교체 가능한 객체로 분리합니다. Kotlin 에서는 함수 타입이나 `Comparator` 를 넘기면 됩니다. 표준 라이브러리의 `Iterable<T>.sortedWith(comparator: Comparator<in T>)` 는 정렬 기준이라는 전략을 인자로 받고, 같은 목록을 기준만 바꿔 정렬할 수 있습니다. 문서는 이 정렬이 안정적(stable)이라고 적습니다.

```kotlin
val words = listOf("banana", "Apple", "cherry")
val byLowercase = words.sortedWith(compareBy { it.lowercase() })
val byLength = words.sortedWith(compareBy { it.length })
```

**Observer** 는 한 객체의 상태 변화를 여러 구독자에게 알립니다. kotlinx.coroutines 의 `StateFlow` 는 "수집자에게 값 변경을 내보내는, 값이 하나뿐인 읽기 전용 상태"이고 현재 값을 `value` 로 읽을 수 있습니다. 문서에 따르면 활성 수집자를 구독자(subscriber)라고 부르고, 상태 플로는 수집자가 없어도 존재하는 hot flow 이며 완료되지 않습니다. 가변 상태는 `MutableStateFlow(value)` 로 만들고 `value` 를 바꿔 갱신합니다. 다만 같은 문서에 따르면 값 갱신은 항상 합쳐지므로(conflated) 느린 수집자는 중간 값을 건너뛰고, 같은 값을 다시 넣어도 내보내지 않습니다. 모든 변경을 빠짐없이 알려야 하는 경우라면 `SharedFlow` 가 더 맞습니다.

kotlinx.coroutines 의 StateFlow 문서에 나오는 예제입니다.

```kotlin
class CounterModel {
    private val _counter = MutableStateFlow(0)
    val counter = _counter.asStateFlow()

    fun inc() { _counter.update { it + 1 } }
}
```

**Facade** 는 여러 하위 시스템 앞에 단순한 창구 하나를 두는 패턴입니다. 언어 기능이 대신해 주는 부분은 없고 구조 그대로 구현합니다.

```kotlin
class OrderFacade(
    private val stock: StockService,
    private val payment: PaymentService,
    private val shipping: ShippingService,
) {
    fun placeOrder(itemId: String, userId: String) {
        stock.reserve(itemId)
        payment.charge(userId, itemId)
        shipping.schedule(userId, itemId)
    }
}
```

## 과하게 쓰지 않기

패턴은 문제가 있을 때 쓰는 해법이므로, 문제가 없는 곳에 넣으면 코드만 늘어납니다.

- 선택 인자가 많은 클래스는 기본 인자와 이름 있는 인자로 충분하고, Builder 클래스는 Java API 와 맞물리거나 단계별 검증이 꼭 필요할 때 남습니다.
- 구현이 하나뿐인 `Factory` 인터페이스는 일반 생성자 호출과 하는 일이 같습니다. 생성 인자 검증, 캐시, 하위 타입 선택처럼 감출 정보가 있을 때 의미가 생깁니다.
- 호출 문법만 바꾸고 싶은 상황에서 Adapter 클래스를 만들 필요는 없습니다. 확장 함수가 더 짧습니다. 반대로 타입이 맞아야 하면 확장 함수로는 해결되지 않습니다.
- 위임으로 만든 데코레이터는 위임 대상이 재정의된 멤버를 보지 못하므로, 감싼 객체가 자기 메서드끼리 호출하는 구조에서는 기대와 다르게 동작할 수 있습니다.

## 참고 자료

- [Design Patterns: Elements of Reusable Object-Oriented Software (InformIT, Addison-Wesley Professional)](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Design Patterns (Wikipedia): 23개 패턴의 분류 목록](https://en.wikipedia.org/wiki/Design_Patterns)
- [AlertDialog.Builder (androidx.appcompat)](https://developer.android.com/reference/androidx/appcompat/app/AlertDialog.Builder)
- [AlertDialog.Builder (android.app)](https://developer.android.com/reference/android/app/AlertDialog.Builder)
- [ViewModelProvider.Factory](https://developer.android.com/reference/androidx/lifecycle/ViewModelProvider.Factory)
- [ViewModelProvider.android.kt (androidx 소스): Factory 기본 구현](https://github.com/androidx/androidx/blob/androidx-main/lifecycle/lifecycle-viewmodel/src/androidMain/kotlin/androidx/lifecycle/ViewModelProvider.android.kt)
- [RecyclerView.Adapter](https://developer.android.com/reference/androidx/recyclerview/widget/RecyclerView.Adapter)
- [BufferedInputStream (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/BufferedInputStream.html)
- [FilterInputStream (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/FilterInputStream.html)
- [Kotlin 문서: Functions (기본 인자, 이름 있는 인자)](https://kotlinlang.org/docs/functions.html)
- [Kotlin 문서: Type-safe builders](https://kotlinlang.org/docs/type-safe-builders.html)
- [Kotlin 문서: Scope functions](https://kotlinlang.org/docs/scope-functions.html)
- [Kotlin 문서: Object declarations and expressions (singleton, companion object)](https://kotlinlang.org/docs/object-declarations.html)
- [Kotlin 문서: Extensions](https://kotlinlang.org/docs/extensions.html)
- [Kotlin 문서: Delegation](https://kotlinlang.org/docs/delegation.html)
- [Kotlin 문서: Visibility modifiers](https://kotlinlang.org/docs/visibility-modifiers.html)
- [Kotlin API: buildString](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/build-string.html)
- [Kotlin API: sortedWith](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sorted-with.html)
- [kotlinx.coroutines API: StateFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/)
- [Factory method pattern (Wikipedia)](https://en.wikipedia.org/wiki/Factory_method_pattern)
- Joshua Bloch, _Effective Java_ 3판, Item 2 (Addison-Wesley, 2018)
