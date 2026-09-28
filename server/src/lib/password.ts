import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/*
 * Password hashing with scrypt (memory-hard, built into Node — no native deps).
 * Stored format: scrypt$N$r$p$<salt b64>$<hash b64>, so parameters can be raised later
 * without breaking existing hashes.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEM });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !n || !r || !p || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEM,
  });
  // Constant-time comparison so response timing doesn't leak how many bytes matched.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A precomputed hash to verify against when the email doesn't exist, so "no such user"
 *  and "wrong password" take the same time and can't be told apart. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}
