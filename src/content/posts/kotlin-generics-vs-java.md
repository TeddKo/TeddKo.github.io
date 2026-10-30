---
title: "Kotlin 제네릭과 Java 제네릭, 변성을 쓰는 위치가 다릅니다"
description: "Java 의 사용 지점 와일드카드(? extends, ? super)와 Kotlin 의 선언 지점 변성(out, in)을 PECS 와 대응해 비교하고 타입 프로젝션, 스타 프로젝션과 raw type, inline 과 reified, where 제약, List 와 MutableList 의 차이를 실행 결과와 함께 다룹니다."
pubDatetime: 2023-07-04T21:30:00+09:00
category: kotlin
tags:
  - Kotlin
  - Java
  - 제네릭
  - 변성
---

Kotlin 과 Java 의 제네릭은 둘 다 JVM 위에서 동작하므로 런타임에 타입 인자가 지워진다는 점은 같습니다. 달라지는 것은 `Dog` 가 `Animal` 의 하위 타입일 때 `List<Dog>` 를 `List<Animal>` 자리에 쓸 수 있는지 컴파일러에게 알려 주는 방법입니다. Java 는 쓰는 곳마다 와일드카드를 붙이고 Kotlin 은 타입을 선언하는 곳에서 한 번 정합니다.

## 타입 소거는 공통입니다

컴파일이 끝나면 `List<String>` 과 `List<Int>` 는 둘 다 `List` 가 됩니다. 그래서 런타임에 타입 인자를 묻는 검사는 두 언어 모두 허용되지 않습니다.

```kotlin
fun a(x: Any) = x is List<String>   // 컴파일 오류: 소거된 타입 인자는 검사할 수 없음
fun e(x: Any) = x is List<*>        // 가능
fun g(x: Any) { val l = x as List<String> }  // 컴파일은 되지만 unchecked cast 경고
```

```kotlin
println(ArrayList<String>()::class == ArrayList<Int>()::class)  // true
```

타입 인자를 모르는 상태에서 `x is List<*>` 로 껍데기만 확인하는 것이 가능한 최대치입니다.

## 기본값은 무공변입니다

`Cat` 이 `Animal` 의 하위 타입이어도 `MutableList<Cat>` 은 `MutableList<Animal>` 의 하위 타입이 아닙니다. 허용하면 고양이 목록에 다른 동물을 끼워 넣을 수 있기 때문입니다.

```kotlin
val cats = mutableListOf<Cat>()
val animals: MutableList<Animal> = cats  // 컴파일 오류: 타입 불일치
```

배열은 두 언어가 갈립니다. Java 배열은 공변이어서 `Animal[] a = new Cat[1]` 이 컴파일되고 잘못된 원소를 넣으면 런타임에 `ArrayStoreException` 이 납니다. Kotlin 의 `Array<T>` 는 무공변이라 같은 대입이 컴파일 단계에서 막힙니다.

## Java 는 사용 지점에서 와일드카드를 붙입니다

Java 에서 `List<Dog>` 를 받는 메서드를 만들려면 매개변수 타입에 와일드카드를 적어야 합니다. 읽기만 한다면 `? extends`, 쓰기만 한다면 `? super` 입니다.

```java
void printAll(List<? extends Animal> src) { /* Animal 로 꺼낼 수 있음, 넣을 수 없음 */ }
void addCats(List<? super Cat> dst)      { dst.add(new Cat()); /* 넣을 수 있음, 꺼내면 Object */ }
```

"생산자는 extends, 소비자는 super" 로 외우는 PECS(Producer Extends, Consumer Super) 가 이 규칙입니다. 값을 꺼내 오는 대상(매개변수로 받은 컬렉션)이 생산자이고 값을 넣어 주는 대상이 소비자입니다(Effective Java 3판 아이템 31). 이 와일드카드는 메서드마다 적어야 하고 라이브러리 설계자가 빠뜨리면 사용자가 고칠 방법이 없습니다.

## Kotlin 은 선언 지점에서 한 번 정합니다

Kotlin 은 타입 매개변수가 한 방향으로만 쓰이는 클래스라면 선언할 때 변성을 붙이게 합니다. 값을 꺼내기만 하면 `out`, 받기만 하면 `in` 입니다.

