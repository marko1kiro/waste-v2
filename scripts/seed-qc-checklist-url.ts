import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
if (!folderId) {
  console.error(
    'FATAL: env var GOOGLE_DRIVE_FOLDER_ID belum di-set. ' +
      'Isi di file .env (lihat .env.example) lalu jalankan ulang.',
  )
  process.exit(1)
}

const qcChecklistUrl = `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`

const sql = neon(process.env.DATABASE_URL!)

await sql`UPDATE tenant_configs SET extra_config = ${JSON.stringify({ store_code: 'CKRBUL', qc_checklist_url: qcChecklistUrl })} WHERE id = 1`
console.log('Updated tenant_configs with qc_checklist_url:', qcChecklistUrl)
