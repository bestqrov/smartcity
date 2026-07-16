import React, { type HTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';

/* ── Card (root) ─────────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Make the card respond to hover / click */
  clickable?: boolean;
  /** Full-bleed image rendered at the top of the card */
  image?: ImgHTMLAttributes<HTMLImageElement>;
}

export function Card({
  clickable = false,
  image,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden',
        'dark:bg-gray-900 dark:border-gray-700',
        clickable
          ? 'cursor-pointer transition-shadow duration-200 hover:shadow-md active:shadow-sm'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(clickable ? { role: 'button', tabIndex: 0 } : {})}
      {...rest}
    >
      {image && (
        <img
          {...image}
          className={`w-full object-cover ${image.className ?? ''}`}
          alt={image.alt ?? ''}
        />
      )}
      {children}
    </div>
  );
}

/* ── CardHeader ──────────────────────────────────────────── */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className = '', children, ...rest }: CardHeaderProps) {
  return (
    <div className={`flex flex-col gap-1.5 p-6 pb-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ── CardTitle ───────────────────────────────────────────── */

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className = '', children, ...rest }: CardTitleProps) {
  return (
    <h3
      className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

/* ── CardDescription ─────────────────────────────────────── */

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className = '', children, ...rest }: CardDescriptionProps) {
  return (
    <p
      className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}
      {...rest}
    >
      {children}
    </p>
  );
}

/* ── CardContent ─────────────────────────────────────────── */

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className = '', children, ...rest }: CardContentProps) {
  return (
    <div className={`p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ── CardFooter ──────────────────────────────────────────── */

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className = '', children, ...rest }: CardFooterProps) {
  return (
    <div
      className={`flex items-center gap-2 border-t border-gray-200 p-6 dark:border-gray-700 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
