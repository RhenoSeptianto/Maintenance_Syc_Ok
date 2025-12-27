import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsDateString()
  start: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedTs?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  storeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}
