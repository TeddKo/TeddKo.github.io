---
title: "해시 테이블이 O(1)인 이유와 깨지는 순간, 그리고 Kotlin HashMap 내부"
description: "해시 함수와 버킷, 체이닝과 선형 탐사의 충돌 처리, 로드 팩터와 리사이즈를 애니메이션으로 보고, JVM HashMap 의 기본 용량과 트리화 조건, equals/hashCode 계약까지 Kotlin 코드로 확인합니다."
pubDatetime: 2023-04-11T21:40:00+09:00
category: data-structure
tags:
  - 자료구조
  - 해시 테이블
  - Kotlin
---

`Map` 은 앱 코드에서 흔히 쓰는 컬렉션입니다. 화면 상태를 id 로 찾을 때도, 캐시를 키로 꺼낼 때도, 중복을 걸러 낼 때도 손에 잡히는 건 `Map` 이나 `Set` 입니다. 조회가 O(1) 이라는 설명은 어디서나 듣습니다. 다만 그 숫자가 어떤 가정 위에 서 있는지, 가정이 무너지면 무슨 일이 생기는지를 다룹니다. 해시 테이블을 밑바닥부터 따라가 본 다음 JVM 의 `HashMap` 이 같은 문제를 실제로 어떻게 푸는지 JDK 소스로 확인합니다.

## 키를 배열 칸 번호로 바꾸는 일

해시 테이블은 배열 하나로 시작합니다. 먼저 키를 정수로 바꿉니다(해시 함수). 그 정수를 배열 길이에 맞게 줄이면 칸 번호가 나오고 값은 그 칸에 들어갑니다. 이 칸을 버킷이라고 부릅니다. 조회도 같은 계산 한 번이면 곧바로 그 칸에 닿습니다. 처음부터 훑을 일이 없으니 O(1) 이 나옵니다.

JVM 에서 키를 정수로 바꾸는 일은 `hashCode()` 가 맡습니다. 예를 들어 `String` 은 각 문자에 31 을 곱해 가며 합치는 방식이라 `"ab"` 의 값은 `97 * 31 + 98 = 3105` 입니다.

```kotlin
println("ab".hashCode()) // 3105
```

`HashMap` 은 이 값을 그대로 쓰지 않습니다. 상위 16비트를 하위 16비트에 섞은 값(`h ^ (h >>> 16)`)에 `(용량 - 1) & 해시` 를 적용해 칸 번호를 구합니다. 용량이 항상 2 의 거듭제곱이라 나머지 연산 대신 비트 AND 한 번으로 끝납니다. 용량 16 에서 `"ab"` 는 1번 버킷으로 갑니다. 이 글의 애니메이션은 흐름이 먼저 보이도록 `hash mod capacity` 로 단순화했고 키도 해시 값이 자기 자신인 정수로 골랐습니다.

## 충돌은 반드시 생깁니다

키의 종류는 사실상 무한한데 버킷은 유한합니다. 서로 다른 키가 같은 칸으로 떨어지는 일은 피할 수 없습니다. 해시 테이블 구현이 서로 갈리는 지점도 대부분 이 충돌을 다루는 방식입니다. 대표적인 방법은 두 가지입니다.

### 체이닝

버킷 하나가 목록을 들고 있습니다. 같은 칸으로 온 키는 그 목록 뒤에 붙입니다. 아래 애니메이션은 버킷 8개에 `12, 5, 20, 13, 7, 28` 을 차례로 넣습니다. 12, 20, 28 은 모두 `mod 8 = 4` 라서 4번 버킷에 길이 3인 사슬이 생깁니다.

![체이닝 애니메이션: 키 12, 5, 20, 13, 7, 28 을 해시값 mod 8 번 버킷에 넣고 같은 버킷으로 온 키는 연결 리스트 뒤에 이어 붙인다](@/assets/images/hash-chaining.gif)

조회는 버킷을 찾은 뒤 사슬을 따라가며 `equals` 로 비교합니다. 28 을 찾으려면 12, 20 을 지나야 합니다. O(1) 은 사슬이 짧다는 전제를 깔고 나온 숫자입니다. 직접 짜 보면 코드는 이만큼 작습니다.

