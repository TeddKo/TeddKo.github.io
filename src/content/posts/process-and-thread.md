---
title: "프로세스와 스레드: 공유하는 자원, 따로 갖는 자원, 그리고 동기화"
description: "프로그램과 프로세스의 차이, PCB와 상태 전이, 스레드가 공유하는 자원과 개별로 갖는 자원, 컨텍스트 스위칭 비용, 경쟁 조건과 교착 상태의 조건을 그림과 애니메이션으로 보고 Android 앱 프로세스와 메인 스레드까지 연결합니다."
pubDatetime: 2023-01-17T21:20:00+09:00
category: cs
tags:
  - 운영체제
  - 프로세스
  - 스레드
  - 동기화
  - Android
---

디스크에 저장된 앱 파일과 화면에 떠 있는 앱은 같은 대상이 아닙니다. 앞의 것은 프로그램이고 뒤의 것은 프로세스입니다. 프로세스 안에서 코드를 실제로 실행하는 단위는 스레드입니다. Android 의 메인 스레드와 ANR 도 이 구분 위에서 설명됩니다.

## 프로그램, 프로세스, PCB

프로그램은 디스크에 저장된 명령어와 데이터의 묶음입니다. 실행 파일은 그 자체로 아무 일도 하지 않습니다. 운영체제가 이 파일을 메모리에 올리고 CPU 시간을 배정하면 실행 중인 인스턴스가 생기는데 이것이 프로세스입니다. 같은 프로그램을 두 번 실행하면 프로세스는 둘이며 각자 독립된 주소 공간을 가집니다.

운영체제는 프로세스마다 PCB(Process Control Block)라는 자료구조를 유지합니다. 프로세스 ID, 현재 상태, 프로그램 카운터와 레지스터 값, 스케줄링 우선순위, 메모리 관리 정보(페이지 테이블 위치 등), 열린 파일 목록이 여기에 담깁니다. Linux 에서는 `task_struct` 가 이 역할을 맡습니다. 프로세스가 CPU 를 내놓으면 레지스터와 프로그램 카운터가 PCB 에 저장됩니다. 다시 CPU 를 받으면 PCB 에서 복원됩니다. 이 저장과 복원이 컨텍스트 스위칭입니다.

## 프로세스 상태 전이

프로세스는 실행되는 동안 new, ready, running, waiting, terminated 상태를 오갑니다. `new` 는 생성 중인 상태이고 `ready` 는 CPU 만 받으면 바로 실행에 들어갈 수 있는 상태입니다. `running` 은 CPU 에서 실제로 돌고 있는 상태, `waiting`(blocked 라고도 부릅니다)은 I/O 완료 같은 이벤트를 기다리는 상태, `terminated` 는 실행을 마친 상태입니다.

![프로세스 상태 전이 애니메이션: new 에서 ready 로 들어간 프로세스가 dispatch 로 running 이 된 뒤 타임 슬라이스 종료로 ready 에 돌아가고 다시 running 이 되었다가 I/O 요청으로 waiting 에 갔다가 ready 를 거쳐 running 으로 복귀하고 terminated 로 끝난다](@/assets/images/process-state.gif)

스케줄러가 ready 큐에서 하나를 골라 running 으로 보내는 동작이 dispatch 입니다. 타임 슬라이스가 끝나면 타이머 인터럽트가 걸려 프로세스는 ready 로 돌아갑니다. 디스크 읽기 같은 I/O 를 요청하면 waiting 으로 이동합니다. I/O 가 끝나도 곧바로 running 이 되지는 않습니다. 반드시 ready 를 거쳐 스케줄러의 선택을 다시 기다립니다. 그림에 waiting 에서 running 으로 가는 화살표가 없는 것도 이 때문입니다. 논리 CPU(하드웨어 스레드) 하나에서 running 상태인 프로세스는 한 시점에 하나뿐입니다.

