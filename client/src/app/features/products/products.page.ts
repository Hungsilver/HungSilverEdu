import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiProblem, Product, ProductRequest } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { ProductsService } from '../../core/products.service';

@Component({
  selector: 'app-products-page',
  imports: [
    FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe,
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule, NzTagModule,
    NzModalModule, NzFormModule, NzInputNumberModule, NzSwitchModule,
    NzPopconfirmModule, NzCheckboxModule
  ],
  template: `
    <div class="page-header">
      <h2>Sản phẩm</h2>
      <div class="actions">
        <input nz-input placeholder="Tìm theo tên hoặc SKU..." class="search"
               [ngModel]="search()" (ngModelChange)="onSearch($event)" />
        @if (auth.isAdmin()) {
          <label nz-checkbox [ngModel]="includeDeleted()" (ngModelChange)="onIncludeDeleted($event)">
            Hiện bản ghi đã xóa
          </label>
          <button nz-button nzType="primary" (click)="openCreate()">
            <nz-icon nzType="plus" />
            Thêm sản phẩm
          </button>
        }
      </div>
    </div>

    <nz-table
      #table
      [nzData]="products()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageIndex]="page()"
      [nzPageSize]="pageSize()"
      (nzPageIndexChange)="onPageChange($event)"
      nzShowSizeChanger
      (nzPageSizeChange)="onPageSizeChange($event)">
      <thead>
        <tr>
          <th>Tên</th>
          <th>SKU</th>
          <th>Giá</th>
          <th>Trạng thái</th>
          <th>Ngày tạo</th>
          @if (auth.isAdmin()) {
            <th class="actions-col">Thao tác</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (product of table.data; track product.id) {
          <tr>
            <td [class.text-deleted]="product.isDeleted">{{ product.name }}</td>
            <td>{{ product.sku }}</td>
            <td>{{ product.price | currency: 'VND' }}</td>
            <td>
              @if (product.isDeleted) {
                <nz-tag nzColor="red">Đã xóa</nz-tag>
              } @else if (product.isActive) {
                <nz-tag nzColor="green">Đang bán</nz-tag>
              } @else {
                <nz-tag>Ngừng bán</nz-tag>
              }
            </td>
            <td>{{ product.createdAtUtc | date: 'dd/MM/yyyy HH:mm' }}</td>
            @if (auth.isAdmin()) {
              <td>
                @if (!product.isDeleted) {
                  <button nz-button nzType="link" nzSize="small" (click)="openEdit(product)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="link" nzSize="small" nzDanger
                          nz-popconfirm nzPopconfirmTitle="Xóa mềm sản phẩm này?"
                          (nzOnConfirm)="remove(product)">
                    <nz-icon nzType="delete" />
                  </button>
                } @else {
                  <button nz-button nzType="link" nzSize="small" (click)="restore(product)">
                    <nz-icon nzType="undo" />
                    Khôi phục
                  </button>
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="editing() ? 'Sửa sản phẩm' : 'Thêm sản phẩm'"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="save()"
      (nzOnCancel)="closeModal()">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>Tên sản phẩm</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng nhập tên">
              <input nz-input formControlName="name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>SKU</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng nhập SKU">
              <input nz-input formControlName="sku" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Mô tả</nz-form-label>
            <nz-form-control>
              <textarea nz-input formControlName="description" rows="3"></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Giá (VND)</nz-form-label>
            <nz-form-control nzErrorTip="Giá phải ≥ 0">
              <nz-input-number formControlName="price" [nzMin]="0" [nzStep]="1000" class="price-input" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Đang bán</nz-form-label>
            <nz-form-control>
              <nz-switch formControlName="isActive" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search {
      width: 240px;
    }

    .price-input {
      width: 100%;
    }
  `
})
export class ProductsPage {
  protected readonly auth = inject(AuthService);
  private readonly productsService = inject(ProductsService);
  private readonly message = inject(NzMessageService);

  protected readonly products = signal<Product[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly search = signal('');
  protected readonly includeDeleted = signal(false);
  protected readonly loading = signal(false);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Product | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    sku: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    description: new FormControl<string | null>(null),
    price: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    isActive: new FormControl(true, { nonNullable: true })
  });

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.productsService
      .getPaged({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        includeDeleted: this.includeDeleted()
      })
      .subscribe({
        next: result => {
          this.products.set(result.items);
          this.total.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
  }

  protected onIncludeDeleted(value: boolean): void {
    this.includeDeleted.set(value);
    this.page.set(1);
    this.load();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', sku: '', description: null, price: 0, isActive: true });
    this.modalOpen.set(true);
  }

  protected openEdit(product: Product): void {
    this.editing.set(product);
    this.form.reset({
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.price,
      isActive: product.isActive
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;

    const request = this.form.getRawValue() as ProductRequest;
    const editing = this.editing();
    const operation = editing
      ? this.productsService.update(editing.id, request)
      : this.productsService.create(request);

    this.saving.set(true);
    operation.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(editing ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Lưu sản phẩm thất bại.');
      }
    });
  }

  protected remove(product: Product): void {
    this.productsService.delete(product.id).subscribe({
      next: () => {
        this.message.success('Đã xóa (mềm) sản phẩm.');
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Xóa thất bại.')
    });
  }

  protected restore(product: Product): void {
    this.productsService.restore(product.id).subscribe({
      next: () => {
        this.message.success('Đã khôi phục sản phẩm.');
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Khôi phục thất bại.')
    });
  }
}
