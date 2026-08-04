import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/.*\S.*/, { message: 'Name must not be empty' })
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
