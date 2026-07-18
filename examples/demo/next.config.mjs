import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 로컬 라이브러리를 빌드 산출물(dist)로 연결한다.
// 라이브러리 소스를 수정하면 루트에서 `yarn build` 후 새로고침.
const stackLinkEntry = path.resolve(__dirname, "../../dist/index.mjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 데모 폴더를 파일 트레이싱 루트로 고정 (상위 lockfile 오탐 경고 제거)
  outputFileTracingRoot: __dirname,
  // 데모는 별도 ESLint 구성이 없으므로 빌드 시 lint 생략
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias["stack-link"] = stackLinkEntry;
    return config;
  },
  turbopack: {
    resolveAlias: {
      "stack-link": stackLinkEntry,
    },
  },
};

export default nextConfig;
