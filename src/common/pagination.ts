import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ?page=1&limit=20&q=search for the admin lists.
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const DEFAULT_PAGE_SIZE = 20;

/** Page number and size with defaults, plus the row offset. */
export function pageOf(query: PageQueryDto) {
  const page = query.page ?? 1;
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  return { page, limit, skip: (page - 1) * limit };
}

/** Search text for ILIKE, with % and _ taken literally. */
export function likePattern(q: string | undefined) {
  const text = q?.trim();
  return text ? `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
}
