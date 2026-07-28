/**
 * Dedicated layout for the resi (shipping label) route.
 *
 * The sole purpose of this layout is to import `print.css` as a GLOBAL
 * CSS file. Next.js only allows global CSS imports in layout files
 * (not in page files or components). The `@page` rule inside print.css
 * must be emitted as unscoped global CSS so the browser's print engine
 * reads it and sets the paper size to 100mm × 150mm.
 */
import "./print.css";

export default function ResiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
