export interface StrikeReservationTicket {
  ticket: string;
  randstr: string;
  createdAt: number;
}

export interface RestoreUnusedStrikeReservationsInput {
  pool: readonly StrikeReservationTicket[];
  reserved: readonly StrikeReservationTicket[];
  spentKeys: ReadonlySet<string>;
  now: number;
  ticketTtlMs: number;
  maxPoolSize: number;
}

export interface RestoreUnusedStrikeReservationsResult {
  pool: StrikeReservationTicket[];
  restoredCount: number;
}

export function strikeTicketKey(ticket: StrikeReservationTicket): string {
  return `${ticket.ticket}:${ticket.randstr}:${ticket.createdAt}`;
}

export function removeStrikeReservations(
  pool: readonly StrikeReservationTicket[],
  reserved: readonly StrikeReservationTicket[],
): StrikeReservationTicket[] {
  if (reserved.length === 0) return [...pool];
  const reservedKeys = new Set(reserved.map(strikeTicketKey));
  return pool.filter((ticket) => !reservedKeys.has(strikeTicketKey(ticket)));
}

export function restoreUnusedStrikeReservations(
  input: RestoreUnusedStrikeReservationsInput,
): RestoreUnusedStrikeReservationsResult {
  const now = input.now;
  const ticketTtlMs = Math.max(0, input.ticketTtlMs);
  const maxPoolSize = Math.max(0, Math.floor(input.maxPoolSize));
  const pool = input.pool
    .filter((ticket) => now - ticket.createdAt < ticketTtlMs)
    .map((ticket) => ({ ticket: ticket.ticket, randstr: ticket.randstr, createdAt: ticket.createdAt }));
  const existingKeys = new Set(pool.map(strikeTicketKey));
  const restored: StrikeReservationTicket[] = [];

  for (const ticket of input.reserved) {
    const key = strikeTicketKey(ticket);
    if (input.spentKeys.has(key)) continue;
    if (now - ticket.createdAt >= ticketTtlMs) continue;
    if (existingKeys.has(key)) continue;
    restored.push({ ticket: ticket.ticket, randstr: ticket.randstr, createdAt: ticket.createdAt });
    existingKeys.add(key);
  }

  const next = [...pool, ...restored].sort((a, b) => a.createdAt - b.createdAt);
  if (next.length > maxPoolSize) {
    next.splice(0, next.length - maxPoolSize);
  }

  return { pool: next, restoredCount: restored.length };
}