```kotlin
class ChainedMap<K, V>(private var capacity: Int = 8) {
    private class Node<K, V>(val key: K, var value: V)

    private var buckets = Array(capacity) { mutableListOf<Node<K, V>>() }
    var size = 0
        private set

    private fun index(key: K) = (key.hashCode() and Int.MAX_VALUE) % capacity

    fun put(key: K, value: V) {
        val bucket = buckets[index(key)]
        val hit = bucket.firstOrNull { it.key == key }
        if (hit != null) {
            hit.value = value
            return
        }
        bucket.add(Node(key, value))
        if (++size > capacity * 3 / 4) resize()
    }

    fun get(key: K): V? = buckets[index(key)].firstOrNull { it.key == key }?.value

    private fun resize() {
        val old = buckets
        capacity *= 2
        buckets = Array(capacity) { mutableListOf() }
        for (bucket in old) for (node in bucket) buckets[index(node.key)].add(node)
    }
}
```

`and Int.MAX_VALUE` 는 음수 해시 코드를 양수로 맞추려는 장치입니다. 삭제는 일부러 뺐습니다. 체이닝에서는 사슬에서 노드를 지우면 끝이라 어렵지 않습니다.

### 오픈 어드레싱과 선형 탐사

사슬 없이 배열 안에서 해결하는 방식도 있습니다. 목표한 칸이 차 있으면 다음 칸을 봅니다. 거기도 차 있으면 그다음 칸입니다. 선형 탐사는 이렇게 한 칸씩 이동하다가 배열 끝을 넘으면 처음으로 돌아갑니다.

같은 키로 돌려 보면 차이가 바로 드러납니다. 20 은 4번이 차 있어서 5번도 지나 6번에 들어갑니다. 13 은 5번에서 출발해 7번까지 가야 하고 7 은 제자리인 7번이 이미 차 있어서 끝을 넘어 0번으로 돌아갑니다. 마지막 28 은 4번에서 출발해 여섯 번을 확인하고서야 1번 칸을 찾습니다.

![선형 탐사 애니메이션: 키가 들어갈 칸이 차 있으면 다음 칸을 차례로 확인하다가 배열 끝을 넘으면 0번 칸으로 돌아가 빈 칸에 저장한다](@/assets/images/hash-probing.gif)

충돌한 키들이 이웃한 칸을 차지하면서 뭉치는 현상을 클러스터링이라고 합니다. 뭉침이 커질수록 새 키가 점점 더 긴 탐사를 하게 되는 악순환이라, 이 방식은 칸을 넉넉히 비워 두어야 빠릅니다. 삭제도 까다롭습니다. 칸을 그냥 비워 버리면 그 칸을 지나쳐 저장된 키의 탐사 경로가 끊기기 때문에, "지워짐" 표시(tombstone)를 남겨 두어야 합니다.

대신 노드 객체가 필요 없고 데이터가 배열에 붙어서 저장됩니다. JDK 에서는 `IdentityHashMap` 이 선형 탐사 방식입니다. 반면 `HashMap` 은 체이닝을 씁니다.

## 로드 팩터와 리사이즈

사슬이 길어지거나 칸이 뭉치지 않게 하려면 테이블이 너무 차지 않아야 합니다. 이 정도를 나타내는 값이 로드 팩터, 곧 `저장된 개수 / 버킷 수` 입니다. 기준을 넘으면 테이블을 더 큰 것으로 바꾸고 모든 키를 새 칸에 다시 배치합니다. 이 작업을 리사이즈, 또는 rehash 라고 합니다.

아래 애니메이션은 용량 4, 로드 팩터 0.75 인 테이블입니다. 개수가 3 을 넘으면 리사이즈하는 조건이라 네 번째 키 3 이 들어오는 순간 용량이 8 로 늘어납니다. 용량 4 에서는 8 과 12 가 같은 버킷에 있었는데, 용량 8 에서는 `8 mod 8 = 0`, `12 mod 8 = 4` 로 갈라집니다.

![리사이즈 애니메이션: 용량 4 테이블에 4개 키가 들어가 임계값 3 을 넘으면 용량 8 의 새 테이블을 만들고 키를 하나씩 다시 계산해서 옮긴다](@/assets/images/hash-resize.gif)

모든 키를 옮기니 리사이즈 한 번은 O(n) 입니다. 그래도 용량을 두 배씩 키우기 때문에 여러 번의 삽입에 나눠서 보면 한 번당 평균 O(1) 로 계산됩니다(분할 상환). 다만 리사이즈가 터지는 그 한 번의 삽입은 눈에 띄게 느립니다. 저장할 개수를 미리 안다면 처음부터 큰 용량으로 만드는 편이 낫습니다.

