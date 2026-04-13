/**
 * Address display utilities
 *
 * Credit: Based on polkadot-apps/packages/address
 */

/**
 * Truncate an address for display.
 *
 * @param address - Full address (SS58 or H160)
 * @param startChars - Characters to show at the start (default 6)
 * @param endChars - Characters to show at the end (default 4)
 * @returns Truncated string like "5Grwva...utQY"
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return '';
  const minLength = startChars + endChars + 3; // 3 for "..."
  if (address.length <= minLength) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Compare two addresses for equality.
 *
 * H160 (0x-prefixed) addresses are compared case-insensitively.
 * SS58 addresses are compared exactly (base58 is case-sensitive).
 * Mixed types (SS58 vs H160) always return false - use ss58ToH160 to normalize first.
 * SS58 addresses at different prefixes (same key, different network) return false -
 * use normalizeSs58 to re-encode with the same prefix before comparing.
 */
export function addressesEqual(a: string, b: string): boolean {
  if (a === b) return true;
  // H160 addresses are hex, so case-insensitive comparison is safe
  if (a.startsWith('0x') && b.startsWith('0x')) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
}
