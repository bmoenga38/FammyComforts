import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // REST lives under /api/v1 (AR3); the response/error envelope is enforced by
  // the global exception filter + the shared Zod schemas (per-endpoint pipes).
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  // Web (Next) owns 3000 in `pnpm dev`; API defaults to 3001 to avoid a collision.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
