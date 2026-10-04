import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ListPublicHolidaysQueryDto,
  PublicHolidayResponseDto,
} from './dto/public-holiday.dto';
import { PublicHolidaysService } from './public-holidays.service';

/**
 * (공개) 한국 공휴일 목록.
 *
 * 매장의 "공휴일 영업시간"을 적용할지 판단하는 기준이다. 고객 앱은 이 목록을 받아 쓰고,
 * 임시공휴일은 public_holidays 테이블에 행을 추가하면 앱 재배포 없이 반영된다.
 */
@ApiTags('Public Holidays')
@Controller('api/customer/public-holidays')
export class PublicHolidaysController {
  constructor(private readonly publicHolidaysService: PublicHolidaysService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: '(공개) 공휴일 목록',
    description:
      '인증 없이 조회합니다. from/to를 생략하면 오늘(KST)부터 400일치를 반환합니다.',
  })
  @ApiOkResponse({ type: [PublicHolidayResponseDto] })
  list(@Query() query: ListPublicHolidaysQueryDto) {
    return this.publicHolidaysService.list(query);
  }
}
