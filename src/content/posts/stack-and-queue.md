---
title: "스택과 큐, 넣고 빼는 위치만 다른 두 구조와 원형 큐·덱 (Kotlin ArrayDeque)"
description: "LIFO 스택과 FIFO 큐의 동작을 애니메이션으로 보고, 배열과 연결 구조로 만드는 방법, 원형 큐의 head/tail 계산, 덱과 Kotlin ArrayDeque, java.util.Stack 을 피하는 이유와 괄호 검사·BFS·실행 취소 같은 쓰임까지 코드로 정리합니다."
pubDatetime: 2022-09-20T21:30:00+09:00
category: data-structure
tags:
  - 자료구조
  - 스택
  - 큐
  - Kotlin
---

배열이나 리스트는 어느 위치든 읽고 쓸 수 있습니다. 스택과 큐는 그 자유를 일부러 줄여 놓은 구조입니다. 원소를 넣는 자리와 꺼내는 자리를 정해 두면 "마지막에 넣은 것부터" 또는 "먼저 넣은 것부터"라는 순서가 규칙 하나로 보장됩니다. 코드는 짧은데 쓰이는 곳이 넓어서 괄호 짝 검사, 함수 호출 추적, 너비 우선 탐색, 작업 대기열이 모두 이 두 구조 위에 서 있습니다.

## 스택은 한쪽만 열려 있는 통입니다

스택(stack)은 맨 위로만 넣고 맨 위에서만 꺼냅니다. 가장 나중에 들어온 원소가 가장 먼저 나오므로 LIFO(Last In, First Out)라고 부릅니다. 접시를 쌓아 두고 위에서부터 집어 가는 모양과 같습니다. 필요한 연산은 세 가지입니다.

| 연산               | 하는 일                      |
| ------------------ | ---------------------------- |
| `push(x)`          | 맨 위에 x 를 올립니다        |
| `pop()`            | 맨 위 원소를 꺼내 돌려줍니다 |
| `peek()` / `top()` | 꺼내지 않고 맨 위만 봅니다   |

아래 애니메이션은 4, 7, 2 를 차례로 넣고 하나를 꺼낸 뒤 9 를 넣고, 다시 두 번 꺼내는 과정입니다. 접근할 수 있는 원소는 언제나 `top` 이 가리키는 하나뿐입니다. 7 을 꺼내려면 위에 있는 2 가 먼저 나가야 합니다.

![스택 애니메이션: 4, 7, 2 를 push 하고 pop 하면 2 가 나오고 9 를 push 한 뒤 pop 을 두 번 하면 9 와 7 이 차례로 나온다](@/assets/images/stack-push-pop.gif)

### 배열로 만들기

배열 하나와 정수 하나면 충분합니다. 정수 `size` 가 다음에 넣을 칸이자 원소 개수이고, 맨 위 원소는 `size - 1` 칸에 있습니다.

```kotlin
class ArrayStack<T>(capacity: Int) {
    private val items = arrayOfNulls<Any?>(capacity)
    var size = 0
        private set

    fun push(item: T) {
        check(size < items.size) { "stack is full" }
        items[size++] = item
    }

    @Suppress("UNCHECKED_CAST")
    fun pop(): T {
        check(size > 0) { "stack is empty" }
        val item = items[--size] as T
        items[size] = null
        return item
    }

    @Suppress("UNCHECKED_CAST")
    fun peek(): T {
        check(size > 0) { "stack is empty" }
        return items[size - 1] as T
    }
}
```

`pop` 에서 칸을 `null` 로 되돌리는 줄은 빼도 결과가 같습니다. 다만 빼면 꺼낸 객체를 배열이 계속 붙잡고 있어 가비지 컬렉터가 회수하지 못합니다. 세 연산은 모두 O(1) 입니다. 고정 크기 배열은 가득 차면 넣을 곳이 없으니 실제 라이브러리는 더 큰 배열로 옮겨 가며 용량을 늘리고 그 복사 비용을 여러 번의 `push` 에 나누어 셈하면 평균은 여전히 O(1) 입니다(분할 상환).

### 연결 구조로 만들기

연결 리스트의 맨 앞에 넣고 맨 앞에서 빼도 같은 일을 합니다. 노드를 만들어 `head` 가 가리키게 하면 `push`, `head` 를 다음 노드로 옮기면 `pop` 입니다. 용량 제한과 복사가 없는 대신 원소마다 노드 객체와 포인터 하나가 더 붙습니다. 메모리를 덜 쓰고 CPU 캐시에도 유리한 배열 기반이 보통 기본 선택입니다.

## 큐는 줄을 서는 구조입니다

큐(queue)는 한쪽으로 넣고 반대쪽에서 꺼냅니다. 먼저 들어온 원소가 먼저 나오므로 FIFO(First In, First Out)입니다. 넣는 쪽은 tail(rear), 꺼내는 쪽은 head(front)라 하고 연산 이름은 `enqueue`, `dequeue`, `peek` 입니다.

