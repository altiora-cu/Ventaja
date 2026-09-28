import type { PickResult } from '@/lib/db/types';

export interface ComboLeg {
  /** null mientras el partido no tenga resultado. */
  result: PickResult | null;
  price: number | null;
}

const STAKE_UNITS = 1;

/**
 * Resultado de una combinada a partir de sus selecciones. Devuelve null si sigue pendiente.
 * Una selección fallada pierde la combinada; una nula cuenta como cuota 1. Función pura con tests.
 */
export function settleCombo(legs: readonly ComboLeg[]): PickResult | null {
  if (!legs.length) return null;
  if (legs.some((l) => l.result === 'fallo')) return 'fallo';
  if (legs.some((l) => l.result === null)) return null;
  if (legs.every((l) => l.result === 'nulo')) return 'nulo';
  return 'acierto';
}

/** Unidades con stake 1u: producto de las cuotas acertadas menos el stake. */
export function comboUnits(result: PickResult, legs: readonly ComboLeg[]): number {
  if (result === 'nulo') return 0;
  if (result === 'fallo') return -STAKE_UNITS;
  const winners = legs.filter((l) => l.result === 'acierto');
  if (winners.some((l) => !l.price)) return 0;
  const totalPrice = winners.reduce((acc, l) => acc * Number(l.price), 1);
  return Math.round((totalPrice - STAKE_UNITS) * 100) / 100;
}
