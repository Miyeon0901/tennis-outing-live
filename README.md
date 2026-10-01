# 11/21 테니스 미니게임 LIVE

2026년 11월 21일 건국대학교 스포츠과학타운 테니스장에서 사용하는 모바일 우선 실시간 복식 점수판입니다. 세 코트를 동시에 운영하면서 점수, 경기 대기열, 실제 참여 횟수, 득점왕/다승왕/불굴의 의지상, 베스트 드레서 투표와 럭키드로우를 한 화면 체계에서 관리합니다. 참가자 이름과 성별을 관리하고 자유복식·혼합복식·남자복식·여자복식 대진을 만들 수 있습니다.

## 기술 구성

- React 18 + TypeScript + Vite
- Supabase PostgreSQL, RPC, Realtime
- Vercel Hobby 배포 호환
- 참가자 이름과 휴대폰 번호 뒷자리 4개를 확인하는 간단 로그인, 인증된 참가자 정보는 `localStorage`에 보관
- 휴대폰 번호 뒷자리는 공개 참가자 데이터와 분리하고 DB에 bcrypt 해시로만 저장
- 관리자 PIN은 DB의 bcrypt 해시로만 저장 (클라이언트 환경변수나 번들에 PIN/Service Role 키 없음)

환경변수가 없으면 14명/2라운드가 들어 있는 **데모 모드**로 실행됩니다. Supabase 환경변수를 연결하면 같은 UI가 실시간 DB 모드로 바뀝니다.

## 핵심 설계

점수 변경은 `change_score` PostgreSQL RPC가 `score = score + delta` 형태로 한 행에서 원자 처리합니다. 두 사용자가 동시에 같은 팀의 `+1`을 눌러도 두 변경이 모두 반영되며, 모든 변경은 `score_events`에 기록됩니다. 점수는 0 미만이 될 수 없습니다.

개인 통계와 어워드는 별도 누적 카운터가 아니라 `status = 'finished'`인 경기에서 클라이언트가 매번 재계산합니다. 종료 경기의 점수나 상태가 바뀌면 Realtime 이벤트가 모든 접속자에게 전달되고 순위가 즉시 다시 계산됩니다. 대기/취소 경기는 완료 참여 횟수에 포함되지 않습니다.

테이블은 `participants`, `rounds`, `matches`, `match_players`, `score_events`, `settings`, `fashion_votes`, `lucky_draws`로 구성됩니다. 공개 클라이언트는 읽기만 가능하고, 쓰기는 검증 로직이 있는 `SECURITY DEFINER` RPC로만 수행합니다.

## 로컬 실행

Node.js 22 이상이 필요합니다. Vercel 프로젝트의 Node.js 버전도 22로 선택하세요.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 터미널에 표시된 주소(기본 `http://localhost:5173`)를 엽니다. 아직 Supabase를 연결하지 않았다면 그대로 데모 기능을 확인할 수 있습니다. 데모 로그인은 `참가자1 / 0000`, 관리자 PIN은 `1121`입니다.

```bash
npm run build
npm test
```

## Supabase 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql)을 전체 실행합니다.
3. 개발 데이터가 필요하면 이어서 [`supabase/seed.sql`](./supabase/seed.sql)을 실행합니다.

샘플 참가자의 초기 로그인용 휴대폰 뒷자리는 모두 `0000`입니다. 운영 전 관리 화면에서 실제 이름, 성별, 휴대폰 번호 뒷자리로 변경하세요. 등록된 활성 참가자의 이름과 뒷자리가 모두 일치해야만 일반 화면에 들어갈 수 있습니다. 뒷자리는 별도 비공개 테이블에 해시로 저장되며 조회 API로 공개되지 않습니다.
기존 참가자에게 아직 뒷자리가 없는 경우 첫 화면의 **관리자 모드**로 진입해 관리자 PIN을 확인한 뒤 참가자 수정 화면에서 새 뒷자리 4개를 지정할 수 있습니다.
4. Project Settings → API에서 Project URL과 `anon` public key를 확인합니다.
5. `.env.local`을 아래처럼 채웁니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

`anon` 키는 공개 웹 클라이언트용 키이며 RLS를 전제로 노출되어도 됩니다. **Service Role 키는 절대 Vercel이나 브라우저 환경변수에 넣지 마세요.**

### Realtime 활성화

`schema.sql` 마지막 구문이 필요한 테이블을 `supabase_realtime` publication에 등록합니다. Dashboard → Database → Replication에서 다음 테이블이 활성화됐는지 확인합니다.

`participants`, `rounds`, `matches`, `match_players`, `score_events`, `settings`, `fashion_votes`, `lucky_draws`

이미 다른 방식으로 publication을 관리한다면 Dashboard에서 직접 토글해도 됩니다.

### 관리자 PIN 변경

최초 PIN은 `1121`입니다. 운영 전 SQL Editor에서 다음 명령을 한 번 실행하세요.

```sql
select public.set_admin_pin('1121', '새로운숫자PIN');
```

새 PIN은 숫자 4~12자리입니다. DB에는 원문이 아니라 bcrypt 해시만 저장됩니다. 앱의 관리 탭에서는 PIN을 확인한 뒤 참가자, 대진, 투표, 추첨 및 초기화를 관리합니다.

## Vercel 무료 배포

