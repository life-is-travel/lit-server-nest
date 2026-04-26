import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(
    password: string,
    hash: string | null | undefined,
  ): Promise<boolean> {
    if (!hash) {
      return false;
    }

    return bcrypt.compare(password, hash);
  }
}
