/**
 * 認証のビジネスロジック。
 *
 * ユーザー作成・パスワード検証・JWT 発行を担当する。
 * Controller は HTTP マッピングのみに留め、ここへ委譲する。
 */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  API_ERROR_CODES,
  createAuthTokenResponse,
  type AuthTokenResponse,
  type AuthUser,
} from '@market/shared-types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import type { LoginDto, RegisterDto } from './auth.dto';
import type { JwtPayload } from './auth.types';

/** bcrypt のコスト。開発・本番とも過度に遅くならない程度の既定値。 */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /** 新規ユーザーを登録し、即座にログイン可能な JWT を返す。 */
  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    const existing = await this.prismaService.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      // メール列挙を完全には防げないが、明示的な衝突として扱う（Phase 1 の単純さ優先）
      throw new ConflictException({
        code: API_ERROR_CODES.AUTH_EMAIL_TAKEN,
        message: 'Email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prismaService.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
      },
    });

    return this.issueToken({ id: user.id, email: user.email });
  }

  /** メール/パスワードでログインし JWT を返す。失敗理由は一律にする。 */
  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const matched = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    return this.issueToken({ id: user.id, email: user.email });
  }

  /** トークンの sub から現在のユーザー要約を返す（削除済みは未認証扱い）。 */
  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'User not found',
      });
    }

    return { id: user.id, email: user.email };
  }

  /** JwtPayload を署名して AuthTokenResponse を組み立てる。 */
  private issueToken(user: AuthUser): AuthTokenResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    return createAuthTokenResponse(accessToken, user);
  }
}
