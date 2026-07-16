import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT_BILLING_SERVICE || 3006;
  await app.listen(port);
  console.log(`[BillingService] Running on http://localhost:${port}`);
}

bootstrap();
