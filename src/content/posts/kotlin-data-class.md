---
title: "Kotlin data class 가 만들어 주는 멤버와 만들지 않는 것"
description: "data class 가 주 생성자 프로퍼티로 생성하는 equals, hashCode, toString, componentN, copy 를 그림과 실행 결과로 확인하고 얕은 복사, 상속 제약, 구조 분해, 불변 권장 이유, @JvmRecord 까지 다룹니다."
pubDatetime: 2022-06-14T21:00:00+09:00
category: kotlin
tags:
  - Kotlin
  - data class
  - 불변성
---

값을 담는 클래스를 Java 로 쓰면 필드와 생성자, getter, `equals`, `hashCode`, `toString` 을 직접 적거나 IDE 로 생성해야 합니다. Kotlin 은 클래스 앞에 `data` 를 붙이면 값 비교, 출력, 복사, 분해에 쓰는 멤버를 컴파일러가 만들어 줍니다.

## 선언 한 줄에서 생기는 멤버

```kotlin
data class User(val name: String, val age: Int)
```

이 한 줄로 다섯 가지 멤버가 생깁니다. `equals()` 와 `hashCode()` 는 프로퍼티 값이 같으면 같은 객체로 취급하게 하고 `toString()` 은 `User(name=Kim, age=30)` 형태의 문자열을 돌려줍니다. `component1()`, `component2()` 는 선언 순서대로 프로퍼티를 꺼내며 구조 분해가 이 함수를 호출합니다. `copy()` 는 일부 프로퍼티만 바꾼 새 인스턴스를 만듭니다.

![User 클래스의 주 생성자 프로퍼티 name, age 에서 equals, hashCode, toString, componentN, copy 가 생성되고 본문 프로퍼티 memo 는 제외되는 그림](@/assets/images/kotlin-data-class-members.png)

```kotlin
val a = User("Kim", 30)
println(a == User("Kim", 30))  // true
println(a)                     // User(name=Kim, age=30)
println(a.copy(name = "Lee"))  // User(name=Lee, age=30)
```

일반 클래스의 `==` 는 `equals()` 를 부르고 `equals()` 의 기본 구현은 참조 비교입니다. data class 에서는 그 자리를 값 비교가 대신합니다.

## 대상은 주 생성자의 프로퍼티뿐입니다

생성되는 멤버는 주 생성자에 선언한 프로퍼티만 다룹니다. 클래스 본문에 선언한 프로퍼티는 `equals`, `hashCode`, `toString`, `componentN`, `copy` 어디에도 반영되지 않습니다.

```kotlin
data class User(val name: String, val age: Int) {
    var memo = ""
}

val a = User("Kim", 30).apply { memo = "A" }
val b = User("Kim", 30).apply { memo = "B" }
println(a == b)           // true
println(a)                // User(name=Kim, age=30)
println(a.copy().memo)    // "" (빈 문자열)
```

`memo` 가 달라도 두 객체는 같고 출력에도 나오지 않습니다. `copy()` 는 주 생성자를 다시 호출하므로 복사본의 `memo` 는 초기값으로 돌아갑니다. 비교에 들어가야 하는 값은 생성자로 옮기고 비교에서 빠져도 되는 부가 상태만 본문에 두는 방식으로 이 성질을 씁니다.

본문에 `equals`, `hashCode`, `toString` 을 직접 구현하면 컴파일러는 그 멤버를 생성하지 않고 작성한 구현을 씁니다. `componentN` 과 `copy` 는 직접 구현할 수 없어서 같은 시그니처를 선언하면 중복 선언으로 컴파일 오류가 납니다.

## copy 는 얕은 복사입니다

`copy()` 는 각 프로퍼티의 참조를 그대로 새 객체에 넘깁니다. 프로퍼티가 가변 컬렉션이면 원본과 복사본이 같은 컬렉션을 가리킵니다.

```kotlin
data class Team(val name: String, val members: MutableList<String>)

val t1 = Team("t", mutableListOf("a"))
val t2 = t1.copy(name = "u")
t2.members.add("b")
println(t1.members)                // [a, b]
println(t1.members === t2.members) // true
```

복사본에서 `members` 를 고쳤는데 원본에도 반영됩니다. 깊은 복사가 필요하면 `members = t1.members.toMutableList()` 처럼 바꿀 프로퍼티를 `copy()` 인자로 새로 만들어 넘겨야 합니다. 프로퍼티를 `List` 같은 읽기 전용 타입으로 선언하면 이런 실수가 줄어듭니다.

