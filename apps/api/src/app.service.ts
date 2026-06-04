import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@sommycomfort/shared';

@Injectable()
export class AppService {
  getHello(): string {
    // Uses the shared workspace package to prove the api ↔ shared link works.
    return `Hello from ${APP_NAME} API!`;
  }
}
