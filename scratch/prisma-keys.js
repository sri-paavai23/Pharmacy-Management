const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const keys = Object.keys(p).filter(k => !k.startsWith('_') && !k.startsWith('$'));
console.log('Prisma client model keys:', JSON.stringify(keys));
p.$disconnect();
