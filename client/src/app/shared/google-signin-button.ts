import { Component, ElementRef, OnInit, inject, output, viewChild } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (res: { credential: string }) => void }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

/**
 * Nút "Đăng nhập với Google" dùng Google Identity Services.
 * Khi user xác thực xong, GIS trả về ID token (JWT) → emit qua (credential)
 * để gửi về POST /api/auth/google.
 * Chưa cấu hình googleClientId trong environment thì hiển thị ghi chú thay vì nút.
 */
@Component({
  selector: 'app-google-signin-button',
  template: `
    @if (clientId) {
      <div #buttonHost></div>
    } @else {
      <p class="hint">Google Login chưa được cấu hình (googleClientId trong environment).</p>
    }
  `,
  styles: `
    .hint {
      color: var(--hs-text-muted);
      font-size: 12px;
      text-align: center;
      margin: 0;
    }
  `
})
export class GoogleSigninButton implements OnInit {
  readonly credential = output<string>();

  protected readonly clientId = environment.googleClientId;
  private readonly buttonHost = viewChild<ElementRef<HTMLElement>>('buttonHost');
  private readonly host = inject(ElementRef);

  ngOnInit(): void {
    if (!this.clientId) return;
    this.loadGsiScript().then(() => this.renderButton());
  }

  private renderButton(): void {
    const hostEl = this.buttonHost()?.nativeElement;
    if (!hostEl || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: this.clientId,
      callback: res => this.credential.emit(res.credential)
    });
    window.google.accounts.id.renderButton(hostEl, { theme: 'outline', size: 'large', width: 330 });
  }

  private loadGsiScript(): Promise<void> {
    if (window.google?.accounts) return Promise.resolve();

    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }
}
