import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { TransformResponseInterceptor } from 'src/common/interceptors/transform-response.interceptor';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';

/**
 * E2E tests for MusicGPT API.
 *
 * Requires running PostgreSQL and Redis instances.
 * Set DATABASE_URL and REDIS_URL in .env or environment.
 */
describe('MusicGPT API (e2e)', () => {
  let app: any;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  const testUser = {
    email: `e2e-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    display_name: 'E2E Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test user data
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
      await prisma.audio.deleteMany({ where: { user_id: userId } });
      await prisma.prompt.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  // ── Health ──
  describe('GET /health', () => {
    it('should return health status', () => {
      return (supertest as any)(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe('ok');
          expect(res.body.data.timestamp).toBeDefined();
        });
    });
  });

  // ── Auth: Register ──
  describe('POST /auth/register', () => {
    it('should register a new user', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.user.email).toBe(testUser.email);
          expect(res.body.data.user.display_name).toBe(testUser.display_name);
          expect(res.body.data.user.subscription_status).toBe('FREE');
          expect(res.body.data.tokens.access_token).toBeDefined();
          expect(res.body.data.tokens.refresh_token).toBeDefined();
          userId = res.body.data.user.id;
          accessToken = res.body.data.tokens.access_token;
          refreshToken = res.body.data.tokens.refresh_token;
        });
    });

    it('should validate required fields', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid' })
        .expect(412);
    });
  });

  // ── Auth: Login ──
  describe('POST /auth/login', () => {
    it('should login with valid credentials', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.tokens.access_token).toBeDefined();
          expect(res.body.data.tokens.refresh_token).toBeDefined();
          accessToken = res.body.data.tokens.access_token;
          refreshToken = res.body.data.tokens.refresh_token;
        });
    });

    it('should reject wrong password', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' })
        .expect(401);
    });
  });

  // ── Auth: Refresh ──
  describe('POST /auth/refresh', () => {
    it('should issue new tokens with valid refresh token', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.access_token).toBeDefined();
          expect(res.body.data.refresh_token).toBeDefined();
          accessToken = res.body.data.access_token;
          refreshToken = res.body.data.refresh_token;
        });
    });

    it('should reject invalid refresh token', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });
  });

  // ── Protected Route Access ──
  describe('Protected routes', () => {
    it('should reject unauthenticated requests', () => {
      return (supertest as any)(app.getHttpServer())
        .get('/prompts')
        .expect(401);
    });

    it('should accept authenticated requests', () => {
      return (supertest as any)(app.getHttpServer())
        .get('/prompts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  // ── Prompts ──
  describe('Prompts CRUD', () => {
    it('POST /prompts - should create a prompt', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/prompts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ text: 'Create a chill lo-fi beat' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.text).toBe('Create a chill lo-fi beat');
          expect(res.body.data.status).toBe('PENDING');
          expect(res.body.data.id).toBeDefined();
        });
    });

    it('GET /prompts - should list user prompts', () => {
      return (supertest as any)(app.getHttpServer())
        .get('/prompts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
          expect(res.body.meta).toBeDefined();
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });
  });

  // ── Subscription ──
  describe('Subscription', () => {
    it('POST /subscription/subscribe - should upgrade to PAID', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/subscription/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.subscription_status).toBe('PAID');
        });
    });

    it('POST /subscription/cancel - should downgrade to FREE', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/subscription/cancel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.subscription_status).toBe('FREE');
        });
    });
  });

  // ── Search ──
  describe('GET /search', () => {
    it('should search with a query', () => {
      return (supertest as any)(app.getHttpServer())
        .get('/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ q: 'e2e' })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.users).toBeDefined();
          expect(res.body.data.audio).toBeDefined();
          expect(res.body.data.users.data).toBeDefined();
          expect(res.body.data.users.meta).toBeDefined();
        });
    });

    it('should require query parameter', () => {
      return (supertest as any)(app.getHttpServer())
        .get('/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(412);
    });
  });

  // ── Auth: Logout ──
  describe('POST /auth/logout', () => {
    it('should logout and revoke tokens', () => {
      return (supertest as any)(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Logged out successfully');
        });
    });
  });
});
