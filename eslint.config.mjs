import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // UTANG TEKNIS: tiga komponen ini masih pola pra-React-Compiler (setState untuk
  // sinkronisasi eksternal di dalam effect, fungsi dipakai effect sebelum deklarasi).
  // Diturunkan ke warning sampai refactor besar SimulatorApp (REKOMENDASI P2 #10) —
  // JANGAN tambah file lain ke daftar ini; kode baru harus lolos rule aslinya.
  {
    files: [
      "components/SimulatorApp.tsx",
      "components/GuidedTour.tsx",
      "components/SqlEditor.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Output build OpenNext/Cloudflare — bukan source code
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
