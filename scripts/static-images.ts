// Lists the photos shipped in public/ so saves can check a path exists
// without bundling the files into the server function.
//   npm run images:manifest
import { readdirSync, writeFileSync } from "node:fs";
export function staticImages(): string[] {
  return ["dishes", "brand"]
    .flatMap((dir) =>
      readdirSync(`public/${dir}`, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile() && !f.name.startsWith("."))
        .map((f) => `${f.parentPath.slice("public".length)}/${f.name}`),
    )
    .sort();
}
if (process.argv[1]?.endsWith("static-images.ts"))
  writeFileSync(
    "src/cms/static-images.json",
    JSON.stringify(staticImages(), null, 2) + "\n",
  );
