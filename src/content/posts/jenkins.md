---
title: "Jenkins 는 아직 쓸 만한가, GitHub Actions 와 나란히 놓고 봤습니다"
description: "CI/CD 가 무엇인지부터 Jenkins 의 controller 와 agent 구조, Jenkinsfile 과 shared library, LTS 와 Java 요구 사항, 플러그인 관리 부담, JCasC 와 Kubernetes agent 를 정리하고, GitHub Actions, GitLab CI, Bitbucket Pipelines 와 비교해 어디서 Jenkins 가 여전히 맞는지 안드로이드 빌드 예제와 함께 적었습니다."
pubDatetime: 2026-11-09T11:13:00+09:00
category: server
tags:
  - Jenkins
  - CI/CD
  - DevOps
  - GitHub Actions
  - 자동화
---

안드로이드 앱을 만들다 보면 "PR 올리면 알아서 빌드하고 테스트 돌려 주면 좋겠다" 는 순간이 반드시 옵니다. 처음에는 빌드 서버로 쓸 맥 한 대나 리눅스 박스에 `./gradlew assembleRelease` 를 크론으로 걸어 두는 정도로 시작합니다. 그러다 브랜치별로 다르게 돌리고, 서명 키를 안전하게 쓰고, 실패하면 알림을 받고 싶어지면 그 크론은 CI 서버가 됩니다.

그 자리에 오랫동안 있었던 도구가 Jenkins 입니다. 요즘은 GitHub Actions 로 시작하는 팀이 훨씬 많아서 "Jenkins 는 레거시 아닌가" 라는 말을 자주 듣습니다. 절반은 맞고 절반은 틀립니다. 어디가 맞고 어디가 틀린지를 Jenkins 구조부터 따라가며 적어 보겠습니다. 컨테이너 얘기가 나오는 곳은 [Docker 글](/posts/docker/)과 [Kubernetes 글](/posts/kubernetes/)을 먼저 보시면 편합니다.

## CI/CD 가 실제로 하는 일

CI(Continuous Integration)는 변경이 올라올 때마다 빌드와 테스트를 자동으로 돌려서 "합쳐도 되는 상태인지" 를 빨리 알려 주는 일입니다. CD 는 그 결과물을 배포 가능한 상태로 만들고, 필요하면 실제 배포까지 자동으로 잇는 일입니다. 안드로이드로 옮기면 PR 마다 lint 와 단위 테스트를 돌리고, 머지되면 AAB 를 만들어 내부 테스트 트랙에 올리는 흐름이 됩니다.

브랜치 전략과 PR 운영 방식에 따라 CI 설계도 달라집니다. 이 부분은 [merge 와 rebase 글](/posts/git-merge-vs-rebase/)에서 다룬 내용과 맞닿아 있습니다. 머지 큐나 squash 정책이 정해져 있어야 "어느 커밋을 빌드할 것인가" 가 정리됩니다.

## Jenkins 구조: controller, agent, executor

Jenkins 는 크게 controller 와 agent 로 나뉩니다. 문서 표현으로 controller 는 Jenkins 서비스 자체이고 설정, 인증, 권한을 맡습니다. agent 는 170KB 짜리 Java 클라이언트 프로세스로, controller 에 연결해서 controller 대신 작업을 실행합니다. Java 가 도는 OS 면 어디든 agent 가 될 수 있어서 안드로이드용 리눅스 머신, iOS 용 맥 한 대, 윈도우 머신을 한 controller 에 붙이는 구성이 자연스럽습니다.

executor 는 작업을 실행하는 슬롯입니다. agent 하나에 executor 가 2개면 동시에 빌드 2개가 돕니다. Gradle 빌드는 메모리를 많이 쓰니 코어 수만큼 executor 를 늘리면 오히려 느려지는 경우가 많습니다.

