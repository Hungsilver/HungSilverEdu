export interface UserDto {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  roles: string[];
  mustChangePassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: UserDto;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface UserListItem {
  id: string;
  userName: string;
  email: string;
  fullName: string | null;
  roles: string[];
  isDeleted: boolean;
  createdAt: string;
}

/** Admin tạo tài khoản Admin/Giáo viên. */
export interface CreateUserRequest {
  userName: string;
  email?: string | null;
  password: string;
  fullName?: string | null;
  role: string;
}

/** Body lỗi chuẩn ProblemDetails từ backend (Result pattern). */
export interface ApiProblem {
  status: number;
  title: string;
  detail: string;
}

/** Wrapper chuẩn cho mọi API response từ backend. */
export interface ApiResponse<T> {
  data: T;
  isSuccess: boolean;
  message: string;
  statusCode: number;
}

export const ROLE_ADMIN = 'Admin';
export const ROLE_TEACHER = 'Teacher';
export const ROLE_USER = 'User'; // = học sinh

// ----------------- Enums (khớp tên enum backend, serialize dạng string) -----------------

export enum AttendanceStatus {
  Present = 'Present',
  ExcusedAbsence = 'ExcusedAbsence',
  UnexcusedAbsence = 'UnexcusedAbsence',
  Late = 'Late'
}

export enum HomeworkStatus {
  NotAssigned = 'NotAssigned',
  CompletedWell = 'CompletedWell',
  Completed = 'Completed',
  NotCompleted = 'NotCompleted'
}

export enum AttitudeStatus {
  Positive = 'Positive',
  Normal = 'Normal',
  Unfocused = 'Unfocused'
}

export enum SessionStatus {
  Scheduled = 'Scheduled',
  Completed = 'Completed',
  Cancelled = 'Cancelled'
}

export enum PointType {
  Reward = 'Reward',
  Penalty = 'Penalty'
}

export enum RewardTier {
  SmallGift = 'SmallGift',
  FreeMaterials = 'FreeMaterials',
  FeeDiscount = 'FeeDiscount'
}

export enum AssessmentType {
  Entry = 'Entry',
  Periodic = 'Periodic',
  Final = 'Final'
}

export enum TuitionStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  DueSoon = 'DueSoon',
  Overdue = 'Overdue',
  Partial = 'Partial'
}

export enum SettingScope {
  System = 'System',
  Role = 'Role',
  Class = 'Class',
  User = 'User'
}

export enum FileStorageMode {
  ExternalUrl = 'ExternalUrl',
  Server = 'Server'
}

/** Mức truy cập file khi tải xuống (phân tầng theo độ nhạy cảm). */
export enum FileVisibility {
  Public = 'Public',               // tải ẩn danh qua link GUID (ảnh đại diện)
  Authenticated = 'Authenticated', // phải đăng nhập
  Restricted = 'Restricted'        // chỉ người upload hoặc Teacher/Admin
}

export enum MaterialSource {
  ExternalUrl = 'ExternalUrl',
  ServerFile = 'ServerFile'
}

export enum MaterialType {
  Pdf = 'Pdf',
  Video = 'Video',
  Vocabulary = 'Vocabulary',
  Test = 'Test',
  Homework = 'Homework'
}

export enum ReportType {
  SessionNotice = 'SessionNotice',
  ScheduleNotice = 'ScheduleNotice'
}

export enum EvaluationRank {
  Excellent = 'Excellent',
  Good = 'Good',
  Satisfactory = 'Satisfactory',
  NeedsImprovement = 'NeedsImprovement'
}

export enum NotificationChannel {
  Email = 'Email',
  Zalo = 'Zalo',
  Messenger = 'Messenger'
}

export enum NotificationType {
  Schedule = 'Schedule',
  DayOff = 'DayOff',
  Report = 'Report',
  Tuition = 'Tuition',
  Homework = 'Homework'
}

export enum NotificationDeliveryStatus {
  Pending = 'Pending',
  Sent = 'Sent',
  Failed = 'Failed',
  Manual = 'Manual'
}

