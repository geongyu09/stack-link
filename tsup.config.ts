import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      incremental: false,
      composite: false,
      // tsup이 dts 빌드 시 baseUrl을 강제 주입하는데, TS 6.0부터 baseUrl이 deprecated라 에러 없이 통과시키기 위함
      ignoreDeprecations: "6.0",
    },
  },
  banner: {
    js: '"use client";',
  },
  external: ["react", "react-dom", "next", "react/jsx-runtime"],
});