1. 이 폴더를 GitHub/GitLab/Bitbucket 저장소에 push합니다.
2. Vercel에서 **Add New → Project**로 저장소를 가져옵니다.
3. Framework Preset은 Vite, Build Command는 `npm run build`, Output Directory는 `dist`로 둡니다.
4. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다.
5. Deploy를 누릅니다. `vercel.json`이 SPA 라우팅을 처리합니다.

Supabase Free와 Vercel Hobby 범위에서 동작하며 별도 유료 기능을 사용하지 않습니다. 행사 전에 Supabase 프로젝트가 일시 정지되지 않았는지 한 번 접속해 확인하세요.

## 행사 전 준비

1. 관리 탭에서 샘플 참가자의 이름, 성별, 휴대폰 번호 뒷자리를 실제 정보로 수정하거나 새 참가자를 등록합니다.
2. 관리 → 대진 자동 생성에서 복식 유형과 총 게임 수를 넣어 균형 대진을 만듭니다. 경기는 A → B → C 코트 순서로 배정되며 혼합복식은 각 팀에 남성 1명과 여성 1명을 배정합니다.
3. 대진 탭에서 각 참가자의 예정/진행/완료 횟수와 휴식을 확인하고 필요하면 수동 경기를 추가합니다.
4. 휴대폰 3대 이상으로 동시에 접속해 각 코트 `+1`, `-1`이 다른 화면에 반영되는지 리허설합니다.
5. 베스트 드레서 투표 공개 여부와 위로상 이름, 중복 수상 설정을 확인합니다.

## 행사 당일 사용

- 각 접속자는 첫 화면에서 본인 이름을 선택하거나 입력합니다. 이 이름은 점수 변경 이력의 수정자로 기록됩니다.
- 코트 탭에서 대기 경기를 시작한 뒤 큰 `+/-` 버튼으로 점수를 기록합니다.
- 경기 종료 시 최종 점수가 통계에 반영되고 LIVE/전체 순위가 즉시 갱신됩니다.
- 다음 대진 전 대진 탭의 완료 경기 수와 공평성 경고를 확인합니다. 완료 경기 편차가 2 이상이면 경고가 표시됩니다.
- 관리자는 종료를 취소할 수 있고, 점수 수정 후 다시 종료하면 통계가 원본 경기 데이터에서 재계산됩니다.
- 이벤트 탭에서 베스트 드레서 투표를 진행합니다. 한 참가자는 서로 다른 후보를 최대 2명까지 선택할 수 있고, 자기 투표·중복 선택·3명째 선택·마감 후 변경은 DB에서 차단됩니다.
- 모든 경기가 끝나면 관리 탭에서 럭키드로우를 실행합니다. 당첨자는 UI 애니메이션과 별개로 PostgreSQL의 안전한 랜덤 선택으로 먼저 확정·저장됩니다.

## 데이터 초기화

관리 탭의 **참가자 외 모든 기록 삭제**는 참가자, 참가자 로그인 정보, 관리자 PIN, 행사 기본 정보는 유지하고 경기, 내부 편성 묶음, 점수 로그, 베스트 드레서 투표, 럭키드로우 결과를 모두 삭제합니다. 이벤트 진행 상태도 시작 전으로 돌아가며 확인창을 거쳐 실행됩니다.
이 버튼은 전용 `reset_event_data` RPC를 호출하고 완료 후 DB를 다시 조회합니다. 실패할 경우 Supabase 오류가 관리 화면에 표시됩니다.

완전한 개발 데이터 재설정이 필요하면 Supabase SQL Editor에서 관련 테이블을 명시적으로 정리한 뒤 `seed.sql`을 다시 실행하세요. 운영 데이터가 삭제되므로 행사 후에는 먼저 Dashboard 백업 또는 CSV export를 권장합니다.

## 자동 대진 기준

자동 생성은 활성 참가자만 대상으로 요청한 게임 수만큼 생성하고 A → B → C 코트에 순차 배정합니다. 내부적으로 동시에 편성 가능한 선수 묶음을 계산해 같은 사람이 겹치지 않게 하고, 현재까지 배정 횟수가 적고 휴식 횟수가 많은 참가자를 우선 선택합니다. 같은 파트너와 상대 조합의 반복도 줄이며 당일 결원은 관리 화면에서 대기 경기를 새로 추가해 조정할 수 있습니다.

## 검증 체크리스트

- [x] 14명 seed와 A·B·C 3코트 순차 배정
- [x] 서로 다른 코트 동시 입력은 독립 행 업데이트
- [x] 같은 팀 동시 `+1`은 원자 RPC로 입력 유실 방지
- [x] 0 미만 점수 방지 및 수정자/시각/event log 기록
- [x] 종료 경기만 개인 승패·득실·승률·어워드 집계
- [x] 대기/취소 경기는 완료 참여 횟수에서 제외
- [x] 완료 점수/상태 수정 시 Realtime 기반 전체 재계산
- [x] 2경기 이상 참여 편차 경고
- [x] 같은 참가자의 두 진행 경기 서버 차단
- [x] 베스트 드레서 자기 투표·중복 선택·3명째 선택·마감 후 변경 서버 차단
- [x] 서버 랜덤 럭키드로우 결과 1건 저장
- [x] TypeScript production build 및 통계 단위 테스트 통과

Supabase를 실제 연결한 다중 브라우저 E2E는 프로젝트 URL/anon key가 있어야 수행할 수 있습니다. 배포 전 위의 행사 전 준비 4번을 실제 프로젝트에서 최종 확인하세요.
