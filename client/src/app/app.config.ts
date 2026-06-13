import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeVi from '@angular/common/locales/vi';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  DeleteOutline,
  DownOutline,
  EditOutline,
  LockOutline,
  LogoutOutline,
  PlusOutline,
  ShoppingOutline,
  TeamOutline,
  UndoOutline,
  UserOutline
} from '@ant-design/icons-angular/icons';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';

registerLocaleData(localeVi);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideNzI18n(vi_VN),
    provideNzIcons([
      UserOutline, LockOutline, DownOutline, LogoutOutline, TeamOutline,
      ShoppingOutline, PlusOutline, EditOutline, DeleteOutline, UndoOutline
    ]),
    { provide: LOCALE_ID, useValue: 'vi' },
    // Khôi phục phiên từ HttpOnly refresh cookie trước khi app render (guards cần biết trạng thái đăng nhập).
    provideAppInitializer(() => inject(AuthService).tryRestoreSession())
  ]
};
