/**
 * process-sprites.mjs — Pure-JS PNG sprite processor for Click Rouge
 *
 * Capabilities:
 *   1. Scale golem 32→64 with nearest-neighbor 2x
 *   2. Generate animation frames for fire_skull (breathe) and fire_dragon (float)
 *   3. Apply 2px selout (dark outline) to ALL sprites
 *   4. Backup originals → assets/sprites/_backup/
 *
 * Uses only Node.js built-ins: fs, path, zlib, crypto. No npm packages required.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

// ─────────────────────────────────────────────────────────────
//  Path config
// ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT    = join(__dirname, '..');
const SPRITES    = join(PROJECT, 'assets', 'sprites');
const BACKUP     = join(SPRITES, '_backup');
const MANIFEST   = join(SPRITES, 'manifest.json');

// ─────────────────────────────────────────────────────────────
//  CRC32
// ─────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─────────────────────────────────────────────────────────────
//  PNG chunk helpers
// ─────────────────────────────────────────────────────────────
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readChunks(buf) {
  const chunks = [];
  let off = 8; // skip signature
  while (off < buf.length) {
    const len   = buf.readUInt32BE(off);
    const type  = buf.toString('ascii', off + 4, off + 8);
    const data  = buf.slice(off + 8, off + 8 + len);
    const storedCrc = buf.readUInt32BE(off + 8 + len);
    const calcCrc   = crc32(buf.slice(off + 4, off + 8 + len));
    if (storedCrc !== calcCrc) throw new Error(`CRC mismatch for ${type}: stored=${storedCrc.toString(16)} calc=${calcCrc.toString(16)}`);
    chunks.push({ type, data });
    off += 12 + len;
  }
  return chunks;
}

function makeChunk(type, data) {
  const len   = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const combo = Buffer.concat([typeB, data]);
  const crcB  = Buffer.allocUnsafe(4);
  crcB.writeUInt32BE(crc32(combo));
  return Buffer.concat([len, combo, crcB]);
}

// ─────────────────────────────────────────────────────────────
//  PNG Decode (supports color types 0,2,3,4,6 + Adam7 interlace)
// ─────────────────────────────────────────────────────────────

/** Reconstruct one unfiltered scanline from filtered data */
function unfilterRow(filtered, prevRow, bpp) {
  const len   = filtered.length;
  const recon = new Uint8Array(len);
  for (let x = 0; x < len; x++) {
    const filt = filtered[x];
    const a    = (x >= bpp) ? recon[x - bpp] : 0;
    const b    = prevRow ? prevRow[x] : 0;
    const c    = (prevRow && x >= bpp) ? prevRow[x - bpp] : 0;
    let val;
    switch (filtered._filter) {
      case 0: val = filt; break;
      case 1: val = (filt + a) & 0xFF; break;
      case 2: val = (filt + b) & 0xFF; break;
      case 3: val = (filt + Math.floor((a + b) / 2)) & 0xFF; break;
      case 4: {
        const p  = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
        val = (filt + pr) & 0xFF;
        break;
      }
      default: throw new Error(`Unknown filter type: ${filtered._filter}`);
    }
    recon[x] = val;
  }
  return recon;
}

/** Unpack sub-8-bit indexed pixels from packed bytes */
function unpackIndices(packed, width, bitDepth) {
  const indices = new Uint8Array(width);
  const pixelsPerByte = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  let pi = 0;
  for (let bi = 0; bi < packed.length && pi < width; bi++) {
    for (let s = 8 - bitDepth; s >= 0 && pi < width; s -= bitDepth) {
      indices[pi++] = (packed[bi] >> s) & mask;
    }
  }
  return indices;
}

/** Look up indexed pixel in PLTE/tRNS and write RGBA to buffer at offset */
function indexedToRGBA(index, pixels, offset, palette, trans) {
  if (index < palette.length) {
    const c = palette[index];
    pixels[offset]     = c.r;
    pixels[offset + 1] = c.g;
    pixels[offset + 2] = c.b;
    pixels[offset + 3] = (trans && index < trans.length) ? trans[index] : 255;
  } else {
    pixels[offset]     = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 0;
  }
}

