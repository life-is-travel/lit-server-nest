type TransformParams = {
  value: unknown;
  obj?: Record<string, unknown>;
  key?: string;
};

const originalValue = ({ value, obj, key }: TransformParams): unknown =>
  obj && key ? obj[key] : value;

export const emptyToUndefined = (params: TransformParams): unknown => {
  const value = originalValue(params);
  return value === '' || value === null ? undefined : params.value;
};

export const optionalNumber = (params: TransformParams): unknown => {
  const value = originalValue(params);
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? value : numberValue;
};

export const optionalBoolean = (params: TransformParams): unknown => {
  const value = originalValue(params);
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return value;
};

export const optionalDateString = (params: TransformParams): unknown => {
  const value = originalValue(params);
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return value;
};
