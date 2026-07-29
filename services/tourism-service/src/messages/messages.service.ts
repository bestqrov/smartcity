import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageDto, senderId: string, senderRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.prisma.message.create({
      data: {
        bookingId: dto.bookingId,
        text: dto.text,
        senderId,
        senderRole,
        readAt: null,
      },
    });
  }

  async findByBooking(bookingId: string, readerRole: 'GUEST' | 'STAFF') {
    const messages = await this.prisma.message.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    const otherSide = readerRole === 'GUEST' ? 'STAFF' : 'GUEST';
    await this.prisma.message.updateMany({
      where: { bookingId, senderRole: otherSide, readAt: null },
      data: { readAt: new Date() },
    });

    return messages;
  }

  async unreadCountForTenant(tenantId: string) {
    return this.prisma.message.count({
      where: {
        senderRole: 'GUEST',
        readAt: null,
        booking: { hotel: { tenantId } },
      },
    });
  }

  async findConversationsForTenant(tenantId: string) {
    const messages = await this.prisma.message.findMany({
      where: { booking: { hotel: { tenantId } } },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            guest: { select: { firstName: true, lastName: true } },
            hotel: { select: { name: true } },
          },
        },
      },
    });

    const conversations = new Map<string, any>();
    for (const message of messages) {
      if (!conversations.has(message.bookingId)) {
        conversations.set(message.bookingId, {
          bookingId: message.bookingId,
          guest: message.booking.guest,
          hotel: message.booking.hotel,
          lastMessage: message.text,
          lastMessageAt: message.createdAt,
          unreadCount: 0,
        });
      }
      if (message.senderRole === 'GUEST' && !message.readAt) {
        conversations.get(message.bookingId).unreadCount += 1;
      }
    }

    return Array.from(conversations.values());
  }
}