/** Expand a single row of raw bytes to RGBA pixels into a target buffer */
function expandToRGBA(recon, dstRow, width, colorType, pixels, palette, trans) {
  const rowBase = dstRow * width * 4;
  for (let x = 0; x < width; x++) {
    const dstOff = rowBase + x * 4;
    switch (colorType) {
      case 6: // RGBA
        pixels[dstOff]     = recon[x * 4];
        pixels[dstOff + 1] = recon[x * 4 + 1];
        pixels[dstOff + 2] = recon[x * 4 + 2];
        pixels[dstOff + 3] = recon[x * 4 + 3];
        break;
      case 2: // RGB -> RGBA
        pixels[dstOff]     = recon[x * 3];
        pixels[dstOff + 1] = recon[x * 3 + 1];
        pixels[dstOff + 2] = recon[x * 3 + 2];
        pixels[dstOff + 3] = 255;
        break;
      case 0: // Gray -> RGBA
        pixels[dstOff]     = recon[x];
        pixels[dstOff + 1] = recon[x];
        pixels[dstOff + 2] = recon[x];
        pixels[dstOff + 3] = 255;
        break;
      case 4: // Gray+Alpha -> RGBA
        pixels[dstOff]     = recon[x * 2];
        pixels[dstOff + 1] = recon[x * 2];
        pixels[dstOff + 2] = recon[x * 2];
        pixels[dstOff + 3] = recon[x * 2 + 1];
        break;
      case 3: // Indexed -> RGBA
        indexedToRGBA(recon[x], pixels, dstOff, palette, trans);
        break;
    }
  }
}

// Adam7 pass descriptors: [startRow, startCol, rowInc, colInc]
const ADAM7 = [
  [0, 0, 8, 8], [0, 4, 8, 8], [4, 0, 8, 4],
  [0, 2, 4, 4], [2, 0, 4, 2], [0, 1, 2, 2],
  [1, 0, 2, 1],
];

