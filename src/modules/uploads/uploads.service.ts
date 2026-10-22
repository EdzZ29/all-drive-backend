import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Image types we accept, identified by their first bytes (not the file name).
const SIGNATURES: {
  ext: string;
  type: string;
  test: (b: Buffer) => boolean;
}[] = [
  {
    ext: 'jpg',
    type: 'image/jpeg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'png',
    type: 'image/png',
    test: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'webp',
    type: 'image/webp',
    test: (b) =>
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    ext: 'gif',
    type: 'image/gif',
    test: (b) => b.toString('ascii', 0, 4) === 'GIF8',
  },
];

// Stores uploaded images. With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
// (production) they go to a public Supabase Storage bucket and get a permanent
// https URL; otherwise (local development) to ./uploads, served at /uploads/.
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {}

  async saveImage(file: Express.Multer.File | undefined, folder: string) {
    if (!file?.buffer?.length)
      throw new BadRequestException('No file uploaded');
    const kind = SIGNATURES.find((s) => s.test(file.buffer));
    if (!kind) {
      throw new BadRequestException(
        'Only JPG, PNG, WebP or GIF images are allowed',
      );
    }
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${kind.ext}`;

    const supabaseUrl = this.config
      .get<string>('SUPABASE_URL')
      ?.replace(/\/+$/, '');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey) {
      const bucket =
        this.config.get<string>('SUPABASE_STORAGE_BUCKET') || 'uploads';
      const path = `${folder}/${name}`;
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': kind.type,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'x-upsert': 'false',
          },
          body: new Uint8Array(file.buffer),
          signal: AbortSignal.timeout(20_000),
        },
      ).catch((err: unknown) => {
        this.logger.error(
          `Supabase upload failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      });
      if (!res?.ok) {
        if (res)
          this.logger.error(
            `Supabase upload failed (${res.status}): ${await res.text().catch(() => '')}`,
          );
        throw new ServiceUnavailableException(
          "Couldn't store the image. Please try again.",
        );
      }
      return {
        url: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
        filename: name,
      };
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, name), file.buffer);
    // Served statically under /uploads (see main.ts).
    return { url: `/uploads/${name}`, filename: name };
  }
}
