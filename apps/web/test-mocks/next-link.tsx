/** Jest 用 next/link モック（単純な <a>）。 */
import type { CSSProperties, ReactNode } from 'react';

export default function Link({
  href,
  children,
  style,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <a href={href} style={style}>
      {children}
    </a>
  );
}
