import Image from 'next/image';

/** BlockVote app logo (rounded tile). `size` is the rendered width/height in px. */
export default function BrandLogo({ size = 32, className = '', priority = false }) {
  return (
    <Image
      src="/logo.png"
      alt="BlockVote"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 select-none ${className}`.trim()}
    />
  );
}