Linux 는 이 모델을 조금 다르게 구현합니다. ready 와 running 을 구분하지 않고 둘 다 `TASK_RUNNING`(`ps` 의 `R`)으로 표시합니다. waiting 은 신호로 깨울 수 있는 sleep(`S`)과 깨울 수 없는 sleep(`D`)으로 나뉩니다. 종료했지만 부모가 종료 상태를 아직 수거하지 않은 프로세스는 좀비(`Z`)로 남습니다.

## 스레드와 공유 자원

스레드는 프로세스 안에서 독립적으로 스케줄링되는 실행 흐름입니다. 같은 프로세스의 스레드는 코드, 전역 변수(데이터 영역), 힙, 열린 파일을 함께 쓰고 스택과 레지스터(프로그램 카운터 포함)는 각자 가집니다.

![같은 프로세스 안의 Thread 1 과 Thread 2 는 Code, Data/BSS, Heap, Open files 를 공유하고 Stack 과 Registers+PC 는 각각 따로 가진다. Process B 는 별도의 주소 공간에 모든 영역을 따로 가진다](@/assets/images/process-thread-memory.png)

스택이 따로 있어야 스레드마다 호출 경로와 지역 변수를 독립적으로 유지할 수 있습니다. 레지스터와 프로그램 카운터가 따로 있어야 실행을 중단했다가 같은 지점에서 이어갈 수 있습니다. 반대로 힙과 전역 변수는 공유되므로 한 스레드가 쓴 값을 다른 스레드가 바로 읽습니다. 프로세스 사이에는 이런 직접 접근이 없고 주소 공간이 분리되어 있어서 다른 프로세스의 메모리를 읽으려면 운영체제가 제공하는 통신 수단을 거쳐야 합니다.

Linux 커널에서 스레드는 별도 개념이 아니라 주소 공간을 공유하도록 만든 task 입니다. `clone()` 에 `CLONE_VM`, `CLONE_FILES` 같은 플래그를 주면 메모리와 파일 테이블을 공유하는 task 가 만들어집니다. pthread 는 이 방식 위에 구현됩니다.

## 컨텍스트 스위칭 비용

스위칭의 직접 비용은 레지스터 저장과 복원, 커널 진입, 다음 실행 대상을 고르는 스케줄러 실행입니다. 이 시간에는 사용자 코드가 하나도 실행되지 않으므로 순수한 오버헤드입니다. 간접 비용도 있습니다. 새로 실행되는 프로세스는 이전 프로세스가 채워 둔 CPU 캐시를 쓰지 못하고 자기 데이터를 다시 채워야 합니다.

프로세스 사이의 전환에는 비용이 하나 더 붙습니다. 주소 공간이 바뀌므로 페이지 테이블을 교체해야 합니다. 주소 변환 결과를 담아 둔 TLB 는 프로세스를 구분하는 태그(ASID, PCID 등)가 없으면 비워야 합니다. 같은 프로세스의 스레드끼리 전환할 때는 주소 공간이 그대로라 이 부분이 빠집니다. 스레드 전환이 일반적으로 더 가볍다고 설명하는 근거가 여기에 있습니다. 실제 시간은 CPU 와 운영체제에 따라 달라서 일반화된 수치는 없습니다.

## 멀티프로세스와 멀티스레드

프로세스를 나누면 메모리가 격리됩니다. 한 프로세스가 비정상 종료해도 다른 프로세스의 메모리는 영향을 받지 않습니다. 대신 데이터를 주고받으려면 파이프, 소켓, 공유 메모리, Android 의 Binder 같은 IPC 를 써야 합니다. 프로세스 생성과 전환의 비용도 큽니다. 스레드는 생성과 전환이 가볍고 같은 메모리를 직접 읽고 쓰니 데이터 공유가 간단합니다. 그만큼 한 스레드의 잘못된 메모리 접근이 프로세스 전체를 종료시킬 수 있습니다. 공유 데이터를 보호하는 동기화 코드도 직접 책임져야 합니다.

