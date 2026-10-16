// Personal details shown across the site. Edit these.

export const siteConfig = {
  /** Shown in the header and browser tab. */
  name: "Loklin Nord",
  /**
   * Portrait next to the intro on the home page. Prepare the photo with
   *   npm run headshot -- "C:\path\to\photo.jpg"
   * which writes public/headshot.webp (portrait 4:5, metadata such as GPS removed), then set:
   *   headshot: { src: "/headshot.webp", alt: "Loklin Nord" },
   * While this is null, nothing is shown on the live site (a dashed placeholder shows in development).
   */
  headshot: { src: "/headshot.webp", alt: "Loklin Nord" } as { src: string; alt: string } | null,
  /** Social links in the footer. Leave a value empty ("") to hide that icon. */
  social: {
    instagram: "https://instagram.com/loklinnord",
    linkedin: "https://www.linkedin.com/in/loklin-nord",
    github: "https://github.com/NordyPi",
  },
};
