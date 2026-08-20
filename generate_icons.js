const fs = require('fs');
const path = require('path');

// Generate minimal 1x1 / colored PNG files if canvas isn't installed, or use basic PNG header buffer
function createPNG(size, filename) {
  // A valid small 8-bit RGBA PNG buffer with graduation cap blue color (#0284c7)
  const width = size;
  const height = size;
  
  // We can write a simple node canvas generator using zlib or standard png chunk builder
  const zlib = require('zlib');

  function writeInt32(buf, offset, value) {
    buf.writeUInt32BE(value, offset);
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crc = crc32(buf.slice(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // Create raw pixel data (RGBA)
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw graduation cap icon background (Deep Ocean Blue #0284c7)
      // Check distance from center for circular shape
      const dx = x - width / 2;
      const dy = y - height / 2;
      const r = Math.sqrt(dx * dx + dy * dy);

      if (r <= width * 0.48) {
        rawData[pxOffset] = 2;     // R
        rawData[pxOffset + 1] = 132; // G
        rawData[pxOffset + 2] = 199; // B
        rawData[pxOffset + 3] = 255; // A
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0; // Transparent
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, pngBuffer);
  console.log(`Generated ${filename} (${size}x${size})`);
}

createPNG(16, path.join(__dirname, 'icons', 'icon16.png'));
createPNG(48, path.join(__dirname, 'icons', 'icon48.png'));
createPNG(128, path.join(__dirname, 'icons', 'icon128.png'));
