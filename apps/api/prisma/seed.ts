import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
const db = new PrismaClient();
async function main() {
 const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), password = process.env.ADMIN_PASSWORD;
 if (!email || !password || password.length < 12) throw new Error('Vendosni ADMIN_EMAIL dhe ADMIN_PASSWORD (të paktën 12 karaktere).');
 if (await db.user.count()) throw new Error('Inicializimi lejohet vetëm në databazë pa përdorues.');
 await db.user.create({data:{email,name:process.env.ADMIN_NAME ?? 'Administrator',role:Role.ADMIN,passwordHash:hashPassword(password)}});
 console.log('Administratori u krijua.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
