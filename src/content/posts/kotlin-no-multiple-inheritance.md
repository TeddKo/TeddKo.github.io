---
title: "Kotlin 은 왜 클래스 다중 상속을 막고 인터페이스로 풀었을까"
description: "다이아몬드 문제가 생기는 구조와 Kotlin 이 클래스는 하나만 상속하고 인터페이스는 여러 개 구현하게 한 방식, 기본 메서드가 충돌할 때 super<A>.foo() 로 해결하는 법, 위임(by)으로 기능을 조합하는 방법을 코드로 확인합니다."
pubDatetime: 2022-11-08T22:00:00+09:00
category: kotlin
tags:
  - Kotlin
  - 상속
  - 인터페이스
  - 위임
---

C++ 처럼 클래스를 여러 개 상속할 수 있는 언어에서는 부모가 같은 부모를 공유하는 구조가 만들어집니다. Kotlin 과 Java 는 이 가능성을 문법 단계에서 막았고 Kotlin 은 인터페이스와 위임으로 같은 필요를 채웁니다.

## 다이아몬드 문제

클래스 `A` 에 `foo()` 가 있고 `B` 와 `C` 가 각각 이 메서드를 재정의했다고 합시다. `D` 가 `B` 와 `C` 를 모두 상속하면 `D().foo()` 는 `B` 의 구현과 `C` 의 구현 중 어느 쪽을 가리켜야 할지 정해지지 않습니다. 상속 관계를 그리면 마름모 모양이 되어 다이아몬드 문제라고 부릅니다. 필드까지 들어오면 `A` 의 상태가 `D` 안에 한 벌인지 두 벌인지도 따져야 합니다.

![A 를 B 와 C 가 상속하고 D 가 B 와 C 를 상속해 foo 의 호출 대상이 모호해지는 다이아몬드 구조와, Kotlin 의 클래스 1개 상속과 인터페이스 여러 개 구현 구조를 나란히 보여 주는 그림](@/assets/images/kotlin-no-multiple-inheritance-diamond.png)

Kotlin 은 클래스 상속을 하나로 제한해서 이 문제를 아예 만들지 않습니다. 상위 클래스를 둘 쓰면 컴파일러가 거부합니다.

```kotlin
open class A
open class B
class C : A(), B()   // 컴파일 오류: 상위 클래스는 하나만 지정 가능
```

## 인터페이스는 여러 개 구현합니다

단일 상속만 허용하면 "걷고 헤엄치는 개구리" 같은 조합을 표현하기 어려워지므로, 인터페이스는 개수 제한 없이 구현할 수 있습니다. Kotlin 의 인터페이스는 메서드 본문을 가질 수 있습니다.

```kotlin
interface Walker {
    fun move() = println("walk")
}
interface Swimmer {
    fun move() = println("swim")
}
```

이렇게 기본 구현을 가진 인터페이스끼리는 같은 문제가 다시 생길 수 있습니다. 같은 시그니처의 멤버를 두 인터페이스에서 물려받으면 컴파일러는 어느 쪽도 고르지 않고 오류를 냅니다.

```kotlin
class Frog : Walker, Swimmer
// 컴파일 오류: move 를 override 해야 함(상속받은 구현이 둘)
```

한쪽이 추상 메서드이고 다른 쪽이 기본 구현이어도 마찬가지입니다. 클래스와 인터페이스에서 같은 멤버를 받는 경우에도 요구는 같습니다. 충돌하는 멤버는 하위 클래스가 직접 `override` 해야 합니다.

## `super<타입>` 으로 구현을 고릅니다

재정의 안에서는 `super` 뒤에 꺾쇠로 타입을 적어 어느 부모의 구현을 부를지 지정합니다.

```kotlin
class Frog : Walker, Swimmer {
    override fun move() {
        super<Walker>.move()
        super<Swimmer>.move()
    }
}

Frog().move()  // walk, swim
```

한쪽만 쓰거나 둘을 이어서 부르거나 전혀 새로 구현하는 것도 모두 `override` 안에서 정할 수 있습니다. Java 에서 같은 상황은 `Walker.super.move()` 로 적습니다. 문법만 다르고 충돌을 호출하는 쪽이 명시하게 하는 방식은 같습니다.

## 인터페이스에는 상태가 없습니다