## 경쟁 조건

공유 데이터를 여러 스레드가 동시에 바꾸면 실행 순서에 따라 결과가 달라지는 경쟁 조건이 생깁니다. 가장 단순한 사례는 카운터 증가입니다.

```kotlin
import kotlin.concurrent.thread

var counter = 0

fun main() {
    val a = thread { repeat(100_000) { counter++ } }
    val b = thread { repeat(100_000) { counter++ } }
    a.join()
    b.join()
    println(counter) // 200000 이 아닐 수 있다
}
```

`counter++` 은 한 줄이지만 CPU 에서는 값을 읽고(LOAD), 1 을 더하고(ADD), 다시 쓰는(STORE) 세 단계입니다. 두 스레드가 이 단계를 교차하면 같은 값을 읽은 채로 각자 더해 한 번의 증가가 사라집니다.

![경쟁 조건 애니메이션: 스레드 A 와 B 가 모두 counter 0 을 읽은 뒤, A 가 1 을 저장하고 B 도 자기 레지스터의 1 을 저장해서 counter 가 2 가 아니라 1 로 남는 갱신 손실](@/assets/images/process-race-condition.gif)

위 코드를 실행하면 200000 보다 작은 값이 실행마다 다르게 출력됩니다. `AtomicInteger.incrementAndGet()` 으로 바꾸면 항상 200000 입니다.

공유 자원에 접근하는 코드 구간을 임계 구역(critical section)이라고 부릅니다. 임계 구역 보호가 올바르려면 상호 배제, 진행, 한정 대기 조건을 만족해야 합니다. 상호 배제는 한 번에 하나의 스레드만 들어간다는 조건입니다. 진행은 안이 비어 있고 대기자가 있으면 그중 하나가 결국 들어간다는 조건입니다. 한정 대기는 대기 중인 스레드가 무한정 기다리지 않는다는 조건입니다.

## 뮤텍스와 세마포어

뮤텍스는 임계 구역에 한 번에 하나의 스레드만 들어가게 하는 잠금입니다. 잠금을 건 스레드가 직접 풀어야 한다는 소유권 개념이 있습니다. JVM 에서는 `synchronized` 블록이나 `ReentrantLock` 이 이 역할을 합니다.

```kotlin
val lock = Any()
var counter = 0

fun increment() = synchronized(lock) { counter++ }
```

세마포어는 정수 값 하나와 두 연산으로 구성됩니다. `wait`(P)는 값이 0 이면 양수가 될 때까지 기다린 뒤 1 줄입니다. `signal`(V)은 값을 1 늘리면서 대기 중인 스레드를 깨웁니다. 초기값이 1 인 이진 세마포어는 뮤텍스와 비슷하게 쓰이지만 소유자가 없어서 다른 스레드가 `signal` 을 호출할 수 있어서 이벤트 알림에도 쓰입니다. 초기값이 n 이면 동시에 n 개까지만 들어가게 하는 카운팅 세마포어가 되어 커넥션 풀 같은 제한된 자원 관리에 맞습니다. 자바에서는 `java.util.concurrent.Semaphore` 가 있습니다.

## 교착 상태

잠금을 쓰기 시작하면 교착 상태(deadlock)가 따라옵니다. 둘 이상의 스레드가 서로가 가진 잠금을 기다리며 영원히 멈추는 상황입니다. 상호 배제, 점유와 대기, 비선점, 순환 대기의 네 조건이 동시에 성립할 때 발생할 수 있습니다. 상호 배제는 자원을 한 번에 한 스레드만 쓴다는 뜻입니다. 점유와 대기는 자원을 잡은 채 다른 자원을 기다리는 상태를 가리킵니다. 비선점은 잡힌 자원을 강제로 빼앗을 수 없다는 뜻이고 순환 대기는 기다리는 관계가 원형으로 이어진다는 뜻입니다.

