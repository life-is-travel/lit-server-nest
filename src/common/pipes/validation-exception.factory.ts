import { BadRequestException, ValidationError } from '@nestjs/common';

type ValidationErrorDetail = {
  property: string;
  constraints: string[];
};

export const createValidationException = (
  errors: ValidationError[],
): BadRequestException => {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: '요청값이 올바르지 않습니다.',
    details: flattenValidationErrors(errors),
  });
};

const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] => {
  return errors.flatMap((error) => {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const currentError =
      error.constraints && Object.keys(error.constraints).length > 0
        ? [
            {
              property: propertyPath,
              constraints: Object.values(error.constraints),
            },
          ]
        : [];

    return [
      ...currentError,
      ...flattenValidationErrors(error.children ?? [], propertyPath),
    ];
  });
};
