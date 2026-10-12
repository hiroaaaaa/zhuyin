import { cp, rm, access } from "node:fs/promises";
import path from "node:path";
const target = path.resolve("../../docs");
await access("../../.git");
await access("dist/index.html");
if (path.basename(target) !== "docs") throw Error("發布路徑錯誤");
await rm(target, { recursive: true, force: true });
await cp("dist", target, { recursive: true });
console.log("已準備 Pages：", target);
