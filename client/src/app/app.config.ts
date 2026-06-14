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
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  AppstoreOutline,
  ArrowLeftOutline,
  AuditOutline,
  BarChartOutline,
  BellOutline,
  BookOutline,
  CalendarOutline,
  CheckOutline,
  CloseOutline,
  CopyOutline,
  DashboardOutline,
  DeleteOutline,
  DollarOutline,
  DownOutline,
  EditOutline,
  EyeOutline,
  FileTextOutline,
  GiftOutline,
  IdcardOutline,
  LineChartOutline,
  LinkOutline,
  LockOutline,
  LogoutOutline,
  MailOutline,
  MenuOutline,
  MinusOutline,
  PlusOutline,
  ReadOutline,
  ReloadOutline,
  SaveOutline,
  ScheduleOutline,
  SettingOutline,
  ShoppingOutline,
  SolutionOutline,
  TeamOutline,
  TrophyOutline,
  UndoOutline,
  UserOutline,
  WarningOutline
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
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideNzI18n(vi_VN),
    provideNzIcons([
      UserOutline, LockOutline, DownOutline, LogoutOutline, TeamOutline,
      ShoppingOutline, PlusOutline, EditOutline, DeleteOutline, UndoOutline,
      DashboardOutline, BookOutline, CalendarOutline, ScheduleOutline, ReadOutline,
      FileTextOutline, SolutionOutline, IdcardOutline, AuditOutline, BarChartOutline,
      LineChartOutline, DollarOutline, BellOutline, WarningOutline, LinkOutline,
      MailOutline, CopyOutline, SaveOutline, CheckOutline, CloseOutline, MinusOutline,
      EyeOutline, AppstoreOutline, SettingOutline, MenuOutline, ArrowLeftOutline,
      ReloadOutline, GiftOutline, TrophyOutline
    ]),
    { provide: LOCALE_ID, useValue: 'vi' },
    // Khôi phục phiên từ HttpOnly refresh cookie trước khi app render (guards cần biết trạng thái đăng nhập).
    provideAppInitializer(() => inject(AuthService).tryRestoreSession())
  ]
};
