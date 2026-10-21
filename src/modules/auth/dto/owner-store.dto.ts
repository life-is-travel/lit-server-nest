import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { RegisterDto } from './register.dto';

/** 매장 추가(F-026): 회원가입 매장 정보에서 이메일·비밀번호만 뺀다. */
export class AddStoreDto extends OmitType(RegisterDto, [
  'email',
  'password',
] as const) {}

export class SwitchStoreDto {
  @ApiPropertyOptional({ description: '지금 매장의 refresh 토큰(폐기용)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
