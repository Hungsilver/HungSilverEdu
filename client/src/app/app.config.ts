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
  ApartmentOutline,
  AppstoreOutline,
  ArrowLeftOutline,
  AuditOutline,
  BankOutline,
  BarChartOutline,
  BellOutline,
  BookOutline,
  BulbOutline,
  CalendarOutline,
  CameraOutline,
  CheckCircleOutline,
  CheckOutline,
  CloseCircleOutline,
  CloseOutline,
  CopyOutline,
  DashboardOutline,
  DeleteOutline,
  DisconnectOutline,
  DollarOutline,
  DownloadOutline,
  DownOutline,
  EditOutline,
  EyeOutline,
  FallOutline,
  FileExcelOutline,
  FileTextOutline,
  GiftOutline,
  HolderOutline,
  IdcardOutline,
  InsertRowRightOutline,
  KeyOutline,
  LeftOutline,
  LineChartOutline,
  LinkOutline,
  LoadingOutline,
  LockOutline,
  LogoutOutline,
  MailOutline,
  MenuOutline,
  MinusOutline,
  PlusOutline,
  ReadOutline,
  ReloadOutline,
  RightOutline,
  RobotOutline,
  SafetyOutline,
  ClockCircleOutline,
  FileSearchOutline,
  FormOutline,
  SendOutline,
  SaveOutline,
  ScheduleOutline,
  SearchOutline,
  SettingOutline,
  ShoppingOutline,
  SolutionOutline,
  TeamOutline,
  TrophyOutline,
  UndoOutline,
  UnlockOutline,
  UploadOutline,
  UserAddOutline,
  UserDeleteOutline,
  UserOutline,
  WarningOutline,
  ZoomInOutline,
  ZoomOutOutline
} from '@ant-design/icons-angular/icons';
import { provideNzConfig } from 'ng-zorro-antd/core/config';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { routes } from './app.routes';
import { apiResponseInterceptor } from './core/api-response.interceptor';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';

registerLocaleData(localeVi);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiResponseInterceptor, authInterceptor])),
    provideNzI18n(vi_VN),
    provideNzIcons([
      UserOutline, LockOutline, DownOutline, LogoutOutline, TeamOutline,
      ShoppingOutline, PlusOutline, EditOutline, DeleteOutline, UndoOutline,
      DashboardOutline, BookOutline, CalendarOutline, ScheduleOutline, ReadOutline,
      FileTextOutline, SolutionOutline, IdcardOutline, AuditOutline, BarChartOutline,
      LineChartOutline, DollarOutline, BellOutline, WarningOutline, LinkOutline,
      MailOutline, CopyOutline, SaveOutline, CheckOutline, CloseOutline, MinusOutline,
      EyeOutline, AppstoreOutline, SettingOutline, MenuOutline, ArrowLeftOutline,
      ReloadOutline, GiftOutline, TrophyOutline, BulbOutline, CameraOutline, LoadingOutline,
      BankOutline, ApartmentOutline, FileExcelOutline, UploadOutline,
      // Bổ sung icon đang dùng trong template nhưng chưa đăng ký (gây lỗi "<svg> tag not found"):
      SearchOutline, UserAddOutline, DownloadOutline, KeyOutline, UnlockOutline,
      DisconnectOutline, LeftOutline, RightOutline, SafetyOutline, HolderOutline,
      InsertRowRightOutline, ZoomInOutline, ZoomOutOutline, UserDeleteOutline,
      CloseCircleOutline, FallOutline, RobotOutline, CheckCircleOutline,
      ClockCircleOutline, FileSearchOutline, FormOutline, SendOutline
    ]),
    // Theme "Indigo học thuật" — recolor toàn bộ component ng-zorro qua CSS-variable theme.
    provideNzConfig({
      theme: {
        primaryColor: '#4F46E5',
        infoColor: '#4F46E5',
        successColor: '#16A34A',
        warningColor: '#F59E0B',
        errorColor: '#DC2626'
      }
    }),
    { provide: LOCALE_ID, useValue: 'vi' },
    // Khôi phục phiên + áp theme sáng/tối (lấy từ localStorage) trước khi app render —
    // ThemeService khởi tạo sớm để cả trang login cũng đúng chế độ.
    provideAppInitializer(() => {
      inject(ThemeService);
      return inject(AuthService).tryRestoreSession();
    })
  ]
};
