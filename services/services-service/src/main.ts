import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT_SERVICES_SERVICE || 3005;
  await app.listen(port);
  console.log(`[ServicesService] Running on http://localhost:${port}`);
}

bootstrap();
