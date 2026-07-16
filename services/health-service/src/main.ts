import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT_HEALTH_SERVICE || 3003;
  await app.listen(port);
  console.log(`[HealthService] Running on http://localhost:${port}`);
}

bootstrap();
