import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio para validar límites de negocio
 * Límites configurables desde variables de entorno
 */
@Injectable()
export class ValidationLimitsService {
  constructor(private readonly config: ConfigService) {}

  // Límites de inventario
  private get MAX_INVENTORY_QTY(): number {
    return this.config.get<number>('MAX_INVENTORY_QTY', 1000000);
  }

  private get MIN_INVENTORY_QTY(): number {
    return this.config.get<number>('MIN_INVENTORY_QTY', 0);
  }

  // Límites de caja
  private get MAX_CASH_AMOUNT(): number {
    return this.config.get<number>('MAX_CASH_AMOUNT', 100000000);
  }

  private get MIN_CASH_AMOUNT(): number {
    return this.config.get<number>('MIN_CASH_AMOUNT', 0);
  }

  private get MAX_OPENING_AMOUNT(): number {
    return this.config.get<number>('MAX_OPENING_AMOUNT', 50000000);
  }

  // Límites de ventas/cotizaciones
  private get MAX_ITEMS_PER_SALE(): number {
    return this.config.get<number>('MAX_ITEMS_PER_SALE', 100);
  }

  private get MAX_ITEMS_PER_QUOTE(): number {
    return this.config.get<number>('MAX_ITEMS_PER_QUOTE', 100);
  }

  private get MAX_ITEMS_PER_PURCHASE(): number {
    return this.config.get<number>('MAX_ITEMS_PER_PURCHASE', 100);
  }

  private get MAX_QTY_PER_ITEM(): number {
    return this.config.get<number>('MAX_QTY_PER_ITEM', 10000);
  }

  /**
   * Valida cantidad en movimiento de inventario
   */
  validateInventoryQty(qty: number, _type: 'IN' | 'OUT' | 'ADJUST'): void {
    if (qty < this.MIN_INVENTORY_QTY) {
      throw new BadRequestException(
        `La cantidad mínima permitida es ${this.MIN_INVENTORY_QTY}`,
      );
    }
    if (qty > this.MAX_INVENTORY_QTY) {
      throw new BadRequestException(
        `La cantidad máxima permitida es ${this.MAX_INVENTORY_QTY}`,
      );
    }
  }

  /**
   * Valida monto de caja
   */
  validateCashAmount(amount: number, operation: 'opening' | 'movement'): void {
    const min = this.MIN_CASH_AMOUNT;
    const max =
      operation === 'opening' ? this.MAX_OPENING_AMOUNT : this.MAX_CASH_AMOUNT;

    if (amount < min) {
      throw new BadRequestException(
        `El monto mínimo permitido es ${min.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
        })}`,
      );
    }
    if (amount > max) {
      throw new BadRequestException(
        `El monto máximo permitido es ${max.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
        })}`,
      );
    }
  }

  /**
   * Valida cantidad de items en venta/cotización/pedido de compra
   */
  validateItemsCount(count: number, type: 'sale' | 'quote' | 'purchase'): void {
    const max =
      type === 'sale'
        ? this.MAX_ITEMS_PER_SALE
        : type === 'quote'
          ? this.MAX_ITEMS_PER_QUOTE
          : this.MAX_ITEMS_PER_PURCHASE;
    if (count > max) {
      throw new BadRequestException(
        `El máximo de items permitidos es ${max} (tipo: ${type})`,
      );
    }
  }

  /**
   * Valida cantidad por item
   */
  validateItemQty(qty: number): void {
    if (qty < 1) {
      throw new BadRequestException('La cantidad mínima por item es 1');
    }
    if (qty > this.MAX_QTY_PER_ITEM) {
      throw new BadRequestException(
        `La cantidad máxima por item es ${this.MAX_QTY_PER_ITEM}`,
      );
    }
  }

  /**
   * Valida fecha de validez de cotización
   */
  validateQuoteValidUntil(validUntil: Date): void {
    const now = new Date();
    if (validUntil < now) {
      throw new BadRequestException(
        'La fecha de validez no puede ser en el pasado',
      );
    }
  }
}
