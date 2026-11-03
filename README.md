# GeonJuKong

버킷리스트와 프로필을 기존 서버에서 사용하려면 Supabase SQL Editor에서 다음 두 파일을 한 번씩 실행하세요. 새 프로젝트의 `supabase/schema.sql`에는 포함되어 있습니다.

- `supabase/migrations/20261103_bucket_list.sql`
- `supabase/migrations/20261103_profiles.sql`

버킷리스트는 두 사람이 함께 추가·수정·삭제하고 달성일을 기록합니다. 프로필은 설정에서 사진·상태메시지·자기소개를 편집하며 아바타를 누르면 볼 수 있습니다. 프로필은 본인만 수정할 수 있습니다. 체험 모드 프로필은 이 브라우저의 localStorage, 버킷리스트와 첨부는 IndexedDB에 저장됩니다.

게시글 작성·수정 화면에서 첨부 번호를 확인하고 앞뒤 이동·삭제·추가할 수 있습니다. 시스템 사진 선택기가 반환하는 순서로 번호가 붙으며, 선택기 자체의 터치 순서는 운영체제에 따라 다를 수 있습니다. 삭제한 첨부 원본은 기존 정책대로 Drive에 남습니다. 영상은 미리보기에서 재생할 수 있으며 Drive 영상은 불러오기 버튼으로 원본을 내려받은 뒤 재생합니다. 재생 가능한 형식은 기기 코덱 지원에 따라 다릅니다.

홈 사진 선택을 공유 모드에서 사용하려면 Supabase SQL Editor에서 `supabase/migrations/20261101_home_photos.sql`을 적용하세요. 두 사람에게 같은 선택 사진이 표시되며, 삭제된 사진은 제외합니다. 선택한 사진이 모두 삭제되면 최신 사진으로 돌아갑니다.

**설치형 Android/iOS 앱 구성도 추가했습니다.** APK와 iOS 프로젝트 생성 절차 및 현재 빌드 제한은 [NATIVE.md](NATIVE.md)를 확인하세요. 아래의 PWA 실행 방식은 브라우저 미리보기와 웹 버전에 해당합니다.

갤럭시 S23 울트라와 아이폰 14에서 홈 화면에 추가해 사용하는 커플 PWA입니다. 일기·게시글·댓글·버킷리스트와 프로필은 허용된 두 Google 계정에게만 공개합니다. 여기서 ‘전체 공개’는 두 사람 모두 열람한다는 뜻이며 인터넷 공개가 아닙니다.

## 바로 실행

Node.js 20 이상에서 프로젝트 폴더를 열고 실행합니다. 외부 패키지 설치는 필요하지 않습니다.

Windows에서는 `webServer.bat`을 실행하면 서버가 시작된 뒤 기본 브라우저가 열립니다. 서버를 유지하려면 명령 창을 열어 두고, 종료하려면 Ctrl+C를 누르세요.

```sh
npm run dev
```

PC에서 http://localhost:4173 을 엽니다. 처음에는 **체험 모드**로 열립니다. 설정에서 나/짝꿍을 바꿔 양쪽의 작성·댓글·프로필을 확인할 수 있습니다. 샘플 데이터는 처음 한 번만 생성합니다.

- 체험 모드: 기록과 원본 파일을 **현재 브라우저 IndexedDB**에 저장합니다. 다른 기기로 동기화되지 않습니다. 브라우저 데이터 삭제·용량 정리 시 사라질 수 있습니다.
- 공유 모드: Google 로그인 후 Supabase에 글을 저장하고 Google Calendar와 Drive에 연결합니다. 아래의 외부 서비스 설정이 필요합니다. 체험 기록은 자동 업로드하지 않습니다.
- 현재 개발 서버는 PC의 루프백 주소에만 바인딩합니다. 휴대폰 설치와 실제 운영에는 HTTPS 배포 주소가 필요합니다.

Windows의 제한된 작업 폴더에서도 실행되도록 npm 스크립트에 Node의 심볼릭 링크 보존 옵션을 적용했습니다. 외부 디렉터리 접근 권한을 요구하지 않습니다.

## 기능과 현재 범위

