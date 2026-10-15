// Creates demo posts with generated placeholder photos, for local development only.
// Run with:  npm run db:seed-demo     (re-running replaces the demo posts)
import "dotenv/config";
import sharp from "sharp";
import type { Block } from "@/lib/blocks";
import { db } from "@/lib/db";
import { saveImage } from "@/lib/uploads";

if (process.env.NODE_ENV === "production") throw new Error("Demo seed is for development only.");

const palette = [
  ["#f4a261", "#e76f51"],
  ["#2a9d8f", "#264653"],
  ["#e9c46a", "#f4a261"],
  ["#8ecae6", "#219ebc"],
  ["#ffb4a2", "#b5838d"],
  ["#90be6d", "#43aa8b"],
];

async function placeholder(label: string, w: number, h: number, i: number) {
  const [a, b] = palette[i % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" font-family="Arial" font-size="${Math.round(w / 14)}" fill="white" fill-opacity="0.85" text-anchor="middle" dominant-baseline="middle">${label}</text>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  return saveImage(jpeg, { alt: label });
}

const L = (en: string, ja: string) => ({ en, ja });
const P = (en: string, ja: string) => L(`<p>${en}</p>`, `<p>${ja}</p>`);

async function main() {
  await db.post.deleteMany({ where: { slug: { startsWith: "demo-" } } });

  const img = await Promise.all([
    placeholder("Cover", 2400, 1500, 0),
    placeholder("Market", 1600, 2000, 1),
    placeholder("Street 1", 1080, 1920, 2),
    placeholder("Street 2", 1080, 1920, 3),
    placeholder("Street 3", 1080, 1920, 4),
    placeholder("Coastline", 2400, 900, 5),
    placeholder("Temple", 1600, 2000, 0),
    placeholder("Project", 2400, 1500, 3),
  ]);

  const blog: Block[] = [
    { id: "b1", type: "cover", mediaId: img[0].id, caption: L("Sunrise over the bay", "湾に昇る朝日") },
    {
      id: "b2",
      type: "text",
      text: L(
        "<p>We arrived late at night, tired but excited. The next morning the city was already awake — <strong>scooters everywhere</strong>, street food stalls opening, and the smell of coffee drifting down every alley.</p><p>This is a demo post created by the seed script. Edit or delete it from the admin portal.</p>",
        "<p>夜遅くに到着し、疲れていたけれどワクワクしていました。翌朝、街はすでに目覚めていて、<strong>どこもかしこもスクーター</strong>、屋台が開き始め、路地にはコーヒーの香りが漂っていました。</p><p>これはシードスクリプトで作成されたデモ記事です。管理画面から編集・削除できます。</p>",
      ),
    },
    {
      id: "b3",
      type: "split",
      imageSide: "left",
      mediaId: img[1].id,
      text: P(
        "The morning market was the highlight. We tried things we couldn't name and pointed at everything.",
        "朝市がハイライトでした。名前もわからないものを食べ、何でも指さして注文しました。",
      ),
    },
    { id: "b4", type: "triple", mediaIds: [img[2].id, img[3].id, img[4].id], caption: L("Three streets, one afternoon", "三つの通り、ひとつの午後") },
    { id: "b5", type: "wide", mediaId: img[5].id, caption: L("", "") },
    {
      id: "b6",
      type: "split",
      imageSide: "right",
      mediaId: img[6].id,
      text: P("We ended the trip at the old temple on the hill, just before closing time.", "旅の最後は、閉門直前の丘の上の古いお寺でした。"),
    },
    { id: "b7", type: "video", source: { kind: "youtube", videoId: "aqz-KE-bpKQ" }, caption: L("A YouTube embed block", "YouTube埋め込みブロック") },
  ];

  const author = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  await db.post.create({
    data: {
      type: "BLOG",
      status: "PUBLISHED",
      slug: "demo-first-trip",
      sourceLang: "EN",
      titleEn: "Mornings by the bay",
      titleJa: "湾辺の朝",
      excerptEn: "Markets, scooters and a temple on the hill — a demo post showing every block type.",
      excerptJa: "市場、スクーター、そして丘の上のお寺。すべてのブロックを紹介するデモ記事です。",
      blocks: blog,
      coverImageId: img[0].id,
      authorId: author?.id,
      publishedAt: new Date(),
    },
  });

  await db.post.create({
    data: {
      type: "PROJECT",
      status: "PUBLISHED",
      slug: "demo-this-website",
      sourceLang: "EN",
      titleEn: "This website",
      titleJa: "このウェブサイト",
      excerptEn: "A bilingual travel blog and portfolio built with Next.js, PostgreSQL and Docker, self-hosted at home.",
      excerptJa: "Next.js・PostgreSQL・Dockerで構築し、自宅でセルフホストしているバイリンガルの旅ブログ兼ポートフォリオ。",
      blocks: [
        { id: "p1", type: "cover", mediaId: img[7].id, caption: L("", "") },
        {
          id: "p2",
          type: "text",
          text: P(
            "Replace this with a write-up of a project: the problem, what you built, the stack, and what you learned.",
            "ここにプロジェクトの説明を書いてください：課題、作ったもの、技術スタック、学んだこと。",
          ),
        },
      ] satisfies Block[],
      coverImageId: img[7].id,
      authorId: author?.id,
      publishedAt: new Date(),
    },
  });

  console.log("Demo content created: /en/blog/demo-first-trip and /en/portfolio/demo-this-website");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
