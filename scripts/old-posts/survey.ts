// Read-only overview of the old posts: what each contains and anything the importer can't map yet.
//   npx tsx scripts/old-posts/survey.ts <folder containing post01/ post02/ …>
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseOldPost, type OldElement } from "./parse";

const root = process.argv[2];
if (!root) throw new Error("Usage: tsx scripts/old-posts/survey.ts <posts folder>");

const dirs = readdirSync(root).filter((d) => /^post\d+$/.test(d)).sort();
const totals = new Map<string, number>();
const rowShapes = new Map<string, number>();
const inline = new Set<string>();
const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

const describe = (e: OldElement) => {
  if (e.kind === "text") return "text";
  if (e.kind === "combo") return `combo(${e.imageFirst ? "img-left" : "img-right"}${e.image.type === "video" ? ",VIDEO" : ""})`;
  if (e.kind === "row") return `row[${e.items.map((i) => (i.type === "video" ? "V" : "i")).join("")}]`;
  return `UNKNOWN(<${e.tag} class=${e.className}>)`;
};

for (const d of dirs) {
  const file = path.join(root, d, `${d}.js`);
  if (!existsSync(file)) {
    console.log(`${d}: no ${d}.js`);
    continue;
  }
  const p = parseOldPost(file);
  p.inlineTags.forEach((tag) => inline.add(tag));
  for (const e of p.elements) {
    count(totals, e.kind);
    if (e.kind === "row") count(rowShapes, `${e.items.length}: ${e.items.map((i) => i.type).join("+")} [${[...new Set(e.items.map((i) => i.className))].join(",")}]`);
  }
  console.log(
    `${d} | ${p.title ?? "NO TITLE"} | ${p.date ?? "NO DATE"} | ${p.location ?? "no location"} | cover: ${p.cover?.file ?? "NONE"}`,
  );
  console.log(`      ${p.elements.map(describe).join(" ") || "(no elements)"}`);
  for (const w of new Set(p.warnings)) console.log(`      ! ${w}`);
}

console.log("\nElement totals:", Object.fromEntries(totals));
console.log("Row shapes:");
for (const [k, v] of [...rowShapes].sort((a, b) => b[1] - a[1])) console.log(`  ${v}x  ${k}`);
console.log("Inline tags in text:", [...inline].sort().join(", "));