| 기능 | 구현 |
| --- | --- |
| 홈 | 다가오는 약속, 최근 일기·게시글 |
| 캘린더 | 월 이동·오늘·날짜 선택·일정 등록/수정/삭제·날짜별 일기/추억 |
| Google Calendar | 전용 공유 캘린더 조회/추가/수정/삭제, 종일·시간·여러 날 일정 |
| 일기 | 두 사람에게 공개, 기분, 날짜, 본인 글 수정·삭제 |
| 추억 | 제목·본문·날짜·사진/영상 원본 첨부·검색 |
| 댓글 | 두 사람 모두 작성, 작성자만 수정·삭제 |
| 버킷리스트 | 공유 목표 추가·수정·삭제, 달성 체크·해제, 달성일 수정 |
| 프로필 | 사진·상태메시지·자기소개 설정, 서로의 정보 보기 |
| 원본 보관 | 체험은 IndexedDB, 실제 공유는 Google Drive |
| 알림 | 게시글·일기·댓글·일정의 앱 내 알림 |
| PWA | 아이콘·manifest·앱 셸 오프라인 캐시, 홈 화면 설치 |
| 백업 | 기록/파일 목록 JSON 내보내기. 파일 원본은 별도 백업 |

Google의 일정 변경은 Google 연결 후 최초 조회, 월 이동, 설정의 ‘지금 동기화’에서 반영합니다. 캘린더 알림은 Google Calendar의 기본 알림 설정을 이용합니다. 앱 자체 일정 예약 푸시는 포함하지 않았습니다.

공유 사진은 인증된 Drive API로 표시하며, 새로 올리는 지원 이미지에는 최대 640px WebP 미리보기를 별도로 생성합니다. 기존 사진이나 생성에 실패한 사진은 원본을 사용합니다. 화면에 가까운 사진부터 불러오고 같은 실행 중에는 메모리 캐시를 재사용합니다. 설정에서 이번 실행의 이미지 본문 다운로드량과 시간을 확인할 수 있습니다. 공개 링크나 URL에 Google 토큰을 넣지 않습니다. 읽을 권한이 없거나 브라우저에서 표시하지 못하는 형식은 ‘원본 열기’를 사용합니다. 동영상 변환·스트리밍 서버는 포함하지 않았습니다.

사진 상세에서 접근할 수 없다고 표시되면 ‘사진 접근 허용’을 눌러 Google Picker에서 해당 원본 사진을 선택합니다. 선택 후에도 불러오지 못하면 Drive에서 로그인 계정의 파일 공유 권한을 확인합니다. Google Picker API 키와 프로젝트 번호가 필요하며, 설치형 앱의 선택기 동작은 실제 기기와 Google 설정에서 확인해야 합니다.

## 실제 두 계정 연결

외부 계정과 자격 증명은 제공되지 않아 프로젝트 생성·실계정 동기화·외부 배포를 대신 완료하지 않았습니다. 비밀번호·service role 키·Google client secret을 프런트엔드나 대화에 넣지 마세요.

### 1. Supabase

1. 개인 Supabase 프로젝트를 생성합니다.
2. `supabase/schema.sql`의 마지막 두 예시 이메일을 **실제 Google 이메일 두 개(소문자)**로 바꾸고 표시 이름도 정합니다.
3. SQL Editor에서 해당 SQL 전체를 **새 프로젝트에 한 번** 실행합니다. 이 파일은 초기 설치 스키마이며 반복 실행용 마이그레이션이 아닙니다.
4. Authentication → Providers → Google을 켭니다. 아래 Google OAuth 클라이언트 ID와 client secret을 **Supabase 관리자 화면에만** 입력합니다.
5. Authentication → URL Configuration에서 Site URL을 배포 주소로 설정하고 Redirect URLs에 배포 주소와 `http://localhost:4173/`을 등록합니다.
6. 프로젝트 URL과 공개 anon 키 또는 publishable 키를 `config.js`의 `supabaseUrl`, `supabaseAnonKey`에 입력합니다. `service_role`/secret 키는 사용하면 안 됩니다.

브라우저의 Google OAuth 로그인은 PKCE를 사용합니다. 앱 세션은 이 기기의 localStorage에 저장하고 갱신합니다. 공용 기기에서는 사용 후 로그아웃하세요. Google API 접근 토큰은 메모리에만 보관하며, 아래 서버 설정이 완료되면 암호화한 갱신 토큰을 사용해 재실행 후에도 다시 가져옵니다.

