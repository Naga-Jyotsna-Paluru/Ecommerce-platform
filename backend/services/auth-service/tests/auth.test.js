/**
 * tests/auth.test.js
 *
 * Integration Tests for Auth Service
 *
 * WHY INTEGRATION TESTS (not just unit tests)?
 * Unit tests mock the database. Integration tests use a real test database.
 * This catches bugs that only appear when real SQL runs — constraint violations,
 * transaction issues, index behavior.
 *
 * SETUP REQUIRED:
 * - Set TEST_DB_* env variables pointing to a test database
 * - Never run tests against your production database
 */

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { createUsersTable } = require('../src/models/userModel');

// Test user data
const testUser = {
  fullName: 'Test User',
  email: 'testuser@example.com',
  password: 'Test@1234',
};

beforeAll(async () => {
  // Ensure tables exist in test DB
  await createUsersTable();
});

afterAll(async () => {
  // Clean up test data and close pool
  await pool.query("DELETE FROM users WHERE email = $1", [testUser.email]);
  await pool.end();
});

describe('POST /api/auth/register', () => {
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
    // CRITICAL: password must never be in the response
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('should return 400 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, email: 'other@test.com', password: '123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, email: 'not-an-email' });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('should log in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    // Refresh token should be in cookie, not response body
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should return 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword@1' });

    expect(res.statusCode).toBe(401);
    // Must use generic message — not "wrong password" or "wrong email"
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Test@1234' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    accessToken = res.body.data.accessToken;
  });

  it('should return user profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.invalid');
    expect(res.statusCode).toBe(401);
  });
});
