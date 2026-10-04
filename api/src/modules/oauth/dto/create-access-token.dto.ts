import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import { SCOPE_READ, SCOPE_WRITE } from '../oauth.constants';
import {
  ACCESS_TOKEN_EXPIRY_OPTIONS,
  type AccessTokenExpiry,
} from '../utils/personal-access-token';

const SCOPE_OPTIONS = [SCOPE_READ, SCOPE_WRITE];

export class CreateAccessTokenDto {
  @ApiProperty({
    enum: ACCESS_TOKEN_EXPIRY_OPTIONS,
    description:
      'How long the token stays valid. "never" issues a token with no expiry, which only stops working when the user leaves the organisation or the signing key is rotated.',
  })
  @IsIn(ACCESS_TOKEN_EXPIRY_OPTIONS)
  expires_in: AccessTokenExpiry;

  @ApiProperty({
    enum: SCOPE_OPTIONS,
    isArray: true,
    description:
      'mcp:read lets the token call read tools; mcp:write lets it create, update and delete.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(SCOPE_OPTIONS, { each: true })
  scopes: string[];
}
