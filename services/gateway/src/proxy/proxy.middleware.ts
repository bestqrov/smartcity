import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly routeMap: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    const userServiceUrl =
      this.configService.get<string>('USER_SERVICE_URL') ||
      'http://localhost:3001';
    const tourismServiceUrl =
      this.configService.get<string>('TOURISM_SERVICE_URL') ||
      'http://localhost:3002';

    this.routeMap = {
      '/api/auth': userServiceUrl,
      '/api/users': userServiceUrl,
      '/api/tenants': userServiceUrl,
      '/api/hotels': tourismServiceUrl,
      '/api/rooms': tourismServiceUrl,
      '/api/bookings': tourismServiceUrl,
      '/api/activities': tourismServiceUrl,
      '/api/restaurants': tourismServiceUrl,
      '/api/reviews': tourismServiceUrl,
      '/api/orders': tourismServiceUrl,
      '/api/qr': tourismServiceUrl,
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl || req.url;
    let targetUrl: string | undefined;

    for (const [prefix, url] of Object.entries(this.routeMap)) {
      if (path.startsWith(prefix)) {
        targetUrl = url;
        break;
      }
    }

    if (!targetUrl) {
      return next();
    }

    const proxyOptions: Options = {
      target: targetUrl,
      changeOrigin: true,
      logLevel: 'warn',
      pathRewrite: (path) => path.replace(/^\/api/, ''),
      onError: (err, _req, res) => {
        console.error(`[Proxy] Error proxying to ${targetUrl}:`, err.message);
        (res as Response).status(502).json({
          statusCode: 502,
          message: 'Service unavailable',
          error: 'Bad Gateway',
        });
      },
    };

    const proxy = createProxyMiddleware(proxyOptions);
    proxy(req, res, next);
  }
}
