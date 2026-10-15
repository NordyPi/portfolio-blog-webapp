import { cacheLife } from "next/cache";
import { GitHubIcon, InstagramIcon, LinkedInIcon } from "@/components/icons";
import { siteConfig } from "@/config/site";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter({ siteName, rights }: { siteName: string; rights: string }) {
  const { instagram, linkedin, github } = siteConfig.social;
  const links = [
    { href: instagram, label: "Instagram", Icon: InstagramIcon },
    { href: linkedin, label: "LinkedIn", Icon: LinkedInIcon },
    { href: github, label: "GitHub", Icon: GitHubIcon },
  ].filter((l) => l.href);

  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <p className="text-sm text-muted">
          © <CurrentYear /> {siteName}. {rights}
        </p>
        <ul className="flex items-center gap-2">
          {links.map(({ href, label, Icon }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-accent"
              >
                <Icon />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
