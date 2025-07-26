// Jest setup file - this runs once before all tests
import { initTestDb, closeTestDb } from './tests/testUtils';

// Global test setup - initialize database connection
beforeAll(async () => {
  await initTestDb();
});

// Global test teardown - close database connection
afterAll(async () => {
  await closeTestDb();
}); 