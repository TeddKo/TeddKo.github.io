---
title: "연결 리스트, 포인터 두 개로 끼워 넣는 구조와 뒤집기·사이클 탐지 (Kotlin)"
description: "노드와 포인터로 이어 붙이는 단일·이중·원형 연결 리스트를 애니메이션으로 보고, 삽입·삭제·탐색 복잡도와 배열과의 차이(캐시 지역성 포함), java.util.LinkedList 의 특성, 리스트 뒤집기와 Floyd 사이클 탐지를 Kotlin 코드로 정리합니다."
pubDatetime: 2023-08-29T22:00:00+09:00
category: data-structure
tags:
  - 자료구조
  - 연결 리스트
  - Kotlin
---

배열은 원소를 메모리에 나란히 놓고 번호로 찾아갑니다. 연결 리스트는 원소를 아무 데나 두고 각 원소가 다음 원소의 위치를 들고 있게 합니다. 번호로 바로 건너뛰는 능력을 내주는 대신, 중간에 끼워 넣거나 빼는 일이 이웃한 두세 개의 참조를 고치는 작업으로 줄어듭니다. 이 거래가 언제 이득이고 언제 손해인지 따져 보는 것이 연결 리스트를 이해하는 출발점입니다. [스택과 큐](/posts/stack-and-queue/)를 연결 구조로 만들 때도 같은 원리가 쓰입니다.

## 노드는 값과 다음 노드의 참조입니다

연결 리스트의 단위는 노드입니다. 노드 하나에 값과 다음 노드를 가리키는 참조(포인터)가 들어 있고 리스트 전체는 첫 노드를 가리키는 `head` 하나로 대표됩니다. 마지막 노드의 `next` 는 `null` 이며 리스트가 여기서 끝난다는 표시입니다.

```kotlin
class Node<T>(val value: T, var next: Node<T>? = null)
```

원소에 닿으려면 `head` 에서 출발해 `next` 를 따라가는 수밖에 없습니다. 인덱스 3 번 원소가 필요하면 세 번 따라가야 합니다. 배열은 `base + 3 * 원소크기` 라는 계산 한 번으로 끝나는 일입니다.

## 단일, 이중, 원형

노드가 `next` 만 가지면 단일 연결 리스트입니다. 한 방향으로만 걸을 수 있어서 어떤 노드를 지우려면 바로 앞 노드가 필요하고 그 앞 노드는 처음부터 걸어야 찾을 수 있습니다. 노드에 `prev` 를 하나 더 달면 이중 연결 리스트가 됩니다. 앞뒤로 모두 걸을 수 있고 노드 하나만 손에 있으면 앞 노드를 찾으러 걸을 필요도 없습니다. 대신 노드마다 참조가 하나씩 늘고 갱신할 포인터도 두 배가 됩니다.

```kotlin
class DNode<T>(val value: T) {
    var prev: DNode<T>? = null
    var next: DNode<T>? = null
}

fun <T> unlink(node: DNode<T>) {
    node.prev?.next = node.next
    node.next?.prev = node.prev
}
```

`unlink` 는 노드 자신만 받고도 상수 시간에 빠집니다. 양 끝 노드는 한쪽 이웃이 `null` 이지만 안전 호출(`?.`)이 그 경우를 알아서 건너뜁니다. `head` 와 `tail` 포인터를 갱신하는 코드는 따로 필요합니다.

원형 연결 리스트에서는 마지막 노드의 `next` 가 첫 노드를 가리킵니다. 끝이 없으니 순서대로 계속 돌아야 하는 곳에 어울립니다. 여러 작업에 차례로 시간을 나눠 주는 라운드 로빈 스케줄링이나, 한 칸씩 건너뛰며 제거하는 요세푸스 문제가 전형적인 예입니다. 순회할 때는 `null` 대신 시작 노드로 돌아왔는지를 종료 조건으로 삼아야 하고 이 조건을 빠뜨리면 무한 루프에 빠집니다.