기존 프로젝트에는 `supabase/migrations/20261029_google_credentials.sql`과 `supabase/migrations/20261029_shared_features.sql`을 순서대로 적용합니다. 새 프로젝트에는 `supabase/schema.sql`을 실행한 뒤 `supabase/migrations/20261029_google_credentials.sql`을 적용합니다. `supabase/functions/google-auth`를 Edge Function으로 배포하고 서버 비밀값에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, 32바이트 무작위 키를 Base64로 인코딩한 `GOOGLE_TOKEN_ENCRYPTION_KEY`, 앱의 정확한 origin을 쉼표로 구분한 `GOOGLE_AUTH_ORIGINS`를 설정하세요. Capacitor 사용 시 해당 앱 origin도 포함합니다. 키와 client secret은 클라이언트 코드나 저장소에 넣지 마세요. 암호화 키를 잃거나 바꾸면 기존 갱신 토큰은 복호화할 수 없어 재인증이 필요합니다.

`members` 테이블은 slot 1·2만 허용하며 클라이언트에서 수정할 수 없습니다. RLS가 두 이메일과 Google 제공자를 확인하고, 글 수정·삭제는 작성자만 허용합니다. Google Calendar 일정은 캘린더의 편집 권한을 가진 두 사람이 모두 편집할 수 있습니다. 이메일을 바꿀 때는 관리자가 SQL Editor에서 명시적으로 수정합니다.

### 2. Google Cloud와 OAuth

같은 Google Cloud 프로젝트에서 다음을 준비합니다.

1. **Google Calendar API, Google Drive API, Google Picker API, People API**를 활성화합니다.
2. Google Auth Platform 동의 화면에 앱 이름·연락처와 테스트 사용자 두 이메일을 등록합니다.
3. 웹 애플리케이션 OAuth 클라이언트를 만듭니다.
4. 승인된 JavaScript 원본에 `http://localhost:4173`과 실제 `https://배포호스트`를 추가합니다. 경로 없이 origin을 입력합니다.
5. 승인된 리디렉션 URI에는 Supabase Google 공급자 화면에 표시되는 `https://프로젝트ID.supabase.co/auth/v1/callback`을 등록합니다.
6. 클라이언트 ID를 `config.js`의 `googleClientId`에 입력합니다.
7. Picker용 공개 API 키를 만들고 HTTP referrer를 로컬/배포 주소로 제한하고 API 제한도 적용합니다. `googleApiKey`에 입력합니다.
8. 프로젝트의 **숫자 프로젝트 번호**를 `googleProjectNumber`에 입력합니다. 문자열 프로젝트 ID와 다릅니다.

API 연결 권한은 `openid`, `email`, `profile`, `calendar.events`, `drive.file`, `drive.readonly`, `user.birthday.read`입니다. 상대방 사진을 자동으로 불러오기 위한 `drive.readonly`는 계정의 모든 Drive 파일을 읽을 수 있는 권한입니다. Google은 이를 제한된 범위로 분류하므로 OAuth 앱 설정과 게시 상태에 따라 추가 검증이 필요할 수 있습니다. 실제 API 연결 시에도 앱에 로그인한 것과 같은 Google 이메일인지 확인합니다.

연애 시작일은 달력에서 선택합니다. 생일은 두 사람이 각자 로그인해 설정의 ‘내 Google 생일 가져오기’를 눌러 공유합니다. 기존 사용자는 Google을 다시 연결해 생일 조회 권한에 동의해야 합니다. Google 계정에 연도까지 포함된 생일이 없으면 계정 설정에서 먼저 입력해야 합니다. Google 생일은 공유 설정에 저장되어 상대방에게도 표시됩니다. 기존 프로젝트와 새 프로젝트 모두 `supabase/migrations/20261031_couple_dates.sql`을 추가로 적용하세요. 기존에 입력한 생일은 그대로 두며, 각자가 가져오면 `members`의 해당 slot 생일이 교체됩니다.

