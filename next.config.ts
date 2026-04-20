import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // LAN IP 에서 iPhone·태블릿으로 접속할 때 /_next/webpack-hmr 차단 해제
  // (Next 16 기본 보안: localhost 외 host 는 dev 리소스 block)
  // Wi-Fi·IP 가 바뀌면 여기에 추가 필요 (프로덕션은 Vercel 이라 이 설정 무관)
  allowedDevOrigins: ['172.30.1.27'],
};

export default nextConfig;
