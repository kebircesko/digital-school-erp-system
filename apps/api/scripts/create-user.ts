import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
const db = new PrismaClient();
async function main() {
 const email=process.env.NEW_USER_EMAIL?.trim().toLowerCase(),password=process.env.NEW_USER_PASSWORD,role=process.env.NEW_USER_ROLE as Role;
 if (!email || !password || password.length<12 || !Object.values(Role).includes(role)) throw new Error('Kërkohen NEW_USER_EMAIL, NEW_USER_PASSWORD (12+ karaktere), NEW_USER_ROLE (ADMIN/FINANCE/INSTRUCTOR).');
 await db.user.create({data:{email,passwordHash:hashPassword(password),name:process.env.NEW_USER_NAME??email,role}});
 console.log('Përdoruesi u krijua.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
