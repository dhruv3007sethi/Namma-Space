/**
 * Lightweight magic-byte sniffing so that uploads are not trusted on their
 * declared Content-Type alone. Returns the detected MIME type or null.
 */
export function sniffMediaType(head: Uint8Array): string | null {
  const b = (i: number) => head[i] ?? -1;
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...head.subarray(start, start + len));

  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (
    b(0) === 0x89 &&
    ascii(1, 3) === 'PNG' &&
    b(4) === 0x0d &&
    b(5) === 0x0a &&
    b(6) === 0x1a &&
    b(7) === 0x0a
  ) {
    return 'image/png';
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return 'video/webm';

  // ISO base media file format (MP4, MOV, HEIC): "ftyp" box at offset 4.
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  return null;
}

/** Whether a declared MIME type is consistent with the sniffed one. */
export function mimeTypesCompatible(declared: string, sniffed: string): boolean {
  const d = declared.toLowerCase();
  if (d === sniffed) return true;
  // HEIC/HEIF brands overlap; QuickTime and MP4 containers are often mislabelled by clients.
  const groups = [
    ['image/heic', 'image/heif'],
    ['video/mp4', 'video/quicktime'],
  ];
  return groups.some((g) => g.includes(d) && g.includes(sniffed));
}
