import { defineConfig } from "orval";
export default defineConfig({
  orisign: { input: "http://localhost:4000/openapi.yaml", output: {
    target:"./api/generated.ts",
    client:"axios"
  } },
});