controller 프로세스 안에도 built-in 노드가 있는데, 문서는 보안, 성능, 확장성 때문에 여기서 빌드를 돌리는 것을 권하지 않습니다. 끄려면 executor 수를 0 으로 둡니다. 저는 처음 설치하면 이걸 제일 먼저 합니다.

![Git 저장소의 webhook 이 Jenkins controller 를 깨우고, controller 의 pipeline 과 plugins 와 credentials 가 고정 agent 와 Docker agent 와 Kubernetes pod 에 작업을 배정한 뒤 산출물이 보관되고 배포되는 흐름입니다. controller 는 관리와 기록을 맡고 실제 빌드는 agent 의 executor 에서 실행됩니다.](@/assets/images/jenkins-architecture.png)

데이터는 전부 Jenkins Home 디렉터리에 있습니다. 설정, job 정의, 빌드 기록, 설치된 플러그인(`plugins/*.jpi`)이 한곳에 모여 있어서 백업은 이 디렉터리를 어떻게 지키느냐의 문제입니다. 반대로 말하면 이 디렉터리가 날아가면 CI 가 통째로 날아갑니다.

## Jenkinsfile 로 파이프라인을 코드에 두기

예전 Jenkins 는 웹 화면에서 freestyle job 을 클릭으로 만들었습니다. 지금은 `Jenkinsfile` 을 저장소에 두는 Pipeline 방식이 표준입니다. 문서가 꼽는 장점은 브랜치와 PR 마다 자동으로 파이프라인이 돌고, 코드 리뷰로 파이프라인을 고칠 수 있고, 변경 이력이 남는다는 점입니다. 클릭으로 만든 job 은 누가 언제 옵션을 바꿨는지 알 방법이 없어서, 한 번 이 방식을 써 보면 돌아가기 어렵습니다.

문법은 두 가지입니다. Declarative 는 `pipeline { ... }` 블록 안에 구조가 정해져 있어서 읽기 쉽고, Scripted 는 `node { ... }` 안에서 Groovy 를 거의 그대로 씁니다. 특별한 이유가 없으면 Declarative 로 시작하고, 정말 막히는 부분만 `script { }` 블록으로 풀어 쓰면 됩니다.

### stages, steps, post

`stages` 아래에 `stage` 가 있고 각 stage 는 `steps` 를 가집니다. 결과에 따라 실행되는 `post` 블록에는 `always`, `failure`, `success`, `unstable`, `fixed`, `cleanup` 같은 조건이 있습니다. `cleanup` 은 다른 조건이 다 평가된 뒤 마지막에 실행됩니다. 워크스페이스 정리나 알림은 여기에 둡니다.

### agent 에 Docker 와 Kubernetes 쓰기

`agent` 지시어로 stage 가 어디서 돌지 정합니다. `docker` 로 이미지를 적으면 새 컨테이너 안에서 실행되고 `args` 로 `docker run` 옵션을 넘깁니다. `kubernetes` 를 쓰면 pod 안에서 실행되고, pod 정의를 YAML 로 직접 쓸 수 있습니다. 문서는 `kubernetes` agent 를 쓰려면 Jenkinsfile 이 Multibranch Pipeline 이나 SCM 에서 와야 한다고 적고 있습니다.

```groovy
agent {
    kubernetes {
        defaultContainer 'builder'
        yaml '''
kind: Pod
spec:
  containers:
  - name: builder
    image: my-registry/android-build:latest
    command: [sleep]
    args: [99d]
'''
    }
}
```

이미지 이름은 예시입니다. 안드로이드 SDK 가 들어 있는 빌드 이미지를 직접 만들어 두는 쪽을 권합니다. 이 방식은 빌드마다 깨끗한 환경이라는 장점이 있지만, Gradle 캐시도 같이 사라지는 단점이 있어서 뒤에서 다시 다룹니다.

### credentials 바인딩

