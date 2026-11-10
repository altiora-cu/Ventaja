/** Totales del boleto flotante: cuota combinada y probabilidad conjunta de las jugadas sueltas en juego. */

export const MIN_COMBO_LEGS = 2;
export const MAX_COMBO_LEGS = 8;

export interface BoletoLeg {
  fixtureId: number;
  prob: number;
  price: number | null;
}

export interface BoletoTotals {
  /** Producto de las cuotas; null si alguna jugada no tiene cuota. */
  totalPrice: number | null;
  jointProb: number;
  /** Se puede guardar como combinada: entre 2 y 8 jugadas, una por partido. */
  canCombo: boolean;
  /** Hay dos jugadas del mismo partido: una combinada no las acepta juntas. */
  sameFixture: boolean;
}

export function boletoTotals(legs: ReadonlyArray<BoletoLeg>): BoletoTotals {
  const allPriced = legs.length > 0 && legs.every((l) => l.price !== null && l.price > 0);
  const totalPrice = allPriced ? legs.reduce((acc, l) => acc * (l.price as number), 1) : null;
  const jointProb = legs.length > 0 ? legs.reduce((acc, l) => acc * l.prob, 1) : 0;
  const fixtures = new Set(legs.map((l) => l.fixtureId));
  const sameFixture = fixtures.size !== legs.length;
  const canCombo = legs.length >= MIN_COMBO_LEGS && legs.length <= MAX_COMBO_LEGS && !sameFixture;
  return { totalPrice, jointProb, canCombo, sameFixture };
}
