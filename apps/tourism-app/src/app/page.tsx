import { redirect } from 'next/navigation';
import { defaultLocale } from '@smartcity/i18n';

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
