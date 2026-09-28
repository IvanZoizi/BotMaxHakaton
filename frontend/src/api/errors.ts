import type { ErrorCode, ErrorDetail } from './types';

export class ApiError extends Error {
  code: ErrorCode;
  details: ErrorDetail[];
  status: number;

  constructor(code: ErrorCode, message: string, status: number, details: ErrorDetail[] = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const notLinked = () =>
  new ApiError('NOT_LINKED', 'Сотрудник не найден. Пройдите подключение к компании', 403);

export const forbidden = (message = 'Это действие недоступно для вашей роли') =>
  new ApiError('FORBIDDEN', message, 403);

export const notFound = (message = 'Объект не найден') => new ApiError('NOT_FOUND', message, 404);

export const validationError = (message: string, details: ErrorDetail[] = []) =>
  new ApiError('VALIDATION_ERROR', message, 400, details);

export const ruleViolation = (message: string) => new ApiError('RULE_VIOLATION', message, 422);

export const alreadyResolved = (message: string) => new ApiError('ALREADY_RESOLVED', message, 409);

export const conflict = (message: string) => new ApiError('CONFLICT', message, 409);
