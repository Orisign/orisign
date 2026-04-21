import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const file = resolve(root, "api/openapi.yaml");
const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const url = `${base}/openapi.yaml`;

async function pull() {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Spec load failed: ${res.status}`);
  }

  const text = await res.text();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

pull().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