클래스에서 다이아몬드 문제가 특히 까다로운 것은 상태 때문입니다. Kotlin 인터페이스는 프로퍼티를 선언할 수는 있지만 backing field 를 가질 수 없습니다. 초기값을 붙이면 컴파일되지 않습니다.

```kotlin
interface S { var state: Int = 0 }  // 컴파일 오류: 인터페이스 프로퍼티에는 초기값을 둘 수 없음
interface HasCount { val count: Int get() = 1 }  // 접근자만 있으면 가능
```

프로퍼티는 추상으로 두거나 다른 멤버로 계산하는 접근자로만 구현합니다. 값을 실제로 저장하는 필드는 구현 클래스에서 만들어야 하므로, 인터페이스를 여러 개 구현해도 저장 공간이 겹치지 않습니다. 충돌할 수 있는 것은 메서드 구현뿐이고 위에서 본 `super<타입>` 으로 해결됩니다.

## 위임으로 조합합니다

여러 인터페이스의 구현을 가져오고 싶을 때 상속 대신 쓰는 도구가 `by` 입니다. 인터페이스를 구현하는 객체를 생성자로 받아 모든 호출을 그 객체에 넘기도록 컴파일러가 전달 메서드를 만들어 줍니다.

```kotlin
interface Logger { fun log(msg: String) }
interface Cache { fun get(k: String): String? }

class ConsoleLogger : Logger { override fun log(msg: String) = println("log: $msg") }
class MapCache : Cache {
    private val m = mapOf("a" to "1")
    override fun get(k: String) = m[k]
}

class Service(logger: Logger, cache: Cache) : Logger by logger, Cache by cache

val s = Service(ConsoleLogger(), MapCache())
s.log("x")        // log: x
println(s.get("a")) // 1
```

`Service` 는 두 클래스를 상속하지 않았지만 두 인터페이스의 기능을 모두 갖습니다. 협력 객체를 바꾸려면 생성자에 다른 구현을 넘기면 되므로 테스트에서 가짜 구현을 끼우기도 쉽습니다.

위임에는 상속과 다른 점이 하나 있습니다. 위임 대상은 자기를 감싼 클래스를 모릅니다. 감싼 쪽에서 메서드 하나를 재정의해도 위임 대상 내부의 호출은 자기 구현을 부릅니다.

```kotlin
interface Greeter {
    fun name(): String
    fun greet() = "hi " + name()
}
class Base : Greeter { override fun name() = "base" }
class Derived(b: Greeter) : Greeter by b { override fun name() = "derived" }

println(Derived(Base()).name())   // derived
println(Derived(Base()).greet())  // hi base
```

`greet()` 는 위임 대상 `Base` 안에서 실행되므로 `Derived` 의 `name()` 을 거치지 않습니다. 상속이라면 `hi derived` 가 나옵니다. 템플릿 메서드처럼 하위 클래스의 재정의에 기대는 설계는 위임으로 옮기면 동작이 달라집니다.

## 상속보다 합성

Kotlin 은 클래스를 기본적으로 `final` 로 두고 `open` 을 붙인 것만 상속을 허용합니다. 단일 상속, 상태 없는 인터페이스, 기본 `final` 은 모두 상속 계층을 얕게 유지하는 방향의 설계입니다. Effective Java 3판 아이템 18 "상속보다는 컴포지션을 사용하라"와 같은 쪽을 향하며(기본 `final` 은 아이템 19 "상속을 고려해 설계하고 문서화하라. 그러지 않았다면 상속을 금지하라"와 맞닿아 있습니다), 인터페이스로 계약을 정하고 구현 객체를 필드로 들고 `by` 로 넘기는 구성이 그 지침을 문법으로 지원합니다. 부모 클래스로 고를 수 있는 것은 하나뿐이어서 그 자리에는 "이 클래스는 무엇인가"에 답하는 타입이 와야 하고 나머지 능력은 인터페이스와 위임으로 붙입니다.

## 참고 자료

- Inheritance — https://kotlinlang.org/docs/inheritance.html
- Interfaces — https://kotlinlang.org/docs/interfaces.html
- Delegation — https://kotlinlang.org/docs/delegation.html
- Java Language Specification §15.12.1 — https://docs.oracle.com/javase/specs/jls/se17/html/jls-15.html#jls-15.12.1
- Joshua Bloch, Effective Java 3rd Edition — https://www.informit.com/store/effective-java-9780134686059
