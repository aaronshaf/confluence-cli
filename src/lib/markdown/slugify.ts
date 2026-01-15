/**
 * Slugify a string for use as a filename
 * Converts titles to URL-friendly lowercase strings
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
}

/**
 * Generate a unique filename by appending a counter if needed
 */
export function generateUniqueFilename(baseName: string, existingNames: Set<string>, extension = '.md'): string {
  const slug = slugify(baseName);
  const filename = `${slug}${extension}`;

  if (!existingNames.has(filename)) {
    return filename;
  }

  let counter = 2;
  while (existingNames.has(`${slug}-${counter}${extension}`)) {
    counter++;
  }

  return `${slug}-${counter}${extension}`;
}
