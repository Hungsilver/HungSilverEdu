import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { BranchesService } from '../../core/branches.service';
import { ClassesService } from '../../core/classes.service';
import { ScreenService } from '../../core/screen.service';
import { GradesService } from '../../core/grades.service';
import {
  Branch, BranchRequest, ClassImportClassPreview, ClassImportExistingClass,
  ClassImportStudentPreview, ClassListItem, Grade, GradeRequest,
  Subject, SubjectRequest, TeacherProfile
} from '../../core/models';
import { SubjectsService } from '../../core/subjects.service';
import { TeachersService } from '../../core/teachers.service';
import { ClassFormModal } from './class-form-modal';
import { ColumnDef, ColumnSettings } from '../../shared/column-settings';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-classes-page',
  imports: [
    DecimalPipe, FormsModule, RouterLink, PageHeader, ClassFormModal, ColumnSettings,
    NzButtonModule, NzCardModule, NzEmptyModule, NzFormModule, NzIconModule,
    NzInputModule, NzInputNumberModule, NzModalModule, NzPaginationModule, NzPopconfirmModule, NzSelectModule,
    NzTableModule, NzTabsModule, NzTagModule, NzTooltipModule, NzUploadModule
  ],
  template: `
    <app-page-header title="Lớp học" subtitle="Quản lý lớp, danh mục và import Excel" icon="book">
      <button nz-button nzType="primary" (click)="openClassForm()"><nz-icon nzType="plus" /> Thêm lớp</button>
      @if (auth.isAdmin()) {
        <button nz-button (click)="openImportModal()"><nz-icon nzType="file-excel" /> Import Excel</button>
      }
      <button nz-button (click)="exportClasses()"><nz-icon nzType="download" /> Export Excel</button>
    </app-page-header>

    <nz-tabs class="module-tabs" nzType="line">
      <nz-tab nzTitle="Lớp học">
        <div class="filters">
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Cơ sở" [(ngModel)]="branchId">
            @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học" [(ngModel)]="subjectId">
            @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="gradeId">
            @for (g of grades(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.name" /> }
          </nz-select>
          @if (auth.isAdmin()) {
            <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Giáo viên" [(ngModel)]="teacherProfileId">
              @for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }
            </nz-select>
          }
          <input nz-input placeholder="Mã lớp, tên lớp, giáo viên" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
        </div>
        <div class="filter-actions">
          <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
          <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
          <span class="spacer"></span>
          <app-column-settings #cols storageKey="hs-cols-classes" [columns]="COLUMNS" />
        </div>

        @if (screen.isMobile()) {
          <div class="mobile-card-list">
            @for (c of classes(); track c.id) {
              <nz-card class="clickable" [routerLink]="['/classes', c.id]">
                <div class="card-header">
                  <span class="card-title">{{ c.name }}</span>
                  <nz-tag>{{ c.classCode }}</nz-tag>
                </div>
                <div class="card-field"><span class="label">Giáo viên</span><span>{{ c.teacherName || '—' }}</span></div>
                <div class="card-field"><span class="label">Môn / Khối</span><span>{{ c.subjectName || '—' }} · {{ c.gradeName || '—' }}</span></div>
                <div class="card-field"><span class="label">Cơ sở</span><span>{{ c.branchName || '—' }}</span></div>
                <div class="card-field"><span class="label">Sĩ số</span><span>{{ c.currentSize }}/{{ c.maxCapacity }}</span></div>
                <div class="card-field"><span class="label">Học phí</span><span>{{ c.tuitionFee | number:'1.0-0' }}</span></div>
                <div class="card-actions" (click)="$event.stopPropagation()">
                  <button nz-button nzSize="small" nz-tooltip nzTooltipTitle="Sửa lớp" aria-label="Sửa lớp" (click)="openClassForm(c)"><nz-icon nzType="edit" /></button>
                  <button nz-button nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa lớp" aria-label="Xóa lớp"
                    nz-popconfirm nzPopconfirmTitle="Xóa lớp này?" (nzOnConfirm)="deleteClass(c)"><nz-icon nzType="delete" /></button>
                </div>
              </nz-card>
            } @empty {
              <nz-empty nzNotFoundContent="Chưa có lớp học" />
            }
            <nz-pagination class="mobile-pager" [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
              (nzPageIndexChange)="page.set($event); loadClasses()" />
          </div>
        } @else {
          <nz-table #classTable [nzData]="classes()" [nzLoading]="loading()" [nzFrontPagination]="false"
            [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
            (nzPageIndexChange)="page.set($event); loadClasses()" [nzScroll]="{ x: '1180px' }">
            <thead>
              <tr>
                <th nzWidth="56px">STT</th>
                @for (col of cols.visibleColumns(); track col.key) { <th>{{ col.label }}</th> }
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              @for (c of classTable.data; track c.id; let i = $index) {
                <tr class="clickable" [routerLink]="['/classes', c.id]">
                  <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
                  @for (col of cols.visibleColumns(); track col.key) {
                    <td>
                      @switch (col.key) {
                        @case ('classCode') { {{ c.classCode }} }
                        @case ('name') { {{ c.name }} }
                        @case ('teacher') { {{ c.teacherName || '—' }} }
                        @case ('subject') { {{ c.subjectName || '—' }} }
                        @case ('grade') { {{ c.gradeName || '—' }} }
                        @case ('branchCode') { {{ c.branchCode || '—' }} }
                        @case ('branchName') { {{ c.branchName || '—' }} }
                        @case ('size') { {{ c.currentSize }}/{{ c.maxCapacity }} }
                        @case ('tuition') { {{ c.tuitionFee | number:'1.0-0' }} }
                      }
                    </td>
                  }
                  <td (click)="$event.stopPropagation()">
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa lớp" aria-label="Sửa lớp" (click)="openClassForm(c)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa lớp" aria-label="Xóa lớp"
                      nz-popconfirm nzPopconfirmTitle="Xóa lớp này?"
                      (nzOnConfirm)="deleteClass(c)"><nz-icon nzType="delete" /></button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-tab>

      @if (auth.isAdmin()) {
      <nz-tab nzTitle="Danh mục">
        <div class="catalog-grid">
          <section>
            <h3>Môn học</h3>
            <form nz-form nzLayout="inline">
              <input nz-input placeholder="Tên môn" [(ngModel)]="subjectName" name="subjectName" />
              <nz-input-number [(ngModel)]="subjectIndex" name="subjectIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
              <button nz-button nzType="primary" (click)="saveSubject()">{{ editingSubject() ? 'Cập nhật' : 'Thêm' }}</button>
              @if (editingSubject()) { <button nz-button (click)="resetSubject()">Hủy</button> }
            </form>
            <nz-table [nzData]="subjects()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th nzWidth="56px">STT</th><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead>
              <tbody>
                @for (s of subjects(); track s.id; let i = $index) {
                  <tr><td>{{ i + 1 }}</td><td>{{ s.code }}</td><td>{{ s.name }}</td><td>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa môn" aria-label="Sửa môn" (click)="editSubject(s)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa môn" aria-label="Xóa môn"
                      nz-popconfirm nzPopconfirmTitle="Xóa môn?" (nzOnConfirm)="deleteSubject(s)"><nz-icon nzType="delete" /></button>
                  </td></tr>
                }
              </tbody>
            </nz-table>
          </section>

          <section>
            <h3>Khối</h3>
            <form nz-form nzLayout="inline">
              <input nz-input placeholder="Tên khối" [(ngModel)]="gradeName" name="gradeName" />
              <nz-input-number [(ngModel)]="gradeIndex" name="gradeIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
              <button nz-button nzType="primary" (click)="saveGrade()">{{ editingGrade() ? 'Cập nhật' : 'Thêm' }}</button>
              @if (editingGrade()) { <button nz-button (click)="resetGrade()">Hủy</button> }
            </form>
            <nz-table [nzData]="grades()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th nzWidth="56px">STT</th><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead>
              <tbody>
                @for (g of grades(); track g.id; let i = $index) {
                  <tr><td>{{ i + 1 }}</td><td>{{ g.code }}</td><td>{{ g.name }}</td><td>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa khối" aria-label="Sửa khối" (click)="editGrade(g)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa khối" aria-label="Xóa khối"
                      nz-popconfirm nzPopconfirmTitle="Xóa khối?" (nzOnConfirm)="deleteGrade(g)"><nz-icon nzType="delete" /></button>
                  </td></tr>
                }
              </tbody>
            </nz-table>
          </section>

          <section>
            <h3>Cơ sở</h3>
            <form nz-form nzLayout="inline">
              <input nz-input placeholder="Tên cơ sở" [(ngModel)]="branchName" name="branchName" />
              <nz-input-number [(ngModel)]="branchIndex" name="branchIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
              <button nz-button nzType="primary" (click)="saveBranch()">{{ editingBranch() ? 'Cập nhật' : 'Thêm' }}</button>
              @if (editingBranch()) { <button nz-button (click)="resetBranch()">Hủy</button> }
            </form>
            <nz-table [nzData]="branches()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th nzWidth="56px">STT</th><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead>
              <tbody>
                @for (b of branches(); track b.id; let i = $index) {
                  <tr><td>{{ i + 1 }}</td><td>{{ b.code }}</td><td>{{ b.name }}</td><td>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa cơ sở" aria-label="Sửa cơ sở" (click)="editBranch(b)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa cơ sở" aria-label="Xóa cơ sở"
                      nz-popconfirm nzPopconfirmTitle="Xóa cơ sở?" (nzOnConfirm)="deleteBranch(b)"><nz-icon nzType="delete" /></button>
                  </td></tr>
                }
              </tbody>
            </nz-table>
          </section>
        </div>
      </nz-tab>

      <nz-tab nzTitle="Cấu hình">
        <nz-empty nzNotFoundContent="Chưa có cấu hình" />
      </nz-tab>
      }
    </nz-tabs>

    <app-class-form-modal [(open)]="classFormOpen" [classId]="editingClassId()" (saved)="onClassSaved()" />

    <nz-modal [nzVisible]="importOpen()" nzTitle="Import lớp học" [nzWidth]="1200"
      (nzOnCancel)="importOpen.set(false)" [nzOkText]="importLoaded() ? 'Xác nhận import' : null"
      [nzOkDisabled]="!importLoaded()" (nzOnOk)="commitImport()">
      <ng-container *nzModalContent>
        <div class="import-toolbar">
          <button nz-button (click)="downloadImportTemplate()"><nz-icon nzType="download" /> Tải file mẫu</button>
          <nz-upload [nzShowUploadList]="false" [nzBeforeUpload]="beforeImportUpload">
            <button nz-button nzType="primary"><nz-icon nzType="upload" /> Chọn file Excel</button>
          </nz-upload>
        </div>
        @if (importLoaded()) {
          <div class="import-summary">
            <nz-tag nzColor="green">{{ importValidClasses() }} lớp hợp lệ</nz-tag>
            <nz-tag nzColor="green">{{ importValidStudents() }} học viên hợp lệ</nz-tag>
            @if (importInvalid() > 0) {
              <nz-tag nzColor="red">{{ importInvalid() }} dòng lỗi — sửa rồi mới import</nz-tag>
            }
            <span class="import-hint">Sửa trực tiếp bên dưới (dropdown lấy từ danh mục thật). Bấm 1 lớp để xem học viên của lớp đó. Dòng lỗi sẽ bị bỏ qua khi import.</span>
          </div>

          <h4 class="import-h">Lớp ({{ editClasses().length }})</h4>
          <nz-table [nzData]="editClasses()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '960px' }">
            <thead><tr>
              <th nzWidth="180px">Tên lớp</th><th nzWidth="160px">Giáo viên</th><th nzWidth="140px">Môn</th>
              <th nzWidth="120px">Khối</th><th nzWidth="140px">Cơ sở</th><th nzWidth="110px">Học phí</th>
              <th nzWidth="160px">Trạng thái</th><th nzWidth="48px"></th>
            </tr></thead>
            <tbody>
              @for (c of editClasses(); track c.previewId) {
                <tr class="clickable" [class.selected]="selectedImportClass() === c.previewId" (click)="selectedImportClass.set(c.previewId)">
                  @if (c.existingClassId) {
                    <td>{{ c.name }}</td>
                    <td>{{ c.teacherName || '—' }}</td>
                    <td>{{ c.subjectName || '—' }}</td>
                    <td>{{ c.gradeName || '—' }}</td>
                    <td>{{ c.branchName || '—' }}</td>
                    <td>{{ c.tuitionFee | number:'1.0-0' }}</td>
                    <td><nz-tag nzColor="blue">Lớp đã có</nz-tag></td>
                    <td></td>
                  } @else {
                    <td (click)="$event.stopPropagation()"><input nz-input nzSize="small" [(ngModel)]="c.name" (ngModelChange)="revalidateImport()" /></td>
                    <td (click)="$event.stopPropagation()"><nz-select class="cell-select" nzSize="small" nzShowSearch nzPlaceHolder="Giáo viên" [(ngModel)]="c.teacherProfileId" (ngModelChange)="revalidateImport()">@for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }</nz-select></td>
                    <td (click)="$event.stopPropagation()"><nz-select class="cell-select" nzSize="small" nzShowSearch nzPlaceHolder="Môn" [(ngModel)]="c.subjectId" (ngModelChange)="revalidateImport()">@for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }</nz-select></td>
                    <td (click)="$event.stopPropagation()"><nz-select class="cell-select" nzSize="small" nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="c.gradeId" (ngModelChange)="revalidateImport()">@for (g of grades(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.name" /> }</nz-select></td>
                    <td (click)="$event.stopPropagation()"><nz-select class="cell-select" nzSize="small" nzShowSearch nzPlaceHolder="Cơ sở" [(ngModel)]="c.branchId" (ngModelChange)="revalidateImport()">@for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }</nz-select></td>
                    <td (click)="$event.stopPropagation()"><nz-input-number nzSize="small" class="full" [(ngModel)]="c.tuitionFee" [nzMin]="0" /></td>
                    <td (click)="$event.stopPropagation()">
                      @if (c.isValid) { <nz-tag nzColor="green">OK</nz-tag> }
                      @else {
                        <nz-tag nzColor="red" nz-tooltip [nzTooltipTitle]="c.error">Lỗi</nz-tag>
                        @if (c.duplicateClassId) {
                          <button nz-button nzType="link" nzSize="small" (click)="useDuplicateClass(c)">Dùng lớp đã có</button>
                        }
                      }
                    </td>
                    <td (click)="$event.stopPropagation()"><button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa lớp khỏi import" aria-label="Xóa lớp khỏi import" nz-popconfirm nzPopconfirmTitle="Bỏ lớp này khỏi import?" (nzOnConfirm)="removeImportClass(c)"><nz-icon nzType="delete" /></button></td>
                  }
                </tr>
              }
            </tbody>
          </nz-table>

          @if (selectedImportClass()) {
            <h4 class="import-h">Học viên của lớp đã chọn ({{ selectedImportStudents().length }})</h4>
            <nz-table [nzData]="selectedImportStudents()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '960px' }">
              <thead><tr>
                <th nzWidth="120px">Mã HV</th><th nzWidth="170px">Họ tên</th><th nzWidth="120px">Ngày sinh</th>
                <th nzWidth="120px">SĐT PH</th><th nzWidth="120px">SĐT HV</th><th nzWidth="140px">Ghi chú</th>
                <th nzWidth="150px">Lớp</th><th nzWidth="80px">Trạng thái</th><th nzWidth="48px"></th>
              </tr></thead>
              <tbody>
                @for (s of selectedImportStudents(); track s.rowNumber) {
                  <tr>
                    <td><input nz-input nzSize="small" placeholder="Tự sinh" [(ngModel)]="s.studentCode" /></td>
                    <td><input nz-input nzSize="small" [(ngModel)]="s.fullName" (ngModelChange)="revalidateImport()" /></td>
                    <td><input nz-input nzSize="small" placeholder="dd/MM/yyyy" [(ngModel)]="s.dateOfBirth" /></td>
                    <td><input nz-input nzSize="small" [(ngModel)]="s.parentPhone" /></td>
                    <td><input nz-input nzSize="small" [(ngModel)]="s.phone" /></td>
                    <td><input nz-input nzSize="small" [(ngModel)]="s.note" /></td>
                    <td><nz-select class="cell-select" nzSize="small" [(ngModel)]="s.previewClassId" (ngModelChange)="revalidateImport()">@for (c of editClasses(); track c.previewId) { <nz-option [nzValue]="c.previewId" [nzLabel]="c.name || c.classCode || 'Lớp mới'" /> }</nz-select></td>
                    <td>
                      @if (s.isValid) { <nz-tag nzColor="green">OK</nz-tag> }
                      @else { <nz-tag nzColor="red" nz-tooltip [nzTooltipTitle]="s.error">Lỗi</nz-tag> }
                    </td>
                    <td><button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa học viên khỏi import" aria-label="Xóa học viên khỏi import" (click)="removeImportStudent(s)"><nz-icon nzType="delete" /></button></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .module-tabs { margin-top: 4px; }
    .filters { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
    .filter-actions .spacer { flex: 1; }
    .clickable { cursor: pointer; }
    .catalog-grid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr)); gap: 16px; }
    section { border: 1px solid var(--hs-border); border-radius: 8px; padding: 14px; }
    section h3 { margin: 0 0 12px; font-size: 16px; }
    form[nz-form] { gap: 8px; margin-bottom: 12px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; }
    .full { width: 100%; }
    .detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .detail-grid div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; }
    .detail-grid b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
    .detail-actions { margin-bottom: 12px; }
    .import-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .import-toolbar { margin-bottom: 14px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .import-summary { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .import-hint { color: var(--hs-text-muted); font-size: 12px; }
    .import-h { margin: 14px 0 8px; font-size: 14px; }
    .cell-select { width: 100%; min-width: 110px; }
    .selected td { background: var(--hs-surface-2); }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; }
    .mobile-card-list .clickable { cursor: pointer; }
    .card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .card-title { font-weight: 600; }
    .card-field { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
    .card-field .label { color: var(--hs-text-muted); font-size: 12px; }
    .card-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .mobile-pager { margin-top: 4px; text-align: center; }
    @media (max-width: 900px) {
      .filters, .catalog-grid, .form-grid, .detail-grid, .import-grid { grid-template-columns: 1fr; }
    }
  `
})
export class ClassesPage {
  private readonly classesService = inject(ClassesService);
  private readonly branchesService = inject(BranchesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly teachersService = inject(TeachersService);
  private readonly message = inject(NzMessageService);
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  protected search = '';
  protected branchId: string | null = null;
  protected subjectId: string | null = null;
  protected gradeId: string | null = null;
  protected teacherProfileId: string | null = null;

  // Cột cấu hình được của bảng lớp (ngoài STT & Thao tác cố định).
  protected readonly COLUMNS: ColumnDef[] = [
    { key: 'classCode', label: 'Mã lớp' },
    { key: 'name', label: 'Tên lớp' },
    { key: 'teacher', label: 'Giáo viên' },
    { key: 'subject', label: 'Môn học' },
    { key: 'grade', label: 'Khối' },
    { key: 'branchCode', label: 'Mã cơ sở' },
    { key: 'branchName', label: 'Tên cơ sở' },
    { key: 'size', label: 'Sĩ số' },
    { key: 'tuition', label: 'Học phí' }
  ];

  // Modal thêm/sửa lớp dùng chung (class-form-modal): null = thêm mới, có id = sửa.
  protected readonly classFormOpen = signal(false);
  protected readonly editingClassId = signal<string | null>(null);

  protected readonly importOpen = signal(false);
  protected readonly importLoaded = signal(false);
  // Bản sao có thể sửa của preview — người dùng chỉnh trực tiếp trước khi import; server revalidate lại khi commit.
  protected readonly editClasses = signal<ClassImportClassPreview[]>([]);
  // Danh sách lớp đang có (Id, Tên, Cơ sở) từ preview — để kiểm trùng tên+cơ sở ngay khi user sửa tên lớp.
  protected readonly existingImportClasses = signal<ClassImportExistingClass[]>([]);
  protected readonly editStudents = signal<ClassImportStudentPreview[]>([]);
  protected readonly selectedImportClass = signal<string | null>(null);
  protected readonly selectedImportStudents = computed(() =>
    this.editStudents().filter(s => s.previewClassId === this.selectedImportClass()));
  protected readonly importValidClasses = computed(() => this.editClasses().filter(c => c.isValid).length);
  protected readonly importValidStudents = computed(() => this.editStudents().filter(s => s.isValid).length);
  protected readonly importInvalid = computed(() =>
    this.editClasses().filter(c => !c.isValid).length + this.editStudents().filter(s => !s.isValid).length);

  protected readonly editingSubject = signal<Subject | null>(null);
  protected subjectName = '';
  protected subjectIndex = 0;
  protected readonly editingGrade = signal<Grade | null>(null);
  protected gradeName = '';
  protected gradeIndex = 0;
  protected readonly editingBranch = signal<Branch | null>(null);
  protected branchName = '';
  protected branchIndex = 0;

  constructor() {
    this.loadLookups();
    this.loadClasses();
  }

  protected loadClasses(): void {
    this.loading.set(true);
    this.classesService.getPaged({
      page: this.page(), pageSize: this.pageSize(), search: this.search,
      branchId: this.branchId ?? undefined, subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined, teacherProfileId: this.teacherProfileId ?? undefined
    }).subscribe({
      next: r => { this.classes.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.loadClasses();
  }

  protected resetFilters(): void {
    this.search = '';
    this.branchId = null;
    this.subjectId = null;
    this.gradeId = null;
    this.teacherProfileId = null;
    this.page.set(1);
    this.loadClasses();
  }

  private loadLookups(): void {
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
    this.subjectsService.getAll().subscribe(x => this.subjects.set(x));
    this.gradesService.getAll().subscribe(x => this.grades.set(x));
    this.teachersService.getPaged({ page: 1, pageSize: 500 }).subscribe(x => this.teachers.set(x.items));
  }

  protected openClassForm(item?: ClassListItem): void {
    this.editingClassId.set(item?.id ?? null);
    this.classFormOpen.set(true);
  }

  protected onClassSaved(): void {
    this.loadClasses();
    this.loadLookups();
  }

  protected deleteClass(c: ClassListItem): void {
    this.classesService.delete(c.id).subscribe({
      next: () => { this.message.success('Đã xóa lớp.'); this.loadClasses(); },
      error: err => this.showError(err, 'Xóa lớp thất bại.')
    });
  }

  protected openImportModal(): void {
    this.importLoaded.set(false);
    this.editClasses.set([]);
    this.editStudents.set([]);
    this.selectedImportClass.set(null);
    this.importOpen.set(true);
  }

  protected exportClasses(): void {
    this.classesService.exportClasses({
      search: this.search || undefined,
      branchId: this.branchId ?? undefined,
      subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined,
      teacherProfileId: this.teacherProfileId ?? undefined
    }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'danh-sach-lop.xlsx'; a.click();
        URL.revokeObjectURL(url);
      },
      error: err => this.showError(err, 'Export thất bại.')
    });
  }

  protected downloadImportTemplate(): void {
    this.classesService.downloadClassImportTemplate().subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mau-import-lop-hoc.xlsx'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  protected readonly beforeImportUpload = (file: NzUploadFile): boolean => {
    const raw = file as unknown as File;
    this.classesService.importClassesPreview(raw).subscribe({
      next: p => {
        // Clone để sửa tại chỗ; revalidate phía client cho phản hồi tức thì, server vẫn kiểm lại khi commit.
        this.editClasses.set(p.classes.map(c => ({ ...c })));
        this.editStudents.set(p.students.map(s => ({ ...s })));
        this.existingImportClasses.set(p.existingClasses ?? []);
        this.selectedImportClass.set(p.classes[0]?.previewId ?? null);
        this.importLoaded.set(true);
        this.importOpen.set(true);
      },
      error: err => this.showError(err, 'Không đọc được file import.')
    });
    return false;
  };

  protected commitImport(): void {
    if (!this.importLoaded()) return;
    this.classesService.importClassesCommit({ classes: this.editClasses(), students: this.editStudents() }).subscribe({
      next: r => {
        const skipped = r.skipped > 0 ? ` Bỏ qua ${r.skipped} dòng.` : '';
        this.message.success(`Đã tạo ${r.classesCreated} lớp, ${r.studentsCreated} học viên.${skipped}`);
        if (r.errors?.length) this.message.warning(r.errors.slice(0, 3).join(' · '));
        this.importOpen.set(false);
        this.loadClasses();
        this.loadLookups();
      },
      error: err => this.showError(err, 'Import thất bại.')
    });
  }

  /** Kiểm tra lại tính hợp lệ sau mỗi lần sửa preview (mirror logic server; server vẫn revalidate khi commit). */
  protected revalidateImport(): void {
    const classes = this.editClasses();
    const validIds = new Set<string>();
    for (const c of classes) {
      c.error = this.validateImportClass(c);
      c.isValid = c.error === null;
      if (c.isValid) validIds.add(c.previewId);
    }
    const students = this.editStudents();
    for (const s of students) {
      s.error = this.validateImportStudent(s, validIds);
      s.isValid = s.error === null;
    }
    // Gán lại tham chiếu để các computed (đếm hợp lệ/lỗi) cập nhật.
    this.editClasses.set([...classes]);
    this.editStudents.set([...students]);
  }

  private validateImportClass(c: ClassImportClassPreview): string | null {
    if (c.existingClassId) return null; // lớp đã có → dùng lại, bỏ qua kiểm
    if (!c.name?.trim() && !c.classCode?.trim()) return 'Thiếu tên lớp hoặc mã lớp.';
    if (!c.branchId) return 'Cơ sở không hợp lệ.';
    if (!c.subjectId) return 'Môn học không hợp lệ.';
    if (!c.gradeId) return 'Khối không hợp lệ.';
    if (!c.teacherProfileId) return 'Giáo viên không hợp lệ.';
    // 1 cơ sở không được trùng tên lớp: dò theo danh sách lớp đang có (cập nhật khi user sửa tên/cơ sở).
    const name = c.name.trim().toLowerCase();
    if (this.existingImportClasses().some(e => e.branchId === c.branchId && e.name.trim().toLowerCase() === name))
      return `Tên lớp '${c.name.trim()}' đã tồn tại trong cơ sở — đổi tên khác hoặc chọn dùng lớp đã có.`;
    return null;
  }

  /** Chọn dùng lớp đã có (trùng tên+cơ sở): học viên sẽ ghi danh vào lớp cũ, không tạo lớp mới. */
  protected useDuplicateClass(c: ClassImportClassPreview): void {
    if (!c.duplicateClassId) return;
    c.existingClassId = c.duplicateClassId;
    this.revalidateImport();
  }

  private validateImportStudent(s: ClassImportStudentPreview, validClassIds: Set<string>): string | null {
    if (!s.fullName?.trim()) return 'Thiếu tên học viên.';
    if (!validClassIds.has(s.previewClassId)) return 'Lớp của dòng này chưa hợp lệ.';
    return null;
  }

  protected removeImportClass(c: ClassImportClassPreview): void {
    this.editClasses.set(this.editClasses().filter(x => x.previewId !== c.previewId));
    this.editStudents.set(this.editStudents().filter(s => s.previewClassId !== c.previewId));
    if (this.selectedImportClass() === c.previewId)
      this.selectedImportClass.set(this.editClasses()[0]?.previewId ?? null);
    this.revalidateImport();
  }

  protected removeImportStudent(s: ClassImportStudentPreview): void {
    this.editStudents.set(this.editStudents().filter(x => x.rowNumber !== s.rowNumber));
    this.revalidateImport();
  }

  protected saveSubject(): void {
    const req: SubjectRequest = { name: this.subjectName.trim(), description: null, indexOrder: this.subjectIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingSubject();
    const op = editing ? this.subjectsService.update(editing.id, req) : this.subjectsService.create(req);
    op.subscribe({ next: () => { this.resetSubject(); this.loadLookups(); }, error: err => this.showError(err, 'Lưu môn thất bại.') });
  }
  protected editSubject(s: Subject): void { this.editingSubject.set(s); this.subjectName = s.name; this.subjectIndex = s.indexOrder; }
  protected resetSubject(): void { this.editingSubject.set(null); this.subjectName = ''; this.subjectIndex = 0; }
  protected deleteSubject(s: Subject): void { this.subjectsService.delete(s.id).subscribe({ next: () => this.loadLookups(), error: err => this.showError(err, 'Xóa môn thất bại.') }); }

  protected saveGrade(): void {
    const req: GradeRequest = { name: this.gradeName.trim(), indexOrder: this.gradeIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingGrade();
    const op = editing ? this.gradesService.update(editing.id, req) : this.gradesService.create(req);
    op.subscribe({ next: () => { this.resetGrade(); this.loadLookups(); }, error: err => this.showError(err, 'Lưu khối thất bại.') });
  }
  protected editGrade(g: Grade): void { this.editingGrade.set(g); this.gradeName = g.name; this.gradeIndex = g.indexOrder; }
  protected resetGrade(): void { this.editingGrade.set(null); this.gradeName = ''; this.gradeIndex = 0; }
  protected deleteGrade(g: Grade): void { this.gradesService.delete(g.id).subscribe({ next: () => this.loadLookups(), error: err => this.showError(err, 'Xóa khối thất bại.') }); }

  protected saveBranch(): void {
    const req: BranchRequest = { name: this.branchName.trim(), address: null, phone: null, indexOrder: this.branchIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingBranch();
    const op = editing ? this.branchesService.update(editing.id, req) : this.branchesService.create(req);
    op.subscribe({ next: () => { this.resetBranch(); this.loadLookups(); }, error: err => this.showError(err, 'Lưu cơ sở thất bại.') });
  }
  protected editBranch(b: Branch): void { this.editingBranch.set(b); this.branchName = b.name; this.branchIndex = b.indexOrder; }
  protected resetBranch(): void { this.editingBranch.set(null); this.branchName = ''; this.branchIndex = 0; }
  protected deleteBranch(b: Branch): void { this.branchesService.delete(b.id).subscribe({ next: () => this.loadLookups(), error: err => this.showError(err, 'Xóa cơ sở thất bại.') }); }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }
}