배열로 큐를 만들 때 처음 떠오르는 방식은 `dequeue` 마다 앞칸을 지우고 나머지를 한 칸씩 당기는 것입니다. 꺼낼 때마다 O(n) 이 듭니다. 당기지 않고 `head` 인덱스만 올리면 O(1) 이 되지만 앞쪽 칸은 영영 비고 `tail` 은 배열 끝에 닿아 버립니다. 원소는 몇 개 없는데 배열은 가득 찬 상태가 됩니다.

### 원형 큐

배열의 끝과 처음이 이어져 있다고 취급하면 이 문제가 사라집니다. 인덱스를 올릴 때 `(i + 1) % capacity` 로 계산하면 끝에 닿았을 때 0 으로 돌아갑니다. 아래 애니메이션은 용량 6 의 원형 큐입니다. A 부터 D 까지 넣고 두 개를 꺼낸 다음 E, F, G, H 를 넣는데 `tail` 이 5 에서 0 으로 넘어가면서 비어 있던 앞쪽 칸을 다시 씁니다.

![용량 6 원형 큐 애니메이션: A~D 를 enqueue 하고 dequeue 를 두 번 한 뒤 E~H 를 enqueue 하면 tail 이 5 에서 0 으로 돌아가고 마지막에는 6칸이 모두 차서 head 와 tail 이 같은 칸을 가리킨다](@/assets/images/queue-circular.gif)

마지막 장면에서 `head` 와 `tail` 이 모두 2 를 가리킵니다. 원소가 하나도 없는 처음 상태에서도 둘은 같은 칸에 있습니다. 두 포인터가 같다는 사실만으로는 비었는지 가득 찼는지 알 수 없습니다. 흔한 해결책은 두 가지입니다. 원소 개수 `size` 를 따로 두거나, 칸 하나를 항상 비워 두고 `(tail + 1) % capacity == head` 를 가득 찬 조건으로 삼습니다. 아래 코드는 앞의 방식을 따르며 `tail` 은 저장하지 않고 `(head + size) % capacity` 로 그때그때 계산합니다.

```kotlin
class CircularQueue<T>(capacity: Int) {
    private val items = arrayOfNulls<Any?>(capacity)
    private var head = 0
    var size = 0
        private set

    fun enqueue(item: T) {
        check(size < items.size) { "queue is full" }
        items[(head + size) % items.size] = item
        size++
    }

    @Suppress("UNCHECKED_CAST")
    fun dequeue(): T {
        check(size > 0) { "queue is empty" }
        val item = items[head] as T
        items[head] = null
        head = (head + 1) % items.size
        size--
        return item
    }
}
```

## 덱은 양쪽이 열려 있습니다

덱(deque, double-ended queue)은 앞과 뒤 양쪽에서 넣고 뺄 수 있습니다. 한쪽만 쓰면 스택처럼 동작하고 뒤로 넣고 앞에서 빼면 큐처럼 동작합니다. 스택과 큐를 모두 포괄하는 구조라서 Kotlin 표준 라이브러리처럼 스택·큐 전용 클래스 없이 덱 하나로 두 용도를 모두 처리하게 하는 경우가 많습니다.

Kotlin 표준 라이브러리의 `ArrayDeque` 가 그 구현입니다. 내부는 크기가 늘어나는 원형 배열이라 앞뒤 삽입과 삭제가 분할 상환 O(1) 이고 `MutableList` 이기도 해서 `deque[i]` 같은 인덱스 접근을 지원합니다.

```kotlin
val stack = ArrayDeque<Int>()
stack.addLast(1)
stack.addLast(2)
println(stack.removeLast()) // 2

val queue = ArrayDeque<Int>()
queue.addLast(1)
queue.addLast(2)
println(queue.removeFirst()) // 1
println(queue.removeFirstOrNull()) // 2
println(queue.removeFirstOrNull()) // null
```

비어 있을 때 `removeFirst()` 와 `removeLast()` 는 `NoSuchElementException` 을 던지고, `...OrNull()` 변형은 `null` 을 돌려줍니다. 이름이 같다고 `java.util.ArrayDeque` 와 같은 클래스는 아닙니다. 자바 쪽은 `null` 원소를 허용하지 않고 인덱스 접근도 없습니다. `import java.util.*` 같은 별표 import 가 있으면 기본 import 보다 우선하기 때문에 `ArrayDeque` 가 자바 쪽으로 해석됩니다. 파일 맨 위의 import 를 확인할 필요가 있습니다.

### java.util.Stack 은 피합니다

자바에는 이름 그대로 `java.util.Stack` 이 있지만 새 코드에는 권하지 않습니다. `Vector` 를 상속하기 때문입니다. `Vector` 는 JDK 1.0 부터 있던 동기화(synchronized) 리스트라서 한 스레드에서만 써도 잠금 비용을 냅니다. Javadoc 도 스레드 안전이 필요 없으면 `ArrayList` 를 쓰라고 권합니다. 더 큰 문제는 `Vector` 의 `add(0, x)`, `get(i)`, `remove(i)` 가 그대로 열려 있다는 점입니다. 스택이라는 이름을 달고 있어도 중간에 끼워 넣을 수 있으니 LIFO 규칙이 타입으로 지켜지지 않습니다. 순회도 맨 아래 원소부터 시작해서 보통 기대하는 "위에서부터"와 순서가 반대입니다. `Stack` 의 Javadoc 자체가 `Deque` 구현체를 대신 쓰라고 안내합니다. Kotlin 이라면 `ArrayDeque` 하나로 해결됩니다.

