import { Controller, Get } from '@nestjs/common';
import {
  healthResponseSchema,
  ok,
  type ApiSuccess,
  type HealthResponse,
} from '@fammycomforts/shared';
import { PrismaService } from '../prisma/prisma.service';

/** `GET /api/v1/health` — liveness + a real DB ping (NFR10). */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<ApiSuccess<HealthResponse>> {
    let db: HealthResponse['db'] = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      // No DB reachable — report "down" in the body, not a 5xx.
      db = 'down';
    }
    const body = healthResponseSchema.parse({ status: 'ok', db });
    return ok(body);
  }
}
