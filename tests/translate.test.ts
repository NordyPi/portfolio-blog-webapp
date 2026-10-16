import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { staleTranslationKeys, translateDoc, type TranslatableDoc } from "@/lib/translate";

// Fake DeepL: prefixes every text with [JA] and records what was sent.
let sent: string[] = [];
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  const body = JSON.parse(init.body) as { text: string[] };
  sent.push(...body.text);
  return new Response(JSON.stringify({ translations: body.text.map((t) => ({ text: `[JA] ${t}` })) }));
}) as unknown as typeof fetch;
process.env.DEEPL_API_KEY = "test-key:fx";

function makeDoc(): TranslatableDoc {
  return {
    sourceLang: "EN",
    titleEn: "Autumn in Kyoto",
    titleJa: "",
    excerptEn: "Leaves",
    excerptJa: "",
    locationEn: "Kyoto, Japan",
    locationJa: "",
    blocks: [
      { id: "a", type: "text", text: { en: "<p>First <strong>para</strong></p>", ja: "" } },
      { id: "b", type: "wide", mediaId: null, caption: { en: "Bridge", ja: "" } },
    ],
    translationState: {},
  };
}

beforeEach(() => {
  sent = [];
});

test("first run translates every field and keeps rich-text markup", async () => {
  const doc = makeDoc();
  await translateDoc(doc);
  assert.equal(sent.length, 5); // title, excerpt, location, text block, caption
  assert.equal(doc.titleJa, "[JA] Autumn in Kyoto");
  assert.equal(doc.locationJa, "[JA] Kyoto, Japan");
  assert.ok(doc.blocks[0].type === "text" && doc.blocks[0].text.ja.includes("<strong>"));
  assert.deepEqual(staleTranslationKeys(doc), []);
});

test("re-translates only fields whose source changed, keeping manual edits elsewhere", async () => {
  const doc = makeDoc();
  await translateDoc(doc);

  doc.titleJa = "京都の秋（手直し）"; // manual edit of a translation
  if (doc.blocks[1].type === "wide") doc.blocks[1].caption.en = "Togetsukyo Bridge"; // source change elsewhere
  assert.deepEqual(staleTranslationKeys(doc), ["b.caption"]);

  sent = [];
  await translateDoc(doc);
  assert.deepEqual(sent, ["Togetsukyo Bridge"]);
  assert.equal(doc.titleJa, "京都の秋（手直し）");
});

test("changing a field's source re-translates that field, replacing the manual edit", async () => {
  const doc = makeDoc();
  await translateDoc(doc);
  doc.titleJa = "手直し";
  doc.titleEn = "Autumn in Kyoto, Japan";

  sent = [];
  await translateDoc(doc);
  assert.deepEqual(sent, ["Autumn in Kyoto, Japan"]);
  assert.equal(doc.titleJa, "[JA] Autumn in Kyoto, Japan");
});

test("Japanese-source posts translate into English", async () => {
  const doc = { ...makeDoc(), sourceLang: "JA" as const, titleEn: "", titleJa: "京都の秋", excerptJa: "", excerptEn: "", blocks: [] };
  await translateDoc(doc);
  assert.deepEqual(sent, ["京都の秋"]);
  assert.equal(doc.titleEn, "[JA] 京都の秋");
});
