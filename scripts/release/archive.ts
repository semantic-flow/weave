export interface ArchiveEntry {
  name: string;
  data: Uint8Array;
  executable?: boolean;
}

const encoder = new TextEncoder();
const tarBlockSize = 512;
const zipLocalFileHeaderSignature = 0x04034b50;
const zipCentralDirectoryHeaderSignature = 0x02014b50;
const zipEndOfCentralDirectorySignature = 0x06054b50;
const zipDosDate = (1 << 5) | 1;
const zipDosTime = 0;

let crc32Table: Uint32Array | undefined;

export async function createTarGzArchive(
  entries: readonly ArchiveEntry[],
): Promise<Uint8Array> {
  const tarArchive = createTarArchive(entries);
  const gzipStream = new Blob([toArrayBuffer(tarArchive)]).stream()
    .pipeThrough(
      new CompressionStream("gzip"),
    );
  return new Uint8Array(await new Response(gzipStream).arrayBuffer());
}

export function createZipArchive(
  entries: readonly ArchiveEntry[],
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = normalizeArchiveEntryName(entry.name);
    const nameBytes = encoder.encode(name);
    const crc = crc32(entry.data);
    const mode = entry.executable ? 0o755 : 0o644;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, zipLocalFileHeaderSignature, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, zipDosTime, true);
    localView.setUint16(12, zipDosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, zipCentralDirectoryHeaderSignature, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, zipDosTime, true);
    centralView.setUint16(14, zipDosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, (mode & 0xffff) << 16, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    chunks.push(localHeader, entry.data);
    centralDirectoryChunks.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = sumByteLengths(centralDirectoryChunks);
  chunks.push(...centralDirectoryChunks);

  const endOfCentralDirectory = new Uint8Array(22);
  const endView = new DataView(endOfCentralDirectory.buffer);
  endView.setUint32(0, zipEndOfCentralDirectorySignature, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, centralDirectoryOffset, true);
  endView.setUint16(20, 0, true);
  chunks.push(endOfCentralDirectory);

  return concatBytes(chunks);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(data));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function renderChecksumFile(
  checksum: string,
  archiveName: string,
): string {
  return `${checksum}  ${archiveName}\n`;
}

function createTarArchive(entries: readonly ArchiveEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];

  for (const entry of entries) {
    const name = normalizeArchiveEntryName(entry.name);
    const data = entry.data;
    const header = createTarHeader({
      name,
      mode: entry.executable ? 0o755 : 0o644,
      size: data.length,
    });
    chunks.push(header, data, createPadding(data.length, tarBlockSize));
  }

  chunks.push(new Uint8Array(tarBlockSize * 2));
  return concatBytes(chunks);
}

function createTarHeader(options: {
  name: string;
  mode: number;
  size: number;
}): Uint8Array {
  const header = new Uint8Array(tarBlockSize);
  const nameBytes = encoder.encode(options.name);
  if (nameBytes.length > 100) {
    throw new Error(
      `Archive entry name is too long for ustar: ${options.name}`,
    );
  }

  header.set(nameBytes, 0);
  writeOctal(header, 100, 8, options.mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, options.size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  header.set(encoder.encode("ustar\0"), 257);
  header.set(encoder.encode("00"), 263);

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }

  const checksumText = checksum.toString(8).padStart(6, "0");
  header.set(encoder.encode(checksumText), 148);
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

function writeOctal(
  target: Uint8Array,
  offset: number,
  length: number,
  value: number,
): void {
  const text = value.toString(8).padStart(length - 1, "0");
  target.set(encoder.encode(text), offset);
  target[offset + length - 1] = 0;
}

function createPadding(length: number, blockSize: number): Uint8Array {
  const remainder = length % blockSize;
  return remainder === 0
    ? new Uint8Array()
    : new Uint8Array(blockSize - remainder);
}

function normalizeArchiveEntryName(name: string): string {
  if (
    name.length === 0 || name.startsWith("/") || name.includes("..") ||
    name.includes("\\")
  ) {
    throw new Error(`Invalid archive entry name: ${name}`);
  }
  return name;
}

function crc32(data: Uint8Array): number {
  const table = crc32Table ??= createCrc32Table();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }
  return table;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(sumByteLengths(chunks));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function sumByteLengths(chunks: readonly Uint8Array[]): number {
  return chunks.reduce((total, chunk) => total + chunk.length, 0);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}
