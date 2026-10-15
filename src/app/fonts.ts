// ============================================================================
// SITE FONTS — change the three fonts below to re-style all text on the site.
//
//   body     paragraphs, navigation, buttons       → Tailwind class `font-sans` (the default)
//   heading  titles and headings                   → Tailwind class `font-display`
//   jp       Japanese characters (fallback for both) — latin fonts don't include kana/kanji
//
// To change one:
//   1. Pick any font on https://fonts.google.com
//   2. Import it here by name, with spaces replaced by underscores
//      (e.g. "Playfair Display" → Playfair_Display, "DM Sans" → DM_Sans)
//   3. Swap it into the line below, keeping the same `variable` name.
// Fonts are downloaded at build time and served from your own server (no Google requests from visitors).
//
// Some combinations that suit a travel blog:
//   heading: Fraunces · Playfair_Display · Lora · DM_Serif_Display · Cormorant_Garamond
//   body:    Geist · Inter · DM_Sans · Source_Sans_3 · Nunito_Sans
//   jp:      Noto_Sans_JP · Noto_Serif_JP (pairs with a serif body) · M_PLUS_1p · Zen_Kaku_Gothic_New
//
// The fonts are wired into Tailwind in src/app/globals.css (`--font-sans`, `--font-display`).
// ============================================================================
import { Fraunces, Geist, Noto_Sans_JP } from "next/font/google";

const body = Geist({ subsets: ["latin"], variable: "--font-body" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading" });
// Large, so not preloaded: browsers fetch only the character subsets a page actually uses.
const jp = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-jp", preload: false });

export const fontVariables = `${body.variable} ${heading.variable} ${jp.variable}`;
