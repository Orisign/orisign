import { defineConfig } from "orval";

const spec = "./api/openapi.yaml";

export default defineConfig({
  api: {
    input: {
      target: spec,
    },
    output: {
      target: "./api/generated.ts",
      client: "react-query",
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: "./lib/fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },
});
