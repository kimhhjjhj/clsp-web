// PWA 아이콘 SVG 생성 — 동양 로고 PNG 를 base64 embed (iOS 외부 href 이슈 회피)
import fs from 'node:fs'

const logoB64 = fs.readFileSync('public/tongyang-logo.png').toString('base64')
const dataUri = `data:image/png;base64,${logoB64}`

function svg({ rounded }) {
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f1f5f9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512"${rounded ? ' rx="96"' : ''} fill="url(#bg)"/>
  <image x="56" y="140" width="400" height="70" preserveAspectRatio="xMidYMid meet" href="${dataUri}"/>
  <text x="256" y="370" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="150" font-weight="900" fill="#1e3a5f" letter-spacing="-5">CLSP</text>
</svg>
`
}

fs.writeFileSync('app/icon.svg', svg({ rounded: true }))
fs.writeFileSync('app/apple-icon.svg', svg({ rounded: false }))
console.log('✔ icon.svg (rounded) + apple-icon.svg (square) 생성 완료')
console.log(`  logo base64: ${Math.round(logoB64.length / 1024)}KB`)
