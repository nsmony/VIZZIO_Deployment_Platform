import Link from 'next/link';
import type { ReactNode } from 'react';

export function FeaturedCard({
  title,
  description,
  href,
  children,
}: {
  title: string;
  description: string;
  href: string;
  children?: ReactNode;
}) {
  return (
    <Link className="portal-card featured-card" href={href}>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
      <strong>Open guide →</strong>
    </Link>
  );
}