## 복잡도

| 구조 (배열 기반)  | 넣기 | 꺼내기 | 들여다보기 | 임의 탐색 |
| ----------------- | ---- | ------ | ---------- | --------- |
| 스택              | O(1) | O(1)   | O(1)       | O(n)      |
| 큐 (원형)         | O(1) | O(1)   | O(1)       | O(n)      |
| 덱 (`ArrayDeque`) | O(1) | O(1)   | O(1)       | O(n)      |

넣기는 용량이 늘어나는 구현이면 분할 상환 값이고 고정 용량이면 가득 찼을 때 실패합니다. 공간은 모두 O(n) 입니다.

## 괄호 검사

스택이 딱 맞는 문제가 괄호 짝 검사입니다. 여는 괄호는 쌓고 닫는 괄호를 만나면 맨 위와 짝이 맞는지 확인합니다. 안쪽 괄호일수록 먼저 닫혀야 하니 "나중에 열린 것부터 닫힌다"는 LIFO 와 규칙이 같습니다.

```kotlin
fun isBalanced(s: String): Boolean {
    val pairs = mapOf(')' to '(', ']' to '[', '}' to '{')
    val stack = ArrayDeque<Char>()
    for (ch in s) {
        when (ch) {
            '(', '[', '{' -> stack.addLast(ch)
            ')', ']', '}' -> if (stack.removeLastOrNull() != pairs[ch]) return false
        }
    }
    return stack.isEmpty()
}
```

`"{[()]}"` 는 `true` 를 돌려줍니다. `"([)]"` 는 `)` 를 만난 시점의 맨 위가 `[` 라서 `false` 입니다. 끝까지 읽었는데 스택에 여는 괄호가 남아 있어도 실패라서 마지막 줄의 `isEmpty()` 확인이 필요합니다.

## 호출 스택과 실행 취소

함수를 호출하면 반환 주소와 지역 변수를 담은 프레임이 스레드의 호출 스택에 쌓이고, 함수가 끝나면 맨 위 프레임이 사라집니다. 재귀가 너무 깊으면 이 스택이 한도를 넘어 `StackOverflowError` 가 납니다. 같은 일을 직접 만든 스택으로 처리하면 힙을 쓰므로 깊이 제한이 훨씬 느슨해지고 재귀를 반복문과 명시적 스택으로 바꾸는 기법이 여기서 나옵니다.

편집기의 실행 취소와 다시 실행은 스택 두 개로 만듭니다. 동작할 때마다 `undo` 스택에 쌓고 취소하면 `undo` 에서 꺼내 `redo` 스택으로 옮깁니다. 새 동작이 들어오면 `redo` 는 비웁니다. 되돌릴 대상이 항상 가장 최근 동작이라 스택의 순서와 맞아떨어집니다.

## 너비 우선 탐색

큐가 필요한 대표적인 알고리즘이 BFS 입니다. 시작점에 가까운 노드부터 방문해야 하므로 먼저 발견한 노드를 먼저 처리하는 FIFO 가 필수입니다. 이 자리에 스택을 놓으면 가장 최근에 발견한 노드를 먼저 파고드는 깊이 우선 탐색(DFS)이 됩니다. 두 알고리즘의 코드는 거의 같고 자료구조 하나만 다릅니다.

```kotlin
fun bfs(graph: Map<Int, List<Int>>, start: Int): List<Int> {
    val order = mutableListOf<Int>()
    val seen = mutableSetOf(start)
    val queue = ArrayDeque(listOf(start))
    while (queue.isNotEmpty()) {
        val node = queue.removeFirst()
        order += node
        for (next in graph[node].orEmpty()) {
            if (seen.add(next)) queue.addLast(next)
        }
    }
    return order
}
```

간선이 `1 -> 2, 3`, `2 -> 4`, `3 -> 4` 인 그래프에서 1 부터 시작하면 방문 순서는 `[1, 2, 3, 4]` 입니다. 큐에 넣는 시점에 `seen` 에 기록하므로 4 는 한 번만 들어갑니다.

## 참고 자료

- Java SE 17 API — ArrayDeque — https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/ArrayDeque.html
- Java SE 17 API — Stack — https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Stack.html
- Java SE 17 API — Vector — https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Vector.html
- Kotlin API — kotlin.collections.ArrayDeque — https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/-array-deque/
- Kotlin 언어 명세 — Packages and imports — https://kotlinlang.org/spec/packages-and-imports.html
- Kotlin 언어 명세 — Overload resolution — https://kotlinlang.org/spec/overload-resolution.html
- Cormen 외, _Introduction to Algorithms_ 4판, 10.1절 (Stacks and queues)
