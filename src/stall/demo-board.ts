import sharp from "sharp";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function rounded(
  source: Buffer,
  width: number,
  height: number,
  radius: number
): Promise<Buffer> {
  const image = await sharp(source)
    .resize(width, height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`
  );
  return sharp(image)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export async function renderDemoBoard(input: {
  photo: Buffer;
  heading: string;
  subheading: string;
  tiles: { image: Buffer; label: string }[];
}): Promise<Buffer> {
  const width = 1280;
  const height = 720;
  const photo = await rounded(input.photo, 520, 648, 36);
  const tiles = input.tiles.slice(0, 4);
  const tileW = tiles.length === 1 ? 280 : 176;
  const tileH = tiles.length === 1 ? 340 : 176;
  const rendered = await Promise.all(
    tiles.map(async (tile) => {
      try {
        return await rounded(tile.image, tileW, tileH, 22);
      } catch {
        return null;
      }
    })
  );

  const composites: sharp.OverlayOptions[] = [
    { input: photo, left: 36, top: 36 },
  ];

  const text: string[] = [];
  const originX = 590;
  rendered.forEach((image, index) => {
    if (!image) return;
    const col = tiles.length === 1 ? 0 : index % 2;
    const row = tiles.length === 1 ? 0 : Math.floor(index / 2);
    const left = originX + col * (tileW + 18);
    const top = 156 + row * (tileH + 36);
    composites.push({ input: image, left, top });
    text.push(
      `<text x="${left}" y="${top + tileH + 22}" font-family="DejaVu Sans, sans-serif" font-size="15" fill="#3a3128">${escapeXml(clip(tiles[index].label, 18))}</text>`
    );
  });

  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="590" y="78" font-family="DejaVu Sans, sans-serif" font-size="34" font-weight="700" fill="#1a140f">${escapeXml(clip(input.heading, 28))}</text>
    <text x="590" y="114" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#6d6256">${escapeXml(clip(input.subheading, 46))}</text>
    ${text.join("\n")}
    <text x="590" y="688" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#8a7d70">Demo preview</text>
  </svg>`);

  const background = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#14110e"/>
    <rect x="560" y="24" width="688" height="672" rx="32" fill="#f3eadf"/>
  </svg>`);

  return sharp(background)
    .composite([...composites, { input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 84 })
    .toBuffer();
}
