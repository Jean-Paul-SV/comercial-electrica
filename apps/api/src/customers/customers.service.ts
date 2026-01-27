import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.customer.findMany({ orderBy: { name: 'asc' } });
  }

  async get(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    return c;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        docType: dto.docType,
        docNumber: dto.docNumber.trim(),
        name: dto.name.trim(),
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        address: dto.address,
        cityCode: dto.cityCode,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.get(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        docType: dto.docType ?? undefined,
        docNumber: dto.docNumber?.trim(),
        name: dto.name?.trim(),
        email: dto.email?.toLowerCase(),
        phone: dto.phone ?? undefined,
        address: dto.address ?? undefined,
        cityCode: dto.cityCode ?? undefined,
      },
    });
  }
}