export type NotificationTargetScope = 'All' | 'Class' | 'Student';

// ----------------- Học sinh -----------------

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string | null;
  school: string | null;
  gradeLevel: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  email: string | null;
  note: string | null;
  enrollmentDate: string;
  englishLevel: string | null;
  learningGoal: string | null;
  entryScore?: number | null;
  curriculum: string | null;
  userId: string | null;
  userName: string | null;
  isLocked: boolean;
  mustChangePassword: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  classes: StudentClass[];
}

export interface StudentClass {
  classId: string;
  classCode: string;
  className: string;
  teacherProfileId: string | null;
  teacherName: string | null;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  tuitionFee: number;
  enrolledOn: string;
}

export interface StudentRequest {
  studentCode: string | null;
  fullName: string;
  dateOfBirth: string | null;
  school: string | null;
  gradeLevel: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  email: string | null;
  note: string | null;
  enrollmentDate: string | null;
  englishLevel: string | null;
  learningGoal: string | null;
  curriculum: string | null;
  isActive: boolean;
}

// ----------------- Lớp học -----------------

export interface ClassListItem {
  id: string;
  classCode: string;
  name: string;
  teacherId?: string;
  teacherProfileId: string | null;
  teacherName: string | null;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeBand?: string | null;
  gradeId: string | null;
  gradeName: string | null;
  tuitionFee: number;
  maxCapacity: number;
  currentSize: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface ClassDetail {
  id: string;
  classCode: string;
  name: string;
  teacherId?: string;
  teacherProfileId: string | null;
  teacherName: string | null;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeBand?: string | null;
  gradeId: string | null;
  gradeName: string | null;
  tuitionFee: number;
  curriculumId: string | null;
  curriculumName: string | null;
  maxCapacity: number;
  schedule: string | null;
  startDate: string | null;
  isActive: boolean;
  currentSize: number;
  averageScore: number | null;
  attendanceRate: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ClassRequest {
  classCode: string | null;
  name: string;
  teacherProfileId: string;
  branchId: string | null;
  subjectId: string | null;
  gradeId: string | null;
  curriculumId: string | null;
  tuitionFee: number;
  maxCapacity: number;
  schedule: string | null;
  startDate: string | null;
  isActive: boolean;
}

// ----------------- Cơ sở (Branch — Đợt 8) -----------------

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  teacherCodePrefix: string | null;
  indexOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface BranchRequest {
  code?: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  teacherCodePrefix: string | null;
  indexOrder: number;
  isActive: boolean;
}

// ----------------- Khối -----------------

export interface Grade {
  id: string;
  code: string;
  name: string;
  indexOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface GradeRequest {
  code?: string | null;
  name: string;
  indexOrder: number;
  isActive: boolean;
}

// ----------------- Giáo viên -----------------

export interface TeacherProfile {
  id: string;
  teacherCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  note: string | null;
  userId: string | null;
  userName: string | null;
  isLocked: boolean;
  mustChangePassword: boolean;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  classCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface TeacherDetail {
  teacher: TeacherProfile;
  classes: ClassListItem[];
}

export interface TeacherRequest {
  teacherCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  note: string | null;
  userId: string | null;
  branchId: string | null;
  isActive: boolean;
}

export interface UnlinkedUser {
  id: string;
  userName: string;
  fullName: string | null;
}

/** Tạo hồ sơ GV (hoặc dùng hồ sơ có sẵn) + cấp tài khoản. Tên đăng nhập = Mã GV (tự sinh);
 *  mật khẩu trống ⇒ dùng mật khẩu mặc định; bắt buộc đổi ở lần đăng nhập đầu. */
export interface CreateTeacherAccountRequest {
  teacherProfileId: string | null;
  teacherCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  note: string | null;
  branchId: string | null;
  loginEmail: string | null;
  password: string | null;
}

/** Cấp tài khoản cho một HS/GV (mật khẩu trống ⇒ dùng mặc định). */
export interface ProvisionAccountRequest {
  password?: string | null;
  loginEmail?: string | null;
}

export interface AccountProvisionResult {
  userId: string;
  userName: string;
  mustChangePassword: boolean;
}

export interface BulkProvisionItem {
  id: string;
  success: boolean;
  userName: string | null;
  error: string | null;
}

export interface BulkProvisionResult {
  total: number;
  succeeded: number;
  failed: number;
  items: BulkProvisionItem[];
}

// ----------------- Môn học (Subject — Đợt 7) -----------------

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  indexOrder: number;
  isActive: boolean;
}

export interface SubjectRequest {
  code?: string | null;
  name: string;
  description: string | null;
  indexOrder: number;
  isActive: boolean;
}

export interface RosterItem {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  phone: string | null;
  parentPhone: string | null;
  email: string | null;
  note: string | null;
  enrolledOn: string;
  userId: string | null;
  userName: string | null;
  isLocked: boolean;
}

/** Giáo viên tạo học sinh trong lớp (kèm tùy chọn cấp tài khoản).
 *  Khi cấp: tên đăng nhập = Mã học viên (tự sinh); mật khẩu trống ⇒ dùng mật khẩu mặc định. */
export interface CreateClassStudentRequest {
  studentCode?: string | null;
  fullName: string;
  dateOfBirth?: string | null;
  school?: string | null;
  gradeLevel?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  email?: string | null;
  note?: string | null;
  englishLevel?: string | null;
  learningGoal?: string | null;
  createAccount: boolean;
  password?: string | null;
}

export interface CreateClassStudentResult {
  studentId: string;
  studentCode: string;
  fullName: string;
  accountCreated: boolean;
  userName: string | null;
  accountError: string | null;
}

export interface ClassStudentOverview {
  studentId: string;
  studentCode: string;
  fullName: string;
  rewardBalance: number;
  attendedSessions: number;
  totalRecords: number;
  attendanceRate: number;
  homeworkCompleted: number;
  homeworkAssigned: number;
  homeworkRate: number;
}

// ----------------- Lịch học -----------------

export interface CalendarSession {
  id: string;
  classId: string;
  className: string;
  sessionNumber: number;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
  status: SessionStatus;
  // Snapshot từ lớp để nhóm/hiển thị lịch theo cơ sở · môn · khối · giáo viên.
  teacherProfileId: string | null;
  teacherName: string | null;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  subjectName: string | null;
  gradeName: string | null;
  // "Ca" tính sẵn ở server theo cấu hình. shiftOrder lớn (vd 2147483647) = chưa xếp giờ.
  shiftName: string | null;
  shiftOrder: number;
}

/** Bộ lọc lịch học (tùy role: GV bỏ qua teacherProfileId, server tự scope). */
export interface ScheduleFilter {
  branchId?: string;
  subjectId?: string;
  gradeId?: string;
  teacherProfileId?: string;
}

export interface ScheduleSlot {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface CreateSlotRequest {
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface CreateSessionRequest {
  classId: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
  sessionNumber: number | null;
}

export interface GenerateSessionsRequest {
  fromDate: string;
  toDate: string;
}

// ----------------- Buổi học (module nhập liệu) -----------------

export interface PointEntry {
  id: string;
  studentId: string;
  type: PointType;
  points: number;
  reason: string;
  createdAt: string;
}

export interface SessionStudentRow {
  studentId: string;
  fullName: string;
  attendance: AttendanceStatus;
  homework: HomeworkStatus;
  attitude: AttitudeStatus;
  personalNote: string | null;
  rewardBalance: number;
  points: PointEntry[];
}

export interface SessionSheet {
  sessionId: string;
  classId: string;
  className: string;
  sessionNumber: number;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
  status: SessionStatus;
  rows: SessionStudentRow[];
}

export interface SaveAttendanceRow {
  studentId: string;
  attendance: AttendanceStatus;
  homework: HomeworkStatus;
  attitude: AttitudeStatus;
  personalNote: string | null;
}

export interface AddPointRequest {
  studentId: string;
  type: PointType;
  points: number;
  reason: string;
}

export interface RedeemRewardRequest {
  tier: RewardTier;
  note: string | null;
}

export interface SkillScores {
  overall: number | null;
  vocabulary: number | null;
  grammar: number | null;
  listening: number | null;
  speaking: number | null;
  reading: number | null;
  writing: number | null;
}

export interface AssessmentPoint {
  takenOn: string;
  overall: number | null;
  vocabulary: number | null;
  grammar: number | null;
  listening: number | null;
  speaking: number | null;
  reading: number | null;
  writing: number | null;
}

export interface StudentProgress {
  studentId: string;
  fullName: string;
  totalSessions: number;
  attendedSessions: number;
  absentSessions: number;
  homeworkCompleted: number;
  homeworkNotCompleted: number;
  rewardPoints: number;
  penaltyPoints: number;
  rewardBalance: number;
  latestSkills: SkillScores | null;
  scoreTrend: AssessmentPoint[];
}

// ----------------- Nhật ký & Báo cáo -----------------

export interface TeacherJournal {
  id: string;
  classSessionId: string;
  contentTaught: string | null;
  activities: string | null;
  difficulties: string | null;
  notesForNextSession: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertJournalRequest {
  contentTaught: string | null;
  activities: string | null;
  difficulties: string | null;
  notesForNextSession: string | null;
}

export interface GeneratedReport {
  id: string | null;
  type: ReportType;
  content: string;
  generatedAt: string;
}

// ----------------- Dashboard -----------------

export interface TodaySession {
  sessionId: string;
  classId: string;
  className: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
}

export interface TuitionDue {
  studentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  status: TuitionStatus;
}

export interface Absentee {
  studentId: string;
  studentName: string;
  className: string;
  sessionDate: string;
}

export interface MissingHomework {
  studentId: string;
  studentName: string;
  className: string;
  sessionDate: string;
}

export interface TopStudent {
  studentId: string;
  studentName: string;
  rewardBalance: number;
}

export interface AttentionStudent {
  studentId: string;
  studentName: string;
  reason: string;
}

export interface DashboardSummary {
  totalActiveStudents: number;
  totalClasses: number;
  sessionsToday: number;
  todaySchedule: TodaySession[];
  tuitionDueSoon: TuitionDue[];
  recentAbsentees: Absentee[];
  missingHomework: MissingHomework[];
  topStudents: TopStudent[];
  needAttention: AttentionStudent[];
}

export interface MonthRate {
  month: string;
  rate: number;
}

export interface ClassPoints {
  className: string;
  points: number;
}

export interface MonthScore {
  month: string;
  averageScore: number;
}

export interface DashboardCharts {
  attendanceByMonth: MonthRate[];
  homeworkByMonth: MonthRate[];
  rewardPointsByClass: ClassPoints[];
  testScoreGrowth: MonthScore[];
}

// ----------------- Cấu hình & File -----------------

export interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  scope: SettingScope;
  scopeId: string | null;
  dataType: string | null;
  description: string | null;
}

export interface UpsertSettingRequest {
  key: string;
  value: string | null;
  scope: SettingScope;
  scopeId: string | null;
  dataType: string | null;
  description: string | null;
}

export interface EffectiveSettings {
  values: Record<string, string>;
}

export interface StoredFile {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

// ----------------- Tích hợp AI (Google Gemini) -----------------

/** Trạng thái cấu hình API Key AI của tài khoản hiện tại — KHÔNG bao giờ chứa key thô. */
export interface AiCredential {
  hasKey: boolean;
  maskedKey: string | null;
  provider: string;
  model: string | null;
  lastValidatedAt: string | null;
  isValid: boolean | null;
}

export interface SaveAiCredentialRequest {
  apiKey: string;
  model: string | null;
}

export interface ValidateAiKeyResult {
  isValid: boolean;
  message: string | null;
}

// ----------------- Học phí -----------------

export interface TuitionInvoice {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string | null;
  periodYear: number;
  periodMonth: number;
  amount: number;
  discountAmount: number;
  paidAmount: number;
  dueDate: string;
  status: TuitionStatus;
  paidOn: string | null;
  note: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface TuitionStudentListItem {
  studentId: string;
  studentCode: string;
  studentName: string;
  phone: string | null;
  parentPhone: string | null;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: TuitionStatus;
}

export interface TuitionClassLine {
  classId: string;
  classCode: string;
  className: string;
  teacherName: string | null;
  subjectName: string | null;
  gradeName: string | null;
  branchName: string | null;
  tuitionFee: number;
}

export interface TuitionBill {
  studentId: string;
  studentCode: string;
  studentName: string;
  phone: string | null;
  parentPhone: string | null;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  classes: TuitionClassLine[];
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: TuitionStatus;
  invoices: TuitionInvoice[];
}

export interface PayStudentTuitionRequest {
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  discountAmount: number;
  paidAmount: number;
  note: string | null;
}

export interface CreateTuitionInvoiceRequest {
  studentId: string;
  classId: string | null;
  periodYear: number;
  periodMonth: number;
  amount: number;
  dueDate: string;
  note: string | null;
}

export interface UpdateTuitionInvoiceRequest {
  amount: number;
  dueDate: string;
  note: string | null;
}

export const TUITION_STATUS_LABELS: Record<TuitionStatus, string> = {
  [TuitionStatus.Pending]: 'Chưa tới hạn',
  [TuitionStatus.Paid]: 'Đã đóng',
  [TuitionStatus.DueSoon]: 'Sắp đến hạn',
  [TuitionStatus.Overdue]: 'Quá hạn',
  [TuitionStatus.Partial]: 'Còn thiếu'
};

export const TUITION_STATUS_COLORS: Record<TuitionStatus, string> = {
  [TuitionStatus.Pending]: 'default',
  [TuitionStatus.Paid]: 'green',
  [TuitionStatus.DueSoon]: 'gold',
  [TuitionStatus.Overdue]: 'red',
  [TuitionStatus.Partial]: 'orange'
};

// ----------------- Kho tài liệu -----------------

export interface Material {
  id: string;
  classId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeBand: string | null;
  title: string;
  type: MaterialType;
  source: MaterialSource;
  url: string | null;
  storedFileId: string | null;
  description: string | null;
  downloadUrl: string;
  createdAt: string;
}

export interface CreateMaterialRequest {
  classId: string | null;
  categoryId: string | null;
  subjectId: string | null;
  gradeBand: string | null;
  title: string;
  type: MaterialType;
  source: MaterialSource;
  url: string | null;
  storedFileId: string | null;
  description: string | null;
}

export interface UpdateMaterialRequest {
  categoryId: string | null;
  subjectId: string | null;
  gradeBand: string | null;
  title: string;
  type: MaterialType;
  source: MaterialSource;
  url: string | null;
  storedFileId: string | null;
  description: string | null;
}

// ----------------- Nhập danh sách lớp từ Excel (Đợt 7) -----------------

export interface ClassImportClassPreview {
  previewId: string;
  classCode: string | null;
  name: string;
  existingClassId: string | null;
  // Lớp mới trùng tên trong cùng cơ sở với 1 lớp đã có → id lớp trùng (để chọn "dùng lớp đã có").
  duplicateClassId: string | null;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  teacherProfileId: string | null;
  teacherName: string | null;
  tuitionFee: number;
  isValid: boolean;
  error: string | null;
}

export interface ClassImportStudentPreview {
  rowNumber: number;
  previewClassId: string;
  studentCode: string | null;
  fullName: string;
  dateOfBirth: string | null;
  parentPhone: string | null;
  phone: string | null;
  note: string | null;
  isValid: boolean;
  error: string | null;
}

export interface ClassImportExistingClass {
  id: string;
  name: string;
  branchId: string | null;
}

export interface ClassImportPreview {
  classes: ClassImportClassPreview[];
  students: ClassImportStudentPreview[];
  existingClasses: ClassImportExistingClass[];
  validClassCount: number;
  validStudentCount: number;
  invalidCount: number;
}

export interface ClassImportCommitRequest {
  classes: ClassImportClassPreview[];
  students: ClassImportStudentPreview[];
}

export interface ClassImportResult {
  classesCreated: number;
  studentsCreated: number;
  enrollmentsCreated: number;
  skipped: number;
  errors: string[];
}

export interface MaterialCategory {
  id: string;
  name: string;
  description: string | null;
  indexOrder: number;
}

export interface MaterialCategoryRequest {
  name: string;
  description: string | null;
  indexOrder: number;
}

// ----------------- Bài tập & nộp bài (Đợt 4) -----------------

export enum SubmissionStatus {
  NotSubmitted = 'NotSubmitted',
  Submitted = 'Submitted',
  Late = 'Late'
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  [SubmissionStatus.NotSubmitted]: 'Chưa nộp',
  [SubmissionStatus.Submitted]: 'Đã nộp',
  [SubmissionStatus.Late]: 'Muộn'
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, string> = {
  [SubmissionStatus.NotSubmitted]: 'default',
  [SubmissionStatus.Submitted]: 'green',
  [SubmissionStatus.Late]: 'red'
};

export interface Assignment {
  id: string;
  classId: string;
  classSessionId: string | null;
  materialId: string | null;
  materialTitle: string | null;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  submittedCount: number;
  totalCount: number;
  createdAt: string;
}

export interface CreateAssignmentRequest {
  classId: string;
  classSessionId: string | null;
  materialId: string | null;
  title: string;
  instructions: string | null;
  dueDate: string | null;
}

export interface SubmissionStatusInfo {
  studentId: string;
  fullName: string;
  status: SubmissionStatus;
  submittedOn: string | null;
  link: string | null;
  note: string | null;
}

export interface PortalAssignment {
  id: string;
  className: string;
  title: string;
  instructions: string | null;
  materialTitle: string | null;
  materialUrl: string | null;
  dueDate: string | null;
  status: SubmissionStatus;
  submittedOn: string | null;
  link: string | null;
}

export interface SubmitAssignmentRequest {
  link: string | null;
  note: string | null;
}

// ----------------- Import Excel học viên (Đợt 6) -----------------

export interface StudentImportRow {
  rowNumber: number;
  fullName: string | null;
  dateOfBirth: string | null;
  school: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  englishLevel: string | null;
  learningGoal: string | null;
  isValid: boolean;
  error: string | null;
}

export interface StudentImportPreview {
  rows: StudentImportRow[];
  validCount: number;
  invalidCount: number;
}

export interface StudentImportResult {
  created: number;
  accountsCreated: number;
  skipped: number;
  errors: string[];
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  [MaterialType.Pdf]: 'PDF',
  [MaterialType.Video]: 'Video',
  [MaterialType.Vocabulary]: 'Từ vựng',
  [MaterialType.Test]: 'Đề kiểm tra',
  [MaterialType.Homework]: 'Bài tập'
};

// ----------------- Đề trắc nghiệm AI -----------------

export type ExamQuestionType = 'SingleChoice' | 'TrueFalse' | 'FillBlank' | 'Matching';
export type ExamStatus = 'Draft' | 'Published';
export type ExamGenSource = 'Extracted' | 'Generated' | 'Manual';
export type ExamGenerationMode = 'Extract' | 'Generate';

export const EXAM_TYPE_LABELS: Record<ExamQuestionType, string> = {
  SingleChoice: 'Trắc nghiệm',
  TrueFalse: 'Đúng/Sai',
  FillBlank: 'Điền từ',
  Matching: 'Nối cột'
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  Draft: 'Nháp',
  Published: 'Đã phát hành'
};

export interface ExamListItem {
  id: string;
  materialId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  gradeBand: string | null;
  durationMinutes: number;
  totalPoints: number;
  status: ExamStatus;
  source: ExamGenSource;
  questionCount: number;
  createdAt: string;
}

export interface ExamGroup {
  id: string;
  orderNo: number;
  section: string | null;
  exerciseLabel: string | null;
  instruction: string | null;
  passage: string | null;
}

export interface ExamQuestion {
  id: string;
  groupId: string | null;
  orderNo: number;
  sourceNumber: number | null;
  type: ExamQuestionType;
  stem: string;
  optionsJson: string | null;
  answerJson: string;
  explanation: string | null;
  points: number;
}

export interface ExamDetail {
  id: string;
  materialId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  description: string | null;
  gradeBand: string | null;
  durationMinutes: number;
  totalPoints: number;
  status: ExamStatus;
  source: ExamGenSource;
  sourceFileUrl: string | null;
  groups: ExamGroup[];
  questions: ExamQuestion[];
  createdAt: string;
}

export interface GenerateExamRequest {
  mode: ExamGenerationMode;
  title: string | null;
  durationMinutes: number | null;
  maxQuestions: number | null;
  difficulty: string | null;
  instructions: string | null;
  verify: boolean;
}

export interface ExamGenerationResult {
  examId: string;
  questionCount: number;
  droppedCount: number;
  warnings: string[];
}

export interface UpdateExamRequest {
  title: string;
  description: string | null;
  gradeBand: string | null;
  durationMinutes: number;
}

export interface ExamOption { key: string; text: string; }
export interface ExamPair { left: string; right: string; }

export interface UpsertQuestionRequest {
  groupId: string | null;
  type: ExamQuestionType;
  stem: string;
  options: ExamOption[] | null;
  optionsRight: ExamOption[] | null;
  answerKey: string | null;
  answerBlanks: string[] | null;
  wordBox: string[] | null;
  answerPairs: ExamPair[] | null;
  explanation: string | null;
  points: number | null;
}

// ----------------- Đánh giá tháng + Bảng vàng -----------------

export interface MonthlyEvaluation {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  year: number;
  month: number;
  attendanceScore: number;
  homeworkScore: number;
  attitudeScore: number;
  vocabularyScore: number;
  grammarScore: number;
  total: number;
  rank: EvaluationRank;
  comment: string | null;
}

export interface UpsertEvaluationRequest {
  studentId: string;
  classId: string | null;
  year: number;
  month: number;
  attendanceScore: number;
  homeworkScore: number;
  attitudeScore: number;
  vocabularyScore: number;
  grammarScore: number;
  comment: string | null;
}

export interface LeaderEntry {
  studentId: string;
  studentName: string;
  value: number;
}

export interface Leaderboard {
  topReward: LeaderEntry[];
  topAttendance: LeaderEntry[];
  topHomework: LeaderEntry[];
}

export const EVAL_RANK_LABELS: Record<EvaluationRank, string> = {
  [EvaluationRank.Excellent]: '🥇 Xuất sắc',
  [EvaluationRank.Good]: '🥈 Tốt',
  [EvaluationRank.Satisfactory]: '🥉 Đạt yêu cầu',
  [EvaluationRank.NeedsImprovement]: '⚠️ Cần cố gắng'
};

export const EVAL_RANK_COLORS: Record<EvaluationRank, string> = {
  [EvaluationRank.Excellent]: 'gold',
  [EvaluationRank.Good]: 'green',
  [EvaluationRank.Satisfactory]: 'blue',
  [EvaluationRank.NeedsImprovement]: 'red'
};

// ----------------- Thông báo & Báo cáo phụ huynh -----------------

export interface CreateNotificationRequest {
  title: string;
  content: string;
  type: NotificationType;
  channels: NotificationChannel[];
  scope: NotificationTargetScope;
  classId: string | null;
  studentId: string | null;
}

export interface NotificationDelivery {
  id: string;
  studentId: string | null;
  studentName: string;
  channel: NotificationChannel;
  renderedContent: string;
  status: NotificationDeliveryStatus;
  errorMessage: string | null;
}

export interface NotificationResult {
  notificationId: string;
  deliveries: NotificationDelivery[];
}

export interface ParentReport {
  id: string | null;
  year: number;
  month: number;
  content: string;
  generatedAt: string;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.Schedule]: 'Lịch học',
  [NotificationType.DayOff]: 'Nghỉ học',
  [NotificationType.Report]: 'Báo cáo',
  [NotificationType.Tuition]: 'Học phí',
  [NotificationType.Homework]: 'Bài tập'
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  [NotificationChannel.Email]: 'Email',
  [NotificationChannel.Zalo]: 'Zalo',
  [NotificationChannel.Messenger]: 'Messenger'
};

export const DELIVERY_STATUS_LABELS: Record<NotificationDeliveryStatus, string> = {
  [NotificationDeliveryStatus.Pending]: 'Chờ gửi',
  [NotificationDeliveryStatus.Sent]: 'Đã gửi',
  [NotificationDeliveryStatus.Failed]: 'Lỗi',
  [NotificationDeliveryStatus.Manual]: 'Gửi tay'
};

export const DELIVERY_STATUS_COLORS: Record<NotificationDeliveryStatus, string> = {
  [NotificationDeliveryStatus.Pending]: 'default',
  [NotificationDeliveryStatus.Sent]: 'green',
  [NotificationDeliveryStatus.Failed]: 'red',
  [NotificationDeliveryStatus.Manual]: 'blue'
};

// ----------------- Cảnh báo & Portal học sinh -----------------

export interface WarningItem {
  studentId: string;
  studentName: string;
  detail: string;
}

export interface Warnings {
  consecutiveAbsences: WarningItem[];
  missedHomework: WarningItem[];
  scoreDrop: WarningItem[];
  tuitionOverdue: WarningItem[];
}

export interface PortalSession {
  sessionId: string;
  className: string;
  sessionDate: string;
  startTime: string | null;
  topic: string | null;
}

export interface PortalProfile {
  studentId: string;
  fullName: string;
  englishLevel: string | null;
  learningGoal: string | null;
  totalSessions: number;
  attendedSessions: number;
  homeworkCompleted: number;
  rewardBalance: number;
  upcomingSessions: PortalSession[];
}

// ----------------- Nhãn hiển thị tiếng Việt -----------------

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.Present]: 'Có mặt',
  [AttendanceStatus.Late]: 'Đi muộn',
  [AttendanceStatus.ExcusedAbsence]: 'Vắng có phép',
  [AttendanceStatus.UnexcusedAbsence]: 'Vắng không phép'
};

export const HOMEWORK_LABELS: Record<HomeworkStatus, string> = {
  [HomeworkStatus.NotAssigned]: 'Không giao',
  [HomeworkStatus.CompletedWell]: 'Hoàn thành tốt',
  [HomeworkStatus.Completed]: 'Hoàn thành',
  [HomeworkStatus.NotCompleted]: 'Chưa hoàn thành'
};

export const ATTITUDE_LABELS: Record<AttitudeStatus, string> = {
  [AttitudeStatus.Positive]: 'Tích cực',
  [AttitudeStatus.Normal]: 'Bình thường',
  [AttitudeStatus.Unfocused]: 'Chưa tập trung'
};

export const REWARD_TIER_LABELS: Record<RewardTier, string> = {
  [RewardTier.SmallGift]: 'Quà nhỏ (50 điểm)',
  [RewardTier.FreeMaterials]: 'Miễn phí tài liệu (100 điểm)',
  [RewardTier.FeeDiscount]: 'Giảm học phí (150 điểm)'
};

export const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

// ----------------- Lý do điểm -----------------

export enum PointReasonType {
  Reward = 'Reward',
  Penalty = 'Penalty'
}

export interface PointReason {
  id: string;
  label: string;
  points: number;
  type: PointReasonType;
  indexOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PointReasonRequest {
  label: string;
  points: number;
  type: PointReasonType;
  indexOrder: number;
  isActive: boolean;
}

export const SKILLS: { key: keyof SkillScores; label: string }[] = [
  { key: 'listening', label: 'Nghe' },
  { key: 'speaking', label: 'Nói' },
  { key: 'reading', label: 'Đọc' },
  { key: 'writing', label: 'Viết' },
  { key: 'grammar', label: 'Ngữ pháp' },
  { key: 'vocabulary', label: 'Từ vựng' }
];
