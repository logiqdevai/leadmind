const { PrismaClient } = require('./src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const template = await prisma.messageTemplate.findUnique({
    where: { uuid: 'f1ae37a8-91ef-4abf-9af2-5a474e3db088' },
  });
  console.log('TEMPLATE:', JSON.stringify(template, null, 2));

  const sequence = await prisma.outreachSequence.findUnique({
    where: { uuid: 'b3d1bb70-ca3b-4d06-83d0-960b8dc8a523' },
  });
  console.log('SEQUENCE:', JSON.stringify(sequence, null, 2));

  const steps = await prisma.outreachSequenceStep.findMany({
    where: { sequence_uuid: 'b3d1bb70-ca3b-4d06-83d0-960b8dc8a523' },
    orderBy: { order_index: 'asc' },
  });
  console.log('EXISTING STEPS:', JSON.stringify(steps, null, 2));
}

main().finally(() => prisma.$disconnect());