function parsePNG(buf) {
  const chunks = readChunks(buf);
  const ihdr   = chunks.find(c => c.type === 'IHDR');
  if (!ihdr) throw new Error('Missing IHDR');

  const width       = ihdr.data.readUInt32BE(0);
  const height      = ihdr.data.readUInt32BE(4);
  const bitDepth    = ihdr.data.readUInt8(8);
  const colorType   = ihdr.data.readUInt8(9);
  const interlace   = ihdr.data.readUInt8(12);

  // Read palette for indexed-color
  let palette = null;
  let trans   = null;
  if (colorType === 3) {
    const plteChunk = chunks.find(c => c.type === 'PLTE');
    if (!plteChunk) throw new Error('Indexed PNG missing PLTE chunk');
    palette = [];
    for (let i = 0; i < plteChunk.data.length; i += 3) {
      palette.push({ r: plteChunk.data[i], g: plteChunk.data[i + 1], b: plteChunk.data[i + 2] });
    }
    // Optional tRNS for alpha per palette entry
    const trnsChunk = chunks.find(c => c.type === 'tRNS');
    if (trnsChunk) {
      trans = new Uint8Array(trnsChunk.data);
    }
  }

  // Determine bytes per pixel (for filtering) and raw byte count per row
  let bpp, rawRowBytes;
  switch (colorType) {
    case 0: bpp = Math.max(1, bitDepth / 8); rawRowBytes = width * bpp; break;
    case 2: bpp = 3 * Math.max(1, bitDepth / 8); rawRowBytes = width * bpp; break;
    case 3: bpp = 1; rawRowBytes = Math.ceil(width * bitDepth / 8); break;
    case 4: bpp = 2 * Math.max(1, bitDepth / 8); rawRowBytes = width * bpp; break;
    case 6: bpp = 4 * Math.max(1, bitDepth / 8); rawRowBytes = width * bpp; break;
    default: throw new Error(`Unsupported color type: ${colorType}`);
  }

  // Collect all IDAT data
  const idats      = chunks.filter(c => c.type === 'IDAT');
  const compressed = Buffer.concat(idats.map(c => c.data));
  const raw        = zlib.inflateSync(compressed);

  const pixels = new Uint8Array(width * height * 4); // always output RGBA

  if (interlace === 0) {
    // ── Non-interlaced path ──
    const stride = rawRowBytes + 1;
    let prevRow  = null;
    for (let y = 0; y < height; y++) {
      const filter         = raw[y * stride];
      const filtered       = raw.slice(y * stride + 1, y * stride + 1 + rawRowBytes);
      filtered._filter     = filter;
      const recon          = unfilterRow(filtered, prevRow, bpp);

      // For sub-8-bit indexed, unpack indices before expanding
      if (colorType === 3 && bitDepth < 8) {
        const indices = unpackIndices(recon, width, bitDepth);
        expandToRGBA(indices, y, width, 3, pixels, palette, trans);
      } else {
        expandToRGBA(recon, y, width, colorType, pixels, palette, trans);
      }
      prevRow = recon;
    }
  } else if (interlace === 1) {
    // ── Adam7 interlaced path ──
    let rawOff = 0;

    for (const pass of ADAM7) {
      const [startRow, startCol, rowInc, colInc] = pass;
      if (startCol >= width || startRow >= height) continue;

      const subW = Math.ceil((width - startCol) / colInc);
      const subH = Math.ceil((height - startRow) / rowInc);
      if (subW === 0 || subH === 0) continue;

      const subRawRowBytes = (colorType === 3)
        ? Math.ceil(subW * bitDepth / 8)
        : subW * bpp;

      let prevRow = null;
      for (let subY = 0; subY < subH; subY++) {
        const filter     = raw[rawOff];
        const filtered   = raw.slice(rawOff + 1, rawOff + 1 + subRawRowBytes);
        filtered._filter = filter;
        const recon      = unfilterRow(filtered, prevRow, bpp);

        const imgY = startRow + subY * rowInc;

        // Get the per-pixel values (indices or raw bytes)
        let perPixel;
        if (colorType === 3 && bitDepth < 8) {
          perPixel = unpackIndices(recon, subW, bitDepth);
        } else {
          perPixel = recon;
        }

        for (let subX = 0; subX < subW; subX++) {
          const imgX = startCol + subX * colInc;
          const dstOff = (imgY * width + imgX) * 4;
          switch (colorType) {
            case 6:
              pixels[dstOff]     = perPixel[subX * 4];
              pixels[dstOff + 1] = perPixel[subX * 4 + 1];
              pixels[dstOff + 2] = perPixel[subX * 4 + 2];
              pixels[dstOff + 3] = perPixel[subX * 4 + 3];
              break;
            case 2:
              pixels[dstOff]     = perPixel[subX * 3];
              pixels[dstOff + 1] = perPixel[subX * 3 + 1];
              pixels[dstOff + 2] = perPixel[subX * 3 + 2];
              pixels[dstOff + 3] = 255;
              break;
            case 0:
              pixels[dstOff]     = perPixel[subX];
              pixels[dstOff + 1] = perPixel[subX];
              pixels[dstOff + 2] = perPixel[subX];
              pixels[dstOff + 3] = 255;
              break;
            case 4:
              pixels[dstOff]     = perPixel[subX * 2];
              pixels[dstOff + 1] = perPixel[subX * 2];
              pixels[dstOff + 2] = perPixel[subX * 2];
              pixels[dstOff + 3] = perPixel[subX * 2 + 1];
              break;
            case 3:
              indexedToRGBA(perPixel[subX], pixels, dstOff, palette, trans);
              break;
          }
        }
        prevRow = recon;
        rawOff += 1 + subRawRowBytes;
      }
    }
  } else {
    throw new Error(`Unknown interlace method: ${interlace}`);
  }

  return { width, height, pixels, colorType, bitDepth };
}

