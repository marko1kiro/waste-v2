import assert from 'node:assert/strict'
import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const sql = neon(databaseUrl)
const marker = `regression-${Date.now()}-${Math.random().toString(36).slice(2)}`
const checkStatement = `DO $check$
    DECLARE
      test_date date := DATE '2099-12-31';
      test_shift text := '${marker}';
      test_station text := '${marker}';
      first_id integer;
      second_id integer;
      remaining integer;
      lock_count integer;
    BEGIN
      INSERT INTO waste_submission_locks (business_date, shift, station) VALUES (test_date, test_shift, test_station);
      INSERT INTO product_destructions (business_date, shift, kategori_induk, nama_produk, jumlah_produk) VALUES (test_date, test_shift, test_station, 'REGRESSION', 1) RETURNING id INTO first_id;
      INSERT INTO product_destructions (business_date, shift, kategori_induk, nama_produk, jumlah_produk) VALUES (test_date, test_shift, test_station, 'REGRESSION', 1) RETURNING id INTO second_id;

      PERFORM pg_advisory_xact_lock(hashtext(test_date::text || ':' || test_shift || ':' || test_station));
      DELETE FROM product_destructions WHERE id = first_id;
      SELECT COUNT(*)::int INTO remaining FROM product_destructions WHERE business_date = test_date AND shift = test_shift AND kategori_induk = test_station;
      DELETE FROM waste_submission_locks WHERE business_date = test_date AND shift = test_shift AND station = test_station AND remaining = 0;
      SELECT COUNT(*)::int INTO lock_count FROM waste_submission_locks WHERE business_date = test_date AND shift = test_shift AND station = test_station;
      IF remaining <> 1 OR lock_count <> 1 THEN RAISE EXCEPTION 'lock retained regression failed'; END IF;

      PERFORM pg_advisory_xact_lock(hashtext(test_date::text || ':' || test_shift || ':' || test_station));
      DELETE FROM product_destructions WHERE id = second_id;
      SELECT COUNT(*)::int INTO remaining FROM product_destructions WHERE business_date = test_date AND shift = test_shift AND kategori_induk = test_station;
      DELETE FROM waste_submission_locks WHERE business_date = test_date AND shift = test_shift AND station = test_station AND remaining = 0;
      SELECT COUNT(*)::int INTO lock_count FROM waste_submission_locks WHERE business_date = test_date AND shift = test_shift AND station = test_station;
      IF remaining <> 0 OR lock_count <> 0 THEN RAISE EXCEPTION 'lock cleared regression failed'; END IF;

      RAISE EXCEPTION 'rollback submission lock regression';
    END
  $check$`

await assert.rejects(sql(checkStatement), /rollback submission lock regression/)

console.log('submission lock checks passed')
