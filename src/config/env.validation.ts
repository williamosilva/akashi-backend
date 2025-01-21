import { plainToClass } from 'class-transformer';
import { IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  MONGODB_URI: string;

  //   @IsString()
  //   JWT_ACCESS_SECRET: string;

  //   @IsString()
  //   JWT_REFRESH_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
