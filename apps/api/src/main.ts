import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Web (Next) owns 3000 in `pnpm dev`; API defaults to 3001 to avoid a collision.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
