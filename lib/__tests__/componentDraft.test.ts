import {
  createDraftFromPreset,
  draftRowToInput,
  draftsToInputs,
  type ComponentDraftRow,
} from '../chef/componentDraft';
import { finalizeComponentQuantities } from '../marketplace/componentNormalize';

describe('componentDraft', () => {
  it('converts included and addon drafts to API inputs', () => {
    const rows: ComponentDraftRow[] = [
      createDraftFromPreset('Roti'),
      createDraftFromPreset('Gulab Jamun'),
      createDraftFromPreset('Cheese'),
    ];
    const inputs = draftsToInputs(rows);
    expect(inputs).toHaveLength(3);
    expect(inputs[0]?.component_type).toBe('included');
    expect(inputs[1]?.component_type).toBe('addon_toggle');
    expect(inputs[1]?.included_qty).toBe(0);
    expect(inputs[2]?.component_type).toBe('addon_stepper');
    expect(inputs[2]?.included_qty).toBe(0);
  });

  it('drops rows without a name', () => {
    const inputs = draftsToInputs([
      { ...createDraftFromPreset('Roti'), name: '  ' },
      createDraftFromPreset('Aachar'),
    ]);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.name).toBe('Aachar');
  });

  it('enforces addon qty rules on conversion', () => {
    const row = createDraftFromPreset('Gulab Jamun');
    const input = draftRowToInput(row);
    expect(input).toMatchObject(
      finalizeComponentQuantities({ component_type: 'addon_toggle', included_qty: 0, min_qty: 0, max_qty: 1 }),
    );
  });

  it('drops duplicate component names when converting drafts', () => {
    const inputs = draftsToInputs([
      createDraftFromPreset('Aachar'),
      createDraftFromPreset('Aachar'),
      createDraftFromPreset('Chaas'),
    ]);
    expect(inputs).toHaveLength(2);
    expect(inputs.map((c) => c.name)).toEqual(['Aachar', 'Chaas']);
  });
});
