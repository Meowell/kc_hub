import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DAILY_SCOPE_KEY = "daily";

const users = [
  { name: "提督A", pin: "1001" },
  { name: "提督B", pin: "1002" },
  { name: "提督C", pin: "1003" },
];

const defaultTags = [
  { name: "E1", colorClass: "bg-red-200", sortOrder: 1 },
  { name: "E2", colorClass: "bg-orange-200", sortOrder: 2 },
  { name: "E3", colorClass: "bg-yellow-200", sortOrder: 3 },
  { name: "E4", colorClass: "bg-green-200", sortOrder: 4 },
  { name: "E5", colorClass: "bg-blue-200", sortOrder: 5 },
  { name: "E6", colorClass: "bg-purple-200", sortOrder: 6 },
  { name: "E7", colorClass: "bg-pink-200", sortOrder: 7 },
];

async function main() {
  // Seed users
  for (const user of users) {
    const pinCode = await bcrypt.hash(user.pin, 10);
    await prisma.user.upsert({
      where: { name: user.name },
      update: { pinCode },
      create: { name: user.name, pinCode },
    });
  }

  // Seed default lock tags
  for (const tag of defaultTags) {
    await prisma.lockTag.upsert({
      where: { scopeKey_name: { scopeKey: DAILY_SCOPE_KEY, name: tag.name } },
      update: { colorClass: tag.colorClass, sortOrder: tag.sortOrder },
      create: { ...tag, scopeKey: DAILY_SCOPE_KEY },
    });
  }

  console.log("Seed completed: users + lock tags created.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
