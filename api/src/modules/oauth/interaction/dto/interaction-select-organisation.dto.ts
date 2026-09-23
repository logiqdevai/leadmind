import { IsString, IsUUID } from 'class-validator';

export class InteractionSelectOrganisationDto {
  @IsString()
  login_token: string;

  @IsUUID()
  organisation_uuid: string;
}