테스트 상태·미검증 개인용 OAuth의 사용자 제한·경고·토큰 제약은 Google 설정에 따라 적용됩니다. 외부 사용자 유형의 Testing 상태에서 기본 프로필 외 권한을 요청하면 Google 갱신 토큰은 7일 후 만료될 수 있습니다. 권한 취소나 만료 시 다시 인증해야 하며, 실제 운영에는 동의 화면과 필요한 검증을 확인하세요. [Google OAuth 문서](https://developers.google.com/identity/protocols/oauth2#expiration)

### 3. 공유 Google Calendar

1. Google Calendar 웹에서 전용 캘린더(예: ‘GeonJuKong’)를 생성합니다.
2. 상대 이메일에 **일정 변경** 권한으로 공유합니다. 공개 공유는 켜지 않습니다.
3. 캘린더 설정 → 캘린더 통합의 캘린더 ID를 `calendarId`에 입력합니다. 개인 기본 캘린더나 공개 URL이 아닌 **전용 캘린더 ID**를 사용하세요.
4. 앱에서 Google 로그인 → 설정 → Google 연결하기를 누릅니다.

일정은 별도 서버에 복제하지 않고 해당 Google Calendar를 기준으로 관리합니다. 시간은 현재 기기의 로컬 시간으로 입력·표시하며, Google에 시간대 오프셋을 포함한 ISO 시각을 전송합니다. 종일 일정의 종료일은 Google API의 배타적 종료 규칙을 적용합니다. 반복 일정은 조회된 해당 회차 편집이며 반복 규칙 편집 UI는 없습니다.

### 4. 공유 Google Drive

1. 원본 파일의 소유자가 될 한 사람의 Drive에서 전용 폴더를 생성합니다.
2. 상대 Google 이메일에 편집 권한으로 공유합니다. **링크가 있는 모든 사용자** 공유는 켜지 않습니다.
3. 폴더 URL의 `/folders/` 뒤 ID를 `driveFolderId`에 입력합니다.
4. **두 사람 모두** Google을 다시 연결하고 Drive 읽기 권한을 허용합니다. 기존 연결에는 새 권한이 없으므로 재연결이 필요합니다. 두 계정에 폴더가 공유되어야 하며, 업로드하려면 편집 권한과 앱에서 ‘폴더 선택’을 통한 `drive.file` 권한도 필요합니다.
5. 앱에서 폴더의 업로드 권한 확인이 끝나면 추억 게시글에 파일을 첨부합니다.

폴더 소유자와 업로드 파일 소유자는 다를 수 있습니다. 개인 Drive에서는 업로더의 저장 용량이 사용될 수 있으므로 한 폴더로 합쳐도 두 계정의 용량이 자동 통합되지 않습니다.

업로드는 4MiB 청크의 resumable 전송입니다. **같은 작성 창과 탭을 유지한 채** 다시 저장하면 서버의 업로드 지점을 확인하고 이어서 전송합니다. 새로고침·브라우저 종료 뒤 재개는 지원하지 않습니다. 모바일에서는 화면을 켜 두세요. 성공한 파일은 폼 안에 기억하므로 게시글 저장 실패 후 재시도할 때 중복 업로드를 줄입니다. 게시글 저장 전 취소하거나 탭을 닫으면 Drive에 업로드된 파일만 남을 수 있으며 자동으로 원본을 삭제하지 않습니다.

게시글 삭제는 댓글도 삭제하지만 Drive/체험 저장소의 원본은 유지합니다. 원본의 영구 삭제는 Drive에서 별도로 관리하세요. Drive 단일 보관은 독립적인 백업이 아니므로 PC/외장 저장장치에도 주기적으로 복사하는 것을 권합니다.

### 5. 앱 내 알림

게시물·일기·댓글·답글과 앱에서 직접 추가한 일정의 알림을 표시합니다. 기존 프로젝트에는 `supabase/migrations/20261031_activity_notifications.sql`을 적용하세요. 채팅 탭과 새 채팅 전송은 제거되었으며 기존 메시지 데이터와 서버 테이블은 보존됩니다. 채팅용 Web Push 신규 구독 UI는 제공하지 않습니다.

## HTTPS 배포와 휴대폰 설치

```sh
npm run check
npm test
npm run build
```

`dist/`에 앱에 필요한 정적 파일만 생성됩니다. 소스 루트 전체(특히 `supabase/`) 대신 **dist 내용만** Cloudflare Pages 같은 정적 호스팅에 배포하세요. 별도 서버 빌드는 필요하지 않습니다. 배포 주소가 정해지면 위 Supabase Redirect URLs, Google JavaScript 원본과 Picker API 키 제한, 푸시 `APP_ORIGIN`을 같은 주소로 맞춥니다.

- 아이폰: Safari에서 HTTPS 배포 주소 열기 → 공유 → 홈 화면에 추가
- 갤럭시: Chrome에서 같은 주소 열기 → 메뉴 → 앱 설치/홈 화면에 추가
- 둘 다 **APK가 필요하지 않습니다.** 이 프로젝트는 네이티브 iOS 앱이나 APK를 생성하지 않습니다.

서비스 워커는 앱 셸만 캐시합니다. 인증 API 응답, Google 파일, Supabase 기록, OAuth 쿼리가 있는 페이지는 캐시에 저장하지 않습니다. 공유 데이터의 오프라인 편집/전송 큐는 없으며 연결 실패를 표시합니다. 새 버전에서 셸 파일 목록/캐시 정책을 바꿀 때는 `sw.js`의 CACHE 버전을 올립니다. 기존 화면은 새로고침하여 업데이트하세요.

## 검증

- `npm run check`: 앱·서비스 워커·개발 스크립트 JavaScript 구문과 JSON 검사
- `npm test`: 날짜·입력·파일·앱 흐름·서버 경로 제한을 검증합니다. Google API와 Supabase 인증은 모의 응답으로 PKCE 교환·토큰 갱신·페이지 조회·동일 계정 확인·원본 청크 전송·중단 재개를 검사합니다. 네이티브 콜백 허용 범위·설정 중복 방지·아이콘·시스템 브라우저 OAuth 복귀도 검사합니다.
- 앱 흐름 검사는 테스트용 DOM/저장소 어댑터로 수행합니다. 실제 브라우저 레이아웃·IndexedDB 구현·Google/Supabase의 실서비스 권한 검증을 대신하지 않습니다.
- 브라우저 제어 연결을 사용할 수 없어 시각적 검증은 수행하지 못했습니다. 실제 기기에서의 터치 동작과 영상 코덱 지원, Google/Supabase 로그인·API·RLS의 실제 서버 실행은 미검증입니다.

실제 운영 전 아래를 두 기기에서 확인하세요.

1. 두 허용 계정은 같은 일기·게시글·댓글·버킷리스트와 프로필을 읽고 제3 계정은 서버 조회가 거부되는지
2. 상대방 글 수정/삭제가 서버에서도 거부되고 본인 글만 수정되는지
3. Google Calendar와 앱 양쪽에서 생성/수정/삭제 후 다시 조회하면 같은 결과인지
4. 두 계정에서 각각 Drive 폴더 선택 후 원본 업로드/상대 파일 열기가 되는지
5. S23/아이폰의 실제 JPEG·HEIC·MP4·MOV 파일이 원본 크기로 보관되고 재생/다운로드되는지
6. 네트워크를 끊었다 복구했을 때 같은 작성 창에서 영상 재전송이 되는지
7. 홈 화면 설치, 배경 스크롤 잠금, 바깥 영역 터치 닫기와 좌우 사진 넘기기가 되는지

## 운영비와 제한

정적 호스팅과 Supabase는 무료 범위에서 시작하고, 큰 원본은 Drive로 분리합니다. 사용량·서비스 정책에 따라 비용이 달라지며 영구 월 0원은 보장하지 않습니다. Supabase 무료 플랜은 낮은 활동이 지속되면 일시 중지될 수 있습니다. Drive 무료 용량은 Gmail/Photos 등과 공유합니다. 예: 월 3GB 업로드라면 1년 원본이 약 36GB 늘어납니다.

공유 기록·버킷리스트·프로필은 앱이 보이는 동안 5초마다 갱신합니다. 기록은 REST 페이지를 끝까지 읽어 조용히 누락하지 않지만 데이터가 많이 쌓이면 트래픽이 증가합니다. 장기 운영에서는 증분 조회/기록 페이지네이션 또는 Realtime 구독으로 바꿀 지점을 확인해야 합니다. 계정 탈퇴·자동 데이터 삭제 UI는 아직 없으며 관리자 도구에서 별도로 처리합니다.

## 구성

```text
index.html / styles.css       반응형 화면
config.js                    공개 서비스 설정
src/app.js                   화면·입력·체험 모드
src/core.js                  날짜·일정·입력 검증
src/storage.js               IndexedDB 체험 기록·원본
src/backend.js               Supabase REST·Google 로그인 PKCE
src/google.js                Google Calendar·Drive·Picker
sw.js / manifest.webmanifest PWA·앱 셸 캐시·푸시 수신
supabase/schema.sql          두 계정 RLS·테이블
supabase/functions/notify/   채팅 Web Push 서버
scripts/                     로컬 서버·배포 패키지·검사·아이콘
tests/                       로직·앱 이벤트·서버 테스트
```

공식 문서: [Google Calendar 공유](https://developers.google.com/workspace/calendar/api/concepts/sharing), [Drive 권한](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [원본 업로드](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Google 브라우저 토큰](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Apple 웹 푸시](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
