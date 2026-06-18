export interface UserDto {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  roles: string[];
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

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductRequest {
  name: string;
  sku: string;
  description: string | null;
  price: number;
  isActive: boolean;
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
  Overdue = 'Overdue'
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
  fullName: string;
  dateOfBirth: string | null;
  school: string | null;
  gradeLevel: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  enrollmentDate: string;
  englishLevel: string | null;
  learningGoal: string | null;
  entryScore: number | null;
  curriculum: string | null;
  userId: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface StudentRequest {
  fullName: string;
  dateOfBirth: string | null;
  school: string | null;
  gradeLevel: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  enrollmentDate: string | null;
  englishLevel: string | null;
  learningGoal: string | null;
  entryScore: number | null;
  curriculum: string | null;
  isActive: boolean;
}

// ----------------- Lớp học -----------------

export interface ClassListItem {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeBand: string | null;
  maxCapacity: number;
  currentSize: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface ClassDetail {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeBand: string | null;
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
  name: string;
  teacherId: string;
  subjectId: string | null;
  gradeBand: string | null;
  curriculumId: string | null;
  maxCapacity: number;
  schedule: string | null;
  startDate: string | null;
  isActive: boolean;
}

// ----------------- Môn học (Subject — Đợt 7) -----------------

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  classCount: number;
}

export interface SubjectRequest {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface RosterItem {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  phone: string | null;
  parentPhone: string | null;
  enrolledOn: string;
  userId: string | null;
}

/** Giáo viên tạo học sinh trong lớp (kèm tùy chọn tài khoản đăng nhập). */
export interface CreateClassStudentRequest {
  fullName: string;
  dateOfBirth?: string | null;
  school?: string | null;
  gradeLevel?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  englishLevel?: string | null;
  learningGoal?: string | null;
  createAccount: boolean;
  userName?: string | null;
  password?: string | null;
}

export interface CreateClassStudentResult {
  studentId: string;
  fullName: string;
  accountCreated: boolean;
  userName: string | null;
}

export interface ClassStudentOverview {
  studentId: string;
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

// ----------------- Học phí -----------------

export interface TuitionInvoice {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  periodYear: number;
  periodMonth: number;
  amount: number;
  dueDate: string;
  status: TuitionStatus;
  paidOn: string | null;
  note: string | null;
  isDeleted: boolean;
  createdAt: string;
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
  [TuitionStatus.Overdue]: 'Quá hạn'
};

export const TUITION_STATUS_COLORS: Record<TuitionStatus, string> = {
  [TuitionStatus.Pending]: 'default',
  [TuitionStatus.Paid]: 'green',
  [TuitionStatus.DueSoon]: 'gold',
  [TuitionStatus.Overdue]: 'red'
};

// ----------------- Kho tài liệu -----------------

export interface Material {
  id: string;
  classId: string | null;
  categoryId: string | null;
  categoryName: string | null;
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
  gradeBand: string | null;
  title: string;
  type: MaterialType;
  source: MaterialSource;
  url: string | null;
  storedFileId: string | null;
  description: string | null;
}

// ----------------- Nhập danh sách lớp từ Excel (Đợt 7) -----------------

export interface ClassImportRow {
  rowNumber: number;
  name: string;
  subjectName: string | null;
  gradeBand: string | null;
  teacher: string | null;
  maxCapacity: string | null;
  startDate: string | null;
  curriculum: string | null;
  isValid: boolean;
  error: string | null;
}

export interface ClassImportPreview {
  rows: ClassImportRow[];
  validCount: number;
  invalidCount: number;
}

export interface ClassImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface MaterialCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface MaterialCategoryRequest {
  name: string;
  description: string | null;
  sortOrder: number;
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

export const SKILLS: { key: keyof SkillScores; label: string }[] = [
  { key: 'listening', label: 'Nghe' },
  { key: 'speaking', label: 'Nói' },
  { key: 'reading', label: 'Đọc' },
  { key: 'writing', label: 'Viết' },
  { key: 'grammar', label: 'Ngữ pháp' },
  { key: 'vocabulary', label: 'Từ vựng' }
];
