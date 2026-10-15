import { Fraunces, Geist, Noto_Sans_JP } from "next/font/google";

const body = Geist({ subsets: ["latin"], variable: "--font-body" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading" });
// Japanese glyphs; large, so not preloaded (the browser fetches only the subsets it needs).
const jp = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-jp", preload: false });

export const fontVariables = `${body.variable} ${heading.variable} ${jp.variable}`;
