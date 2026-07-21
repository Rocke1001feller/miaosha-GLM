interface StrikeTicket {
  ticket: string;
  randstr: string;
  createdAt: number;
}

export interface StrikeTarget {
  productId: string;
  priority: number; // 1, 2, 3
}

export interface StrikeShot {
  productId: string;
  ticket: string;
  randstr: string;
  createdAt: number;
  priority: number;
}

interface StrikePlan {
  shots: StrikeShot[];
}

interface BuildStrikeQueueInput {
  tickets: StrikeTicket[];
  targets: StrikeTarget[]; // ordered by priority ascending (P1 first), max 3
}

/**
 * Pick the next target in a weighted round-robin that front-loads priority 1.
 * Pattern repeats every 5 slots:
 *   1 target: [P1, P1, P1, P1, P1]
 *   2 targets: [P1, P1, P2, P1, P2]
 *   3 targets: [P1, P1, P2, P1, P3]
 */
function pickTargetByWeightedRoundRobin(index: number, targets: StrikeTarget[]): StrikeTarget {
  const count = targets.length;
  if (count === 1) return targets[0];

  const slot = index % 5;
  if (count === 2) {
    // [P1, P1, P2, P1, P2]
    const map = [0, 0, 1, 0, 1];
    return targets[map[slot]];
  }

  // 3 targets: [P1, P1, P2, P1, P3]
  const map = [0, 0, 1, 0, 2];
  return targets[map[slot]];
}

export function buildStrikeQueue(input: BuildStrikeQueueInput): StrikePlan {
  // Sort tickets newest-first so the freshest ticket (furthest from expiry)
  // gets shot index 0. The first shot has no sliding-window baggage and the
  // highest chance of reaching business logic.
  const tickets = (input.tickets || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  const targets = (input.targets || []).filter((t) => t && t.productId).slice(0, 3);

  if (tickets.length === 0 || targets.length === 0) {
    return { shots: [] };
  }

  const shots: StrikeShot[] = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const target = pickTargetByWeightedRoundRobin(i, targets);
    shots.push({
      productId: target.productId,
      ticket: ticket.ticket,
      randstr: ticket.randstr,
      createdAt: ticket.createdAt,
      priority: target.priority,
    });
  }

  return { shots };
}
