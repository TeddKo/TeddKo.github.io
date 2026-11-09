---
title: "Docker 는 가벼운 VM 이 아니라 격리된 프로세스입니다"
description: "컨테이너가 namespace 와 cgroup 위에서 어떻게 동작하는지, 이미지 레이어와 overlayfs, Dockerfile 작성 요령, Docker Engine 에서 containerd 와 runc 로 이어지는 구조, Compose, Docker Desktop 라이선스와 대안, Apple silicon 멀티 아키텍처 빌드, Spring Boot 멀티 스테이지 예제까지 정리했습니다."
pubDatetime: 2026-11-09T10:34:00+09:00
category: server
tags:
  - Docker
  - 컨테이너
  - DevOps
  - 배포
  - OCI
---

Android 개발만 하다가 서버 쪽 일을 같이 보기 시작하면 Docker 는 어느새 매일 쓰는 도구가 됩니다. 그런데 "가벼운 VM"이라는 설명으로 시작하면 이상한 지점에서 막힙니다. 컨테이너 안에서 `ps` 를 쳤는데 프로세스가 몇 개 안 보이는 이유, 메모리 제한을 걸었더니 앱이 조용히 죽는 이유, Mac 에서 만든 이미지가 서버에서 안 도는 이유가 모두 그 설명으로는 풀리지 않습니다. 컨테이너는 **호스트 커널 위에서 도는 평범한 프로세스에 격리 옵션을 붙인 것**입니다. 이 글에서는 그 구조를 먼저 보고, Dockerfile 과 Compose, 그리고 Kotlin/Spring Boot 앱을 올리는 예제까지 이어서 적었습니다.

## 컨테이너는 프로세스입니다

[프로세스와 스레드](/posts/process-and-thread/)에서 다룬 그 프로세스입니다. 컨테이너 안의 앱은 호스트 커널이 스케줄링하는 일반 프로세스이고, 다른 점은 커널이 그 프로세스에게 **보이는 세계를 제한**한다는 것입니다. 이를 가능하게 하는 리눅스 기능이 두 가지입니다.

- **namespace**: 프로세스가 볼 수 있는 자원의 범위를 나눕니다. 리눅스 man page 기준으로 mount(파일시스템 마운트 지점), PID(프로세스 ID), network(네트워크 장치와 포트), IPC, UTS(호스트명), user(UID/GID), cgroup, time 이 있습니다. 컨테이너 안에서 내 앱이 PID 1 로 보이는 것은 PID namespace 때문이고, 컨테이너마다 자기만의 `eth0` 와 포트 공간을 갖는 것은 network namespace 덕분입니다.
- **cgroup**: 쓸 수 있는 양을 제한합니다. `docker run --memory=512m --cpus=1.5` 같은 옵션은 호스트에 있는 그 컨테이너의 cgroup 값을 고치는 것입니다.

![왼쪽은 VM 마다 게스트 OS 와 커널을 갖는 하이퍼바이저 구조, 오른쪽은 하나의 호스트 커널을 공유하는 컨테이너 구조이고, 아래쪽은 docker CLI 에서 dockerd, containerd, runc 를 거쳐 컨테이너가 만들어지는 흐름과 이미지 레이어가 overlayfs 로 합쳐지는 모습입니다.](@/assets/images/docker-architecture.png)

VM 은 하이퍼바이저가 하드웨어를 가상화하고 그 위에 게스트 OS 를 통째로 올립니다. 컨테이너에는 게스트 커널이 없습니다. 그래서 가볍고 빨리 뜨지만, 대가도 분명합니다. **커널이 하나라서 격리 경계가 VM 보다 얇습니다.** 커널 취약점은 모든 컨테이너에 걸치고, 리눅스용 이미지는 리눅스 커널 위에서만 돕니다. Mac 이나 Windows 에서 Docker 를 쓸 때 내부에 리눅스 VM 이 하나 떠 있는 이유가 이것입니다.

