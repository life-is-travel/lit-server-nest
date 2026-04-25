import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ApiErrorResponse } from '../responses/api-response.type';
import { HttpExceptionFilter } from './http-exception.filter';

type MockResponse = {
  status: jest.Mock<MockResponse, [number]>;
  json: jest.Mock<MockResponse, [ApiErrorResponse]>;
};

const createMockHost = (): {
  host: ArgumentsHost;
  response: MockResponse;
} => {
  const response = {
    status: jest.fn<MockResponse, [number]>(),
    json: jest.fn<MockResponse, [ApiErrorResponse]>(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, response };
};

describe('HttpExceptionFilter', () => {
  it('formats http exceptions with the common error response format', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createMockHost();
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '요청값이 올바르지 않습니다.',
      details: [{ property: 'email', constraints: ['email must be an email'] }],
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);

    const [[body]] = response.json.mock.calls;

    expect(body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '요청값이 올바르지 않습니다.',
        details: [
          {
            property: 'email',
            constraints: ['email must be an email'],
          },
        ],
      },
      timestamp: expect.any(String) as string,
    });
  });
});
