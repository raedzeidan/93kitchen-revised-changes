import { build } from "esbuild";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
if (!process.argv[2]) throw Error("Supply an output ZIP path outside the repository.");
const out = resolve(process.argv[2]);
const work = await mkdtemp(join(tmpdir(), "kitchen-function-"));
try {
  await build({
    entryPoints: ["function.mjs"],
    outfile: join(work, "index.mjs"),
    bundle: true,
    minify: true,
    format: "esm",
    platform: "node",
    target: "node24",
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["@electric-sql/pglite"],
    banner: {
      js: "import {createRequire as __makeRequire} from 'node:module';const require=__makeRequire(import.meta.url);",
    },
  });
  await cp("dist", join(work, "dist"), { recursive: true });
  execFileSync("zip", ["-qr", out, "index.mjs", "dist"], { cwd: work });
  console.log(out);
} finally {
  await rm(work, { recursive: true, force: true });
}
