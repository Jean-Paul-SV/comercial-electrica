import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export type OnboardingStatusResponse = {
  status: OnboardingStatus;
  step: 1 | 2 | 3;
  hasOpenCashSession: boolean;
  hasAtLeastOneProduct: boolean;
  checklist: OnboardingChecklistItem[];
};

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<OnboardingStatusResponse> {
    const [user, openSessionsCount, totalSessionsCount, productsCount] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { onboardingStatus: true } as { onboardingStatus?: boolean },
        }),
        this.prisma.cashSession.count({
          where: { closedAt: null },
        }),
        this.prisma.cashSession.count(),
        this.prisma.product.count({ where: { isActive: true } }),
      ]);

    const hasOpenCashSession = openSessionsCount > 0;
    const hasAtLeastOneProduct = productsCount > 0;

    type UserWithOnboarding = { onboardingStatus?: string | null } | null;
    const stored =
      ((user as UserWithOnboarding)?.onboardingStatus as OnboardingStatus | null) ?? null;
    let status: OnboardingStatus =
      stored ?? (totalSessionsCount === 0 && productsCount === 0 ? 'not_started' : 'in_progress');
    if (!stored && totalSessionsCount > 0) status = 'in_progress';

    let step: 1 | 2 | 3 = 1;
    if (status === 'completed' || status === 'skipped') {
      step = 3;
    } else if (status === 'in_progress' || status === 'not_started') {
      if (!hasOpenCashSession) step = 1;
      else if (!hasAtLeastOneProduct) step = 2;
      else step = 3;
    }

    const checklist: OnboardingChecklistItem[] = [
      {
        id: 'cash',
        label: 'Abre la caja para poder registrar ventas.',
        done: hasOpenCashSession,
        href: '/cash',
      },
      {
        id: 'product',
        label: 'Agrega al menos un producto para vender.',
        done: hasAtLeastOneProduct,
        href: '/products',
      },
    ];

    return {
      status,
      step,
      hasOpenCashSession,
      hasAtLeastOneProduct,
      checklist,
    };
  }

  async updateStatus(
    userId: string,
    status: 'in_progress' | 'completed' | 'skipped',
  ): Promise<{ status: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStatus: status,
        onboardingCompletedAt:
          status === 'completed' ? new Date() : undefined,
      } as { onboardingStatus?: string; onboardingCompletedAt?: Date },
    });
    return { status };
  }
}
