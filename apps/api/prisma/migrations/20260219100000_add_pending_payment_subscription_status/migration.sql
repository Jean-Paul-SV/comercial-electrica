-- AlterEnum: añadir PENDING_PAYMENT para bloquear app hasta primer pago
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING_PAYMENT';