```kotlin
interface Producer<out T> { fun produce(): T }
interface Consumer<in T> { fun consume(item: T) }

val pc: Producer<Cat> = object : Producer<Cat> { override fun produce() = Cat("p") }
val pa: Producer<Animal> = pc          // 공변: Producer<Cat> 은 Producer<Animal> 의 하위 타입

val ca: Consumer<Animal> = object : Consumer<Animal> { override fun consume(item: Animal) = println(item.name) }
val cc: Consumer<Cat> = ca             // 반공변: Consumer<Animal> 이 Consumer<Cat> 의 하위 타입
```

`out` 은 Java 의 `? extends`, `in` 은 `? super` 에 대응합니다. `Producer<out T>` 로 선언한 이상 `T` 를 매개변수 위치에 쓰면 컴파일러가 막습니다.

```kotlin
interface Pr<out T> { fun put(t: T) }
// 컴파일 오류: out 으로 선언한 T 가 매개변수(in) 위치에 쓰임
```

![Producer 는 Producer<Cat> 을 Producer<Animal> 에 대입할 수 있고 Consumer 는 Consumer<Animal> 을 Consumer<Cat> 에 대입할 수 있으며 MutableList 는 대입할 수 없다는 세 가지 변성을 화살표로 비교한 그림](@/assets/images/kotlin-generics-variance.png)

표준 라이브러리도 이 방식으로 쓰였습니다. 읽기 전용인 `List<out E>`, `Set<out E>`, `Iterator<out T>` 는 공변이고 `Comparable<in T>` 는 반공변입니다. `Comparator<T>` 는 Java 인터페이스를 그대로 쓰므로 선언은 무공변이고, 표준 라이브러리는 `sortedWith(comparator: Comparator<in T>)` 처럼 쓰는 자리에서 `in` 을 붙입니다. `Map<K, out V>` 는 값 타입만 공변입니다. 읽고 쓰기를 모두 하는 `MutableList<E>` 는 무공변이라, `List<Cat>` 은 `List<Animal>` 자리에 들어가지만 `MutableList<Cat>` 은 들어가지 못합니다. 읽기 전용 인터페이스와 변경 가능한 인터페이스를 나눈 설계가 공변성을 허용하는 조건이 됩니다.

```kotlin
val ls: List<Cat> = listOf(Cat("a"))
val la: List<Animal> = ls   // 컴파일됨
```

## 사용 지점 변성

선언을 고칠 수 없는 클래스는 쓰는 자리에서 Java 와 비슷하게 변성을 붙입니다. 이를 타입 프로젝션이라고 부릅니다.

```kotlin
fun copyAll(from: Array<out Any>, to: Array<Any>) {
    for (i in from.indices) to[i] = from[i]
}
fun fill(dest: MutableList<in Cat>) { dest.add(Cat("c")) }
```

`Array<out Any>` 는 읽기만 가능한 투영이므로 `Array<Cat>` 을 넘길 수 있고 `MutableList<in Cat>` 은 쓰기에 맞춘 투영이라 `MutableList<Animal>` 도 받습니다. 선언 지점 변성이 불가능한 `Array` 와 `MutableList` 에 사용 지점 변성을 얹는 구조입니다.

## Java 에서 보이는 모습

Kotlin 에서 선언 지점 변성을 쓴 타입을 함수 매개변수로 받으면 컴파일된 시그니처에 Java 와일드카드가 자동으로 생깁니다. 아래 함수들을 컴파일해 `javap` 로 본 시그니처를 주석에 붙였습니다.

```kotlin
fun readAll(l: List<Number>) {}           // (Ljava/util/List<+Ljava/lang/Number;>;)V
fun fillAll(l: MutableList<Number>) {}    // (Ljava/util/List<Ljava/lang/Number;>;)V
fun cons(c: Consumer<Number>) {}          // (LConsumer<-Ljava/lang/Number;>;)V
fun giveBack(): List<Number> = emptyList() // ()Ljava/util/List<Ljava/lang/Number;>;
```

