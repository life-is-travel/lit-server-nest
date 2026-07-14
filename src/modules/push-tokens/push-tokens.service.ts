import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/database/prisma.service';
import { DeletePushTokenDto, RegisterPushTokenDto } from './dto/push-token.dto';

@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * FCM 토큰 등록/갱신. 토큰(unique) 기준 upsert —
   * 이미 등록된 토큰이면 store_id/platform을 갱신한다
   * (기기 재로그인·계정 전환 시 같은 토큰이 다른 매장으로 넘어오는 경우 대응).
   */
  async register(
    storeId: string,
    dto: RegisterPushTokenDto,
  ): Promise<{ id: string }> {
    const record = await this.prisma.owner_push_tokens.upsert({
      where: { token: dto.token },
      create: {
        id: `push_token_${randomUUID()}`,
        store_id: storeId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        store_id: storeId,
        platform: dto.platform,
        updated_at: new Date(),
      },
    });

    this.logger.log({
      event: 'push_tokens.registered',
      storeId,
      platform: dto.platform,
    });

    return { id: record.id };
  }

  /**
   * 토큰 삭제(로그아웃 청소). 소유 매장과 무관하게 토큰 일치 시 삭제한다 —
   * 로그아웃한 기기의 잔여 토큰을 확실히 제거하기 위함.
   */
  async remove(dto: DeletePushTokenDto): Promise<{ deleted: number }> {
    const result = await this.prisma.owner_push_tokens.deleteMany({
      where: { token: dto.token },
    });

    this.logger.log({
      event: 'push_tokens.removed',
      deleted: result.count,
    });

    return { deleted: result.count };
  }
}