## 선언 규칙과 상속

data class 에는 몇 가지 선언 제약이 있습니다. 주 생성자에는 매개변수가 하나 이상 있어야 하고 모든 매개변수가 `val` 또는 `var` 여야 합니다. `abstract`, `open`, `sealed`, `inner` 한정자는 함께 쓸 수 없습니다.

```kotlin
data class C(x: Int)   // 컴파일 오류: 주 생성자에 val/var 가 아닌 매개변수
data class D()         // 컴파일 오류: 주 생성자 매개변수가 없음
open data class E(val x: Int)  // 컴파일 오류: open 과 data 는 함께 쓸 수 없음
```

data class 는 `open` 이 될 수 없으므로 다른 클래스가 data class 를 상속할 수 없습니다. 반대 방향은 열려 있어서 data class 가 인터페이스를 구현할 수 있고, Kotlin 1.1 부터는 다른 클래스를 상속하는 것도 가능합니다.

```kotlin
open class Base(val id: Int)
interface Named { val label: String }
data class Item(val x: Int, override val label: String) : Base(1), Named
```

이때도 생성되는 멤버는 `Item` 의 주 생성자 프로퍼티 기준이고 `Base.id` 는 들어가지 않습니다.

## 구조 분해와 순서 의존

`componentN()` 이 있으므로 변수 여러 개에 한 번에 풀어 넣을 수 있습니다.

```kotlin
val (name, age) = User("Kim", 30)

for ((key, value) in mapOf("k" to a)) println("$key $value")
```

분해는 이름을 보지 않고 위치로 짝을 맞춥니다. `data class P(val x: Int, val y: Int)` 의 프로퍼티 순서를 바꾸면 `val (x, y) = p` 는 컴파일 오류 없이 값이 뒤바뀐 채 동작합니다. 같은 타입이 이어지는 프로퍼티일수록 위험해서 분해를 많이 쓰는 클래스는 프로퍼티 순서를 바꿀 때 사용처를 함께 확인해야 합니다.

## 가능하면 val 로 둡니다

`var` 프로퍼티가 `hashCode()` 에 들어가면, 해시 컬렉션에 넣은 뒤 값을 바꾸는 순간 객체를 찾지 못하게 됩니다.

```kotlin
data class M(var x: Int)

val m = M(1)
val set = hashSetOf(m)
m.x = 2
println(set.contains(m))  // false
println(set.size)         // 1
```

원소는 그대로 남아 있지만 해시 값이 달라져 다른 버킷을 찾아가기 때문입니다. 값이 바뀔 때는 `copy()` 로 새 객체를 만드는 편이 이런 문제를 피하고 여러 곳에서 같은 객체를 공유해도 안전합니다. data class 를 `val` 프로퍼티만으로 선언하라는 관례는 여기서 나옵니다.

## JVM 레코드로 컴파일하기

Kotlin 1.5 부터 data class 에 `@JvmRecord` 를 붙이면 Java 의 `record` 로 컴파일됩니다.

```kotlin
@JvmRecord
data class Point(val x: Int, val y: Int)
```

JVM 타깃이 16 이상이어야 하고(15 는 `-Xjvm-enable-preview` 필요) 결과 클래스는 `java.lang.Record` 를 상속합니다. 접근자는 `getX()` 대신 레코드 규칙대로 `x()`, `y()` 로 노출되어 Java 쪽에서 레코드처럼 쓸 수 있습니다. 제약도 있어서 가변 프로퍼티(`var`)를 둘 수 없고 다른 클래스를 상속할 수 없으며(인터페이스 구현은 가능), 주 생성자 매개변수로 초기화되는 것 외에는 backing field 가 있는 프로퍼티를 본문에 선언할 수 없습니다. Java 레코드와 상호 운용이 필요한 경우가 아니면 붙이지 않아도 data class 로 충분합니다.

## 참고 자료

- Data classes — https://kotlinlang.org/docs/data-classes.html
- Using Java records in Kotlin — https://kotlinlang.org/docs/jvm-records.html
- What's new in Kotlin 1.1 — https://kotlinlang.org/docs/whatsnew11.html
- What's new in Kotlin 1.5.0 — https://kotlinlang.org/docs/whatsnew15.html
