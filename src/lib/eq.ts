/** Six-band graphic equaliser: a low shelf, four peaking bands and a high shelf. */
export const EQ_BANDS = [60, 170, 450, 1200, 3500, 10000] as const;
export const EQ_LABELS = ['60', '170', '450', '1.2k', '3.5k', '10k'];
export const EQ_MIN = -12;
export const EQ_MAX = 12;
export const FLAT: number[] = [0, 0, 0, 0, 0, 0];

export interface EqPreset {
  id: string;
  name: string;
  gains: number[];
}

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'সমান', gains: FLAT },
  { id: 'voice', name: 'কণ্ঠ', gains: [-4, -2, 1, 4, 5, 2] },
  { id: 'bass', name: 'বেস', gains: [7, 5, 2, 0, -1, 0] },
  { id: 'radio', name: 'পুরনো রেডিও', gains: [-10, -4, 3, 6, 2, -8] },
  { id: 'night', name: 'রাতের শোনা', gains: [-3, -1, 2, 3, 1, -4] },
  { id: 'horror', name: 'ভৌতিক', gains: [6, 3, -2, 1, 4, 6] },
];

export const isFlat = (gains: number[]) => gains.every((g) => g === 0);

export function presetFor(gains: number[]): EqPreset | undefined {
  return EQ_PRESETS.find((p) => p.gains.every((g, i) => g === gains[i]));
}