이중 연결 리스트를 직접 구현하다 보면 양 끝의 `null` 처리가 분기를 늘립니다. 값이 없는 더미 노드(센티널)를 앞뒤에 하나씩 두면 모든 실제 노드가 양쪽 이웃을 갖게 되어 이 분기가 없어집니다. `java.util.LinkedList` 는 센티널 없이 `first`, `last` 필드로 양 끝을 관리하고 센티널은 직접 만들 때 고를 수 있는 선택지로 남습니다.

## 삽입은 포인터 두 개를 고치는 일입니다

중간 삽입은 배열과 가장 크게 갈리는 지점입니다. 배열은 삽입 위치 뒤의 원소를 모두 한 칸씩 밀어야 하지만 연결 리스트는 새 노드를 만들고 이웃 두 곳의 참조만 바꿉니다. 아래 애니메이션은 `10 → 20 → 40` 에서 20 뒤에 30 을 넣는 과정입니다.

![연결 리스트 중간 삽입 애니메이션: 새 노드 30 을 만들고 30 의 next 를 40 으로 연결한 뒤 20 의 next 를 30 으로 바꾸면 10, 20, 30, 40 순서가 된다](@/assets/images/linked-list-insert.gif)

순서를 지켜야 합니다. 먼저 `new.next = prev.next` 로 새 노드가 뒤쪽 노드를 붙잡게 하고, 그다음에 `prev.next = new` 로 앞쪽을 바꿉니다. 순서를 뒤집어 `prev.next = new` 를 먼저 실행하면 40 으로 가는 유일한 경로가 끊겨서 40 이후의 노드가 리스트에서 떨어져 나갑니다.

```kotlin
class SinglyLinkedList<T> {
    var head: Node<T>? = null
        private set
    var size = 0
        private set

    fun addFirst(value: T) {
        head = Node(value, head)
        size++
    }

    fun insertAfter(prev: Node<T>, value: T) {
        prev.next = Node(value, prev.next)
        size++
    }

    fun removeFirst(): T {
        val node = head ?: throw NoSuchElementException("list is empty")
        head = node.next
        size--
        return node.value
    }

    fun removeAfter(prev: Node<T>): T? {
        val target = prev.next ?: return null
        prev.next = target.next
        size--
        return target.value
    }

    fun find(value: T): Node<T>? {
        var cur = head
        while (cur != null && cur.value != value) cur = cur.next
        return cur
    }
}
```

`insertAfter` 의 한 줄에 위 두 단계가 모두 들어 있습니다. `Node(value, prev.next)` 에서 생성자 인자 `prev.next` 가 먼저 평가되어 새 노드가 기존 뒤쪽 노드를 잡고 그 결과가 `prev.next` 에 대입됩니다. 삭제는 반대로 `prev.next = target.next` 한 줄로 대상을 건너뜁니다. 더는 참조가 이어지지 않는 노드는 가비지 컬렉터가 회수합니다.

시간 복잡도에는 단서가 붙습니다. "O(1) 삽입"은 삽입 위치의 앞 노드를 이미 손에 들고 있을 때의 이야기입니다. 값이 30 인 자리를 찾아 그 뒤에 넣으려면 `find` 로 걸어가는 O(n) 이 먼저 듭니다. 연결 리스트가 빠른 경우는 위치를 이미 알고 있는 상황, 곧 맨 앞이거나 순회하던 도중의 현재 위치이거나 이중 연결 리스트에서 노드를 손에 든 상황으로 한정됩니다.

## 배열과 비교

| 연산                     | 배열 (`ArrayList`) | 단일 연결 리스트          | 이중 연결 리스트 |
| ------------------------ | ------------------ | ------------------------- | ---------------- |
| 인덱스로 읽기            | O(1)               | O(n)                      | O(n)             |
| 값으로 찾기              | O(n)               | O(n)                      | O(n)             |
| 맨 앞에 넣기·빼기        | O(n)               | O(1)                      | O(1)             |
| 맨 뒤에 넣기             | 분할 상환 O(1)     | O(n), tail 이 있으면 O(1) | O(1)             |
| 맨 뒤에서 빼기           | O(1)               | O(n)                      | O(1)             |
| 손에 든 위치에 넣기·빼기 | O(n)               | 앞 노드가 있으면 O(1)     | O(1)             |

