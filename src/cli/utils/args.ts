/**
 * Find a positional argument in args, skipping flags and their values.
 * --flag <value> pairs are identified by their indices so we never mistake
 * a flag's value for a positional argument even if they are equal strings.
 */
export function findPositional(args: string[], flagsWithValues: string[]): string | undefined {
  const flagValueIndices = new Set<number>();
  for (const flag of flagsWithValues) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
      flagValueIndices.add(idx + 1);
    }
  }
  return args.find((arg, i) => !arg.startsWith('--') && !flagValueIndices.has(i));
}