메모리 제한은 한 가지 더 알아 둘 만합니다. Docker 문서에 따르면 커널이 메모리가 부족하다고 판단하면 OOM 상태에 들어가 프로세스를 죽이기 시작하고, Docker 는 데몬의 OOM 우선순위는 낮춰도 컨테이너의 우선순위는 낮추지 않습니다. 호스트가 빠듯하면 컨테이너가 먼저 죽을 수 있다는 뜻입니다. JVM 앱이라면 컨테이너 메모리 제한과 힙 설정을 같이 보셔야 합니다. 서버 앞단 구성이 궁금하시면 [WEB, WAS, API 서버](/posts/ws-was-api-server/)에서 정리한 구조 위에 컨테이너가 얹힌다고 보시면 됩니다. 메모리 격리 쪽 개념은 [가상 메모리와 페이징](/posts/virtual-memory-and-paging/)이 배경 지식이 됩니다.

## 이미지는 레이어, 컨테이너는 그 위의 얇은 쓰기 층

이미지는 읽기 전용 레이어를 쌓은 것입니다. Dockerfile 에서 파일 시스템을 바꾸는 명령(`RUN`, `COPY`, `ADD`)이 대체로 레이어 하나를 만들고, 이 레이어들은 이미지끼리 공유됩니다. 같은 베이스 이미지를 쓰는 앱 열 개를 받아도 베이스 레이어는 한 번만 저장됩니다.

컨테이너를 띄우면 그 위에 쓰기 가능한 레이어 하나가 붙습니다. 이걸 합쳐 하나의 루트 파일시스템처럼 보여 주는 것이 **overlayfs** 같은 union 파일시스템입니다. Docker 문서의 설명을 옮기면, 읽기 전용인 `lowerdir` 에 이미지 레이어가 있고, 쓰기 가능한 `upperdir` 에 컨테이너의 변경이 쌓이고, 둘을 합친 `merged` 가 컨테이너의 마운트 지점입니다. 파일을 처음 수정하면 lower 의 파일이 통째로 upper 로 복사된 뒤 수정됩니다(copy-on-write). 삭제는 실제로 지우는 게 아니라 upper 에 가림 표시(whiteout)를 남깁니다.

실무에서 이 구조가 중요한 순간이 두 번 있습니다. 하나는 **컨테이너가 사라지면 upper 도 사라진다**는 것입니다. DB 파일처럼 남겨야 하는 데이터는 볼륨에 둬야 합니다. 다른 하나는 레이어가 한 번 쌓이면 뒤에서 지워도 크기가 줄지 않는다는 것입니다. 한 `RUN` 에서 받은 파일을 다음 `RUN` 에서 지우면 앞 레이어에는 여전히 파일이 있습니다. 멀티 스테이지 빌드가 나온 이유가 이쪽입니다.

## Dockerfile 에서 손에 익혀 둘 것들

