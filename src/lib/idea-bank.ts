export type SavedIdeaBank = {
  businessType: string;
  audience: string;
  ideas: string[];
  generatedAt: string;
};

export function currentIdeaBank(
  bank: SavedIdeaBank | null | undefined,
  businessType: string,
  audience: string,
) {
  return bank && bank.businessType === businessType && bank.audience.trim() === audience.trim()
    ? bank
    : null;
}
