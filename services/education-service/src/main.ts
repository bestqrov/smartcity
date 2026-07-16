import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT_EDUCATION_SERVICE || 3004;
  await app.listen(port);
  console.log(`[EducationService] Running on http://localhost:${port}`);
}

bootstrap();
