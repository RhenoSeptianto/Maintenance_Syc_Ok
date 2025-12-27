import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, IsJSON } from 'class-validator';

export class CreateMaintenanceDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsDateString()
  date: string; // ISO string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  storeName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  storeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  technician?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  submittedBy?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  scheduleId?: number;

  @IsOptional()
  @IsString()
  details?: string; // JSON string
}

