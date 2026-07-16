'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export function QrScanner() {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    message: string;
    booking?: any;
  } | null>(null);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    setError('');
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setScanning(true);
      requestAnimationFrame(scanFrame);
    } catch {
      setError(t('scanner.cameraError'));
    }
  };

  const scanFrame = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      stopCamera();
      validateQr(code.data);
      return;
    }

    requestAnimationFrame(scanFrame);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          validateQr(code.data);
        } else {
          setError(t('scanner.noQrInImage'));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const validateQr = async (qrData: string) => {
    setError('');

    try {
      const response = await apiClient('/qr/validate', {
        method: 'POST',
        body: JSON.stringify({ qrData }),
      });
      setResult(response);
    } catch (err) {
      setResult({
        valid: false,
        message: err instanceof Error ? err.message : t('scanner.validationFailed'),
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">{t('scanner.title')}</h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('scanner.scanTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                {t('scanner.cameraPreview')}
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex flex-wrap gap-3">
            {!scanning ? (
              <Button onClick={startCamera}>{t('scanner.startCamera')}</Button>
            ) : (
              <Button variant="outline" onClick={stopCamera}>{t('scanner.stopCamera')}</Button>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('scanner.uploadImage')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.valid ? 'border-green-300' : 'border-red-300'}>
          <CardHeader>
            <CardTitle className={result.valid ? 'text-green-700' : 'text-red-700'}>
              {result.valid ? t('scanner.checkInSuccess') : t('scanner.validationFailed')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-gray-700">{result.message}</p>
            {result.booking && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
                <p><strong>{t('scanner.guest')}:</strong> {result.booking.guest.firstName} {result.booking.guest.lastName}</p>
                <p><strong>{t('scanner.hotel')}:</strong> {result.booking.hotel.name}</p>
                <p><strong>{t('scanner.room')}:</strong> {result.booking.room.name}</p>
                <p><strong>{t('scanner.status')}:</strong> {result.booking.status}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
