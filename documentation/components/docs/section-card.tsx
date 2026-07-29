import Link from 'next/link';

export function SectionCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link className="portal-card" href={href}>
      <h3>{title}</h3>
      <span>{description}</span>
    </Link>
  );
}