서명 키나 API 토큰은 Jenkinsfile 에 쓰지 않고 Jenkins 의 credentials 저장소에 넣고 ID 로 불러 씁니다. `environment` 안의 `credentials('id')` 는 secret text 면 값 자체, username/password 면 `user:pass` 문자열과 함께 `변수명_USR`, `변수명_PSW` 를 만들어 줍니다. SSH 키는 임시 파일 경로가 들어옵니다. 지원하지 않는 타입을 쓰면 파이프라인이 실패합니다.

```groovy
environment {
    STORE_PASS = credentials('release-keystore-password')
}
```

주의할 점은 Groovy 문자열 안에 secret 을 보간하지 않는 것입니다. `sh "... ${STORE_PASS}"` 대신 작은따옴표 `sh '... $STORE_PASS'` 로 쉘 변수를 쓰는 편이 로그 유출 면에서 안전합니다.

### shared library 와 multibranch

파이프라인이 열 개, 스무 개로 늘면 같은 코드가 복사됩니다. shared library 는 이걸 따로 저장소로 빼는 방법입니다. `vars/` 아래 파일 이름이 그대로 전역 step 이 되고, `src/` 에는 Groovy 클래스를, `resources/` 에는 JSON 같은 비 Groovy 파일을 둡니다. 쓸 때는 `@Library('my-shared-library@main') _` 처럼 선언하고 버전을 `@` 뒤에 붙여 고정합니다. 저는 `buildAndroid()` 같은 step 하나에 Gradle 호출, 테스트 리포트 수집, 알림을 모아 두는 용도로 씁니다.

Multibranch Pipeline 은 저장소를 스캔해서 `Jenkinsfile` 이 있는 브랜치마다 job 을 자동으로 만들어 줍니다. 브랜치마다 다른 Jenkinsfile 을 쓸 수도 있습니다. PR 검증은 GitHub Branch Source, Bitbucket Branch Source, GitLab Branch Source, Gitea 같은 플러그인이 있어야 하고, 그때 `CHANGE_ID` 변수로 PR 번호를 알 수 있습니다. 브랜치 추가와 삭제를 자동 반영하려면 주기적 스캔을 켜야 합니다.

## 릴리즈 라인과 Java 요구 사항

Jenkins 는 두 갈래로 릴리즈됩니다. weekly 는 매주 새 버전이 나오고 기능과 수정이 빠르게 들어옵니다. LTS 는 12 주마다 최근 weekly 중 하나를 baseline 으로 골라서 그 위에 패치 릴리즈(X.1, X.2, X.3)를 쌓는 라인이고, 중요한 버그와 보안 수정만 받습니다. 운영 서버라면 LTS 를 쓰는 게 기본입니다. 최근 LTS 는 2.580 baseline 이고 2.580.1 이 2026년 9월 30일, 2.580.2 가 2026년 10월 28일에 나왔습니다.

Java 는 지원 정책 문서에 Java 21 과 Java 25 가 지원 대상으로 올라 있습니다. Java 21 은 첫 LTS 가 2.479.1(2024년 10월), 지원 종료 예정이 2027년 9월이고, Java 25 는 첫 LTS 가 2.541.1(2026년 1월), 지원 종료 예정이 2029년 9월입니다. Java 17 은 마지막 LTS 가 2.541.3(2026년 3월)이었고 그 뒤로는 지원되지 않습니다. 문서가 "지원하지 않는 Java 를 쓰면 controller 가 실행되지 않는다" 고 적고 있으니, 옛 서버를 업그레이드할 때는 Jenkins 보다 JDK 를 먼저 올려야 합니다. 안드로이드 빌드용 JDK 는 agent 에서 따로 고르기 때문에 controller 의 Java 와는 별개입니다.

## 플러그인이라는 유지보수 비용

Jenkins 의 장점이자 약점은 플러그인입니다. Git, Docker, Kubernetes, 알림, 리포트 거의 모든 기능이 플러그인이고, 플러그인은 서로 의존합니다. 새 플러그인을 하나 설치하면 의존 플러그인이 딸려 오고, 문서에도 암묵적 의존이 시간이 갈수록 쌓인다는 표현이 나옵니다. update center 는 기본적으로 24시간마다 업데이트를 확인하고, 업데이트를 적용하려면 재시작이 필요합니다.

