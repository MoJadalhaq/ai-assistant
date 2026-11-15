import { useStrings } from "../store/ui-store.ts";

const AUTHOR_SITE = "https://jadalhaq.com";
const AUTHOR_GITHUB = "https://github.com/MoJadalhaq";
const AUTHOR_LINKEDIN = "https://www.linkedin.com/in/mohammedjadalhaq/";

const LINK = "font-medium text-teal-700 underline-offset-2 transition-colors hover:text-teal-900 hover:underline";

/** "Built by Mohammed Jadalhaq · GitHub · LinkedIn": who made the demo, for visitors from a CV or portfolio. */
export function Credit({ className = "" }: { className?: string }) {
  const t = useStrings();
  return (
    <p className={className}>
      {t.credit.builtBy}{" "}
      <a href={AUTHOR_SITE} target="_blank" rel="noopener" className={LINK}>
        {/* The name stays in Latin letters in both languages; bdi keeps it in one piece inside Arabic text. */}
        <bdi>{t.credit.name}</bdi>
      </a>
      {" · "}
      <a href={AUTHOR_GITHUB} target="_blank" rel="noopener" className={LINK}>
        GitHub
      </a>
      {" · "}
      <a href={AUTHOR_LINKEDIN} target="_blank" rel="noopener" className={LINK}>
        LinkedIn
      </a>
    </p>
  );
}