// ─────────────────────────────────────────────────────────────
//  PNG Encode (always RGBA, filter 0, no interlace)
// ─────────────────────────────────────────────────────────────
function encodePNG(width, height, pixels) {
  // Build IHDR
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(6, 9);         // color type = RGBA
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace

  // Build raw scanlines (filter byte 0 per row)
  const stride = width * 4 + 1;
  const raw = Buffer.allocUnsafe(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: None
    const srcOff = y * width * 4;
    const dstOff = y * stride + 1;
    for (let x = 0; x < width * 4; x++) {
      raw[dstOff + x] = pixels[srcOff + x];
    }
  }

  // Compress
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // Assemble
  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─────────────────────────────────────────────────────────────
//  Image-processing functions
// ─────────────────────────────────────────────────────────────

/** Nearest-neighbor scale to exact dimensions */
function scaleNN(pixels, srcW, srcH, dstW, dstH) {
  const out = new Uint8Array(dstW * dstH * 4);
  const sx = srcW / dstW;
  const sy = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const srcY = Math.floor(y * sy);
    for (let x = 0; x < dstW; x++) {
      const srcX  = Math.floor(x * sx);
      const si    = (srcY * srcW + srcX) * 4;
      const di    = (y * dstW + x) * 4;
      out[di]     = pixels[si];
      out[di + 1] = pixels[si + 1];
      out[di + 2] = pixels[si + 2];
      out[di + 3] = pixels[si + 3];
    }
  }
  return out;
}

/** Center a smaller image inside a larger frame (transparent padding) */
function padToSize(pixels, srcW, srcH, dstW, dstH) {
  const out  = new Uint8Array(dstW * dstH * 4).fill(0);
  const ox   = Math.floor((dstW - srcW) / 2);
  const oy   = Math.floor((dstH - srcH) / 2);
  for (let y = 0; y < srcH; y++) {
    const dy = oy + y;
    if (dy < 0 || dy >= dstH) continue;
    for (let x = 0; x < srcW; x++) {
      const dx = ox + x;
      if (dx < 0 || dx >= dstW) continue;
      const si = (y * srcW + x) * 4;
      const di = (dy * dstW + dx) * 4;
      out[di]     = pixels[si];
      out[di + 1] = pixels[si + 1];
      out[di + 2] = pixels[si + 2];
      out[di + 3] = pixels[si + 3];
    }
  }
  return out;
}

/** Apply selout — dark outline on alpha boundaries across entire image */
function applySelout(pixels, width, height, radius) {
  const out = new Uint8Array(pixels);
  const outlineR = 0, outlineG = 0, outlineB = 0, outlineA = 128;

  // First pass: find boundary pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = (y * width + x) * 4;
      if (out[ci + 3] > 0) continue; // Already occupied

      // Check if any neighbor within radius is opaque
      let neighborOpaque = false;
      for (let dy = -radius; dy <= radius && !neighborOpaque; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius && !neighborOpaque; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const ni = (ny * width + nx) * 4;
          if (pixels[ni + 3] > 0) neighborOpaque = true;
        }
      }

      if (neighborOpaque) {
        out[ci]     = outlineR;
        out[ci + 1] = outlineG;
        out[ci + 2] = outlineB;
        out[ci + 3] = outlineA;
      }
    }
  }
  return out;
}

/** Apply selout to a spritesheet, respecting per-frame boundaries */
function applySeloutSpritesheet(pixels, totalW, totalH, frameW, frameH, frames, radius) {
  const out = new Uint8Array(pixels);

  for (let f = 0; f < frames; f++) {
    const frameX = f * frameW;
    // Collect opaque pixels within this frame
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const ci = (y * totalW + frameX + x) * 4;
        if (out[ci + 3] > 0) continue;

        let neighborOpaque = false;
        for (let dy = -radius; dy <= radius && !neighborOpaque; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= frameH) continue;
          for (let dx = -radius; dx <= radius && !neighborOpaque; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= frameW) continue;
            const ni = (ny * totalW + frameX + nx) * 4;
            if (pixels[ni + 3] > 0) neighborOpaque = true;
          }
        }

        if (neighborOpaque) {
          out[ci]     = 0;
          out[ci + 1] = 0;
          out[ci + 2] = 0;
          out[ci + 3] = 128;
        }
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
//  Frame generation
// ─────────────────────────────────────────────────────────────

/** fire_skull: 3-frame breathe (original, shrink 2%, enlarge 2%) */
function generateBreatheFrames(pixels, w, h) {
  const frames = [];

  // Frame 0: original
  frames.push({ pixels, width: w, height: h });

  // Frame 1: shrink to 98%
  const s98W = Math.round(w * 0.98);
  const s98H = Math.round(h * 0.98);
  let shrunk = scaleNN(pixels, w, h, s98W, s98H);
  shrunk = padToSize(shrunk, s98W, s98H, w, h);
  frames.push({ pixels: shrunk, width: w, height: h });

  // Frame 2: grow to 102%
  const s102W = Math.round(w * 1.02);
  const s102H = Math.round(h * 1.02);
  let grown = scaleNN(pixels, w, h, s102W, s102H);
  grown = padToSize(grown, s102W, s102H, w, h);
  frames.push({ pixels: grown, width: w, height: h });

  return frames;
}

