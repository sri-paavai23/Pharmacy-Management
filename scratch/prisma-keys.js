const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(process.env.DATABASE_URL || "mysql://fake:fake@localhost:3306/db");
const p = new PrismaClient({ adapter });
const keys = Object.keys(p).filter(k => !k.startsWith('_') && !k.startsWith('$'));
console.log('Prisma client model keys:', JSON.stringify(keys));
p.$disconnect();

