// useMultiplierStore 로직 단위 검증
// localStorage 로드·저장·정규화 동작 확인 (브라우저 API 스텁)

// 최소 localStorage 스텁
const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
}

// useMultiplierStore 내부의 순수 로직만 복사 (훅 자체는 React 의존)
function storageKey(pid, mode) { return `productivity:${pid}:${mode}` }

function loadFromStorage(key) {
  try {
    const raw = globalThis.window.localStorage.getItem(key)
    if (!raw) return new Map()
    const arr = JSON.parse(raw)
    const m = new Map()
    for (const [k, v] of arr) {
      if (typeof k === 'string' && typeof v === 'number' && v > 0) {
        if (Math.abs(v - 1.0) > 0.001) m.set(k, v)
      }
    }
    return m
  } catch { return new Map() }
}

function saveToStorage(key, m) {
  if (m.size === 0) globalThis.window.localStorage.removeItem(key)
  else globalThis.window.localStorage.setItem(key, JSON.stringify([...m.entries()]))
}

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}

console.log('=== Multiplier Store 단위 검증 ===\n')

// [1] 빈 상태 로드
const k1 = storageKey('proj-A', 'cp')
assert(loadFromStorage(k1).size === 0, '초기 상태 빈 Map')

// [2] 저장·로드 왕복
const m = new Map([['task-1', 1.5], ['task-2', 0.7]])
saveToStorage(k1, m)
const loaded = loadFromStorage(k1)
assert(loaded.size === 2, '2개 항목 라운드트립')
assert(loaded.get('task-1') === 1.5, 'task-1 값 복원')
assert(loaded.get('task-2') === 0.7, 'task-2 값 복원')

// [3] 1.0(변경 없음)은 저장에서 필터
const m2 = new Map([['task-A', 1.0], ['task-B', 1.2]])
saveToStorage(k1, m2)
const loaded2 = loadFromStorage(k1)
// saveToStorage는 1.0을 필터하지 않지만, loadFromStorage가 필터
// 저장 시점에서는 전체 저장되지만 로드할 때 1.0 제거됨
assert(loaded2.size === 1, '로드 시 1.0 필터링 (변경없음 제거)')
assert(loaded2.get('task-B') === 1.2, 'task-B 1.2 유지')

// [4] 빈 Map 저장 → 키 삭제
saveToStorage(k1, new Map())
assert(globalThis.window.localStorage.getItem(k1) === null, '빈 Map 저장 시 키 삭제')

// [5] 프로젝트·모드별 분리
saveToStorage(storageKey('A', 'cp'),   new Map([['t1', 2.0]]))
saveToStorage(storageKey('A', 'full'), new Map([['t1', 0.5]]))
saveToStorage(storageKey('B', 'cp'),   new Map([['t1', 1.3]]))
const aCp = loadFromStorage(storageKey('A', 'cp'))
const aFull = loadFromStorage(storageKey('A', 'full'))
const bCp = loadFromStorage(storageKey('B', 'cp'))
assert(aCp.get('t1') === 2.0 && aFull.get('t1') === 0.5 && bCp.get('t1') === 1.3,
       '프로젝트·모드별 독립 저장')

// [6] 손상된 JSON 방어
globalThis.window.localStorage.setItem(storageKey('bad', 'cp'), '{not valid json')
assert(loadFromStorage(storageKey('bad', 'cp')).size === 0, '손상 JSON 방어 (빈 Map 반환)')

console.log(`\n결과: ${pass}개 통과 / ${fail}개 실패`)
process.exit(fail === 0 ? 0 : 1)
