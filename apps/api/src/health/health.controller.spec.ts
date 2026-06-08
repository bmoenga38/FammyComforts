import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('reports db: "up" when the DB ping succeeds', async () => {
    const prisma = {
      $queryRaw: () => Promise.resolve([{ '?column?': 1 }]),
    } as unknown as PrismaService;

    const controller = new HealthController(prisma);
    await expect(controller.check()).resolves.toEqual({
      data: { status: 'ok', db: 'up' },
    });
  });

  it('reports db: "down" (not a 5xx) when the DB ping throws', async () => {
    const prisma = {
      $queryRaw: () => Promise.reject(new Error('no database reachable')),
    } as unknown as PrismaService;

    const controller = new HealthController(prisma);
    await expect(controller.check()).resolves.toEqual({
      data: { status: 'ok', db: 'down' },
    });
  });
});
