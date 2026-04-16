import { NextRequest, NextResponse } from 'next/server'

// Kakao REST API Key (from project config)
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY ?? '704157b7143915835e8d64a77b644213'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q.trim()) {
    return NextResponse.json({ error: '주소를 입력해주세요.' }, { status: 400 })
  }

  const headers = { Authorization: `KakaoAK ${KAKAO_KEY}` }

  try {
    // 1. 주소 검색
    const addrUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}&size=1`
    let doc: any = null

    const addrRes = await fetch(addrUrl, { headers })
    if (addrRes.ok) {
      const addrData = await addrRes.json()
      doc = addrData?.documents?.[0] ?? null
    }

    // 2. 주소 검색 실패 시 키워드 검색 fallback
    if (!doc) {
      const kwUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=1`
      const kwRes = await fetch(kwUrl, { headers })
      if (kwRes.ok) {
        const kwData = await kwRes.json()
        doc = kwData?.documents?.[0] ?? null
      }
    }

    if (!doc) {
      return NextResponse.json({ error: '주소를 찾을 수 없습니다.' }, { status: 404 })
    }

    const lat = parseFloat(doc.y)
    const lng = parseFloat(doc.x)
    const address = doc.address_name ?? doc.place_name ?? q

    return NextResponse.json({ lat, lng, address })
  } catch (err: any) {
    return NextResponse.json({ error: '지오코딩 실패', details: String(err) }, { status: 500 })
  }
}
