import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Branch, BranchRequest, Grade, GradeRequest, Subject, SubjectRequest } from '../../core/models';
import { BranchesService } from '../../core/branches.service';
import { GradesService } from '../../core/grades.service';
import { SubjectsService } from '../../core/subjects.service';

/**
 * Danh mục trung tâm: Môn học · Khối · Cơ sở (kèm tiền tố mã giáo viên).
 * Gom về Cấu hình để hết cảnh "Cơ sở tạo ở trang Lớp học nhưng tiền tố mã của nó lại sửa ở trang Cấu hình".
 * Mã của các danh mục này do server tự sinh từ tên nên form không có ô nhập mã.
 */
@Component({
  selector: 'app-settings-catalog-tab',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzInputModule, NzButtonModule,
    NzIconModule, NzTableModule, NzPopconfirmModule, NzTooltipModule, NzAlertModule
  ],
  template: `
    <nz-alert
      nzType="info"
      nzMessage="Môn học · Khối · Cơ sở dùng chung cho Lớp học, Học viên, Giáo viên và Kho tài liệu."
      nzDescription="Xóa một danh mục sẽ bị chặn nếu vẫn còn lớp hoặc hồ sơ đang tham chiếu."
      style="margin-bottom:16px" />

    <div class="cat-grid">
      <!-- Môn học -->
      <nz-card nzTitle="Môn học">
        <div class="row-form">
          <input nz-input placeholder="Tên môn học" [(ngModel)]="subjectName" (keyup.enter)="saveSubject()" />
          <button nz-button nzType="primary" (click)="saveSubject()">
            {{ editingSubject() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingSubject()) {
            <button nz-button (click)="resetSubject()">Hủy</button>
          }
        </div>
        <nz-table #subjectTable [nzData]="subjects()" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ y: '260px' }">
          <tbody>
            @for (s of subjectTable.data; track s.id) {
              <tr>
                <td>{{ s.name }}</td>
                <td class="row-actions">
                  <button nz-button nzType="text" nzSize="small" nz-tooltip="Sửa" (click)="editSubject(s)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip="Xóa"
                          nz-popconfirm nzPopconfirmTitle="Xóa môn học này?" (nzOnConfirm)="deleteSubject(s.id)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <!-- Khối -->
      <nz-card nzTitle="Khối">
        <div class="row-form">
          <input nz-input placeholder="Tên khối (vd: Khối 9)" [(ngModel)]="gradeName" (keyup.enter)="saveGrade()" />
          <button nz-button nzType="primary" (click)="saveGrade()">
            {{ editingGrade() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingGrade()) {
            <button nz-button (click)="resetGrade()">Hủy</button>
          }
        </div>
        <nz-table #gradeTable [nzData]="grades()" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ y: '260px' }">
          <tbody>
            @for (g of gradeTable.data; track g.id) {
              <tr>
                <td>{{ g.name }}</td>
                <td class="row-actions">
                  <button nz-button nzType="text" nzSize="small" nz-tooltip="Sửa" (click)="editGrade(g)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip="Xóa"
                          nz-popconfirm nzPopconfirmTitle="Xóa khối này?" (nzOnConfirm)="deleteGrade(g.id)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <!-- Cơ sở + tiền tố mã GV -->
      <nz-card nzTitle="Cơ sở" class="span-all">
        <div class="row-form">
          <input nz-input placeholder="Tên cơ sở" [(ngModel)]="branchName" (keyup.enter)="saveBranch()" />
          <input nz-input placeholder="Địa chỉ (tùy chọn)" [(ngModel)]="branchAddress" />
          <button nz-button nzType="primary" (click)="saveBranch()">
            {{ editingBranch() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingBranch()) {
            <button nz-button (click)="resetBranch()">Hủy</button>
          }
        </div>
        <nz-table #branchTable [nzData]="branches()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>Tên cơ sở</th>
              <th>Địa chỉ</th>
              <th nz-tooltip="Tiền tố đứng đầu mã giáo viên tạo tại cơ sở này, vd DongTho@TrangNTT0">
                Tiền tố mã giáo viên
              </th>
              <th style="width:150px"></th>
            </tr>
          </thead>
          <tbody>
            @for (b of branchTable.data; track b.id) {
              <tr>
                <td><b>{{ b.name }}</b></td>
                <td class="muted">{{ b.address || '—' }}</td>
                <td>
                  <input nz-input [(ngModel)]="b.teacherCodePrefix" [placeholder]="defaultPrefix(b.name)" style="max-width:180px" />
                </td>
                <td class="row-actions">
                  <button nz-button nzSize="small" [nzLoading]="savingBranchId() === b.id" (click)="saveBranchPrefix(b)">
                    Lưu
                  </button>
                  <button nz-button nzType="text" nzSize="small" nz-tooltip="Sửa" (click)="editBranch(b)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip="Xóa"
                          nz-popconfirm nzPopconfirmTitle="Xóa cơ sở này?" (nzOnConfirm)="deleteBranch(b.id)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
  styles: `
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .span-all { grid-column: 1 / -1; }
    .row-form { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .row-form input { flex: 1; min-width: 160px; }
    .row-actions { text-align: right; white-space: nowrap; }
    .muted { color: var(--hs-text-muted); }
    @media (max-width: 575px) {
      .row-form { flex-direction: column; }
      .row-form input { width: 100%; }
    }
  `
})
export class SettingsCatalogTab implements OnInit {
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly branchesService = inject(BranchesService);
  private readonly message = inject(NzMessageService);

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly branches = signal<Branch[]>([]);

  protected readonly editingSubject = signal<Subject | null>(null);
  protected readonly editingGrade = signal<Grade | null>(null);
  protected readonly editingBranch = signal<Branch | null>(null);
  protected readonly savingBranchId = signal<string | null>(null);

  protected subjectName = '';
  protected gradeName = '';
  protected branchName = '';
  protected branchAddress = '';

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.subjectsService.getAll(true).subscribe(x => this.subjects.set(x));
    this.gradesService.getAll(true).subscribe(x => this.grades.set(x));
    this.branchesService.getAll(true).subscribe(x => this.branches.set(x));
  }

  private fail = (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message);

  // ---- Môn học ----

  protected editSubject(s: Subject): void { this.editingSubject.set(s); this.subjectName = s.name; }
  protected resetSubject(): void { this.editingSubject.set(null); this.subjectName = ''; }

  protected saveSubject(): void {
    const name = this.subjectName.trim();
    if (!name) return;
    const editing = this.editingSubject();
    const req: SubjectRequest = {
      name, description: editing?.description ?? null,
      indexOrder: editing?.indexOrder ?? 0, isActive: true
    };
    const op = editing ? this.subjectsService.update(editing.id, req) : this.subjectsService.create(req);
    op.subscribe({
      next: () => { this.resetSubject(); this.reload(); this.message.success('Đã lưu môn học.'); },
      error: this.fail
    });
  }

  protected deleteSubject(id: string): void {
    this.subjectsService.delete(id).subscribe({
      next: () => { this.reload(); this.message.success('Đã xóa môn học.'); },
      error: this.fail
    });
  }

  // ---- Khối ----

  protected editGrade(g: Grade): void { this.editingGrade.set(g); this.gradeName = g.name; }
  protected resetGrade(): void { this.editingGrade.set(null); this.gradeName = ''; }

  protected saveGrade(): void {
    const name = this.gradeName.trim();
    if (!name) return;
    const editing = this.editingGrade();
    const req: GradeRequest = { name, indexOrder: editing?.indexOrder ?? 0, isActive: true };
    const op = editing ? this.gradesService.update(editing.id, req) : this.gradesService.create(req);
    op.subscribe({
      next: () => { this.resetGrade(); this.reload(); this.message.success('Đã lưu khối.'); },
      error: this.fail
    });
  }

  protected deleteGrade(id: string): void {
    this.gradesService.delete(id).subscribe({
      next: () => { this.reload(); this.message.success('Đã xóa khối.'); },
      error: this.fail
    });
  }

  // ---- Cơ sở ----

  protected editBranch(b: Branch): void {
    this.editingBranch.set(b);
    this.branchName = b.name;
    this.branchAddress = b.address ?? '';
  }

  protected resetBranch(): void {
    this.editingBranch.set(null);
    this.branchName = '';
    this.branchAddress = '';
  }

  protected saveBranch(): void {
    const name = this.branchName.trim();
    if (!name) return;
    const editing = this.editingBranch();
    const req: BranchRequest = {
      name,
      address: this.branchAddress.trim() || null,
      phone: editing?.phone ?? null,
      teacherCodePrefix: editing?.teacherCodePrefix ?? null,
      indexOrder: editing?.indexOrder ?? 0,
      isActive: true
    };
    const op = editing ? this.branchesService.update(editing.id, req) : this.branchesService.create(req);
    op.subscribe({
      next: () => { this.resetBranch(); this.reload(); this.message.success('Đã lưu cơ sở.'); },
      error: this.fail
    });
  }

  protected deleteBranch(id: string): void {
    this.branchesService.delete(id).subscribe({
      next: () => { this.reload(); this.message.success('Đã xóa cơ sở.'); },
      error: this.fail
    });
  }

  /** Lưu riêng tiền tố mã GV — gửi lại nguyên các field khác của cơ sở để không ghi đè nhầm. */
  protected saveBranchPrefix(b: Branch): void {
    this.savingBranchId.set(b.id);
    const req: BranchRequest = {
      code: b.code,
      name: b.name,
      address: b.address,
      phone: b.phone,
      teacherCodePrefix: b.teacherCodePrefix?.trim() || null,
      indexOrder: b.indexOrder,
      isActive: b.isActive
    };
    this.branchesService.update(b.id, req).subscribe({
      next: updated => {
        this.branches.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.savingBranchId.set(null);
        this.message.success('Đã lưu tiền tố mã giáo viên.');
      },
      error: err => { this.savingBranchId.set(null); this.fail(err); }
    });
  }

  /** Tiền tố mặc định suy từ tên cơ sở (PascalCase liền + "@") — khớp NameCodeGenerator.PascalCompact ở server. */
  protected defaultPrefix(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    const pascal = parts.map(p => {
      const ascii = p.replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .normalize('NFD').replace(/[^A-Za-z0-9]/g, '');
      return ascii ? ascii[0].toUpperCase() + ascii.slice(1).toLowerCase() : '';
    }).join('');
    return pascal + '@';
  }
}
