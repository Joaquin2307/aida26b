import { Pool } from 'pg';
import dotenv from 'dotenv';
import { hashPassword, isRole } from './auth';

dotenv.config();

// One-off helper to create/update a user with an arbitrary role (e.g. to seed
// administrativo/contador accounts for manual testing). Run with:
//   SEED_USERNAME=conta SEED_PASSWORD=conta1234 SEED_ROLE=contador npm run seed-user
async function main() {
  const username = process.env.SEED_USERNAME?.trim();
  const password = process.env.SEED_PASSWORD;
  const role = process.env.SEED_ROLE?.trim() || 'contador';
  const email = process.env.SEED_EMAIL?.trim() || null;

  if (!username || !password || password.length < 8) {
    throw new Error('SEED_USERNAME and SEED_PASSWORD (>=8 chars) are required');
  }

  if (!isRole(role)) {
    throw new Error('SEED_ROLE must be one of: admin, administrativo, contador');
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const { passwordHash, passwordSalt } = await hashPassword(password);
  await pool.query(
    `INSERT INTO auth.users (username, email, password_hash, password_salt, role, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, true, false)
     ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           password_salt = EXCLUDED.password_salt,
           role = EXCLUDED.role,
           is_active = true,
           must_change_password = false,
           updated_at = now()`,
    [username, email, passwordHash, passwordSalt, role],
  );

  await pool.end();
  console.log(`User ready: ${username} (${role})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
