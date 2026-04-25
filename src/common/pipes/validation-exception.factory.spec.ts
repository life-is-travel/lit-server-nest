import { createValidationException } from './validation-exception.factory';

describe('createValidationException', () => {
  it('creates a validation error response with flattened details', () => {
    const exception = createValidationException([
      {
        property: 'customer',
        children: [
          {
            property: 'email',
            constraints: {
              isEmail: 'email must be an email',
            },
          },
        ],
      },
    ]);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: '요청값이 올바르지 않습니다.',
      details: [
        {
          property: 'customer.email',
          constraints: ['email must be an email'],
        },
      ],
    });
  });
});
