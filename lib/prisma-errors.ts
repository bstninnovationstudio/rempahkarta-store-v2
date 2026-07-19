import { Prisma } from "@prisma/client";

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  ) || (
    typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
  );
}

