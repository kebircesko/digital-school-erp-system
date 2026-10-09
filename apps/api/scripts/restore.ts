import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decrypt,restore,snapshot,encrypt } from '../src/backups/snapshot';
const db=new PrismaClient();
async function main(){const file=process.argv[2];if(!file||process.env.RESTORE_CONFIRM!=='RESTORE_DIGITAL_SCHOOL')throw new Error('Ndaleni API-në, vendosni RESTORE_CONFIRM=RESTORE_DIGITAL_SCHOOL dhe jepni rrugën e backup-it.');if(!process.env.BACKUP_KEY)throw new Error('BACKUP_KEY mungon.');const backup=decrypt(await readFile(file),process.env.BACKUP_KEY);const dir=resolve(process.env.BACKUP_DIR??'.local/backups');await mkdir(dir,{recursive:true,mode:0o700});await writeFile(resolve(dir,`before-restore-${Date.now()}.erpbackup`),encrypt(await snapshot(db),process.env.BACKUP_KEY),{mode:0o600});await restore(db,backup);console.log('Rikthimi përfundoi. Sesionet u revokuan; përdoruesit duhet të kyçen përsëri.');}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.$disconnect());
