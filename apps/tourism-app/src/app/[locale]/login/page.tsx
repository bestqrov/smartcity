'use client';

import * as React from 'react';
import { LoginForm } from '@/components/LoginForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useTranslation } from '@/lib/i18n';

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.loginTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
