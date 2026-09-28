import { describe, expect, it } from 'vitest';
import { comboUnits, settleCombo, type ComboLeg } from './combo-rules';

const leg = (result: ComboLeg['result'], price: number | null = 2): ComboLeg => ({ result, price });

describe('settleCombo', () => {
  it('queda pendiente mientras falte una selección por cerrar y ninguna haya fallado', () => {
    expect(settleCombo([leg('acierto'), leg(null)])).toBeNull();
  });

  it('falla en cuanto una selección falla, aunque queden otras pendientes', () => {
    expect(settleCombo([leg('fallo'), leg(null), leg('acierto')])).toBe('fallo');
  });

  it('acierta cuando todas las selecciones aciertan', () => {
    expect(settleCombo([leg('acierto'), leg('acierto')])).toBe('acierto');
  });

  it('trata una selección nula como cuota 1 y acierta con el resto', () => {
    expect(settleCombo([leg('acierto'), leg('nulo')])).toBe('acierto');
  });

  it('es nula cuando todas las selecciones son nulas', () => {
    expect(settleCombo([leg('nulo'), leg('nulo')])).toBe('nulo');
  });

  it('queda pendiente sin selecciones', () => {
    expect(settleCombo([])).toBeNull();
  });
});

describe('comboUnits', () => {
  it('paga el producto de las cuotas acertadas menos el stake', () => {
    expect(comboUnits('acierto', [leg('acierto', 1.5), leg('acierto', 2)])).toBe(2);
  });

  it('ignora la cuota de las selecciones nulas', () => {
    expect(comboUnits('acierto', [leg('acierto', 1.8), leg('nulo', 3)])).toBe(0.8);
  });

  it('pierde una unidad al fallar y cero al ser nula', () => {
    expect(comboUnits('fallo', [leg('fallo', 2)])).toBe(-1);
    expect(comboUnits('nulo', [leg('nulo', 2)])).toBe(0);
  });

  it('devuelve cero si una selección acertada no tiene cuota', () => {
    expect(comboUnits('acierto', [leg('acierto', null), leg('acierto', 2)])).toBe(0);
  });
});
