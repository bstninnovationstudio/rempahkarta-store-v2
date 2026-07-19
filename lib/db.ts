import { PrismaClient } from "@prisma/client";
import { isProduction } from "@/lib/env";
const globalForPrisma=globalThis as unknown as {prisma?:PrismaClient};
export const prisma=globalForPrisma.prisma??new PrismaClient({log:isProduction()?["error"]:["error","warn"]});
if(!isProduction())globalForPrisma.prisma=prisma;
