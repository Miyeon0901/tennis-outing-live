const actor='배포 전 점검'
const admin={p_admin_token:null}
const editor={p_match_id:null,p_expected_updated_at:null,p_updated_by:actor,...admin}
const denied='관리자 PIN'

// These probes never name a real participant or match and cannot authenticate as admin.
export const rpcChecks={
  verify_admin_pin:{args:{p_pin:null},result:'false'},
  login_participant:{args:{p_name:null,p_phone_last4:null},result:'empty'},
  set_fashion_votes:{args:{p_voter_id:null,p_candidate_ids:[]},error:'현재 투표 중이 아닙니다|활성 참가자만'},
  admin_action:{args:{p_action:null,p_payload:{},p_updated_by:actor,...admin},error:denied},
  assign_match_court:{args:{...editor,p_court_number:null},error:denied},
  delete_match:{args:{p_match_id:null,...admin},error:denied},
  reset_event_data:{args:{p_updated_by:actor,...admin},error:denied},
  set_award_match_limit:{args:{p_match_limit:null,...admin},error:denied},
  update_match_result:{args:{...editor,p_team_a_score:null,p_team_b_score:null},error:denied},
  draw_lucky_with_exclusions:{args:{p_excluded_ids:[],p_updated_by:actor,...admin},error:denied},
  change_score:{args:{p_match_id:null,p_team:'A',p_delta:0,p_created_by:actor},error:'잘못된 점수 변경'},
  set_match_status:{args:{p_match_id:null,p_status:null,p_updated_by:actor,...admin},error:'잘못된 경기 상태'},
}

export const tableColumns={
  participants:'id,name,gender,is_active,created_at',
  rounds:'id,round_number,label,status,rest_participant_ids',
  matches:'id,match_number,court_number,round_id,order_index,status,team_a_score,team_b_score,started_at,finished_at,updated_at,updated_by',
  match_players:'match_id,participant_id,team,position',
  score_events:'id,match_id,team,delta,created_at,created_by',
  settings:'id,current_round,event_title,event_date,venue,fashion_vote_status,reveal_fashion_during_vote,resilience_award_name,allow_duplicate_awards,award_match_limit,updated_at',
  fashion_votes:'voter_id,candidate_id,created_at,updated_at',
  lucky_draws:'id,winner_id,pool_type,exclude_award_winners,drawn_at,drawn_by',
}

export function assertProbe(name,status,body,rule){
  const valid=rule.error
    ? status===400&&body?.code==='P0001'&&new RegExp(rule.error).test(body?.message??'')
    : status===200&&(rule.result==='false'?body===false:Array.isArray(body)&&body.length===0)
  if(!valid)throw new Error(`${name}: DB 검사 실패 (HTTP ${status}, ${body?.code??'unexpected response'}). 마이그레이션·함수 인자·권한·API 캐시를 확인하세요.`)
}

export function requiredRpcs(source){
  const names=[]
  for(const match of source.matchAll(/\.rpc\s*\(\s*([^,\n)]+)/g)){
    const literal=match[1].match(/^['"]([a-z_]+)['"]\s*$/)
    if(!literal)throw new Error('동적 RPC 호출은 DB 배포 검사에 명시적으로 추가해야 합니다.')
    const name=literal[1]
    if(!Object.hasOwn(rpcChecks,name))throw new Error(`${name}: DB 배포 검사에 등록되지 않은 RPC입니다.`)
    names.push(name)
  }
  return [...new Set(names)]
}