표만 보면 삽입과 삭제에서는 연결 리스트가 이기는 것처럼 보입니다. 실제 속도는 점근 표기에 가려진 상수에서 갈리는 일이 많고 그 상수를 좌우하는 것이 메모리 접근 방식입니다. 배열은 원소가 연속된 주소에 있어서 한 칸을 읽으면 주변이 CPU 캐시 라인과 함께 올라오고 순차 접근 패턴은 하드웨어 프리페처가 미리 가져오기도 합니다. 연결 리스트의 노드는 각자 따로 할당된 객체입니다. 다음 노드의 위치는 현재 노드를 읽어 봐야 알고 노드들이 힙 곳곳에 흩어져 있으면 캐시 미스가 원소마다 날 수 있습니다. 같은 O(n) 순회에서 배열이 몇 배 빠른 경우가 많은 까닭입니다.

메모리 사용량도 차이가 납니다. 노드 하나는 객체 헤더에 값 참조와 `next`(이중이면 `prev` 까지)가 붙고 값이 `Int` 같은 기본형이면 박싱된 객체가 따로 하나 더 있습니다. 중간 삽입이 잦아서 얻는 이득이 이 비용을 넘어서는 워크로드는 많지 않아서 기본 선택은 대개 배열 기반 리스트입니다.

## java.util.LinkedList

JVM 에서 쓸 수 있는 연결 리스트는 `java.util.LinkedList` 입니다. 이중 연결 리스트이고 `List` 와 `Deque` 를 함께 구현해서 인덱스 접근도, 양 끝 삽입·삭제도 됩니다. `null` 을 허용하고 동기화는 되어 있지 않습니다. `get(i)` 는 O(n) 입니다. `i` 가 앞쪽 절반이면 `first` 쪽에서, 뒤쪽 절반이면 `last` 쪽에서 걸어가기 때문에 가운데 인덱스가 가장 느립니다.

흔한 함정은 인덱스 루프입니다. `for (i in list.indices) list[i]` 는 `get(i)` 가 매번 걷느라 전체가 O(n²) 으로 늘어납니다. 순회하며 원소를 지울 때는 반복자의 `remove()` 를 쓰면 현재 위치에서 O(1) 로 끝납니다.

```kotlin
import java.util.LinkedList

val list = LinkedList(listOf(0, 1, 2, 3, 4))
val iter = list.listIterator()
while (iter.hasNext()) {
    if (iter.next() % 2 == 0) iter.remove()
}
println(list) // [1, 3]
```

큐나 스택 용도라면 `ArrayDeque` 가 일반적으로 낫습니다. `java.util.ArrayDeque` 의 Javadoc 도 스택으로 쓸 때는 `Stack` 보다, 큐로 쓸 때는 `LinkedList` 보다 빠를 가능성이 높다고 적습니다. Javadoc 이 이유를 밝히지는 않지만, 원소마다 노드를 할당하지 않고 연속된 배열을 쓰니 캐시에 유리하다는 점이 큽니다. `LinkedList` 가 의미를 갖는 자리는 반복자로 순회하면서 중간 삽입과 삭제를 하는 경우처럼 좁습니다.

## 리스트 뒤집기

연결 리스트 문제 가운데 자주 나오는 것이 제자리 뒤집기입니다. 노드를 새로 만들지 않고 각 `next` 의 방향만 돌립니다. 포인터 세 개가 필요합니다. `prev` 는 이미 뒤집은 부분의 맨 앞, `curr` 는 지금 처리할 노드, `next` 는 `curr.next` 를 덮어쓰기 전에 잠깐 저장해 두는 자리입니다.

![연결 리스트 뒤집기 애니메이션: prev, curr, next 포인터로 1, 2, 3, 4 노드의 화살표 방향을 하나씩 반대로 돌리고 마지막에 head 가 노드 4 로 옮겨 간다](@/assets/images/linked-list-reverse.gif)

