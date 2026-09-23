import { IsUUID } from 'class-validator';

export class InteractionLoginDto {
  @IsUUID()
  organisation_uuid: string;
}
