// Prepares the home-page portrait:  npm run headshot -- "C:\path\to\photo.jpg"
//
// - turns the photo upright (phones store rotation as metadata)
// - crops to a 4:5 portrait, centered on the most "interesting" area (usually the face)
// - resizes to 800x1000 and saves public/headshot.webp
// - writes NO metadata, so GPS/camera details never reach the public repo or website
//
// For full control over the framing, crop the photo yourself first (e.g. in the Photos app),
// roughly 4:5 portrait; the automatic crop then has little left to decide.
import path from "node:path";
import sharp from "sharp";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run headshot -- "C:\\path\\to\\photo.jpg"');
    process.exit(1);
  }
  const output = path.join(process.cwd(), "public", "headshot.webp");
  const info = await sharp(input)
    .rotate()
    .resize(800, 1000, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 85 })
    .toFile(output);
  console.log(`Saved ${output} (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB, no metadata).`);
  console.log('Now set  headshot: { src: "/headshot.webp", alt: "Loklin Nord" }  in src/config/site.ts');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