## 시간 복잡도

| 연산               | 평균        | 최악        |
| ------------------ | ----------- | ----------- |
| 삽입 · 조회 · 삭제 | O(1)        | O(n)        |
| 순회               | O(용량 + n) | O(용량 + n) |
| 공간               | O(n)        | O(n)        |

최악은 모든 키가 한 버킷에 몰린 경우입니다. 체이닝에서는 사슬 하나가 n 개로 늘어나고 선형 탐사에서는 거의 전 구간을 탐사하게 됩니다. 해시 함수가 고르게 퍼뜨리고 로드 팩터가 일정하게 유지된다는 가정이 있어야 평균 O(1) 입니다. 순회가 `O(n)` 이 아니라 `O(용량 + n)` 인 것은 빈 버킷도 지나가야 하기 때문입니다.

## JVM HashMap 은 이렇게 동작합니다

Kotlin/JVM 의 `HashMap` 은 `java.util.HashMap` 의 typealias 입니다. JDK 소스를 열어 보면 이렇습니다.

기본 용량은 16이고 로드 팩터는 0.75 라서 임계값은 12 입니다. 테이블은 생성자가 아니라 첫 `put` 때 만들어집니다. 개수를 하나 늘린 뒤 임계값을 넘으면(`++size > threshold`) 용량이 두 배가 되므로 열세 번째 키를 넣는 순간 32 로 커집니다. 이때 해시를 다시 계산하지는 않습니다. 노드에 저장해 둔 해시의 비트 하나(`hash & 옛 용량`)가 0 이면 제자리에 남고 1 이면 옛 용량만큼 뒤 칸으로 옮겨서 사슬을 둘로 나눕니다. 용량을 지정해 만들면(`HashMap<String, Int>(1000)`) 2 의 거듭제곱인 1024 로 올림합니다. 임계값은 그 0.75 배인 768 이라서, 1000 개를 리사이즈 없이 담으려면 개수 / 0.75 이상으로 잡아야 합니다. JDK 19 부터는 이 계산을 대신해 주는 `HashMap.newHashMap(n)` 도 있습니다.

JDK 8 부터는 충돌이 심한 버킷을 트리(레드-블랙 트리)로 바꿉니다. 소스 상수로는 `TREEIFY_THRESHOLD = 8`, `MIN_TREEIFY_CAPACITY = 64`, `UNTREEIFY_THRESHOLD = 6` 입니다. 풀어 쓰면 이미 노드 8개가 있는 버킷에 아홉 번째 노드가 붙는 시점에 트리화를 시도합니다. 이때 테이블 용량이 64 미만이면 트리로 바꾸는 대신 용량을 키워서 키들을 흩어 놓으려 합니다. 리사이즈로 트리가 쪼개져 노드가 6개 이하가 되면 다시 사슬로 돌아갑니다.

트리의 효과는 키 타입에 따라 갈립니다. 트리 안에서는 해시 값으로 먼저 순서를 잡습니다. 해시 값까지 같으면 키가 `Comparable` 일 때 비교 결과로 순서를 잡아 O(log n) 탐색이 됩니다. 해시 값이 같은데 `Comparable` 도 아닌 키들은 순서를 정할 근거가 없어서 트리 안에서도 양쪽 가지를 다 뒤져야 합니다. 해시 코드를 잘 퍼뜨리는 쪽이 첫째 방어선이고 트리화는 최악을 늦춰 주는 안전망입니다.

순회 순서는 버킷 순서라서 보장되는 것이 없습니다. 반면 `mutableMapOf()` 와 `mutableSetOf()` 는 `LinkedHashMap`, `LinkedHashSet` 을 돌려줍니다. 삽입 순서가 유지되는 쪽이 기본값입니다. 순서에 기대지 않을 거라면 `hashMapOf()` 로 명시해도 됩니다.

```kotlin
val a = mutableMapOf("b" to 1, "a" to 2)
val b = hashMapOf("b" to 1, "a" to 2)
println(a)                         // {b=1, a=2}
println(b)                         // {a=2, b=1}  버킷 순서, 보장 아님
println(a::class.java.simpleName)  // LinkedHashMap
```

`HashMap` 은 스레드 안전하지 않습니다. 여러 스레드가 함께 쓴다면 `ConcurrentHashMap` 을 써야 합니다.

## equals 와 hashCode 는 한 쌍입니다

