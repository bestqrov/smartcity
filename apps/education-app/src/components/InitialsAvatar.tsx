const gradientClasses = {
  sky: 'from-sky-500 to-sky-600',
  primary: 'from-primary-500 to-primary-600',
  amber: 'from-amber-500 to-amber-600',
  violet: 'from-violet-500 to-violet-600',
  rose: 'from-rose-500 to-rose-600',
} as const;

export type AvatarColor = keyof typeof gradientClasses;

interface InitialsAvatarProps {
  name: string;
  color: AvatarColor;
}

export function InitialsAvatar({ name, color }: InitialsAvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ${gradientClasses[color]}`}
    >
      {initials || '?'}
    </div>
  );
}
