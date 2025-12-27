import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(3)
  @MaxLength(128)
  password: string;

  // Optional legacy field; ignored by backend logic
  @IsOptional()
  @IsIn(['admin', 'user', 'ts'])
  role?: 'admin' | 'user' | 'ts';
}