/** fire_dragon: 3-frame float (original, up 3px, down 3px) */
function generateFloatFrames(pixels, w, h) {
  const frames = [];
  const shift  = 3;

  // Frame 0: original
  frames.push({ pixels, width: w, height: h });

  // Frame 1: shift up
  {
    const up = new Uint8Array(w * h * 4).fill(0);
    for (let y = 0; y < h; y++) {
      const dstY = y - shift;
      if (dstY < 0) continue;
      const si = (y * w) * 4;
      const di = (dstY * w) * 4;
      up.set(pixels.slice(si, si + w * 4), di);
    }
    frames.push({ pixels: up, width: w, height: h });
  }

  // Frame 2: shift down
  {
    const down = new Uint8Array(w * h * 4).fill(0);
    for (let y = 0; y < h; y++) {
      const dstY = y + shift;
      if (dstY >= h) continue;
      const si = (y * w) * 4;
      const di = (dstY * w) * 4;
      down.set(pixels.slice(si, si + w * 4), di);
    }
    frames.push({ pixels: down, width: w, height: h });
  }

  return frames;
}

/** Combine N frames into horizontal spritesheet */
function makeSpritesheet(frames) {
  const fw = frames[0].width;
  const fh = frames[0].height;
  const totalW = fw * frames.length;
  const out = new Uint8Array(totalW * fh * 4).fill(0);

  for (let i = 0; i < frames.length; i++) {
    const src      = frames[i].pixels;
    const offsetX  = i * fw;
    for (let y = 0; y < fh; y++) {
      const si = y * fw * 4;
      const di = (y * totalW + offsetX) * 4;
      out.set(src.slice(si, si + fw * 4), di);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
//  Backup
// ─────────────────────────────────────────────────────────────
function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function backupFile(srcPath) {
  const rel    = srcPath.slice(SPRITES.length + 1); // relative to SPRITES dir
  const dst    = join(BACKUP, rel);
  const dstDir = dirname(dst);
  ensureDir(dstDir);
  copyFileSync(srcPath, dst);
  console.log(`  backup: ${rel}`);
}

function backupSprites(manifest) {
  console.log('\n=== BACKUP ===');
  ensureDir(BACKUP);

  const backedUp = new Set();
  for (const key of Object.keys(manifest)) {
    const filePath = join(SPRITES, manifest[key].file);
    if (!backedUp.has(filePath)) {
      // Strip to relative path using forward slash for cross-platform
      const rel = manifest[key].file;
      backupFile(filePath);
      backedUp.add(filePath);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Load / Save convenience
// ─────────────────────────────────────────────────────────────
function loadSprite(relPath) {
  const fullPath = join(SPRITES, relPath);
  const buf = readFileSync(fullPath);
  const img = parsePNG(buf);
  console.log(`  loaded: ${relPath} (${img.width}x${img.height}, type=${img.colorType})`);
  return img;
}

function saveSprite(relPath, pixels, width, height) {
  const fullPath = join(SPRITES, relPath);
  ensureDir(dirname(fullPath));
  const buf = encodePNG(width, height, pixels);
  writeFileSync(fullPath, buf);
  console.log(`  saved: ${relPath} (${width}x${height})`);
}

// ─────────────────────────────────────────────────────────────
//  Process individual sprites
// ─────────────────────────────────────────────────────────────
function processGolem(manifest) {
  console.log('\n=== GOLEM: 32x32 → 64x64 (nearest-neighbor 2x) ===');
  const entry = manifest.golem;
  const img = loadSprite(entry.file);

  // Idempotency: skip if already processed
  if (entry.frameW >= 64 && entry.frameH >= 64 && img.width === 64 && img.height === 64) {
    console.log('  SKIP: already 64x64');
    return;
  }

  if (img.width !== 32 || img.height !== 32) {
    console.log(`  WARNING: golem is ${img.width}x${img.height}, not 32x32. Scaling anyway.`);
  }

  // Nearest-neighbor 2x
  const scaled = scaleNN(img.pixels, img.width, img.height, 64, 64);
  // Apply selout
  const outlined = applySelout(scaled, 64, 64, 2);
  saveSprite(entry.file, outlined, 64, 64);

  // Update manifest in memory
  entry.frameW = 64;
  entry.frameH = 64;
  console.log('  manifest updated: frameW=64, frameH=64');
}

function processFireSkull(manifest) {
  console.log('\n=== FIRE_SKULL: 1 frame → 3-frame breathe animation ===');
  const entry = manifest.fire_skull;
  const img = loadSprite(entry.file);

  // Generate 3 breathe frames
  const frames = generateBreatheFrames(img.pixels, img.width, img.height);

  // Build spritesheet
  const spritesheet = makeSpritesheet(frames);

  // Apply per-frame selout
  const outlined = applySeloutSpritesheet(
    spritesheet, img.width * 3, img.height,
    img.width, img.height, 3, 2
  );

  saveSprite(entry.file, outlined, img.width * 3, img.height);

  // Update manifest
  entry.frames  = 3;
  entry.fps     = 3;
  entry.layout  = 'horizontal';
  console.log('  manifest updated: frames=3, fps=3, layout=horizontal');
}

function processFireDragon(manifest) {
  console.log('\n=== FIRE_DRAGON: 1 frame → 3-frame float animation ===');
  const entry = manifest.fire_dragon;
  const img = loadSprite(entry.file);

  // Generate 3 float frames
  const frames = generateFloatFrames(img.pixels, img.width, img.height);

  // Build spritesheet
  const spritesheet = makeSpritesheet(frames);

  // Apply per-frame selout
  const outlined = applySeloutSpritesheet(
    spritesheet, img.width * 3, img.height,
    img.width, img.height, 3, 2
  );

  saveSprite(entry.file, outlined, img.width * 3, img.height);

  // Update manifest
  entry.frames  = 3;
  entry.fps     = 3;
  entry.layout  = 'horizontal';
  console.log('  manifest updated: frames=3, fps=3, layout=horizontal');
}

function processSeloutAll(manifest, skipKeys) {
  console.log('\n=== SELOUT: 2px dark outline (all sprites) ===');
  const skip = new Set(skipKeys);

  for (const [key, entry] of Object.entries(manifest)) {
    if (skip.has(key)) {
      console.log(`  SKIP ${key} (already processed)`);
      continue;
    }

    console.log(`  Processing ${key}...`);
    const img = loadSprite(entry.file);

    const frames = entry.frames || 1;
    const fw     = entry.frameW;
    const fh     = entry.frameH;

    if (frames === 1) {
      // Single-frame: simple selout
      const outlined = applySelout(img.pixels, fw, fh, 2);
      saveSprite(entry.file, outlined, fw, fh);
    } else {
      // Spritesheet: per-frame selout
      const outlined = applySeloutSpritesheet(img.pixels, fw * frames, fh, fw, fh, frames, 2);
      saveSprite(entry.file, outlined, fw * frames, fh);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Manifest I/O
// ─────────────────────────────────────────────────────────────
function saveManifest(manifest) {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log('\nmanifest.json updated');
}

// ─────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────
function main() {
  console.log('=== Click Rouge Sprite Processor ===');
  console.log(`Project root: ${PROJECT}`);
  console.log(`Sprites dir:  ${SPRITES}`);
  console.log(`Backup dir:   ${BACKUP}`);

  // Load manifest
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  console.log(`\nManifest entries: ${Object.keys(manifest).length}`);

  // Step 1: Backup ALL sprite files
  backupSprites(manifest);

  // Step 2: Process golem (scale 2x + selout)
  processGolem(manifest);

  // Step 3: Process fire_skull (breathe animation + selout)
  processFireSkull(manifest);

  // Step 4: Process fire_dragon (float animation + selout)
  processFireDragon(manifest);

  // Step 5: Apply selout to remaining sprites
  processSeloutAll(manifest, ['golem', 'fire_skull', 'fire_dragon']);

  // Step 6: Save updated manifest
  saveManifest(manifest);

  console.log('\n=== DONE ===');
}

main();
