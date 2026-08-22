import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { API_ERROR_CODES } from '@market/shared-types';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter';

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  function createHost(url = '/test') {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    };
    return { host, status, json };
  }

  it('maps validation HttpException with message array', () => {
    const { host, status, json } = createHost('/auth/register');
    filter.catch(
      new BadRequestException({ message: ['email must be an email'], error: 'Bad Request' }),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Validation failed',
        details: ['email must be an email'],
        path: '/auth/register',
      }),
    );
  });

  it('maps unauthorized with explicit code', () => {
    const { host, status, json } = createHost('/auth/login');
    filter.catch(
      new UnauthorizedException({
        code: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      }),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      }),
    );
  });

  it('maps conflict with explicit code', () => {
    const { host, json } = createHost();
    filter.catch(
      new ConflictException({
        code: API_ERROR_CODES.AUTH_EMAIL_TAKEN,
        message: 'Email is already registered',
      }),
      host as never,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: API_ERROR_CODES.AUTH_EMAIL_TAKEN,
      }),
    );
  });

  it('maps string HttpException response', () => {
    const { host, json } = createHost();
    filter.catch(new HttpException('nope', 418), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 418,
        code: 'HTTP_418',
        message: 'nope',
      }),
    );
  });

  it('maps unauthorized without code to AUTH_UNAUTHORIZED', () => {
    const { host, json } = createHost();
    filter.catch(new UnauthorizedException(), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: API_ERROR_CODES.AUTH_UNAUTHORIZED,
      }),
    );
  });

  it('maps unknown errors to INTERNAL_ERROR and logs', () => {
    const { host, status, json } = createHost();
    const errorSpy = jest.spyOn((filter as unknown as { logger: { error: jest.Mock } }).logger, 'error').mockImplementation();

    filter.catch(new Error('boom'), host as never);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('maps non-Error unknown to INTERNAL_ERROR', () => {
    const { host, json } = createHost();
    const errorSpy = jest.spyOn((filter as unknown as { logger: { error: jest.Mock } }).logger, 'error').mockImplementation();

    filter.catch('weird', host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: API_ERROR_CODES.INTERNAL_ERROR }),
    );
    errorSpy.mockRestore();
  });

  it('maps object response with string message and details', () => {
    const { host, json } = createHost();
    filter.catch(
      new BadRequestException({ message: 'bad field', details: { field: 'email' } }),
      host as never,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'bad field',
        details: { field: 'email' },
        code: API_ERROR_CODES.VALIDATION_FAILED,
      }),
    );
  });

  it('maps object response without code using HTTP status fallback', () => {
    const { host, json } = createHost();
    filter.catch(new HttpException({ message: 'nope' }, 403), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'HTTP_403',
        message: 'nope',
      }),
    );
  });

  it('maps unauthorized string response to AUTH_UNAUTHORIZED', () => {
    const { host, json } = createHost();
    filter.catch(new UnauthorizedException('missing token'), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: API_ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'missing token',
      }),
    );
  });

  it('maps object response with non-string message using exception.message', () => {
    const { host, json } = createHost();
    filter.catch(new BadRequestException({ message: 42 }), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.any(String),
        code: API_ERROR_CODES.VALIDATION_FAILED,
      }),
    );
  });

  it('maps HttpException string body with 401 to AUTH_UNAUTHORIZED', () => {
    const { host, json } = createHost();
    filter.catch(new HttpException('missing token', 401), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: API_ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'missing token',
      }),
    );
  });
});