현실에서는 이렇게 흘러갑니다. 보안 권고가 올라오면 플러그인을 올리고, 올리다 보니 Jenkins 코어 최소 버전이 올라가고, 코어를 올리려니 Java 를 올려야 하고, 그 사이에 쓰던 플러그인 하나가 더 이상 관리되지 않습니다. 업그레이드를 미루다 한 번에 하려면 사고가 납니다. 그래서 "Jenkins 는 설치보다 운영이 일" 이라는 말이 나옵니다. 플러그인 수를 줄이고, 업그레이드 전에 staging 인스턴스에서 먼저 돌려 보는 것이 제일 효과가 큽니다.

## JCasC 로 controller 설정도 코드로

Jenkinsfile 이 파이프라인을 코드로 만들어 줬다면, Configuration as Code(JCasC) 플러그인은 controller 설정을 YAML 로 만들어 줍니다. 시스템 메시지, 보안 설정, 도구 경로, credentials 같은 항목을 파일에 적어 두고 저장소에서 관리합니다.

```yaml
jenkins:
  systemMessage: "Managed by Configuration as Code"
```

`CASC_JENKINS_CONFIG` 환경 변수에 파일, 폴더, URL 을 쉼표로 이어서 지정하면 시작할 때 읽습니다. 폴더를 주면 안의 `.yml`, `.yaml` 파일을 재귀적으로 찾고, 여러 파일이 같은 값을 정의해 충돌하면 오류가 납니다. 이걸 쓰면 controller 가 망가져도 설정을 다시 올릴 수 있어서, 아까 말한 Jenkins Home 의존도가 많이 줄어듭니다.

## Kubernetes 위에서 agent 돌리기

고정 agent 를 여러 대 두면 쉬는 시간에도 자원을 차지합니다. Kubernetes 플러그인은 빌드가 시작되면 pod 를 하나 만들고 끝나면 지웁니다. pod 안에는 Jenkins agent 가 도는 컨테이너(기본 이름 `jnlp`)가 있고, 다른 컨테이너를 같이 띄워서 `container` step 으로 명령을 나눠 실행할 수 있습니다. 빌드가 몰리는 시간대에는 pod 가 늘고 한가하면 사라지니 비용에 유리합니다.

안드로이드는 이 방식에서 두 가지가 걸립니다. 하나는 SDK 가 들어 있는 이미지가 커서 pull 시간이 늘어난다는 점이고, 다른 하나는 빌드마다 Gradle 캐시가 사라진다는 점입니다. 캐시 볼륨을 pod 에 붙이거나 Gradle 원격 캐시를 쓰는 식으로 풀어야 합니다. 클러스터 자체를 다루는 부분은 [Kubernetes 글](/posts/kubernetes/)에 적어 두었습니다.

## 안드로이드 빌드 Jenkinsfile

고정 agent 에 Android SDK 를 설치해 두고 `android-sdk` 라벨을 붙인 구성으로 적어 보겠습니다. 이 방식의 가장 큰 장점은 `~/.gradle` 이 빌드 사이에 남아서 캐시 설정을 따로 하지 않아도 두 번째 빌드부터 빠르다는 점입니다.

```groovy
pipeline {
    agent { label 'android-sdk' }

    options {
        timeout(time: 40, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    environment {
        GRADLE_OPTS = '-Dorg.gradle.daemon=false'
    }

    stages {
        stage('Unit test') {
            steps {
                sh './gradlew testDebugUnitTest --no-daemon'
            }
            post {
                always {
                    junit 'app/build/test-results/testDebugUnitTest/*.xml'
                }
            }
        }
        stage('Assemble') {
            steps {
                sh './gradlew assembleDebug --no-daemon'
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: 'app/build/outputs/apk/debug/*.apk'
        }
        cleanup {
            cleanWs()
        }
    }
}
```

