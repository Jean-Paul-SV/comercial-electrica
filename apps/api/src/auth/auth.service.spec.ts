import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import * as argon2 from 'argon2';

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-1',
    email: 'admin@test.com',
    passwordHash: 'hashed-password',
    role: RoleName.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockJwt = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwt,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapAdmin', () => {
    it('debe crear el primer admin exitosamente', async () => {
      const dto: BootstrapAdminDto = {
        email: 'admin@test.com',
        password: 'Admin123!',
      };

      const createdUser = {
        id: 'user-1',
        email: 'admin@test.com',
        role: RoleName.ADMIN,
        createdAt: new Date(),
      };

      prisma.user.count = jest.fn().mockResolvedValue(0);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create = jest.fn().mockResolvedValue(createdUser);

      const result = await service.bootstrapAdmin(dto);

      expect(result).toEqual(createdUser);
      expect(result.role).toBe(RoleName.ADMIN);
      expect(prisma.user.count).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'admin@test.com',
          passwordHash: 'hashed-password',
          role: RoleName.ADMIN,
        },
        select: { id: true, email: true, role: true, createdAt: true },
      });
    });

    it('debe lanzar error si ya existe un usuario', async () => {
      const dto: BootstrapAdminDto = {
        email: 'admin@test.com',
        password: 'Admin123!',
      };

      prisma.user.count = jest.fn().mockResolvedValue(1);

      await expect(service.bootstrapAdmin(dto)).rejects.toThrow(BadRequestException);
      await expect(service.bootstrapAdmin(dto)).rejects.toThrow('Bootstrap ya fue realizado.');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('debe normalizar el email a minúsculas', async () => {
      const dto: BootstrapAdminDto = {
        email: 'ADMIN@TEST.COM',
        password: 'Admin123!',
      };

      const createdUser = {
        id: 'user-1',
        email: 'admin@test.com',
        role: RoleName.ADMIN,
        createdAt: new Date(),
      };

      prisma.user.count = jest.fn().mockResolvedValue(0);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create = jest.fn().mockResolvedValue(createdUser);

      await service.bootstrapAdmin(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'admin@test.com',
          }),
        }),
      );
    });
  });

  describe('register', () => {
    it('debe registrar un nuevo usuario exitosamente', async () => {
      const dto: RegisterUserDto = {
        email: 'user@test.com',
        password: 'User123!',
        role: RoleName.USER,
      };

      const createdUser = {
        id: 'user-2',
        email: 'user@test.com',
        role: RoleName.USER,
        createdAt: new Date(),
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create = jest.fn().mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(result).toEqual(createdUser);
      expect(result.role).toBe(RoleName.USER);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
    });

    it('debe usar USER como rol por defecto si no se especifica', async () => {
      const dto: RegisterUserDto = {
        email: 'user@test.com',
        password: 'User123!',
      };

      const createdUser = {
        id: 'user-2',
        email: 'user@test.com',
        role: RoleName.USER,
        createdAt: new Date(),
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create = jest.fn().mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(result.role).toBe(RoleName.USER);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: RoleName.USER,
          }),
        }),
      );
    });

    it('debe lanzar error si el email ya está registrado', async () => {
      const dto: RegisterUserDto = {
        email: 'existing@test.com',
        password: 'User123!',
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      await expect(service.register(dto)).rejects.toThrow('Email ya registrado.');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('debe hacer login exitosamente con credenciales válidas', async () => {
      const dto: LoginDto = {
        email: 'admin@test.com',
        password: 'Admin123!',
      };

      const mockPayload = {
        sub: 'user-1',
        email: 'admin@test.com',
        role: RoleName.ADMIN,
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwt.signAsync = jest.fn().mockResolvedValue('jwt-token-123');

      const result = await service.login(dto);

      expect(result).toEqual({ accessToken: 'jwt-token-123' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@test.com' },
      });
      expect(argon2.verify).toHaveBeenCalledWith('hashed-password', 'Admin123!');
      expect(jwt.signAsync).toHaveBeenCalledWith(mockPayload);
    });

    it('debe lanzar error si el usuario no existe', async () => {
      const dto: LoginDto = {
        email: 'nonexistent@test.com',
        password: 'Password123!',
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales inválidas.');
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('debe lanzar error si el usuario está inactivo', async () => {
      const dto: LoginDto = {
        email: 'admin@test.com',
        password: 'Admin123!',
      };

      const inactiveUser = {
        ...mockUser,
        isActive: false,
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(inactiveUser);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales inválidas.');
    });

    it('debe lanzar error si la contraseña es incorrecta', async () => {
      const dto: LoginDto = {
        email: 'admin@test.com',
        password: 'WrongPassword!',
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales inválidas.');
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('debe normalizar el email a minúsculas', async () => {
      const dto: LoginDto = {
        email: 'ADMIN@TEST.COM',
        password: 'Admin123!',
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwt.signAsync = jest.fn().mockResolvedValue('jwt-token-123');

      await service.login(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@test.com' },
      });
    });
  });
});
