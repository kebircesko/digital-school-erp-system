export type Role = 'ADMIN' | 'FINANCE' | 'INSTRUCTOR';
export type StudentStatus = 'ACTIVE' | 'INACTIVE';
export interface User { id: string; name: string; email: string; role: Role }
export interface Student { id: string; firstName: string; lastName: string; birthDate: string; parentName: string; parentPhone: string; address: string | null; notes: string | null; status: StudentStatus; version: number; createdAt: string }
export interface StudentInput { firstName: string; lastName: string; birthDate: string; parentName: string; parentPhone: string; address?: string; notes?: string; status: StudentStatus }
export interface StudentPage { items: Student[]; total: number; page: number; pages: number }
export interface Dashboard {
 courses:number;groups:number;financial?:{daily:string;monthly:string;yearly:string;outstanding:string;paid:number;unpaid:number;chart:{month:string;amount:string}[]}; total: number; active: number; inactive: number; recent: Student[] }
