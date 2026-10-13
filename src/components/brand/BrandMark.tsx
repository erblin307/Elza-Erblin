type BrandMarkProps = {
  size?: 20 | 24 | 32 | 48;
  className?: string;
  title?: string;
};

export function BrandMark({ size = 24, className, title }: BrandMarkProps) {
  const titleId = title ? `brand-mark-${size}` : undefined;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      aria-labelledby={titleId}
      role={title ? 'img' : undefined}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <path d="M11 31V12.5h24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 36h23V22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m11.5 34.5 9.5-9.5h7l9-11" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11.5" cy="34.5" r="3.25" fill="var(--surface-primary)" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="37" cy="14" r="3.25" fill="var(--surface-primary)" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
