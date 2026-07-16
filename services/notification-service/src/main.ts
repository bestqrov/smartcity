import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT_NOTIFICATION_SERVICE || 3007;
  await app.listen(port);
  console.log(`[NotificationService] Running on http://localhost:${port}`);
}

bootstrap();