`List<Number>` 매개변수는 `List<? extends Number>` 로, `Consumer<Number>` 는 `Consumer<? super Number>` 로 나옵니다. 반환 타입에는 와일드카드가 붙지 않습니다. 반환값에 와일드카드를 붙이면 Java 호출자가 쓰기 불편해지기 때문입니다. 인자 타입이 `String` 처럼 `final` 이면 와일드카드가 생기지 않습니다. 이 동작을 바꾸려면 `@JvmWildcard` 와 `@JvmSuppressWildcards` 를 씁니다.

## 스타 프로젝션과 raw type

타입 인자를 모르거나 상관없을 때 Kotlin 은 `*` 를 씁니다. `List<*>` 는 `List<out Any?>` 와 같아서 꺼내면 `Any?` 입니다. `MutableList<*>` 에서는 읽기는 `Any?` 로 가능하지만 값을 넣는 호출은 막힙니다.

```kotlin
fun f(l: MutableList<*>) { l.add(1) }
// 컴파일 오류: 스타 프로젝션 때문에 add 를 호출할 수 없음
```

`null` 도 넣을 수 없습니다. 어떤 타입의 목록인지 모르므로 안전하게 넣을 수 있는 값이 없기 때문입니다. Java 의 `List<?>` 와 비슷한 역할이지만 Java 는 `null` 은 넣을 수 있다는 점이 다릅니다.

Java 에는 타입 인자를 아예 생략한 raw type(`List list`)이 있습니다. 제네릭이 생기기 전 코드와 호환하려고 남겨 둔 문법이고 경고를 내면서 컴파일됩니다. Kotlin 에는 raw type 이 없어서 타입 인자를 생략하면 오류입니다.

```kotlin
fun b(x: List) = 1   // 컴파일 오류: 타입 인자가 필요함
```

Java 의 raw type 을 Kotlin 에서 만나면 스타 프로젝션처럼 취급됩니다.

## inline 과 reified

제네릭 함수 안에서 `x is T` 를 쓰려면 타입 인자가 필요한데 소거되었으므로 컴파일되지 않습니다.

```kotlin
fun <T> f(x: Any) = x is T   // 컴파일 오류: 소거된 타입 T 는 검사할 수 없음
```

함수를 `inline` 으로 만들고 타입 매개변수에 `reified` 를 붙이면 호출 지점에 함수 본문이 복사되면서 구체적인 타입이 들어가므로 런타임 검사가 가능해집니다.

```kotlin
inline fun <reified T> isInstance(v: Any) = v is T
inline fun <reified T> List<*>.filterIsT(): List<T> = filter { it is T }.map { it as T }

println(isInstance<String>("s"))                  // true
println(listOf<Any>(1, "a", 2).filterIsT<Int>())  // [1, 2]
```

표준 라이브러리의 `filterIsInstance<T>()` 가 같은 원리입니다. `T::class` 도 `reified` 타입 매개변수에서만 쓸 수 있습니다. 반대로 `reified` 는 `inline` 함수에서만 선언할 수 있고 함수 본문이 호출 지점마다 복사되므로 호출이 많고 본문이 큰 함수에는 코드 크기 부담이 따릅니다.

## where 로 여러 상한을 겁니다

타입 매개변수의 상한이 하나면 `<T : Number>` 처럼 쓰고 둘 이상이면 `where` 절에 나열합니다.

```kotlin
fun <T> bound(x: T) where T : Comparable<T>, T : CharSequence = x.length

println(bound("abc"))  // 3
```

Java 에서는 `<T extends CharSequence & Comparable<T>>` 로 `&` 를 씁니다. 상한을 모두 만족해야 하므로 `T` 는 `Comparable` 의 멤버와 `CharSequence` 의 멤버를 함께 호출할 수 있습니다.

## 참고 자료

- Generics: in, out, where — https://kotlinlang.org/docs/generics.html
- Inline functions: reified type parameters — https://kotlinlang.org/docs/inline-functions.html#reified-type-parameters
- Calling Java from Kotlin — https://kotlinlang.org/docs/java-interop.html
- Calling Kotlin from Java (Variant generics) — https://kotlinlang.org/docs/java-to-kotlin-interop.html#variant-generics
- kotlin.Comparator API — https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-comparator/
- The Java Tutorials: Guidelines for Wildcard Use — https://docs.oracle.com/javase/tutorial/java/generics/wildcardGuidelines.html
- The Java Tutorials: Type Erasure — https://docs.oracle.com/javase/tutorial/java/generics/erasure.html
