import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@fammycomforts/db';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The application's Prisma client (AR4). Prisma 7 connects through a driver
 * adapter (`@prisma/adapter-pg`) configured from `DATABASE_URL`. Connecting is
 * attempted on module init but failures are swallowed so the API still boots
 * without a reachable database (this environment has none) — the health
 * endpoint reports `db: "down"` in that case.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to the database.');
    } catch (error) {
      this.logger.warn(
        `Prisma could not connect on startup (continuing): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