`junit` 과 `archiveArtifacts`, `cleanWs` 는 각각 JUnit, Workspace Cleanup 플러그인이 제공하는 step 이라 해당 플러그인이 설치되어 있어야 합니다. `disableConcurrentBuilds()` 는 같은 job 이 동시에 두 번 도는 것을 막아서, 같은 `~/.gradle` 을 두 빌드가 동시에 만지는 상황을 피합니다. 릴리즈 서명이 필요하면 아까의 `credentials()` 로 keystore 비밀번호를 넘기고 keystore 파일은 `Secret file` 타입 credentials 로 받습니다.

같은 일을 GitHub Actions 로 쓰면 이렇게 됩니다.

```yaml
name: Android CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: 21
      - uses: gradle/actions/setup-gradle@v6
      - run: ./gradlew testDebugUnitTest assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: app/build/outputs/apk/debug/*.apk
```

`setup-gradle` 가 Gradle 사용자 홈을 캐시해 주기 때문에 캐시 설정 코드가 한 줄도 없습니다. 문서 기준으로 캐시는 기본 켜짐이고, 기본 브랜치에서 돈 job 만 캐시에 쓰고 다른 브랜치는 읽기만 합니다. `setup-java` 의 `cache: gradle` 옵션과 같이 쓰면 서로 간섭할 수 있다고 안내하고 있어서 JDK 설치만 `setup-java` 에 맡깁니다. Android SDK 패키지를 더 받아야 하는 프로젝트라면 `sdkmanager` 를 부르는 단계를 하나 더 둡니다.

두 파일을 나란히 놓고 보면 첫 번째 파일을 쓰기 위해 머신 한 대, SDK 설치, 플러그인 세 개가 먼저 있어야 한다는 사실이 눈에 들어옵니다.

## 호스티드 CI 와 비교

GitHub Actions 는 `.github/workflows` 의 YAML 에 workflow 를 쓰고, 이벤트가 오면 runner 에서 job 이 돕니다. GitHub 호스티드 runner 는 Linux, Windows, macOS 가상 머신이고 job 마다 새로 만들어집니다. 직접 운영하는 self-hosted runner 도 쓸 수 있고, 재사용할 단위는 Marketplace 의 action 으로 가져옵니다. GitLab CI 는 `.gitlab-ci.yml`, 그리고 stages 와 jobs 구조이고 runner 가 실행을 맡습니다. GitLab.com 에는 runner 가 준비되어 있고 self-managed 인스턴스는 runner 를 등록해야 합니다. 재사용은 `include:component` 와 CI/CD Catalog 로 합니다. Bitbucket Pipelines 는 저장소 루트의 `bitbucket-pipelines.yml` 로 정의하고, 클라우드에 컨테이너를 만들어 실행합니다. 직접 운영하는 self-hosted runner 와, YAML 에 붙여 쓰는 재사용 스크립트인 pipe 가 있습니다.

![Jenkins, GitHub Actions, GitLab CI, Bitbucket Pipelines 를 호스팅, 설정 방식, 실행 환경, 확장 수단, 운영 부담, 잘 맞는 곳으로 나눠 비교한 표입니다. Jenkins 만 직접 설치하고 운영하는 대신 설정 자유도가 크고, 나머지 셋은 저장소 안의 YAML 로 시작하며 운영 부담이 작습니다.](@/assets/images/jenkins-matrix.png)

저장소가 이미 GitHub 에 있으면 Actions 를 쓰는 편이 설정이 가장 짧고, 서버를 돌볼 일도 없습니다. 이 셋은 코드 저장소와 CI 가 한 제품에 붙어 있어서 권한, PR 상태 표시, 시크릿 관리가 따로 놀지 않는다는 점이 큰 장점입니다. Jenkins 는 이 연결을 직접 구성해야 합니다. 대신 이 셋이 풀어 주지 못하는 영역에서 Jenkins 가 남습니다.

