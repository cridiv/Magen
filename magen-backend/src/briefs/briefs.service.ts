import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BriefsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit

    const [briefs, total] = await Promise.all([
      this.prisma.memeBrief.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.memeBrief.count(),
    ])

    return {
      data: briefs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}