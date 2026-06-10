/** Mirrors the backend AdminTaskItem / AdminTaskPage schemas (fa-web-api). */
export interface AdminTask {
  follow_up_task_id: number;
  alumni_id: number;
  alumni_name: string | null;
  task_title: string | null;
  /** ISO "YYYY-MM-DD" due date, or null when unset. */
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  task_notes: string | null;
  assigned_to_user_id: number | null;
  assigned_to: string | null;
}

export interface AdminTaskPage {
  items: AdminTask[];
  total: number;
  limit: number;
  offset: number;
}