```kotlin
import kotlin.concurrent.thread

val lockA = Any()
val lockB = Any()

thread { synchronized(lockA) { Thread.sleep(100); synchronized(lockB) { } } }
thread { synchronized(lockB) { Thread.sleep(100); synchronized(lockA) { } } }
```

첫 스레드는 A 를 잡은 채 B 를, 둘째 스레드는 B 를 잡은 채 A 를 기다리므로 네 조건이 모두 성립합니다. 하나만 깨면 교착 상태는 일어나지 않습니다. 실무에서 가장 흔한 방법은 모든 스레드가 잠금을 같은 순서로 획득하게 정해 순환 대기를 없애는 것입니다. 위 코드에서 두 스레드가 모두 A, B 순으로 잠그면 문제가 사라집니다. `tryLock` 을 쓰면 잠금을 얻지 못했을 때 이미 가진 잠금을 스스로 내려놓고 다시 시도할 수 있습니다. 자기 잠금을 스스로 선점당하게 만드는 셈이라 비선점 조건을 끊는 수단으로 분류됩니다. 이 방식은 재시도가 엇갈려 계속 반복되는 라이브락이 생길 수 있어 재시도 간격에 무작위 지연을 둡니다.

## Android 에서 보면

Android 앱은 기본적으로 자기만의 Linux 프로세스에서 고유한 사용자 ID 로 실행됩니다. 프로세스는 Zygote 라는 프로세스를 복제(fork)해서 만들어집니다. 한 앱의 Activity, Service 같은 컴포넌트는 기본적으로 같은 프로세스에서 돌아갑니다. 매니페스트의 `android:process` 속성으로 컴포넌트를 별도 프로세스에 둘 수 있습니다. 프로세스 경계를 넘는 호출은 Binder IPC 를 지납니다.

프로세스가 시작되면 메인 스레드(UI 스레드)가 하나 만들어집니다. 컴포넌트의 생명주기 콜백, 화면 그리기, 터치 같은 입력 이벤트 처리가 모두 이 스레드에서 돌아갑니다. 뷰는 UI 스레드에서만 건드릴 수 있어서 다른 스레드에서 접근하면 `CalledFromWrongThreadException` 이 발생합니다. 반대로 메인 스레드에서 오래 걸리는 일을 하면 이벤트 처리가 멈춥니다. 입력 이벤트에 5초 안에 응답하지 못하면 시스템이 ANR(Application Not Responding) 대화상자를 띄웁니다. 브로드캐스트 리시버와 서비스에도 각자 제한 시간이 있습니다. 메인 스레드에서 네트워크 요청을 보내면 `NetworkOnMainThreadException` 으로 막히는 것도 같은 맥락입니다.

그래서 디스크와 네트워크 작업은 별도 스레드나 `Dispatchers.IO` 같은 코루틴 디스패처에서 실행합니다. 결과를 화면에 반영하는 부분만 메인 스레드로 되돌립니다. 스레드를 여러 개 쓰는 순간 위에서 본 경쟁 조건과 교착 상태가 같은 방식으로 적용되므로 공유 상태에는 `synchronized`, `AtomicInteger`, 불변 객체 같은 보호 수단이 필요합니다.

## 참고 자료

- Operating Systems: Three Easy Pieces — The Abstraction: The Process — https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf
- OSTEP — Concurrency: An Introduction — https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf
- OSTEP — Semaphores — https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf
- OSTEP — Common Concurrency Problems — https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf
- ps(1) — https://man7.org/linux/man-pages/man1/ps.1.html
- clone(2) — https://man7.org/linux/man-pages/man2/clone.2.html
- Android — Application fundamentals — https://developer.android.com/guide/components/fundamentals
- Android — Processes and threads overview — https://developer.android.com/guide/components/processes-and-threads
- Android — ANRs — https://developer.android.com/topic/performance/vitals/anr
