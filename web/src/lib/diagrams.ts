// Which diagram illustrates which chapter. Kept outside the client component so server pages can read it.
export const DIAGRAMS_BY_CHAPTER: Record<string, [string, string?][]> = {
  'tci.incoterms': [['incoterms', 'FCA']], 'tci.paiement': [['credoc']], 'gfi.equilibre': [['equilibre']], 'gfi.bilan-fonctionnel': [['equilibre']],
  'tou.systeme': [['leiper']], 'tou.destination': [['butler']],
};
