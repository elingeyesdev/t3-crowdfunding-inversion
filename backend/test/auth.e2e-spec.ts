import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DATABASE_POOL } from '../src/config/database.module';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthController (E2E/Functional)', () => {
  let app: INestApplication;
  let mockPool: any;

  beforeAll(async () => {
    // Mock database queries to prevent actual DB calls during E2E functional test
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
      on: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(mockPool)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should return 200 and accessToken on successful login', async () => {
      const passwordHash = await bcrypt.hash('Password123', 12);
      
      // Simulate finding a valid active user
      mockPool.query.mockImplementation((queryText: string, params: any[]) => {
        if (queryText.includes('users') && queryText.includes('password_hash')) {
          return Promise.resolve({
            rows: [
              {
                id: 'user-uuid-999',
                email: 'superadmin@equipo09.com',
                password_hash: passwordHash,
                is_active: true,
                email_verified: true,
                preferred_language: 'es',
                phone: null,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          });
        }
        if (queryText.includes('user_roles')) {
          return Promise.resolve({
            rows: [
              {
                id: '1',
                email: 'superadmin@equipo09.com',
                roles: ['admin'],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'superadmin@equipo09.com',
          password: 'Password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe('superadmin@equipo09.com');
    });

    it('should return 401 when password is wrong', async () => {
      const passwordHash = await bcrypt.hash('Password123', 12);
      
      mockPool.query.mockImplementation((queryText: string, params: any[]) => {
        if (queryText.includes('users') && queryText.includes('password_hash')) {
          return Promise.resolve({
            rows: [
              {
                id: 'user-uuid-999',
                email: 'superadmin@equipo09.com',
                password_hash: passwordHash,
                is_active: true,
                email_verified: true,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'superadmin@equipo09.com',
          password: 'wrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Credenciales inválidas');
    });
  });
});
