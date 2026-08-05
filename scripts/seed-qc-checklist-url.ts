import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

await sql`UPDATE tenant_configs SET extra_config = '{"store_code":"CKRBUL","qc_checklist_url":"https://drive.google.com/drive/folders/1gv-vTZrjW60S29KDzaafHil8bL9ZDYPv?usp=drive_link"}' WHERE id = 1`
console.log('Updated tenant_configs with qc_checklist_url')
