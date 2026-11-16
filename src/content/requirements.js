import { presets } from '../presets.js'

const pendingRules = [
  ['format', 'Формат файла', 'Файл пішімі'],
  ['background', 'Фон', 'Фон'],
  ['position', 'Положение головы', 'Бас қалпы'],
  ['expression', 'Выражение лица', 'Бет әлпеті'],
  ['glasses', 'Очки', 'Көзілдірік'],
  ['headwear', 'Головной убор', 'Бас киім'],
  ['lighting', 'Освещение', 'Жарық'],
  ['retouch', 'Ретушь', 'Ретушь'],
].map(([id, ru, kz]) => ({
  id, title: { ru, kz }, todo: 'TODO: добавить правило и его источник после получения официального текста от владельца',
}))

const sources = {
  kz_id: {
    name: 'egov.kz',
    href: 'https://egov.kz/cms/ru/services/passport/pass003_mvd',
  },
  dv: {
    name: 'travel.state.gov',
    href: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html',
  },
}

export const requirements = Object.fromEntries(Object.values(presets).map(preset => [
  preset.id,
  {
    source: sources[preset.id],
    items: [
      {
        id: 'size', source: 'preset',
        title: { ru: 'Размер изображения', kz: 'Сурет өлшемі' },
        detail: { ru: `Готовый файл — ${preset.width} × ${preset.height} пикселей.`, kz: `Дайын файл — ${preset.width} × ${preset.height} пиксель.` },
      },
      {
        id: 'weight', source: 'preset',
        title: { ru: 'Вес файла', kz: 'Файл көлемі' },
        detail: { ru: `Готовый файл — не больше ${preset.maxKb} КБ.`, kz: `Дайын файл ${preset.maxKb} КБ-тан аспайды.` },
      },
      {
        id: 'head', source: 'preset',
        title: { ru: 'Размер головы', kz: 'Бас өлшемі' },
        detail: {
          ru: `От макушки до подбородка — ${preset.headMinPct}–${preset.headMaxPct}% высоты кадра.`,
          kz: `Төбеден иекке дейін — кадр биіктігінің ${preset.headMinPct}–${preset.headMaxPct}%-ы.`,
        },
      },
      ...pendingRules,
    ],
  },
]))
