export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

export interface AdminUserFormData {
  name: string
  email: string
  password: string
  role: string
}
