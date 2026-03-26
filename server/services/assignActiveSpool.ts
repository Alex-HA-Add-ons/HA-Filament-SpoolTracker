import type { Printer, PrismaClient, Spool } from '../generated/prisma/client';

export class AssignSpoolError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AssignSpoolError';
  }
}

/**
 * Set which spool is loaded on a printer. Clears that spool from any other printer first
 * (Printer.activeSpoolId is unique per spool).
 */
export async function assignActiveSpoolToPrinter(
  prisma: PrismaClient,
  printerId: string,
  activeSpoolId: string | null,
): Promise<Printer & { activeSpool: Spool | null }> {
  const printer = await prisma.printer.findUnique({ where: { id: printerId } });
  if (!printer) {
    throw new AssignSpoolError(404, 'Printer not found');
  }

  if (activeSpoolId === null) {
    return prisma.printer.update({
      where: { id: printerId },
      data: { activeSpoolId: null },
      include: { activeSpool: true },
    });
  }

  const spool = await prisma.spool.findUnique({ where: { id: activeSpoolId } });
  if (!spool) {
    throw new AssignSpoolError(404, 'Spool not found');
  }
  if (spool.archivedAt != null) {
    throw new AssignSpoolError(400, 'Spool is archived');
  }

  return prisma.$transaction(async (tx) => {
    await tx.printer.updateMany({
      where: { activeSpoolId },
      data: { activeSpoolId: null },
    });
    return tx.printer.update({
      where: { id: printerId },
      data: { activeSpoolId },
      include: { activeSpool: true },
    });
  });
}
