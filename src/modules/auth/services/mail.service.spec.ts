import { ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createMailService = () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number | boolean> = {
        EMAIL_USER: 'contact@lifeistravel.io',
        EMAIL_PASSWORD: 'password',
      };

      return values[key];
    }),
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string | number | boolean> = {
        EMAIL_HOST: 'smtp.example.com',
        EMAIL_PORT: 587,
        EMAIL_SECURE: false,
        EMAIL_FROM: 'Life is Travel <contact@lifeistravel.io>',
      };

      return values[key];
    }),
  };

  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

  return {
    service: new MailService(configService as never),
    sendMail,
  };
};

describe('MailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the reservation mail as HTML with a plain-text alternative', async () => {
    const { service, sendMail } = createMailService();

    await service.sendReservationCreatedEmail('guest@example.com', {
      reservationId: 'res_123456',
      customerName: 'Guest',
      locale: 'en',
      storeName: 'Bin Mama Papa',
      startTime: new Date('2026-06-05T04:00:00.000Z'),
      endTime: new Date('2026-06-05T14:00:00.000Z'),
      bagCount: 1,
      totalAmount: 4500,
    });

    const sent = (
      sendMail.mock.calls as Array<
        [
          {
            to: string;
            from: string;
            subject: string;
            text: string;
            html: string;
          },
        ]
      >
    )[0][0];
    expect(sent.to).toBe('guest@example.com');
    expect(sent.from).toBe('Life is Travel <contact@lifeistravel.io>');
    expect(sent.subject).toBe('[LIT] Reservation confirmed · Jun 5');
    expect(sent.text).toContain('123456');
    expect(sent.text).toContain('Bin Mama Papa');
    expect(sent.html).toContain('<table');
  });

  it('throws when SMTP credentials are missing', async () => {
    const configService = {
      get: jest.fn().mockReturnValue(''),
      getOrThrow: jest.fn(),
    };
    const service = new MailService(configService as never);

    await expect(
      service.sendReservationCreatedEmail('guest@example.com', {
        reservationId: 'res_123456',
        customerName: 'Guest',
        locale: 'en',
        startTime: new Date('2026-06-05T04:00:00.000Z'),
        bagCount: 1,
        totalAmount: 4500,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
