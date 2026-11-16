export const presets = {
  kz_id: {
    id: 'kz_id',
    name: { ru: 'Удостоверение личности РК', kz: 'ҚР жеке куәлігі' },
    width: 413,
    height: 531,
    maxKb: 30,
    headMinPct: 70,
    headMaxPct: 80,
  },
  dv: {
    id: 'dv',
    name: { ru: 'Green Card (DV)', kz: 'Green Card (DV)' },
    width: 600,
    height: 600,
    maxKb: 240,
    headMinPct: 50,
    headMaxPct: 69,
  },
}

export const presetList = Object.values(presets)
