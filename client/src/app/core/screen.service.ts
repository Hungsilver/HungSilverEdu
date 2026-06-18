import { Injectable, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScreenService {
  private readonly bo = inject(BreakpointObserver);
  readonly isMobile = toSignal(
    this.bo.observe('(max-width: 767.98px)').pipe(map(r => r.matches)),
    { initialValue: window.innerWidth < 768 }
  );
}
