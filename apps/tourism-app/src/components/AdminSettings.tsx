'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface SettingsForm {
  siteName: string;
  contactEmail: string;
  currency: string;
  defaultLanguage: string;
}

export function AdminSettings() {
  const { t, locale } = useTranslation();
  const [settings, setSettings] = useState<SettingsForm>({
    siteName: 'SmartCity Tourism',
    contactEmail: 'contact@smartcity.ma',
    currency: 'MAD',
    defaultLanguage: locale,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      localStorage.setItem('tourism-settings', JSON.stringify(settings));
      setMessage(t('common.success'));
    } catch {
      setMessage(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('admin.settings')}</h1>

      {message && (
        <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{message}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.generalSettings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.siteName')}</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.contactEmail')}</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.currency')}</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="MAD">MAD - Moroccan Dirham</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.defaultLanguage')}</label>
                <select
                  value={settings.defaultLanguage}
                  onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>

            <Button type="submit" loading={saving}>{t('common.save')}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
