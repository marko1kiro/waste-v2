import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

await sql`UPDATE tenant_configs SET extra_config = '{"store_code":"CKRBUL"}' WHERE id = 1`
console.log('Updated store_code to CKRBUL')
