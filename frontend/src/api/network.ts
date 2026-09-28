/** Simulated network latency so loading/skeleton states are actually visible in the demo. */
export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
