import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL, 'http://localhost:3102', 'http://localhost:4000']
      : ['http://localhost:3102', 'http://localhost:4000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.init();

  const port = process.env.PORT_GATEWAY || 3000;
  await app.listen(port);
  console.log(`[Gateway] Running on http://localhost:${port}`);
}

bootstrap();
