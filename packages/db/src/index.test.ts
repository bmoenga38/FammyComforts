import { describe, it, expect } from "vitest";
import { PrismaClient, Prisma } from "./index";

describe("@fammycomforts/db", () => {
  it("re-exports the generated PrismaClient constructor", () => {
    expect(typeof PrismaClient).toBe("function");
  });

  it("re-exports the Prisma namespace with a client version", () => {
    expect(typeof Prisma.prismaVersion.client).toBe("string");
  });
});
