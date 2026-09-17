/** Jest 用 next/link モック（単純な <a>）。 */
import type { AnchorHTMLAttributes, ReactNode } from 'react';

export default function Link({
  href,
  children,
  style,
  ...rest
}: {
  href: string;
  children: ReactNode;
  style?: AnchorHTMLAttributes<HTMLAnchorElement>['style'];
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a href={href} style={style} {...rest}>
      {children}
    </a>
  );
}
