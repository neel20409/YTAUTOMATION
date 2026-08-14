import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

// Lazy on purpose: ES module static imports are evaluated (in dependency order) before any
// top-level code in the importing module runs - so if this constructed PrismaClient eagerly at
// module-load time, `import "./db.js"` anywhere would read process.env.DATABASE_URL before the
// entrypoint's dotenv call had a chance to run, no matter what order the source lines appear in.
let _prisma: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (!_prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