`HashMap` 은 먼저 해시로 버킷을 고르고 그 안에서 `equals` 로 같은 키인지 확인합니다. 그래서 계약이 있습니다. `equals` 로 같은 두 객체는 `hashCode` 도 같아야 합니다. 반대는 요구하지 않습니다. 다른 객체끼리 해시가 같은 것은 그저 충돌입니다. 또한 `hashCode` 는 객체가 바뀌지 않는 동안 호출할 때마다 같은 값이어야 합니다.

기본 `Object` 구현은 참조 기준입니다. 값이 같아도 인스턴스가 다르면 다른 키입니다. data class 는 주 생성자 프로퍼티로 `equals`, `hashCode` 를 만들어 주니 값 기준 키가 필요할 때 가장 쉬운 선택입니다.

```kotlin
class PlainKey(val id: Int)
data class DataKey(val id: Int)

fun main() {
    val plain = hashMapOf(PlainKey(1) to "a")
    val data = hashMapOf(DataKey(1) to "a")
    println(plain[PlainKey(1)]) // null
    println(data[DataKey(1)])   // a
}
```

두 가지는 조심해야 합니다. 하나는 본문에 선언한 프로퍼티입니다. 주 생성자 밖의 프로퍼티는 생성된 `equals`/`hashCode` 에 들어가지 않습니다. 다른 하나는 `var` 키입니다. 키를 넣은 뒤에 해시에 영향을 주는 값을 바꾸면 맵은 그 키를 옛 버킷에 둔 채 모릅니다.

```kotlin
data class MutableKey(var id: Int)

fun main() {
    val key = MutableKey(1)
    val map = hashMapOf(key to "v")
    key.id = 2
    println(map[key])            // null  (id=2 의 버킷에는 없음)
    println(map[MutableKey(1)])  // null  (버킷은 맞지만 저장된 키가 이미 id=2)
    println(map.size)            // 1
}
```

값이 사라진 것은 아닌데 꺼낼 길이 없습니다. 키는 `val` 로 선언된 불변 값만 쓰는 편이 안전합니다.

## Android 의 ArrayMap 과 SparseArray

`android.util.ArrayMap` 은 해시 테이블이 아닙니다. 내부에는 정렬된 해시 코드 배열과 키·값 쌍을 담은 배열이 따로 있습니다. 조회는 해시 배열에서 이진 탐색으로 합니다. 항목마다 노드 객체를 만들지 않아 메모리는 아끼지만 삽입과 삭제는 배열을 밀어야 해서 느립니다. 문서도 수백 개 이하의 항목에 맞는 구조라고 설명합니다.

`SparseArray` 는 키가 `Int` 인 맵입니다. `Int` 를 `Integer` 로 박싱하지 않아도 되고, 해시 코드 대신 정렬된 키 배열 자체를 이진 탐색합니다. 두 클래스 모두 항목 수가 적을 때 `HashMap` 을 대신하는 선택지입니다. 수만 개를 담는 캐시라면 `HashMap` 이 맞습니다.

## 키 타입을 고르는 기준

앞에서 본 문제는 대부분 키에서 시작합니다. 키 타입이 `equals` 와 `hashCode` 를 쌍으로 구현했는지, 값이 바뀌지 않는지, 해시가 한쪽으로 쏠리지 않는지를 먼저 봅니다. 그다음에는 저장할 개수를 알면 초기 용량으로 리사이즈 횟수를 줄이고 순서가 필요하면 기본값인 `LinkedHashMap` 을 씁니다. 나머지는 `HashMap` 이 알아서 처리합니다.

## 참고 자료

- [HashMap (Java SE 17 API)](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/HashMap.html)
- [HashMap.java (OpenJDK jdk-17+35)](https://github.com/openjdk/jdk/blob/jdk-17%2B35/src/java.base/share/classes/java/util/HashMap.java)
- [IdentityHashMap (Java SE 17 API)](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/IdentityHashMap.html)
- [Object.hashCode / equals contract](<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Object.html#hashCode()>)
- [JEP 180: Handle Frequent HashMap Collisions with Balanced Trees](https://openjdk.org/jeps/180)
- [Kotlin mutableMapOf](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/mutable-map-of.html)
- [Kotlin data classes](https://kotlinlang.org/docs/data-classes.html)
- [ArrayMap](https://developer.android.com/reference/android/util/ArrayMap)
- [SparseArray](https://developer.android.com/reference/android/util/SparseArray)
