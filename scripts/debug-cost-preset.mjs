// cost-baseline 직접 호출 디버그
import('./../.next/server/app/api/bid/ai-estimate/route.js').catch(() => {})

// 직접 TS 파일 읽을 수는 없으니 API 호출로 전체 결과 JSON 확인
const res = await fetch('http://localhost:3000/api/bid/ai-estimate?mode=preset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: '공동주택',
    bldgArea: 30000,
    totalDuration: 744,
    tasks: [
      { name: '기초', category: '골조공사', quantity: 1000, unit: '㎥', duration: 30 },
    ],
  }),
})
const d = await res.json()
console.log(JSON.stringify(d, null, 2))
