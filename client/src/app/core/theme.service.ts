import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const STORAGE_KEY = 'hs-theme';

/** Quản lý chế độ sáng/tối — lưu lựa chọn vào localStorage, gắn class `theme-dark` lên <body>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly isDark = signal(false);

  constructor() {
    const saved = this.read();
    this.apply(saved);
  }

  toggle(): void {
    this.apply(!this.isDark());
  }

  private apply(dark: boolean): void {
    this.isDark.set(dark);
    this.doc.body.classList.toggle('theme-dark', dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
  }

  private read(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  }
}