Docker 공식 문서의 [best practices](https://docs.docker.com/build/building/best-practices/) 에서 실제로 자주 걸리는 항목만 추렸습니다.

**멀티 스테이지 빌드.** 빌드 도구가 있는 스테이지와 실행만 하는 스테이지를 나눕니다. JDK 와 Gradle 은 빌드 스테이지에만 있고 최종 이미지에는 jar 와 JRE 만 남습니다. 문서에도 독립적인 스테이지는 병렬로 빌드될 수 있다고 적혀 있습니다.

**레이어 캐시 순서.** Docker 는 명령을 위에서 아래로 실행하면서 각 단계의 캐시를 확인하고, 한 단계가 무효가 되면 그 아래는 전부 다시 합니다. 그러니 **자주 바뀌는 것을 아래에** 둡니다. 소스 코드는 매 커밋 바뀌지만 의존성 선언 파일(`build.gradle.kts`)은 가끔 바뀝니다. 의존성 파일을 먼저 복사해 받아 두고 소스를 나중에 복사하면 소스만 고친 빌드에서 의존성 다운로드가 캐시에서 끝납니다. `RUN apt-get update` 를 단독으로 두면 캐시된 오래된 패키지 목록을 쓰게 되니 `apt-get install` 과 한 줄에 묶으라는 경고도 문서에 있습니다.

**.dockerignore.** 빌드 컨텍스트에 `.git`, `build/`, `.gradle/`, IDE 설정이 딸려 가면 전송이 느려지고 `COPY . .` 의 캐시가 사소한 파일 변경에도 깨집니다. 문법은 `.gitignore` 와 같습니다.

**non-root 사용자.** 문서는 서비스가 권한 없이 돌 수 있으면 `USER` 로 일반 사용자를 지정하라고 하고, 재빌드 사이에 ID 가 달라지지 않도록 UID/GID 를 명시하는 것도 고려하라고 합니다. 컨테이너 안의 root 는 호스트의 root 와 같은 UID 0 이라서, 격리를 뚫는 취약점이 나왔을 때 피해가 달라집니다.

**작은 베이스 이미지.** 문서는 신뢰할 수 있는 최소한의 이미지로 시작하고, 운영용으로는 대체로 더 slim 한 이미지를 쓰라고 권합니다. 더 줄이고 싶으면 [distroless](https://github.com/GoogleContainerTools/distroless) 가 있습니다. 패키지 매니저나 셸 같은 프로그램이 이미지에 없고 앱과 런타임 의존성만 담습니다. 공격 표면은 줄지만 `docker exec -it ... sh` 로 들어가 볼 수 없으니, 필요하면 셸이 들어 있는 `:debug` 변형을 따로 씁니다. Java 용 이미지(`java21-debian13` 등)도 제공됩니다.

**태그 고정.** `eclipse-temurin:21-jre` 같은 태그는 시간이 지나면 가리키는 이미지가 바뀝니다. 완전한 재현성이 필요하면 `FROM image:tag@sha256:...` 로 digest 까지 고정하고, 갱신은 Dependabot 같은 도구에 맡기라는 것이 문서의 안내입니다.

### BuildKit

지금의 `docker build` 는 BuildKit 위에서 돕니다. 공식 문서는 BuildKit 을 Docker Desktop 과 Docker Engine 의 기본 빌더로 소개하고, 독립적인 빌드 스테이지의 병렬 실행, 결과에 영향이 없는 스테이지와 컨텍스트 파일 건너뛰기, 변경된 파일만 증분 전송하는 기능을 이점으로 꼽습니다. 아래 예제에서 쓰는 `RUN --mount=type=cache` 도 BuildKit 의 Dockerfile 확장 문법입니다.

## Docker Engine, containerd, runc, 그리고 OCI

`docker run` 한 줄 뒤에는 여러 단계가 있습니다. CLI 는 `dockerd` 에 요청을 보내고, `dockerd` 는 이미지와 컨테이너 수명 관리를 containerd 에 맡기고, containerd 가 실제 컨테이너 프로세스를 만드는 일을 runc 같은 OCI 런타임에 넘깁니다. 위 그림의 아랫부분이 그 흐름입니다.

이렇게 나뉜 이유는 표준이 따로 있기 때문입니다. Open Container Initiative(OCI)가 이미지 포맷과 런타임 스펙을 정의합니다. 런타임 스펙은 컨테이너를 실행하는 번들에 어떤 설정(실행할 프로세스, 마운트, namespace, cgroup 등)이 들어가는지를 규정하고, runc 는 그 스펙을 구현한 런타임입니다. containerd 는 OCI 런타임 스펙과 이미지 스펙을 지원하는 데몬이고 2019년 2월 28일에 CNCF graduated 프로젝트가 되었습니다. GKE, EKS, AKS 같은 쿠버네티스 서비스들이 채택한 것으로 소개됩니다.

이 표준 덕에 Docker 로 만든 이미지를 Podman 이나 쿠버네티스에서 그대로 돌릴 수 있습니다. 이미지가 올라가는 곳이 **레지스트리**(Docker Hub, GitHub Container Registry, 클라우드 사업자의 레지스트리 등)이고, `docker push` / `pull` 은 OCI 이미지를 이 레지스트리와 주고받는 일입니다.

## 이미지를 어디서 돌리나: 도구 비교

![가상 머신, Docker 컨테이너, Podman 을 격리 단위, 시작 속도, 패키징, 상주 데몬, rootless, 주 용도로 비교한 표.](@/assets/images/docker-matrix.png)

[Podman](https://docs.podman.io/) 은 문서 표현으로 데몬이 없는(daemonless) 리눅스 네이티브 도구이고, OCI 컨테이너와 이미지를 다루며, root 로도 일반 사용자로도 컨테이너를 실행할 수 있습니다. Docker 엔진을 쓰던 사람이라면 CLI 가 익숙해서 대부분의 경우 `alias docker=podman` 으로 문제없이 쓸 수 있다고 문서가 적고 있습니다. 데몬이 없으니 상주 프로세스가 root 권한을 쥐고 있는 구조를 피하고 싶은 환경에서 선택지가 됩니다.

macOS 에서는 어차피 리눅스 VM 이 필요해서 그 VM 을 누가 어떻게 관리하느냐가 선택 기준입니다.

- **Docker Desktop**: 가장 흔한 선택지입니다. 아래 라이선스 문단을 먼저 보세요.
- **[Colima](https://github.com/abiosoft/colima)**: Lima 위에서 컨테이너 런타임을 돌리는 오픈소스입니다. 기본이 Docker 이고 containerd(nerdctl)도 쓸 수 있으며 Kubernetes 를 옵션으로 켤 수 있습니다. Intel 과 Apple silicon 을 모두 지원합니다.
- **[OrbStack](https://docs.orbstack.dev/)**: 컨테이너와 리눅스 머신을 돌리는 앱으로, 공식 사이트가 빠르고 가볍다는 점을 내세웁니다. 이 앱의 라이선스와 가격은 별도 페이지에 있으니 회사에서 쓰기 전에 직접 확인하셔야 합니다.

### Docker Desktop 라이선스

Docker Engine 자체는 오픈소스이고 누구나 씁니다. 제한이 걸리는 것은 **Docker Desktop** 입니다. 공식 FAQ 에 따르면 구독 없이 쓸 수 있는 경우는 비상업 오픈소스 프로젝트이거나, 직원 250명 미만이면서 연 매출 1천만 달러 미만인 기업입니다. 정부 기관은 구독을 사야 합니다. 직원 수나 매출 어느 한쪽이라도 넘으면 유료 구독이 필요한 쪽이 되니, 회사 맥북에 Docker Desktop 을 깔기 전에 소속 회사의 규모를 따져 보셔야 합니다. 정확한 약관은 Docker Subscription Service Agreement 에서 확인하세요. 대기업이라면 사내 정책이 이미 정해져 있을 가능성이 높아서, 개인 판단으로 쓰기보다 먼저 물어보는 쪽이 안전합니다.

## Apple silicon 에서 빌드하면 생기는 일

M 시리즈 Mac 에서 아무 옵션 없이 이미지를 빌드하면 arm64 이미지가 나옵니다. 이걸 amd64 서버에 올리면 `exec format error` 로 컨테이너가 뜨지 않습니다. 해결은 `buildx` 로 대상 플랫폼을 지정하는 것입니다.

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t registry.example.com/app:1.0 --push .
```

Docker 문서는 멀티 플랫폼 빌드 전략을 세 가지로 소개합니다. QEMU 에뮬레이션은 Dockerfile 을 고칠 필요가 없어 가장 쉽지만 네이티브 빌드보다 훨씬 느릴 수 있습니다. 여러 네이티브 노드를 하나의 빌더에 묶으면 더 빠르고 에뮬레이션이 안 되는 경우도 풀립니다. 크로스 컴파일은 빌드 스테이지를 `--platform=$BUILDPLATFORM` 으로 빌더의 네이티브 아키텍처에 고정하고 `TARGETOS`, `TARGETARCH` 를 컴파일러에 넘기는 방식입니다. JVM 앱은 바이트코드가 아키텍처와 무관해서 jar 빌드는 어디서 하든 같고, 달라지는 것은 베이스 이미지(JRE)뿐입니다. 그래서 Spring Boot 는 에뮬레이션 부담이 상대적으로 작습니다.

멀티 플랫폼 결과물은 manifest list 를 지원하는 이미지 저장소가 있어야 하는데, 문서에 따르면 Docker Desktop 과 Docker Engine 29.0 이상은 containerd 이미지 저장소를 기본으로 씁니다. 29.0 은 2025년 11월 10일에 나왔습니다. 그보다 오래된 환경이면 `docker-container` 드라이버 빌더를 만들고 `--push` 로 레지스트리에 바로 올려야 합니다.

## Kotlin/Spring Boot 를 올리는 예제

Gradle 로 fat jar 를 만들고 JRE 이미지에서 실행하는 멀티 스테이지 Dockerfile 입니다.

```dockerfile
# syntax=docker/dockerfile:1
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon dependencies > /dev/null

COPY src ./src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/build/libs/*.jar app.jar

USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

순서의 이유는 앞에서 말한 그대로입니다. 설정 파일만 먼저 복사해 `dependencies` 를 한 번 돌려 두면 `src` 만 바뀐 빌드는 두 번째 `RUN` 부터 다시 합니다. `--mount=type=cache` 는 Gradle 홈을 레이어 바깥의 빌드 캐시로 둬서 레이어가 무효가 돼도 받은 라이브러리를 재사용합니다. 최종 이미지에는 JDK, Gradle, 소스가 없고 jar 하나와 JRE 만 있습니다. `bootJar` 결과물이 `build/libs/` 에 하나만 나오도록 `plain` jar 는 `tasks.jar { enabled = false }` 로 꺼 두는 편이 와일드카드 `COPY` 가 헷갈리지 않습니다. `.dockerignore` 는 이렇게 둡니다.

```text
.git
.gradle
build
.idea
*.md
```

로컬 개발용 `compose.yaml` 은 앱과 Postgres 를 같이 띄웁니다.

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/app
      SPRING_DATASOURCE_USERNAME: app
      SPRING_DATASOURCE_PASSWORD: app
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  db-data:
```

Compose 는 서비스, 네트워크, 볼륨을 한 파일에 선언하는 도구이고, 공식 문서 기준 기본 파일명은 `compose.yaml` 입니다(`docker-compose.yml` 도 호환용으로 인식됩니다). 같은 Compose 프로젝트의 서비스는 서비스 이름으로 서로를 찾습니다. 위 설정에서 JDBC URL 의 호스트가 `localhost` 가 아니라 `db` 인 이유입니다. 컨테이너 안의 `localhost` 는 그 컨테이너 자신이라서, 앱이 `localhost:5432` 로 붙으려 하면 연결 실패가 납니다. 처음 Compose 를 쓰는 사람이 가장 많이 겪는 일입니다.

`depends_on` 만으로는 "컨테이너가 시작됐다"까지만 보장하고 Postgres 가 연결을 받을 준비가 됐다는 보장은 없습니다. 그래서 `healthcheck` 와 `condition: service_healthy` 를 같이 둡니다. `db-data` 는 named volume 이라 `docker compose down` 을 해도 남고, DB 를 초기화하고 싶으면 `docker compose down -v` 를 씁니다. 위 비밀번호는 로컬 개발용 값이니 운영 설정에 그대로 가져가시면 안 됩니다.

## 정리하며 남는 것들

컨테이너를 VM 대신 쓰려는 사고방식으로 접근하면 컨테이너 하나에 sshd 와 앱과 cron 을 같이 넣게 됩니다. 컨테이너는 프로세스 하나(와 그 자식들)를 위한 포장이라고 생각하는 편이 운영이 단순해집니다. 쓰기 층은 일회용이니 상태는 볼륨이나 외부 서비스로 빼고, 이미지는 작고 재현 가능하게 만들고, 실행 사용자는 root 가 아니게 합니다. 로컬 개발은 Compose 로, 운영 배치는 쿠버네티스 같은 오케스트레이터로 넘어가는 것이 일반적인 흐름이고, 이미지가 OCI 표준이라 이 이동에 이미지를 다시 만들 필요가 없습니다.

## 참고 자료

- [Docker Build best practices](https://docs.docker.com/build/building/best-practices/)
- [BuildKit](https://docs.docker.com/build/buildkit/)
- [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [OverlayFS storage driver](https://docs.docker.com/engine/storage/drivers/overlayfs-driver/)
- [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [Docker Engine release notes](https://docs.docker.com/engine/release-notes/)
- [Docker plans FAQ](https://www.docker.com/pricing/faq/)
- [The Compose application model](https://docs.docker.com/compose/intro/compose-application-model/)
- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [OCI runtime-spec](https://github.com/opencontainers/runtime-spec)
- [containerd](https://containerd.io/)
- [GoogleContainerTools/distroless](https://github.com/GoogleContainerTools/distroless)
- [Podman documentation](https://docs.podman.io/en/latest/)
- [Colima](https://github.com/abiosoft/colima)
- [OrbStack documentation](https://docs.orbstack.dev/)