- **사내망 안에서만 돌아야 하는 경우.** 소스와 빌드 서버가 외부에서 접근할 수 없는 망에 있으면 호스티드 서비스가 닿지 못합니다. self-hosted runner 로도 해결되지만, 이미 Jenkins 가 있다면 굳이 옮길 이유가 줄어듭니다.
- **여러 저장소와 여러 SCM 이 섞인 경우.** Git 서버가 몇 종류인 조직에서는 CI 를 한 곳에 모으는 것이 이득이 되기도 합니다.
- **복잡한 파이프라인이 이미 shared library 로 쌓여 있는 경우.** 수십 개 job 을 재작성하는 비용은 보통 예상보다 큽니다.
- **빌드 노드를 세밀하게 제어해야 하는 경우.** 특정 장비를 붙인 실기기 테스트 농장, 라이선스가 묶인 머신 같은 것이 있으면 agent 모델이 잘 맞습니다.

반대로 새 프로젝트이고, 소스가 GitHub 나 GitLab 이나 Bitbucket 에 있고, 빌드 요구가 평범하다면 호스티드 CI 로 가는 게 거의 항상 빠릅니다. Jenkins 를 새로 도입하면서 얻는 것보다 controller 와 플러그인을 돌보는 시간이 더 커지기 쉽습니다. 저는 "새로 시작하면 호스티드, 이미 Jenkins 가 있으면 JCasC 와 shared library 로 정리하면서 계속" 쪽으로 판단합니다. 다만 안드로이드 빌드가 길고 무거워서 호스티드 러너의 시간 비용이 부담되면 self-hosted runner 를 붙이는 선택지도 Actions 안에서 열려 있습니다.

## 참고 자료

- [Jenkins - LTS Release Line](https://www.jenkins.io/download/lts/)
- [Jenkins - Installing Jenkins on Linux](https://www.jenkins.io/doc/book/installing/linux/)
- [Jenkins - Java Support Policy](https://www.jenkins.io/doc/book/platform-information/support-policy-java/)
- [Jenkins - LTS Changelog](https://www.jenkins.io/changelog-stable/)
- [Jenkins - Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Jenkins - Pipeline](https://www.jenkins.io/doc/book/pipeline/)
- [Jenkins - Managing Nodes](https://www.jenkins.io/doc/book/managing/nodes/)
- [Jenkins - Extending with Shared Libraries](https://www.jenkins.io/doc/book/pipeline/shared-libraries/)
- [Jenkins - Branches and Pull Requests](https://www.jenkins.io/doc/book/pipeline/multibranch/)
- [Jenkins - Managing Plugins](https://www.jenkins.io/doc/book/managing/plugins/)
- [Jenkins - Configuration as Code](https://www.jenkins.io/doc/book/managing/casc/)
- [Jenkins Kubernetes plugin](https://plugins.jenkins.io/kubernetes/)
- [GitHub Docs - Understanding GitHub Actions](https://docs.github.com/en/actions/about-github-actions/understanding-github-actions)
- [GitHub Docs - Building and testing Java with Gradle](https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-java-with-gradle)
- [gradle/actions - setup-gradle](https://github.com/gradle/actions/blob/main/docs/setup-gradle.md)
- [GitLab Docs - CI/CD](https://docs.gitlab.com/ci/)
- [Atlassian - Get started with Bitbucket Pipelines](https://support.atlassian.com/bitbucket-cloud/docs/get-started-with-bitbucket-pipelines/)
- [Atlassian - What are pipes](https://support.atlassian.com/bitbucket-cloud/docs/what-are-pipes/)
- [Atlassian - Bitbucket Runners Comparison](https://support.atlassian.com/bitbucket-cloud/kb/bitbucket-runners-comparison/)