한 바퀴마다 `next` 를 저장하고, `curr.next = prev` 로 화살표를 돌리고, `prev` 와 `curr` 를 한 칸 전진시킵니다. `curr` 가 `null` 이 되면 `prev` 가 새 `head` 입니다. 이 문제의 요점은 `next` 를 저장하는 순서에 있습니다. 저장 없이 `curr.next` 를 먼저 덮어쓰면 뒤쪽 리스트로 가는 길을 잃습니다.

```kotlin
fun <T> reverse(head: Node<T>?): Node<T>? {
    var prev: Node<T>? = null
    var cur = head
    while (cur != null) {
        val next = cur.next
        cur.next = prev
        prev = cur
        cur = next
    }
    return prev
}
```

시간은 O(n), 추가 공간은 포인터 몇 개뿐이라 O(1) 입니다.

## 사이클 탐지와 러너 기법

리스트의 어느 노드가 앞쪽 노드를 다시 가리키면 `null` 에 닿지 못해서 순회가 끝나지 않습니다. 방문한 노드를 집합에 모아 두면 찾을 수 있지만 O(n) 공간이 듭니다. Floyd 의 토끼와 거북이 알고리즘(러너 기법)은 포인터 두 개로 공간을 O(1) 로 줄입니다. 하나는 한 칸씩(slow), 하나는 두 칸씩(fast) 움직입니다. 사이클이 없으면 fast 가 먼저 `null` 에 닿아 끝납니다. 사이클이 있으면 둘 다 결국 사이클 안으로 들어가고 그 안에서는 라운드마다 fast 가 slow 와의 간격을 1 씩 좁히므로 반드시 만납니다.

![연결 리스트 사이클 탐지 애니메이션: 노드 8 이 노드 3 으로 되돌아가는 리스트에서 slow 는 한 칸씩, fast 는 두 칸씩 움직이다가 6번째 라운드에 노드 7 에서 만난다](@/assets/images/linked-list-cycle.gif)

꼬리 구간이 2 개(노드 1, 2)이고 사이클이 6 개(노드 3~8)인 이 예에서 둘은 6번째 라운드에 노드 7 에서 만납니다.

```kotlin
fun <T> hasCycle(head: Node<T>?): Boolean {
    var slow = head
    var fast = head
    while (fast != null) {
        slow = slow?.next
        fast = fast.next?.next
        if (slow === fast && fast != null) return true
    }
    return false
}
```

비교에는 `==` 가 아닌 `===` 를 씁니다. 값이 같은 서로 다른 노드가 있을 수 있으니 같은 객체인지를 봐야 합니다.

만난 지점에서 한 포인터를 `head` 로 돌려보내고 둘을 모두 한 칸씩 움직이면 사이클이 시작되는 노드에서 다시 만납니다. 출발점에서 사이클 입구까지의 거리를 `a`, 입구에서 만난 지점까지를 `b`, 사이클 길이를 `L` 이라 하면 slow 는 사이클을 한 바퀴 다 돌기 전에 따라잡히므로 `b < L` 입니다. slow 가 간 거리는 `a + b` 이고 fast 는 그 두 배입니다. 둘의 차가 사이클을 정수 바퀴 돈 만큼이라 `a + b` 는 `L` 의 배수이고 그러니 만난 지점에서 `a` 칸을 더 가면 입구에 닿습니다. 위 예에서는 `a = 2`, `b = 4`, `L = 6` 입니다. 같은 러너 기법으로 한 칸씩, 두 칸씩 움직이다가 fast 가 끝에 닿았을 때의 slow 를 보면 리스트의 중간 노드도 찾을 수 있습니다.

## 참고 자료

- Java SE 17 API — LinkedList — https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/LinkedList.html
- Java SE 17 API — ArrayDeque — https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/ArrayDeque.html
- OpenJDK 17 소스 — LinkedList.java — https://github.com/openjdk/jdk17u/blob/master/src/java.base/share/classes/java/util/LinkedList.java
- VisuAlgo — Cycle-Finding (Floyd) — https://visualgo.net/en/cyclefinding
- Donald E. Knuth, _The Art of Computer Programming_ Vol. 2, 3.1절 연습문제 6
- Cormen 외, _Introduction to Algorithms_ 4판, 10.2절 (Linked lists)
