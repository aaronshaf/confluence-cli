export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export const VALID_FORMATS = ['storage', 'wiki', 'atlas_doc_format'] as const;
export type ValidFormat = (typeof VALID_FORMATS)[number];

export function isValidFormat(s: string): s is ValidFormat {
  return (VALID_FORMATS as readonly string[]).includes(s);
}
