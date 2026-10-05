/** Small uncompressed ZIP writer for the user's JPEG slides and UTF-8 caption. */
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function creativeZip(entries: Array<{ name: string; bytes: Uint8Array }>) {
  const locals: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name),
      checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length),
      view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(12, 33, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, entry.bytes.length, true);
    view.setUint32(22, entry.bytes.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    const directory = new Uint8Array(46 + name.length),
      dv = new DataView(directory.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(14, 33, true);
    dv.setUint32(16, checksum, true);
    dv.setUint32(20, entry.bytes.length, true);
    dv.setUint32(24, entry.bytes.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    directory.set(name, 46);
    locals.push(local, entry.bytes);
    central.push(directory);
    offset += local.length + entry.bytes.length;
  }
  const centralSize = central.reduce((size, bytes) => size + bytes.length, 0);
  const end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const zip = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const bytes of [...locals, ...central, end]) {
    zip.set(bytes, cursor);
    cursor += bytes.length;
  }
  return zip;
}
