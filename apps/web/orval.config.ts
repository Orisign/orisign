import { defineConfig } from "orval";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default defineConfig({
  api: {
    input: "http://localhost:4000/openapi.yaml",
    output: {
      target: "./api/generated.ts",
      client: "react-query",
      baseUrl: apiUrl,
      override: {
        fetch: {
          includeHttpResponseReturnType: false
        },
        mutator: {
          path: "./lib/fetcher.ts",
          name: 'customFetch'
        }
      }
    },
  },
});
