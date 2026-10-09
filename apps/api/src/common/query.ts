import {
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";
export class ListQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsUUID() courseId?: string;
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(["CASH", "BANK"]) method?: "CASH" | "BANK";
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 20;
}
export function pagination(total: number, query: ListQuery, items: unknown[]) {
  return {
    items,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
