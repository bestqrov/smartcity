import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProxyMiddleware } from './proxy.middleware';

@Module({
  imports: [ConfigModule],
})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProxyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
